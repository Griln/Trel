import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

const WIN_LONG_PATH_PREFIX = '\\\\?\\';
const MAX_WIN_PATH = 240;

const _ntPathCache = new Map<string, string>();
function ntPath(p: string): string {
  if (process.platform !== 'win32') return p;
  const cached = _ntPathCache.get(p);
  if (cached !== undefined) return cached;
  if (p.startsWith(WIN_LONG_PATH_PREFIX)) return p;
  const normalized = path.normalize(p);
  let out: string;
  if (normalized.length > MAX_WIN_PATH) {
    if (normalized.startsWith('\\\\')) out = '\\\\?\\UNC\\' + normalized.slice(2).replace(/\//g, '\\');
    else out = WIN_LONG_PATH_PREFIX + normalized.replace(/\//g, '\\');
  } else {
    out = normalized;
  }
  _ntPathCache.set(p, out);
  return out;
}

export type ImportCategory =
  | 'accounts'
  | 'worlds'
  | 'mods'
  | 'shaderpacks'
  | 'resourcepacks'
  | 'texturepacks'
  | 'servers'
  | 'screenshots'
  | 'options'
  | 'config'
  | 'datapacks'
  | 'stats'
  | 'advancements'
  | 'logs'
  | 'scripts'
  | 'defaultconfigs'
  | 'backups'
  | 'local'
  | 'usercache'
  | 'world_templates'
  | 'resources'
  | 'pin'
  | 'version-content'
  | 'pack-meta'
  | 'assets'
  | 'libraries'
  | 'skin-cache'
  | 'log-configs'
  | 'version-install';

export type SourceKind = 'java' | 'bedrock';

export interface DetectedSource {
  id: string;
  label: string;
  rootDir: string;
  available: ImportCategory[];
  approxSize: number;
  kind: SourceKind;
  installableVersions?: string[];
  mojangOnlyBedrock?: boolean;
}

export interface ImportPlan {
  sourceId: string;
  sourceRootDir?: string;
  categories: ImportCategory[];
  deduplicate?: boolean;
}

export interface ImportReport {
  copied: Partial<Record<ImportCategory, number>>;
  skipped: Partial<Record<ImportCategory, number>>;
  newAccounts: string[];
  installedVersions: string[];
  errors: string[];
  warnings: string[];
}

type ProgressCallback = (current: number, total: number, stage: string) => void;
type VersionInstaller = (versionId: string) => Promise<void>;

interface CacheEntry {
  sources: DetectedSource[];
  timestamp: number;
}

let _detectCache: CacheEntry | null = null;
const DETECT_CACHE_TTL = 30_000;

// ─── Helpers ────────────────────────────────────────────────────────────

function baseSearchPaths(): { appdata: string; userprofile: string; home: string } {
  const home = os.homedir();
  const appdata =
    process.env.APPDATA ||
    (process.platform === 'darwin'
      ? path.join(home, 'Library', 'Application Support')
      : path.join(home, '.config'));
  const userprofile = process.env.USERPROFILE || home;
  return { appdata, userprofile, home };
}

function safeStat(p: string): fs.Stats | null {
  try { return fs.statSync(ntPath(p)); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.warn(`[import] safeStat ${p}:`, (e as Error).message); return null; }
}

function safeReaddir(p: string): string[] {
  try { return fs.readdirSync(ntPath(p)); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.warn(`[import] safeReaddir ${p}:`, (e as Error).message); return []; }
}

function readJson(p: string): unknown | null {
  try { return JSON.parse(fs.readFileSync(ntPath(p), 'utf-8')); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.warn(`[import] readJson ${p}:`, (e as Error).message); return null; }
}

interface CopySpec {
  from: string[];
  to?: string[];
}

const CATEGORY_DIRS: Record<string, CopySpec[]> = {
  worlds: [{ from: ['saves'] }],
  mods: [{ from: ['mods'] }],
  shaderpacks: [{ from: ['shaderpacks'] }],
  resourcepacks: [{ from: ['resourcepacks'] }],
  texturepacks: [{ from: ['texturepacks'] }],
  screenshots: [{ from: ['screenshots'] }],
  config: [{ from: ['config'] }],
  datapacks: [{ from: ['datapacks'] }],
  stats: [{ from: ['stats'] }],
  advancements: [{ from: ['advancements'] }],
  logs: [{ from: ['logs'] }, { from: ['crash-reports'] }],
  scripts: [{ from: ['scripts'] }, { from: ['kubejs'] }],
  defaultconfigs: [{ from: ['defaultconfigs'] }],
  backups: [{ from: ['backups'] }],
  local: [{ from: ['local'] }],
  world_templates: [{ from: ['world_templates'] }],
  resources: [{ from: ['resources'] }],
  pin: [{ from: ['pin'] }],
  assets: [{ from: ['assets'] }],
  libraries: [{ from: ['libraries'] }],
  'skin-cache': [{ from: ['assets', 'skins'] }],
  'log-configs': [{ from: ['assets', 'log_configs'] }],
  usercache: [],
  servers: [],
  options: [],
  accounts: [],
  'version-content': [],
  'pack-meta': [],
  'version-install': [],
};

const BEDROCK_DIRS: Record<string, CopySpec[]> = {
  worlds: [{ from: ['minecraftWorlds'] }],
  resourcepacks: [{ from: ['resource_packs'] }],
};

function dirSize(dir: string, maxDepth: number): number {
  if (maxDepth <= 0) return 0;
  let total = 0;
  for (const name of safeReaddir(dir)) {
    if (JUNK_NAMES.has(name)) continue;
    const st = safeStat(path.join(dir, name));
    if (!st) continue;
    if (st.isDirectory()) total += dirSize(path.join(dir, name), maxDepth - 1);
    else total += st.size;
  }
  return total;
}

function countFilesRecursive(dir: string, depth: number): number {
  if (depth <= 0) return 0;
  let count = 0;
  for (const name of safeReaddir(dir)) {
    if (JUNK_NAMES.has(name)) continue;
    const full = path.join(dir, name);
    const st = safeStat(full);
    if (!st) continue;
    if (st.isDirectory()) count += countFilesRecursive(full, depth - 1);
    else count++;
  }
  return count;
}

function rmTrelTmps(dir: string): void {
  if (!safeStat(dir)?.isDirectory()) return;
  if (dir.length < 5) return;  // safety: don't scan filesystem roots
  for (const n of safeReaddir(dir)) {
    const full = path.join(dir, n);
    if (n.endsWith('.trel_tmp')) { try { fs.unlinkSync(ntPath(full)); } catch {} }
    else if (safeStat(full)?.isDirectory()) rmTrelTmps(full);
  }
}

// ─── Symlink / junction safety ────────────────────────────────────────

function isSymlinkOrJunction(p: string, expectedRoot?: string): boolean {
  try {
    const lSt = fs.lstatSync(ntPath(p));
    if (lSt.isSymbolicLink()) return true;
    // Junction detection via realpath diversion: if realpath differs from
    // the path itself and points outside expectedRoot, treat as redirect.
    if (expectedRoot && lSt.isDirectory()) {
      const real = realpathSafe(p);
      const base = realpathSafe(expectedRoot);
      if (real && base && !real.startsWith(base + path.sep) && real !== base) return true;
    }
  } catch {}
  return false;
}

function realpathSafe(p: string): string | null {
  try { return fs.realpathSync(ntPath(p)); } catch { return null; }
}

/**
 * Returns true if `candidate` resolves to a path inside `root`.
 * Used to verify that a symlink/junction target stays within the game dir.
 */
function isInsideDir(candidate: string, root: string): boolean {
  const real = realpathSafe(candidate);
  if (!real) return false;
  const resolvedRoot = realpathSafe(root) ?? path.resolve(root);
  const sep = path.sep;
  return real === resolvedRoot || real.startsWith(resolvedRoot + sep);
}

function resolveDestPath(destDir: string, name: string, taken?: Set<string>): string {
  let to = path.join(destDir, name);
  const ci = process.platform === 'win32' || process.platform === 'darwin';
  const norm = ci ? to.toLowerCase() : to;
  if (!fs.existsSync(ntPath(to)) && !taken?.has(norm)) return to;
  const dotIdx = name.lastIndexOf('.');
  const ext = dotIdx > 0 ? name.slice(dotIdx) : '';
  const stem = dotIdx > 0 ? name.slice(0, dotIdx) : name;
  const m = stem.match(/^(.*) \((\d+)\)$/);
  const base = m ? m[1] : stem;
  let n = m ? parseInt(m[2], 10) : 1;
  to = path.join(destDir, `${base} (${n})${ext}`);
  while (fs.existsSync(ntPath(to)) || taken?.has(ci ? to.toLowerCase() : to)) { n++; to = path.join(destDir, `${base} (${n})${ext}`); }
  return to;
}

function approxSizeOf(rootDir: string, categories: ImportCategory[], bedrock = false): number {
  let total = 0;
  const DIRS = bedrock ? BEDROCK_DIRS : CATEGORY_DIRS;
  for (const cat of categories) {
    if (cat === 'accounts' || cat === 'servers' || cat === 'options' || cat === 'usercache' ||
        cat === 'version-install' || cat === 'version-content' || cat === 'pack-meta') {
      total += fileSizeInRoot(rootDir, cat);
      continue;
    }
    for (const spec of DIRS[cat] ?? []) {
      const dir = path.join(rootDir, ...spec.from);
      total += dirSize(dir, cat === 'worlds' ? 3 : 2);
    }
  }
  return total;
}

function fileSizeInRoot(rootDir: string, cat: ImportCategory): number {
  switch (cat) {
    case 'accounts': {
      let total = 0;
      for (const f of ['launcher_accounts.json', 'launcher_profiles.json', 'TLauncherProfile.json', 'sklauncher_accounts.json']) {
        const st = safeStat(path.join(rootDir, f));
        if (st) total += st.size;
      }
      return total;
    }
    case 'servers': {
      let total = 0;
      for (const f of ['servers.dat', 'servers.dat_old']) {
        const st = safeStat(path.join(rootDir, f));
        if (st) total += st.size;
      }
      return total;
    }
    case 'options': {
      let total = 0;
      for (const f of ['options.txt', 'controls.txt', 'hotbar.nbt', 'optionsshaders.txt',
        'optionsof.txt', 'resourcepacks.txt', 'user_jvm_args.txt', 'note.txt',
        'splashes.txt', 'allowed_symlinks.txt']) {
        const st = safeStat(path.join(rootDir, f));
        if (st) total += st.size;
      }
      return total;
    }
    case 'usercache': {
      let total = 0;
      for (const f of ['usercache.json', 'usernamecache.json']) {
        const st = safeStat(path.join(rootDir, f));
        if (st) total += st.size;
      }
      return total;
    }
    case 'version-content': {
      let total = 0;
      const vDir = path.join(rootDir, 'versions');
      if (safeStat(vDir)?.isDirectory()) {
        for (const ver of safeReaddir(vDir)) {
          for (const sub of VERSION_CONTENT_SUBS) {
            const subDir = path.join(vDir, ver, sub);
            if (safeStat(subDir)?.isDirectory()) total += dirSize(subDir, 2);
          }
        }
      }
      return total;
    }
    case 'pack-meta': {
      let total = 0;
      for (const f of ['mmc-pack.json', 'instance.cfg', 'manifest.json', 'minecraftinstance.json', 'modrinth.index.json']) {
        const st = safeStat(path.join(rootDir, f));
        if (st) total += st.size;
      }
      return total;
    }
    case 'version-install': {
      const vDir = path.join(rootDir, 'versions');
      if (!safeStat(vDir)?.isDirectory()) return 0;
      let bytes = 0;
      for (const ver of safeReaddir(vDir)) { bytes += dirSize(path.join(vDir, ver), 3); }
      return bytes;
    }
    default: return 0;
  }
}

// ─── Per-version content ────────────────────────────────────────────────

const VERSION_CONTENT_SUBS = ['mods', 'shaderpacks', 'resourcepacks', 'texturepacks', 'config', 'datapacks'];

const JUNK_NAMES = new Set(['.git', '.svn', '.hg', '__MACOSX', '.DS_Store', 'Thumbs.db', 'desktop.ini', 'node_modules']);

const SYSTEM_DENYLIST = new Set([
  'c:\\windows', 'c:\\program files', 'c:\\program files (x86)',
  'c:\\programdata', 'c:\\$recycle.bin', 'c:\\system volume information',
  '/etc', '/usr', '/bin', '/sbin', '/var', '/proc', '/sys', '/dev', '/boot',
]);

function isPathAllowed(dir: string): boolean {
  const resolved = path.resolve(dir).toLowerCase();
  if (resolved.length < 3) return false;
  for (const denied of SYSTEM_DENYLIST) {
    if (resolved === denied || resolved.startsWith(denied + path.sep)) return false;
  }
  // Block network paths
  if (resolved.startsWith('\\\\')) return false;
  return true;
}

function hasVersionContent(rootDir: string): boolean {
  const vDir = path.join(rootDir, 'versions');
  if (!safeStat(vDir)?.isDirectory()) return false;
  for (const ver of safeReaddir(vDir)) {
    for (const sub of VERSION_CONTENT_SUBS) {
      const subDir = path.join(vDir, ver, sub);
      if (safeStat(subDir)?.isDirectory() && safeReaddir(subDir).some(n => !JUNK_NAMES.has(n))) return true;
    }
  }
  return false;
}

// ─── Category detection ─────────────────────────────────────────────────

function availableCategories(rootDir: string, bedrock = false): ImportCategory[] {
  const out: ImportCategory[] = [];
  if (bedrock) {
    for (const [cat, specs] of Object.entries(BEDROCK_DIRS)) {
      for (const spec of specs) {
        const dir = path.join(rootDir, ...spec.from);
        if (safeStat(dir)?.isDirectory() && safeReaddir(dir).some(n => !JUNK_NAMES.has(n))) {
          if (!out.includes(cat as ImportCategory)) out.push(cat as ImportCategory);
        }
      }
    }
    return out;
  }

  // Accounts from multiple launcher files
  for (const f of ['launcher_accounts.json', 'launcher_profiles.json', 'TLauncherProfile.json', 'sklauncher_accounts.json']) {
    if (safeStat(path.join(rootDir, f))) { out.push('accounts'); break; }
  }

  // Servers
  if (safeStat(path.join(rootDir, 'servers.dat')) || safeStat(path.join(rootDir, 'servers.dat_old'))) out.push('servers');

  // Options / config files in root
  const hasOptions = ['options.txt', 'controls.txt', 'hotbar.nbt', 'optionsshaders.txt',
    'optionsof.txt', 'resourcepacks.txt', 'user_jvm_args.txt', 'note.txt',
    'splashes.txt', 'allowed_symlinks.txt']
    .some(f => safeStat(path.join(rootDir, f)));
  if (hasOptions) out.push('options');

  // User cache
  if (safeStat(path.join(rootDir, 'usercache.json')) || safeStat(path.join(rootDir, 'usernamecache.json'))) out.push('usercache');

  // Pack metadata
  for (const f of ['mmc-pack.json', 'instance.cfg', 'manifest.json', 'minecraftinstance.json', 'modrinth.index.json']) {
    if (safeStat(path.join(rootDir, f))) { out.push('pack-meta'); break; }
  }

  // Per-version content
  if (hasVersionContent(rootDir)) out.push('version-content');

  // Subfolder checks
  for (const [cat, specs] of Object.entries(CATEGORY_DIRS)) {
    if (cat === 'accounts' || cat === 'servers' || cat === 'options' || cat === 'usercache' ||
        cat === 'version-content' || cat === 'pack-meta') continue;
    for (const spec of specs) {
      const dir = path.join(rootDir, ...spec.from);
      if (safeStat(dir)?.isDirectory() && safeReaddir(dir).some(n => !JUNK_NAMES.has(n))) {
        if (!out.includes(cat as ImportCategory)) out.push(cat as ImportCategory);
      }
    }
  }

  const installable = detectInstallableVersions(rootDir);
  if (installable.length > 0) out.push('version-install');

  return out;
}

// ─── Installable version detection ──────────────────────────────────────

export function detectInstallableVersions(rootDir: string): string[] {
  const vDir = path.join(rootDir, 'versions');
  if (!safeStat(vDir)?.isDirectory()) return [];
  const ids: string[] = [];
  for (const name of safeReaddir(vDir)) {
    const verDir = path.join(vDir, name);
    if (!safeStat(verDir)?.isDirectory()) continue;
    const jsonPath = path.join(verDir, name + '.json');
    const j = readJson(jsonPath) as Record<string, unknown> | null;
    if (!j) continue;
    const hasMain = typeof j.mainClass === 'string' && j.mainClass !== '';
    const hasParent = typeof j.inheritsFrom === 'string';
    if (!hasMain && !hasParent) continue;
    // Version folders with inheritsFrom may not have their own jar —
    // they inherit it from the parent. Don't filter them out.
    if (!hasParent) {
      const jarPath = path.join(verDir, name + '.jar');
      if (!safeStat(jarPath)?.isFile()) continue;
    }
    const id = typeof j.id === 'string' && j.id !== '' ? j.id : name;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

// ─── Dedup / copy depth constants ────────────────────────────────────────
const MAX_COPY_DEPTH = 32;
const DEDUP_HASH_DEPTH = MAX_COPY_DEPTH;

// ─── SHA-1 dedup (async) ────────────────────────────────────────────────

async function fileSha1(filePath: string): Promise<string | null> {
  try {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(ntPath(filePath));
    for await (const chunk of stream) hash.update(chunk as Buffer);
    return hash.digest('hex');
  } catch { return null; }
}

async function buildExistingHashes(dir: string, depth: number): Promise<Set<string>> {
  const hashes = new Set<string>();
  if (depth <= 0 || !safeStat(dir)?.isDirectory()) return hashes;
  for (const name of safeReaddir(dir)) {
    if (JUNK_NAMES.has(name)) continue;
    const full = path.join(dir, name);
    const st = safeStat(full);
    if (!st) continue;
    if (st.isDirectory()) {
      const sub = await buildExistingHashes(full, depth - 1);
      for (const h of sub) hashes.add(h);
    } else {
      const h = await fileSha1(full);
      if (h) hashes.add(h);
    }
  }
  return hashes;
}

// ─── Async copy with progress ───────────────────────────────────────────

  interface CopyResult { copied: number; skipped: number; errors: string[]; warnings: string[] }

async function copyTreeNoOverwrite(
  src: string, dest: string,
  dedupHashes?: Set<string>,
  onProgress?: (copied: number) => void,
  signal?: AbortSignal,
): Promise<CopyResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let copied = 0;
  let skipped = 0;
  try { await fsp.mkdir(ntPath(dest), { recursive: true }); } catch (e) {
    errors.push(`mkdir "${dest}": ${(e as Error).message}`);
    return { copied, skipped, errors, warnings };
  }
  const names = safeReaddir(src).filter(n => !JUNK_NAMES.has(n));
  if (names.length === 0) { return { copied, skipped, errors, warnings }; }
  // Pre-compute all destinations serially to avoid rename race conditions
  const entries: Array<{ from: string; to: string; isDir: boolean }> = [];
  const taken = new Set<string>();
  for (const name of names) {
    const from = path.join(src, name);
    const st = safeStat(from);
    if (!st) continue;
    // Block symlink / junction traversal (lstat + realpath)
    if (isSymlinkOrJunction(from)) {
      warnings.push(`skipping symlink/junction: ${path.relative(src, from)}`);
      continue;
    }
    const real = realpathSafe(from);
    if (real && !isInsideDir(real, src)) {
      warnings.push(`skipping escaped path: ${path.relative(src, from)} -> ${real}`);
      continue;
    }
    const to = resolveDestPath(dest, name, taken);
    taken.add(process.platform === 'win32' || process.platform === 'darwin' ? to.toLowerCase() : to);
    entries.push({ from, to, isDir: st.isDirectory() });
  }
  const BATCH_SIZE = 8;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    if (signal?.aborted) { errors.push('Import cancelled by user.'); break; }
    const batch = entries.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(async (e) => {
      try {
        // TOCTOU: re-check symlink right before copy
        if (isSymlinkOrJunction(e.from)) {
          warnings.push(`TOCTOU: symlink appeared before copy: ${path.relative(src, e.from)}`);
          return { c: 0, s: 0, errs: [] as string[] };
        }
        if (dedupHashes && !e.isDir) {
          const h = await fileSha1(e.from);
          if (h && dedupHashes.has(h)) return { c: 0, s: 1, errs: [] as string[] };
        }
        if (e.isDir) await copyDirAtomic(e.from, e.to, MAX_COPY_DEPTH, warnings, dedupHashes, signal);
        else {
          await copyFileAtomic(e.from, e.to);
          if (dedupHashes) {
            const h = await fileSha1(e.to);
            if (h) dedupHashes.add(h);
          }
        }
        return { c: 1, s: 0, errs: [] };
      } catch (e2) { return { c: 0, s: 0, errs: [`cp "${path.relative(path.dirname(src), e.from)}" -> "${path.relative(path.dirname(dest), e.to)}": ${(e2 as Error).message}`] }; }
    }));
    for (const r of results) {
      copied += r.c; skipped += r.s; errors.push(...r.errs);
    }
    onProgress?.(copied);
  }
  return { copied, skipped, errors, warnings };
}

async function copyFileIfExists(src: string, destDir: string, destName?: string, onProgress?: () => void, errors?: string[]): Promise<boolean> {
  if (!safeStat(src)) return false;
  try {
    await fsp.mkdir(ntPath(destDir), { recursive: true });
    const dest = resolveDestPath(destDir, destName || path.basename(src));
    await copyFileAtomic(src, dest);
    onProgress?.();
    return true;
  } catch (e) {
    errors?.push(`"${path.basename(src)}": ${(e as Error).message}`);
    return false;
  }
}

// ─── Atomic file/dir copy with retry ────────────────────────────────────

async function copyFileAtomic(src: string, dest: string): Promise<void> {
  const tmp = dest + '.trel_tmp';
  const MAX_ATTEMPTS = 3;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      await fsp.copyFile(ntPath(src), ntPath(tmp));
      await fsp.rename(ntPath(tmp), ntPath(dest));
      // Post-copy size verification (best-effort)
      try {
        const ss = await fsp.stat(ntPath(src)), ds = await fsp.stat(ntPath(dest));
        if (ds.size !== ss.size) throw new Error(`[CORRUPT] size mismatch: ${ss.size} source vs ${ds.size} dest`);
      } catch (ve) {
        if ((ve as Error).message.startsWith('[CORRUPT]')) throw ve;
        // stat failure itself is not fatal — the file was already written
      }
      return;
    } catch (e) {
      try { await fsp.unlink(ntPath(tmp)); } catch {}
      // [CORRUPT] is never transient — remove dest, drop retry
      if ((e as Error).message.startsWith('[CORRUPT]')) {
        try { await fsp.unlink(ntPath(dest)); } catch {}
        throw e;
      }
      if (i === MAX_ATTEMPTS - 1) {
        const err = e as NodeJS.ErrnoException;
        if (err.code === 'ENOSPC') throw new Error(`[DISK_FULL] ${path.basename(src)}: no space left on device`);
        if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') throw new Error(`[LOCKED] ${path.basename(src)}: ${err.message}`);
        throw e;
      }
      const err = e as NodeJS.ErrnoException;
      if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') {
        await new Promise(r => setTimeout(r, 200 * (i + 1)));
      } else { throw e; }
    }
  }
}

async function copyDirAtomic(
  src: string, dest: string, maxDepth = MAX_COPY_DEPTH, warnings?: string[],
  dedupHashes?: Set<string>, signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) return;
  if (maxDepth <= 0) { warnings?.push(`max depth exceeded at ${path.relative(path.dirname(src), src)}`); return; }
  await fsp.mkdir(ntPath(dest), { recursive: true });
  const names = safeReaddir(src);
  for (const name of names) {
    if (signal?.aborted) return;
    if (JUNK_NAMES.has(name)) continue;
    const from = path.join(src, name);
    const st = safeStat(from);
    if (!st) continue;
    // Block symlink / junction (lstat + realpath)
    if (isSymlinkOrJunction(from)) {
      warnings?.push(`skipping symlink/junction: ${path.relative(src, from)}`);
      continue;
    }
    const real = realpathSafe(from);
    if (real && !isInsideDir(real, src)) {
      warnings?.push(`skipping escaped path: ${path.relative(src, from)} -> ${real}`);
      continue;
    }
    // TOCTOU: re-check just before copy
    if (isSymlinkOrJunction(from)) {
      warnings?.push(`TOCTOU: symlink appeared before copy: ${path.relative(src, from)}`);
      continue;
    }
    const to = resolveDestPath(dest, name);
    if (st.isDirectory()) {
      await copyDirAtomic(from, to, maxDepth - 1, warnings, dedupHashes, signal);
    } else {
      if (dedupHashes) {
        const h = await fileSha1(from);
        if (h && dedupHashes.has(h)) continue;
      }
      await copyFileAtomic(from, to);
      if (dedupHashes) {
        const h = await fileSha1(to);
        if (h) dedupHashes.add(h);
      }
    }
  }
}

// ─── Accounts extraction ────────────────────────────────────────────────

function extractOfflineNames(rootDir: string): string[] {
  const names = new Set<string>();
  try {
    const j = JSON.parse(fs.readFileSync(ntPath(path.join(rootDir, 'launcher_accounts.json')), 'utf-8')) as any;
    for (const k of Object.keys(j.accounts ?? {})) {
      const a = j.accounts[k];
      if (a?.minecraftProfile?.name) names.add(a.minecraftProfile.name);
      else if (a?.username) names.add(a.username);
    }
  } catch {}
  try {
    const j = JSON.parse(fs.readFileSync(ntPath(path.join(rootDir, 'launcher_profiles.json')), 'utf-8')) as any;
    const auth = j.authenticationDatabase ?? {};
    for (const k of Object.keys(auth)) { const a = auth[k]; const profiles = a?.profiles ?? {};
      for (const pk of Object.keys(profiles)) { const name = profiles[pk]?.displayName ?? profiles[pk]?.name; if (name) names.add(name); }
      if (a?.displayName) names.add(a.displayName); }
  } catch {}
  try { const tl = JSON.parse(fs.readFileSync(ntPath(path.join(rootDir, 'TLauncherProfile.json')), 'utf-8')) as any; if (tl?.lastUsername) names.add(tl.lastUsername); if (Array.isArray(tl?.users)) for (const u of tl.users) { if (u?.username) names.add(u.username); } } catch {}
  try { const sk = JSON.parse(fs.readFileSync(ntPath(path.join(rootDir, 'sklauncher_accounts.json')), 'utf-8')) as any; for (const k of Object.keys(sk)) { if (sk[k]?.username) names.add(sk[k].username); } } catch {}
  return Array.from(names).filter((n) => /^[a-zA-Z0-9_]{1,16}$/.test(n));
}

// ─── Source detection ───────────────────────────────────────────────────

export function detectSources(): DetectedSource[] {
  const now = Date.now();
  if (_detectCache && (now - _detectCache.timestamp) < DETECT_CACHE_TTL) return _detectCache.sources;
  const { appdata, userprofile } = baseSearchPaths();
  const sources: DetectedSource[] = [];

  const flatRoots: Array<{ id: string; label: string; dir: string }> = [
    { id: 'mojang',    label: 'Mojang Launcher',  dir: path.join(appdata, '.minecraft') },
    { id: 'tlauncher', label: 'TLauncher',        dir: path.join(appdata, 'TLauncher', '.minecraft') },
    { id: 'atlauncher', label: 'ATLauncher',      dir: path.join(appdata, 'ATLauncher', '.minecraft') },
    { id: 'legacy',    label: '.minecraft (home)', dir: path.join(userprofile, '.minecraft') },
    { id: 'sklauncher', label: 'SKlauncher',      dir: path.join(appdata, 'SKlauncher', '.minecraft') },
    { id: 'crystal',   label: 'Crystal Launcher', dir: path.join(appdata, 'CrystalLauncher', '.minecraft') },
  ];
  for (const r of flatRoots) {
    if (!safeStat(r.dir)?.isDirectory()) continue;
    const installableVersions = detectInstallableVersions(r.dir);
    const cats = availableCategories(r.dir);
    if (cats.length === 0) continue;
    sources.push({ id: r.id, label: r.label, rootDir: r.dir, available: cats, approxSize: approxSizeOf(r.dir, cats), kind: 'java', installableVersions });
  }

  const instanceRoots: Array<{ idPrefix: string; labelPrefix: string; parent: string; instanceSub?: string; recursive?: boolean }> = [
    { idPrefix: 'prism',      labelPrefix: 'Prism',       parent: path.join(appdata, 'PrismLauncher', 'instances'), instanceSub: '.minecraft' },
    { idPrefix: 'polymc',     labelPrefix: 'PolyMC',      parent: path.join(appdata, 'PolyMC', 'instances'),        instanceSub: '.minecraft' },
    { idPrefix: 'pollymc',    labelPrefix: 'PollyMC',     parent: path.join(appdata, 'PollyMC', 'instances'),       instanceSub: '.minecraft' },
    { idPrefix: 'multimc',    labelPrefix: 'MultiMC',     parent: path.join(appdata, 'MultiMC', 'instances'),        instanceSub: '.minecraft' },
    { idPrefix: 'curseforge', labelPrefix: 'CurseForge',  parent: path.join(userprofile, 'curseforge', 'minecraft', 'Instances'), recursive: true },
    { idPrefix: 'gd',         labelPrefix: 'GDLauncher',  parent: path.join(appdata, 'gdlauncher_next', 'instances') },
    { idPrefix: 'modrinth',   labelPrefix: 'Modrinth',    parent: path.join(appdata, 'com.modrinth.theseus', 'profiles') },
    { idPrefix: 'hmcl',       labelPrefix: 'HMCL',        parent: path.join(appdata, 'hmcl', '.minecraft', 'versions') },
    { idPrefix: 'technic',    labelPrefix: 'Technic',     parent: path.join(appdata, 'technic', 'modpacks') },
    { idPrefix: 'legacyfabric', labelPrefix: 'Legacy Fabric', parent: path.join(appdata, 'LegacyFabric', 'instances'), instanceSub: '.minecraft' },
    { idPrefix: 'labymod',    labelPrefix: 'LabyMod',     parent: path.join(appdata, 'LabyMod', 'instances'), instanceSub: '.minecraft' },
  ];
  for (const r of instanceRoots) {
    if (!safeStat(r.parent)?.isDirectory()) continue;
    const names = r.recursive ? collectNestedDirs(r.parent) : safeReaddir(r.parent);
    for (const name of names) {
      const instRoot = path.join(r.parent, name);
      if (!safeStat(instRoot)?.isDirectory()) continue;
      const root = r.instanceSub && safeStat(path.join(instRoot, r.instanceSub)) ? path.join(instRoot, r.instanceSub) : instRoot;
      const installableVersions = detectInstallableVersions(root);
      const cats = availableCategories(root);
      if (cats.length === 0) continue;
      sources.push({ id: `${r.idPrefix}:${name}`, label: `${r.labelPrefix}: ${name}`, rootDir: root, available: cats, approxSize: approxSizeOf(root, cats), kind: 'java', installableVersions });
    }
  }

  const JAVA_GAME_CATS = new Set(['worlds', 'mods', 'shaderpacks', 'resourcepacks', 'texturepacks', 'screenshots', 'config', 'datapacks', 'scripts', 'defaultconfigs', 'backups', 'world_templates', 'resources', 'pin', 'version-content', 'version-install']);
  const mojangSource = sources.find(s => s.id === 'mojang');
  if (mojangSource) {
    mojangSource.mojangOnlyBedrock = !mojangSource.available.some(cat => JAVA_GAME_CATS.has(cat));
  }

  const bedrockRoot = detectBedrockRoot();
  if (bedrockRoot) {
    const cats = availableCategories(bedrockRoot, true);
    if (cats.length > 0) sources.push({ id: 'bedrock', label: 'Minecraft Bedrock Edition', rootDir: bedrockRoot, available: cats, approxSize: approxSizeOf(bedrockRoot, cats, true), kind: 'bedrock' });
  }

  sources.sort((a, b) => b.approxSize - a.approxSize);
  _detectCache = { sources, timestamp: now };
  return sources;
}

function collectNestedDirs(parent: string): string[] {
  const result: string[] = [];
  const walk = (dir: string, depth: number) => { if (depth > 3) return; for (const name of safeReaddir(dir)) { if (JUNK_NAMES.has(name)) continue; const full = path.join(dir, name); if (safeStat(full)?.isDirectory()) { result.push(path.relative(parent, full)); walk(full, depth + 1); } } };
  walk(parent, 0);
  return result;
}

function detectBedrockRoot(): string | null {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;
  try { for (const entry of fs.readdirSync(ntPath(path.join(localAppData, 'Packages')))) { if (entry.startsWith('Microsoft.MinecraftUWP_')) { const c = path.join(localAppData, 'Packages', entry, 'LocalState', 'games', 'com.mojang'); if (fs.existsSync(ntPath(c))) return c; } } } catch {}
  return null;
}

// ─── Perform import ─────────────────────────────────────────────────────

export async function performImport(
  plan: ImportPlan, source: DetectedSource, gameDir: string,
  addAccount: (name: string) => boolean,
  installVersion?: VersionInstaller,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<ImportReport> {
  const report: ImportReport = { copied: {}, skipped: {}, newAccounts: [], installedVersions: [], errors: [], warnings: [] };

  // Cleanup orphaned .trel_tmp from previous aborted runs
  try { rmTrelTmps(gameDir); } catch {}

  // Self-import / nesting guard: source must not be inside gameDir or vice versa
  const resolvedSource = path.resolve(source.rootDir);
  const resolvedGame = path.resolve(gameDir);
  const comparePaths = process.platform === 'win32'
    ? (a: string, b: string) => a.toLowerCase() === b.toLowerCase() || a.toLowerCase().startsWith(b.toLowerCase() + path.sep)
    : (a: string, b: string) => a === b || a.startsWith(b + path.sep);
  if (comparePaths(resolvedSource, resolvedGame)) {
    report.errors.push('Source directory is inside the game directory (or vice versa). Nothing to import.');
    return report;
  }
  if (comparePaths(resolvedGame, resolvedSource)) {
    report.errors.push('Game directory is inside the source directory. Nothing to import.');
    return report;
  }

  // Validate source directory
  if (!safeStat(source.rootDir)?.isDirectory()) {
    report.errors.push(`Source directory does not exist or is not accessible: ${source.rootDir}`);
    return report;
  }
  if (!isPathAllowed(source.rootDir)) {
    report.errors.push(`Source directory is in a restricted system path: ${source.rootDir}`);
    return report;
  }
  // Ensure game directory parent exists and is writable
  const gameDirParent = path.dirname(gameDir);
  if (!safeStat(gameDirParent)?.isDirectory()) {
    report.errors.push(`Parent of game directory does not exist: ${gameDirParent}`);
    return report;
  }

  // Pre-calculate total steps including per-version installs
  let totalSteps = plan.categories.length;
  let versionsToInstall: string[] | undefined;
  if (plan.categories.includes('version-install') && installVersion) {
    versionsToInstall = source.installableVersions ?? detectInstallableVersions(source.rootDir);
    if (versionsToInstall.length > 0) totalSteps += versionsToInstall.length - 1;
  }
  let completedSteps = 0;
  const step = (stage = '') => { completedSteps++; onProgress?.(completedSteps, totalSteps, stage); };

  // ── Accounts ──
  if (plan.categories.includes('accounts')) {
    if (source.available.includes('accounts')) {
      const names = extractOfflineNames(source.rootDir);
      for (const name of names) { try { if (addAccount(name)) report.newAccounts.push(name); } catch (e) { report.errors.push(`account "${name}": ${(e as Error).message}`); } }
      report.copied.accounts = report.newAccounts.length;
    } else { report.copied.accounts = 0; }
    step('Accounts');
  }

  // ── Servers.dat ──
  if (plan.categories.includes('servers')) {
    let copied = 0;
    const srvFiles = ['servers.dat', 'servers.dat_old'];
    for (let i = 0; i < srvFiles.length; i++) {
      onProgress?.(completedSteps, totalSteps, `Servers (${i + 1}/${srvFiles.length})`);
      if (await copyFileIfExists(path.join(source.rootDir, srvFiles[i]), gameDir, undefined, undefined, report.errors)) copied++;
    }
    report.copied.servers = copied;
    step('Servers');
  }

  // ── Options ──
  if (plan.categories.includes('options')) {
    let copied = 0;
    const optFiles = ['options.txt', 'controls.txt', 'hotbar.nbt', 'optionsshaders.txt',
      'optionsof.txt', 'resourcepacks.txt', 'user_jvm_args.txt', 'note.txt',
      'splashes.txt', 'allowed_symlinks.txt'];
    for (let i = 0; i < optFiles.length; i++) {
      onProgress?.(completedSteps, totalSteps, `Options (${i + 1}/${optFiles.length})`);
      if (await copyFileIfExists(path.join(source.rootDir, optFiles[i]), gameDir, undefined, undefined, report.errors)) copied++;
    }
    report.copied.options = copied;
    step('Options');
  }

  // ── Usercache ──
  if (plan.categories.includes('usercache')) {
    let copied = 0;
    const ucFiles = ['usercache.json', 'usernamecache.json'];
    for (let i = 0; i < ucFiles.length; i++) {
      onProgress?.(completedSteps, totalSteps, `User cache (${i + 1}/${ucFiles.length})`);
      if (await copyFileIfExists(path.join(source.rootDir, ucFiles[i]), gameDir, undefined, undefined, report.errors)) copied++;
    }
    report.copied.usercache = copied;
    step('User cache');
  }

  // ── Pack meta ──
  if (plan.categories.includes('pack-meta')) {
    let copied = 0;
    const metaFiles = ['mmc-pack.json', 'instance.cfg', 'manifest.json', 'minecraftinstance.json', 'modrinth.index.json'];
    for (let i = 0; i < metaFiles.length; i++) {
      onProgress?.(completedSteps, totalSteps, `Pack meta (${i + 1}/${metaFiles.length})`);
      if (await copyFileIfExists(path.join(source.rootDir, metaFiles[i]), gameDir, undefined, undefined, report.errors)) copied++;
    }
    report.copied['pack-meta'] = copied;
    step('Pack metadata');
  }

  // ── Version install ──
  if (plan.categories.includes('version-install')) {
    if (versionsToInstall && versionsToInstall.length > 0) {
      for (let i = 0; i < versionsToInstall.length; i++) {
        const vid = versionsToInstall[i];
        onProgress?.(completedSteps, totalSteps, `Installing ${vid}...`);
        try { await installVersion!(vid); report.installedVersions.push(vid); report.copied['version-install'] = (report.copied['version-install'] ?? 0) + 1; }
        catch (e) { report.errors.push(`version "${vid}": ${(e as Error).message}`); }
        completedSteps++;
      }
    } else { report.copied['version-install'] = 0; step(); }
  }

  // ── Pre-build dedup hashes ──
  let dedupHashes: Set<string> | undefined;
  if (plan.deduplicate) {
    dedupHashes = new Set();
    onProgress?.(completedSteps, totalSteps, 'Scanning existing files...');
    const contentCats = ['mods', 'shaderpacks', 'resourcepacks', 'texturepacks', 'config', 'datapacks', 'scripts', 'version-content'];
    for (const cat of plan.categories) {
      if (!contentCats.includes(cat)) continue;
      if (cat === 'version-content') {
        const vDir = path.join(gameDir, 'versions');
        for (const ver of safeReaddir(vDir)) { for (const sub of VERSION_CONTENT_SUBS) { const hh = await buildExistingHashes(path.join(vDir, ver, sub), DEDUP_HASH_DEPTH); for (const h of hh) dedupHashes.add(h); } }
      } else {
        for (const spec of CATEGORY_DIRS[cat] ?? []) { const hh = await buildExistingHashes(path.join(gameDir, ...(spec.to ?? spec.from)), DEDUP_HASH_DEPTH); for (const h of hh) dedupHashes.add(h); }
      }
    }
  }

  // ── Pre-scan file totals for accurate sub-progress ──
  const DIRS = source.kind === 'bedrock' ? BEDROCK_DIRS : CATEGORY_DIRS;
  const skipCats = new Set(['accounts', 'servers', 'options', 'usercache', 'pack-meta', 'version-install', 'version-content']);
  const catTotals: Record<string, number> = {};
  if (!signal?.aborted) {
    onProgress?.(completedSteps, totalSteps, 'Counting files...');
    for (const cat of plan.categories) {
      if (skipCats.has(cat)) continue;
      const specs = DIRS[cat];
      if (!specs || specs.length === 0) continue;
      const MAX_PRESCAN = 5000;
      let total = 0;
      for (const spec of specs) {
        const from = path.join(source.rootDir, ...spec.from);
        if (!safeStat(from)?.isDirectory()) continue;
        if (safeReaddir(from).length > MAX_PRESCAN) { total = 0; break; }
        total += countFilesRecursive(from, cat === 'worlds' ? 3 : 2);
      }
      if (total > 0) catTotals[cat] = total;
    }
  }

  // ── Content folders ──
  for (const cat of plan.categories) {
    if (signal?.aborted) break;
    if (skipCats.has(cat)) continue;
    const specs = DIRS[cat];
    if (!specs || specs.length === 0) { step(cat); continue; }
    let catCopied = 0; let catSkipped = 0;
    let lastSubTick = 0;
    const catStart = Date.now();
    const hasTotal = catTotals[cat] && catTotals[cat] > 0;
    const fileTotal = hasTotal ? catTotals[cat]! : 0;
    let specAccum = 0;
    // Cleanup orphaned .trel_tmp in this category (recursive)
    for (const spec of specs) {
      const catDest = path.join(gameDir, ...(spec.to ?? spec.from));
      try { rmTrelTmps(catDest); } catch {}
    }
    for (const spec of specs) {
      if (signal?.aborted) break;
      const from = path.join(source.rootDir, ...spec.from);
      if (!safeStat(from)?.isDirectory()) continue;
      const to = path.join(gameDir, ...(spec.to ?? spec.from));
      const r = await copyTreeNoOverwrite(from, to, dedupHashes, (cnt) => {
        const now = Date.now();
        if (now - lastSubTick > 200) {
          lastSubTick = now;
          const totalCnt = specAccum + cnt;
          const elapsed = (now - catStart) / 1000;
          const suffix = fileTotal ? ` (${totalCnt}/${fileTotal})` : ` (${totalCnt})`;
          const eta = totalCnt > 0 && fileTotal > 0 ? Math.round((elapsed / totalCnt) * (fileTotal - totalCnt)) : 0;
          onProgress?.(completedSteps, totalSteps, `${cat}${suffix}${eta > 0 ? ` ~${eta}s` : ''}`);
        }
      }, signal);
      specAccum += r.copied;
      catCopied += r.copied; catSkipped += r.skipped; report.errors.push(...r.errors); report.warnings.push(...r.warnings);
    }
    report.copied[cat] = catCopied; report.skipped[cat] = catSkipped;
    step(cat);
  }

  // ── Per-version content ──
  if (plan.categories.includes('version-content') && !signal?.aborted) {
    const vDirSrc = path.join(source.rootDir, 'versions');
    const vDirDst = path.join(gameDir, 'versions');
    let catCopied = 0; let catSkipped = 0;
    if (safeStat(vDirSrc)?.isDirectory()) {
      let lastSubTick = 0;
      for (const ver of safeReaddir(vDirSrc)) {
        if (signal?.aborted) break;
        for (const sub of VERSION_CONTENT_SUBS) {
          const from = path.join(vDirSrc, ver, sub);
          if (!safeStat(from)?.isDirectory()) continue;
          const to = path.join(vDirDst, ver, sub);
          const r = await copyTreeNoOverwrite(from, to, dedupHashes, (cnt) => {
            const now = Date.now();
            if (now - lastSubTick > 200) {
              lastSubTick = now;
              onProgress?.(completedSteps, totalSteps, `version-content (${cnt})`);
            }
          }, signal);
          catCopied += r.copied; catSkipped += r.skipped; report.errors.push(...r.errors); report.warnings.push(...r.warnings);
        }
      }
    }
    report.copied['version-content'] = catCopied; report.skipped['version-content'] = catSkipped;
    step('version-content');
  }

  // ── Import manifest ──
  try {
    await fsp.writeFile(ntPath(path.join(gameDir, '.trel_import.json')),
      JSON.stringify({ timestamp: new Date().toISOString(), sourceId: plan.sourceId, categories: plan.categories,
        copied: report.copied, skipped: report.skipped, newAccounts: report.newAccounts.length,
        installedVersions: report.installedVersions, errors: report.errors,
        aborted: signal?.aborted ?? false }, null, 2), 'utf-8');
  } catch { /* skip */ }

  return report;
}

// ─── Cache import (legacy) ─────────────────────────────────────────────

export type CacheCategory = 'assets' | 'libraries' | 'skin-cache' | 'versions';

export interface DetectedCache { sourceDir: string; available: CacheCategory[]; approxSize: number }
export interface CacheImportPlan { sourceDir: string; categories: CacheCategory[] }

const CACHE_SUBDIRS: Record<CacheCategory, string[]> = { assets: ['assets'], libraries: ['libraries'], 'skin-cache': ['assets', 'skins'], versions: ['versions'] };

function approxCacheSizeOf(sourceDir: string, categories: CacheCategory[]): number {
  let total = 0;
  for (const cat of categories) { const subdirs = CACHE_SUBDIRS[cat]; if (!subdirs) continue; total += dirSize(path.join(sourceDir, ...subdirs), 2); }
  return total;
}

export function detectCache(sourceDir: string): DetectedCache {
  const available: CacheCategory[] = [];
  if (!safeStat(sourceDir)?.isDirectory()) return { sourceDir, available, approxSize: 0 };
  for (const cat of ['assets', 'libraries', 'skin-cache', 'versions'] as CacheCategory[]) {
    const subdirs = CACHE_SUBDIRS[cat]; if (!subdirs) continue;
    const dir = path.join(sourceDir, ...subdirs); if (safeStat(dir)?.isDirectory() && safeReaddir(dir).some(n => !JUNK_NAMES.has(n))) available.push(cat);
  }
  return { sourceDir, available, approxSize: approxCacheSizeOf(sourceDir, available) };
}

export function detectFromDir(dir: string): DetectedSource | null {
  if (!safeStat(dir)?.isDirectory()) return null;
  if (!isPathAllowed(dir)) { console.warn(`[import] detectFromDir: blocked system path: ${dir}`); return null; }
  const isBedrock = safeStat(path.join(dir, 'minecraftWorlds'))?.isDirectory() && !safeStat(path.join(dir, 'saves'))?.isDirectory();
  const cats = availableCategories(dir, isBedrock);
  if (cats.length === 0) return null;
  const installableVersions = isBedrock ? undefined : detectInstallableVersions(dir);
  return { id: 'custom', label: isBedrock ? 'Minecraft Bedrock Edition' : path.basename(dir) + ' (' + dir + ')', rootDir: dir, available: cats, approxSize: approxSizeOf(dir, cats, isBedrock), kind: isBedrock ? 'bedrock' : 'java', installableVersions };
}

export async function performCacheImport(plan: CacheImportPlan, gameDir: string, onProgress?: ProgressCallback): Promise<{ copied: Partial<Record<CacheCategory, number>>; bytesCopied: number; errors: string[] }> {
  try { rmTrelTmps(gameDir); } catch {}
  const copied: Partial<Record<CacheCategory, number>> = {}; let bytesCopied = 0; const errors: string[] = []; let done = 0; const total = plan.categories.length;
  for (const cat of plan.categories) {
    const subdirs = CACHE_SUBDIRS[cat]; if (!subdirs) continue;
    const from = path.join(plan.sourceDir, ...subdirs); if (!safeStat(from)?.isDirectory()) { done++; continue; }
    for (const name of safeReaddir(from)) { const st = safeStat(path.join(from, name)); if (st) bytesCopied += st.size; }
    const r = await copyTreeNoOverwrite(from, path.join(gameDir, ...subdirs));
    copied[cat] = r.copied; errors.push(...r.errors); if (r.warnings.length) console.warn(`[import] cache warnings: ${r.warnings.join('; ')}`); done++; onProgress?.(done, total, cat);
  }
  return { copied, bytesCopied, errors };
}
