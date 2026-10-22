import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import * as importOps from './import-ops';

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
  | 'version-install'
  | 'schematics'
  | 'replays'
  | 'minimap'
  | 'coremods'
  | 'openloader'
  | 'debug'
  | 'behaviorpacks'
  | 'skinpacks';

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
  /** Extra folders that hold the account files (the launcher root and such). */
  accountsRoots?: string[];
  /**
   * The build was recognized as a Modrinth/CurseForge modpack and can be
   * reinstalled through Trel's own mechanism (with updates) instead of being
   * copied file by file. Filled in from modrinth.index.json / manifest.json.
   */
  modpack?: DetectedModpack;
  /** Memory and JVM arguments set in the source launcher (instance.cfg and friends). */
  launcherTweaks?: LauncherTweaks;
  /** This is an exported .zip of a build, not a folder: it has to be unpacked first. */
  isArchive?: boolean;
}

/** What could be read from the modpack metadata next to the instance. */
export interface DetectedModpack {
  /** 'modrinth' — modrinth.index.json, 'curseforge' — manifest.json, 'packwiz' — packwiz.toml, 'mmc' — mmc-pack.json. */
  origin: 'modrinth' | 'curseforge' | 'packwiz' | 'mmc';
  name: string;
  /** Version of the build, if given (not the game version). */
  version?: string;
  mc: string;
  loader: 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge';
  loaderVersion?: string;
  /** Number of files the launcher would have downloaded itself. */
  fileCount: number;
}

/** Settings of the source launcher that are worth porting over manually. */
export interface LauncherTweaks {
  /** -Xmx in megabytes. */
  maxMemoryMb?: number;
  minMemoryMb?: number;
  jvmArgs?: string;
  javaPath?: string;
  /** Required major Java version from the version json (17, 21…). */
  javaMajor?: number;
}

export interface ImportPlan {
  sourceId: string;
  sourceRootDir?: string;
  categories: ImportCategory[];
  deduplicate?: boolean;
  /**
   * Move the files as hardlinks instead of copying them. Instant and with no
   * extra space used, but the file becomes shared with the source launcher: an
   * edit in one place shows up in the other. Only for a single volume; otherwise — copy.
   */
  useHardlinks?: boolean;
  /** Do not touch the accounts and tokens (accounts, usercache): game content only. */
  skipSecrets?: boolean;
  /** Delete the source files after a successful verified copy (move, not copy). */
  moveSource?: boolean;
  /** Pack the current Trel worlds into a .zip before importing foreign ones. */
  archiveWorlds?: boolean;
  /**
   * Temporary unpack directory (only trel-pack-* in tmp): delete after the import.
   * Set by the fromArchive flow, do not fill it in by hand.
   */
  cleanupDir?: string;
}

export interface ImportReport {
  copied: Partial<Record<ImportCategory, number>>;
  skipped: Partial<Record<ImportCategory, number>>;
  newAccounts: string[];
  installedVersions: string[];
  errors: string[];
  warnings: string[];
  /** Duration per category in ms — shows where the bottleneck is. */
  durationsMs?: Partial<Record<ImportCategory, number>>;
  /** Total bytes written and the overall duration (for the "MB/s" readout in the UI). */
  bytesWritten?: number;
  totalMs?: number;
  /** The import was aborted by the user: what was copied stays in place. */
  aborted?: boolean;
  /** Was paused (ms in total) — the honest speed is measured without them. */
  pausedMs?: number;
  /** How many times it was paused. */
  pauses?: number;
  /** How many bytes the deduplication saved (it was already in Trel). */
  savedBytes?: number;
  /** Files rolled back by the journal (the category failed as a whole). */
  rolledBackFiles?: number;
  /** The source was removed after the move (moveSource). */
  movedSource?: boolean;
  /** Path to the zip archive of the worlds taken before the import. */
  archivedWorlds?: string;
  /** Suspicious mods (quarantine): "file — reason". */
  quarantine?: string[];
  /** One mod in several versions: "modid — files". */
  duplicateMods?: string[];
  /** Authlib/ely endpoints found at the source (not migrated themselves). */
  authServers?: string[];
  /** Secrets were skipped because of skipSecrets. */
  secretsSkipped?: boolean;
  /** Path to the log file of this import. */
  logPath?: string;
}

/** Preview of the plan before the import starts. */
export interface ImportPreview {
  /** Files per category (for big folders — an upper-bound estimate). */
  files: Partial<Record<ImportCategory, number>>;
  /** Bytes per category. */
  bytes: Partial<Record<ImportCategory, number>>;
  totalFiles: number;
  totalBytes: number;
  /** Free space on the game volume (0 if it could not be read). */
  freeBytes: number;
  /** The volume statistics are unavailable — the space check was not performed. */
  freeSpaceUnknown: boolean;
  /** There is not enough space — better not to start the import at all. */
  notEnoughSpace: boolean;
  /** Versions that will be copied or downloaded. */
  versions: string[];
  warnings: string[];
  /** Servers from the source servers.dat (name+address, first 20). */
  servers?: Array<{ name: string; ip: string }>;
  /** What will change: new / overwritten / already there (estimated by same-name+size). */
  diff?: { fresh: number; overwrite: number; identical: number };
  /** How many bytes are already in Trel (estimated dedup savings). */
  savedBytesEstimate?: number;
  /** Time estimate based on the previous speed (s), if it is known. */
  etaSecondsEstimate?: number;
  /** The first files of the queue (rel paths, capped) — shows what exactly will be moved. */
  fileTree?: Array<{ path: string; bytes: number }>;
}

/** Brief summary of the last import into this game folder (.trel_import.json). */
export interface LastImportInfo {
  /** Completion time (ms). */
  at: number;
  sourceId: string;
  categories: string[];
  copiedFiles: number;
  aborted: boolean;
  hardlinks: boolean;
  /** Average speed of the last import (B/s) — used to estimate the time before the start. */
  lastSpeedBps?: number;
}

type ProgressCallback = (current: number, total: number, stage: string, bytes?: number, bytesPerSecond?: number, etaSeconds?: number, currentFile?: string) => void;
type VersionInstaller = (versionId: string) => Promise<void>;

interface CacheEntry {
  sources: DetectedSource[];
  timestamp: number;
  key: string;
}

let _detectCache: CacheEntry | null = null;
const DETECT_CACHE_TTL = 120_000;

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
  /** Fallback layouts (TLauncher keeps the mods in TLMods/ and such). */
  altFrom?: string[][];
  /**
   * Mask of the sibling folders: [parent segments..., prefix]. Badlion keeps its
   * configs in BLClient-Mod-Profiles-<version>/ — the exact name is unknown upfront.
   */
  globFrom?: { parent: string[]; prefix: string };
}

export const CATEGORY_DIRS: Record<string, CopySpec[]> = {
  worlds: [{ from: ['saves'] }],
  mods: [{ from: ['mods'], altFrom: [['TLMods']] }],
  schematics: [{ from: ['schematics'] }, { from: ['blueprints'] }],
  replays: [{ from: ['replay_recordings'] }],
  minimap: [{ from: ['xaero'] }, { from: ['journeymap'] }, { from: ['voxelmap'] }],
  coremods: [{ from: ['coremods'] }],
  openloader: [{ from: ['openloader'] }, { from: ['globalresources'] }],
  debug: [{ from: ['debug'] }],
  shaderpacks: [{ from: ['shaderpacks'], altFrom: [['shaders']] }],
  resourcepacks: [{ from: ['resourcepacks'] }],
  texturepacks: [{ from: ['texturepacks'] }],
  screenshots: [{ from: ['screenshots'] }],
  config: [{ from: ['config'], globFrom: { parent: [], prefix: 'BLClient-Mod-Profiles' } }],
  datapacks: [{ from: ['datapacks'] }],
  stats: [{ from: ['stats'] }],
  advancements: [{ from: ['advancements'] }],
  logs: [{ from: ['logs'] }, { from: ['crash-reports'] }],
  scripts: [{ from: ['scripts'] }, { from: ['kubejs'] }],
  defaultconfigs: [{ from: ['defaultconfigs'] }],
  backups: [{ from: ['backups'], altFrom: [['Backups']] }],
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
  behaviorpacks: [{ from: ['behavior_packs'] }],
  skinpacks: [{ from: ['skin_packs'] }],
  world_templates: [{ from: ['world_templates'] }],
};

/** File-based categories: category name → files in the source root. */
export const FILE_CATS: Record<string, string[]> = {
  servers: ['servers.dat', 'servers.dat_old'],
  options: ['options.txt', 'controls.txt', 'hotbar.nbt', 'optionsshaders.txt',
    'optionsof.txt', 'resourcepacks.txt', 'user_jvm_args.txt', 'note.txt',
    'splashes.txt', 'allowed_symlinks.txt'],
  usercache: ['usercache.json', 'usernamecache.json'],
  'pack-meta': ['mmc-pack.json', 'instance.cfg', 'manifest.json', 'minecraftinstance.json', 'modrinth.index.json'],
};

/**
 * Source folders for a single category.
 *
 * CurseForge nuance: an instance that was never launched keeps its content only
 * inside overrides/ (mods, configs, etc. are unpacked from there on the first
 * start). If the target folder is missing from the instance root — we take it
 * from overrides/, so such "never launched" builds get imported too.
 */
function specSourceDirs(rootDir: string, spec: CopySpec, allowOverrides: boolean): string[] {
  const main = path.join(rootDir, ...spec.from);
  if (safeStat(main)?.isDirectory()) return [main];
  for (const alt of spec.altFrom ?? []) {
    const altDir = path.join(rootDir, ...alt);
    if (safeStat(altDir)?.isDirectory()) return [altDir];
  }
  if (spec.globFrom) {
    // All sibling folders with the prefix (each Badlion version has its own folder).
    const parent = path.join(rootDir, ...spec.globFrom.parent);
    const out: string[] = [];
    for (const name of safeReaddir(parent)) {
      if (name.startsWith(spec.globFrom.prefix) && safeStat(path.join(parent, name))?.isDirectory()) {
        out.push(path.join(parent, name));
      }
    }
    if (out.length > 0) return out.sort();
  }
  if (allowOverrides) {
    const ov = path.join(rootDir, 'overrides', ...spec.from);
    if (safeStat(ov)?.isDirectory()) return [ov];
  }
  return [];
}

/**
 * Subfolders inside versions/<id> that the profile brings along.
 *
 * TLauncher "version isolation" nuance: in that mode the worlds live in
 * versions/<v>/saves. Trel reads the saves only from the shared gameDir/saves,
 * so we import such worlds into the shared folder — but only if the source has
 * no shared saves of its own (otherwise versions/<v>/saves is just leftovers,
 * not isolation, and there is no point in dragging them along).
 */
function versionContentSubs(rootDir: string): string[] {
  const subs = [...VERSION_CONTENT_SUBS];
  if (!safeStat(path.join(rootDir, 'saves'))?.isDirectory()) subs.push('saves');
  return subs;
}

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

/**
 * Files and bytes in a single walk.
 *
 * The preview used to call countFilesRecursive and dirSize separately — two
 * full walks of the same tree. On assets/libraries (tens of thousands of files)
 * that is noticeable. The default depth matches the copy depth, otherwise the
 * preview would underestimate the size exactly on the deep trees — and the size
 * is needed precisely to predict a lack of space.
 */
export interface DirScan { files: number; bytes: number; top: Array<{ rel: string; bytes: number }>; truncated: boolean }
/**
 * A single walk: the counters + the first topCap files (rel path, size) for the
 * preview tree and the diff estimate. Two separate walks (measure + listing)
 * would double the preview time on big builds.
 */
export const SCAN_MAX_FILES = 200_000;
export function scanDir(dir: string, depth: number, topCap = 300, maxFiles = SCAN_MAX_FILES): DirScan {
  const top: Array<{ rel: string; bytes: number }> = [];
  let files = 0; let bytes = 0; let truncated = false;
  let stopped = false;
  const walk = (d: string, rel: string, dep: number) => {
    if (dep <= 0 || stopped) return;
    for (const name of safeReaddir(d)) {
      if (stopped) return;
      if (JUNK_NAMES.has(name)) continue;
      const full = path.join(d, name);
      const st = safeStat(full);
      if (!st) continue;
      if (st.isDirectory()) walk(full, rel ? `${rel}/${name}` : name, dep - 1);
      else {
        files++; bytes += st.size;
        if (files >= maxFiles) { stopped = true; truncated = true; return; }
        if (top.length < topCap) top.push({ rel: rel ? `${rel}/${name}` : name, bytes: st.size });
        else truncated = true;
      }
    }
  };
  walk(dir, '', depth);
  return { files, bytes, top, truncated };
}

function measureTree(dir: string, depth: number): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  if (depth <= 0) return { files, bytes };
  for (const name of safeReaddir(dir)) {
    if (JUNK_NAMES.has(name)) continue;
    const full = path.join(dir, name);
    const st = safeStat(full);
    if (!st) continue;
    if (st.isDirectory()) {
      const sub = measureTree(full, depth - 1);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files++;
      bytes += st.size;
    }
  }
  return { files, bytes };
}

function rmTrelTmps(dir: string, maxDepth = 16): void {
  if (maxDepth <= 0) return;
  if (!safeStat(dir)?.isDirectory()) return;
  if (dir.length < 5) return;  // safety: don't scan filesystem roots
  for (const n of safeReaddir(dir)) {
    const full = path.join(dir, n);
    if (n.endsWith('.trel_tmp')) { try { fs.unlinkSync(ntPath(full)); } catch {} }
    else if (safeStat(full)?.isDirectory()) rmTrelTmps(full, maxDepth - 1);
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

export function resolveDestPath(destDir: string, name: string, taken?: Set<string>): string {
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

// ─── Dedup / copy depth constants ────────────────────────────────────────

/**
 * Recursion limit for copying and hashing. Declared before its first use
 * (APPROX_DEPTH below reads it while the module initializes).
 */
const MAX_COPY_DEPTH = 32;
const DEDUP_HASH_DEPTH = MAX_COPY_DEPTH;

/**
 * Walk depth for the fast size estimate of the source list.
 *
 * Flat categories (mods, config, screenshots) fit into 2–3 levels, and a shallow
 * depth saves detect time. But the cache structure is inherently deep:
 * `assets/objects/ab/<hash>`, `libraries/com/mojang/authlib/1.0/x.jar` — with a
 * depth of 2 the source card showed 449 MB where there really were 2 GB.
 * Worlds need the depth for DIM-1/region and for the datapacks inside a world.
 */
const APPROX_DEPTH: Partial<Record<ImportCategory, number>> = {
  assets: MAX_COPY_DEPTH,
  libraries: MAX_COPY_DEPTH,
  'skin-cache': MAX_COPY_DEPTH,
  'log-configs': MAX_COPY_DEPTH,
  worlds: 5,
};

/** The path `child` lies strictly inside `parent` (both are arrays of segments). */
function isUnder(child: string[], parent: string[]): boolean {  if (child.length <= parent.length) return false;
  return parent.every((seg, i) => seg === child[i]);
}

/**
 * Name case conflicts: on Windows/macOS `Mod.jar` and `mod.jar` are one file,
 * and the second one silently overwrites the first (or ends up as ` (1)`). We
 * scan only the top level of the category folders — cheap and it catches 99% of the cases.
 */
export function findCaseConflicts(rootDir: string, categories: ImportCategory[], bedrock = false): string[] {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return [];
  const DIRS = bedrock ? BEDROCK_DIRS : CATEGORY_DIRS;
  const out: string[] = [];
  for (const cat of categories) {
    for (const spec of DIRS[cat] ?? []) {
      const from = specSourceDirs(rootDir, spec, true)[0];
      if (!from) continue;
      const seen = new Map<string, string>();
      for (const name of safeReaddir(from)) {
        const low = name.toLowerCase();
        const prev = seen.get(low);
        if (prev !== undefined && prev !== name) out.push(`${cat}/${prev} vs ${cat}/${name}`);
        else seen.set(low, name);
      }
      if (out.length >= 10) return out;
    }
  }
  return out;
}

/**
 * A tiny NBT reader used only for servers.dat: the server list (name/ip) for the
 * preview. The full NBT is not needed — we read Compound/List/String/Long/Byte
 * and skip the rest by type. servers.dat is raw big-endian NBT.
 */
export function parseServersDat(filePath: string): Array<{ name: string; ip: string }> {
  const out: Array<{ name: string; ip: string }> = [];
  let buf: Buffer;
  try {
    const raw = fs.readFileSync(ntPath(filePath));
    // Just in case we try gzip (old versions): the gzip magic is 1f 8b.
    try {
      buf = raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b ? zlib.gunzipSync(raw) : raw;
    } catch { buf = raw; }
    // Root: 1 byte TAG_Compound (10) + u16 name. A byte on purpose: reading a u16
    // gave 0x0A00 and silently discarded every valid file.
    if (buf.length < 3 || buf[0] !== 10) return out;
  } catch { return out; }
  let off = 1;
  const readU16 = () => { const v = buf.readUInt16BE(off); off += 2; return v; };
  const readStr = () => { const n = readU16(); const v = buf.toString('utf-8', off, off + n); off += n; return v; };
  const skipPayload = (type: number): void => {
    if (type === 1) off += 1;
    else if (type === 2) off += 2;
    else if (type === 3 || type === 4) off += 4;
    else if (type === 5 || type === 6) off += 8;
    else if (type === 7) off += 4 + buf.readInt32BE(off); // byte array
    else if (type === 8) off += readU16();
    else if (type === 9) {
      const et = buf[off]; const n = buf.readInt32BE(off + 1); off += 5;
      for (let i = 0; i < n; i++) {
        if (et === 10) skipCompoundBody();
        else skipPayload(et);
      }
    } else if (type === 10) skipCompoundBody();
    else if (type === 11) off += 4 + buf.readInt32BE(off) * 4;
    else if (type === 12) off += 4 + buf.readInt32BE(off) * 8; // long array
  };
  const skipCompoundBody = (): void => {
    for (;;) {
      const t = buf[off++];
      if (t === 0) return;
      readStr();
      skipPayload(t);
    }
  };
  try {
    readStr(); // root name
    // The root is a compound: look for servers.
    for (;;) {
      const t = buf[off++];
      if (t === 0) break;
      const name = readStr();
      if (t === 9 && name === 'servers') {
        const et = buf[off]; const n = Math.min(buf.readInt32BE(off + 1), 50); off += 5;
        for (let i = 0; i < n && out.length < 20; i++) {
          let srvName = ''; let srvIp = '';
          if (et !== 10) { skipPayload(et); continue; }
          for (;;) {
            const ft = buf[off++];
            if (ft === 0) break;
            const fname = readStr();
            if (ft === 8) {
              const v = readStr();
              if (fname === 'name') srvName = v.slice(0, 64);
              else if (fname === 'ip') srvIp = v.slice(0, 128);
            } else skipPayload(ft);
          }
          if (srvName || srvIp) out.push({ name: srvName || srvIp, ip: srvIp });
        }
      } else skipPayload(t);
    }
  } catch { /* broken dat — preview without servers */ }
  return out;
}

/** The first 4 KB of two files match (a cheap guard against same-name files on FAT). */
export function sameHead(a: string, b: string): boolean {
  try {
    const fa = fs.openSync(ntPath(a), 'r');
    try {
      const fb = fs.openSync(ntPath(b), 'r');
      try {
        const ba = Buffer.alloc(4096); const bb = Buffer.alloc(4096);
        const na = fs.readSync(fa, ba, 0, 4096, 0); const nb = fs.readSync(fb, bb, 0, 4096, 0);
        return na === nb && ba.subarray(0, na).equals(bb.subarray(0, nb));
      } finally { fs.closeSync(fb); }
    } finally { fs.closeSync(fa); }
  } catch { return false; }
}

/** A broken JSON is copied as-is, but we warn honestly (otherwise it is a surprise in-game). */
function warnIfJsonBroken(destPath: string, warnings: string[]): void {
  if (!destPath.endsWith('.json')) return;
  try {
    JSON.parse(fs.readFileSync(ntPath(destPath), 'utf-8'));
  } catch {
    warnings.push(`possibly corrupt JSON copied as-is: ${path.basename(destPath)}`);
  }
}

/**
 * Removes the categories that are entirely nested inside another selected category.
 *
 * `assets` includes `skin-cache` (assets/skins) and `log-configs`
 * (assets/log_configs). If everything is selected together, the nested categories
 * copy the same content a second time, and resolveDestPath, honestly avoiding an
 * overwrite, lays it out next to it as `skins/ab (1)/…` and `client (1).xml`.
 * The user got garbage and double the copying time. This used to be unreachable
 * (the cache categories were not shown in the UI), now it is reachable.
 */
export function dropNestedCategories(categories: ImportCategory[], bedrock = false): ImportCategory[] {
  const DIRS = bedrock ? BEDROCK_DIRS : CATEGORY_DIRS;
  return categories.filter((cat) => {
    const specs = DIRS[cat];
    // File-based categories (accounts/servers/options/…) copy no folders.
    if (!specs || specs.length === 0) return true;
    for (const other of categories) {
      if (other === cat) continue;
      const otherSpecs = DIRS[other];
      if (!otherSpecs || otherSpecs.length === 0) continue;
      // A category is redundant only if EVERY one of its paths is covered by
      // another category — both in the source and in the destination (spec.to may
      // differ from spec.from).
      const covered = specs.every((s) => otherSpecs.some((o) =>
        isUnder(s.from, o.from) && isUnder(s.to ?? s.from, o.to ?? o.from)));
      if (covered) return false;
    }
    return true;
  });
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
      const dir = specSourceDirs(rootDir, spec, !bedrock)[0];
      if (!dir) continue;
      total += dirSize(dir, APPROX_DEPTH[cat] ?? 2);
    }
  }
  return total;
}

/**
 * Account files of the various launchers. A single list for the detect, the size
 * estimation and the import itself: the detect used to know about only four
 * files, which is why Prism/PolyMC (accounts.json) and the Microsoft Store
 * variant were not offered the "accounts" category at all and were silently
 * never imported. hmcl.json — HMCL; config/account.json and config/accounts.json —
 * ATLauncher (they live in the launcher root, which we reach through accountsRoots).
 */
const ACCOUNT_FILES = [
  'launcher_accounts.json',
  'launcher_accounts_microsoft_store.json',
  'launcher_profiles.json',
  'TLauncherProfile.json',
  'TLauncherProfiles.json',
  'sklauncher_accounts.json',
  'accounts.json',
  'hmcl.json',
  'config/account.json',
  'config/accounts.json',
] as const;

/**
 * Size of the "file-based" categories (the ones not described by CATEGORY_DIRS).
 *
 * `maxVersions` limits the walk over versions/ during the fast estimate for the
 * source list: there the detect speed matters, not the byte-exact accuracy. The
 * preview passes Infinity — its number goes into the free space check, and on a
 * source with 40 profiles a cutoff at 15 understated the volume several times over.
 */
function fileSizeInRoot(rootDir: string, cat: ImportCategory, maxVersions = 15): number {
  switch (cat) {
    case 'accounts': {
      let total = 0;
      for (const f of ACCOUNT_FILES) {
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
          for (const sub of versionContentSubs(rootDir)) {
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
      const names = safeReaddir(vDir);
      for (const ver of Number.isFinite(maxVersions) ? names.slice(0, maxVersions) : names) {
        const verDir = path.join(vDir, ver);
        if (safeStat(verDir)?.isDirectory()) bytes += dirSize(verDir, MAX_COPY_DEPTH);
      }
      return bytes;
    }
    default: return 0;
  }
}

// ─── Per-version content ────────────────────────────────────────────────

const VERSION_CONTENT_SUBS = ['mods', 'shaderpacks', 'resourcepacks', 'texturepacks', 'config', 'datapacks', 'screenshots'];
/**
 * Isolated version content that Trel reads only from the shared folders:
 * worlds from saves, screenshots from screenshots. Everything else goes to
 * versions/<v>/.
 */
function versionContentDest(gameDir: string, vDir: string, ver: string, sub: string): string {
  if (sub === 'saves') return path.join(gameDir, 'saves');
  if (sub === 'screenshots') return path.join(gameDir, 'screenshots');
  return path.join(vDir, ver, sub);
}

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
    for (const sub of versionContentSubs(rootDir)) {
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

  // Accounts from multiple launcher files (only if there really are accounts in them)
  if (hasAccountFiles([rootDir]) || extractOfflineNames(rootDir).length > 0) out.push('accounts');

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

  // Subfolder checks (including the CurseForge overrides/ fallback)
  for (const [cat, specs] of Object.entries(CATEGORY_DIRS)) {
    if (cat === 'accounts' || cat === 'servers' || cat === 'options' || cat === 'usercache' ||
        cat === 'version-content' || cat === 'pack-meta') continue;
    for (const spec of specs) {
      const dir = specSourceDirs(rootDir, spec, !bedrock)[0];
      if (dir && safeReaddir(dir).some(n => !JUNK_NAMES.has(n))) {
        if (!out.includes(cat as ImportCategory)) out.push(cat as ImportCategory);
      }
    }
  }

  const installable = detectInstallableVersions(rootDir);
  if (installable.length > 0) out.push('version-install');

  return out;
}

// ─── Installable version detection ──────────────────────────────────────

interface InstallableVersionEntry {
  id: string;
  folder: string;
  hasJar: boolean;
  hasJson: boolean;
  sourceId: string;
  inheritsFrom?: string;
}

function looksLikeRealMinecraftVersionJson(j: Record<string, unknown>): boolean {
  return typeof j.id === 'string'
    || typeof j.inheritsFrom === 'string'
    || typeof j.mainClass === 'string'
    || !!j.downloads
    || Array.isArray(j.libraries);
}

function isLikelyJavaVersionId(id: string): boolean {
  // Modern releases: 1.21, 1.21.5, 1.20.1
  if (/^1\.\d+(?:\.\d+)?$/.test(id)) return true;
  // Snapshots: 24w14a, 1.20-pre1, 1.20.2-rc2
  if (/^\d{2}w\d{2}[a-z]$/i.test(id)) return true;
  if (/^1\.\d+(?:\.\d+)?-(?:pre|rc)-?\d+$/i.test(id)) return true;
  // Old versions: b1.7.3, a1.2.6, rd-132211, in-20100110, inf-20100618
  if (/^[ab]\d+\.\d+(?:\.\d+)?(?:_\d+)?$/i.test(id)) return true;
  if (/^(?:rd|in|inf)-/i.test(id)) return true;
  // Local modded profile folders usually start with a real Java base id.
  if (/^1\.\d+(?:\.\d+)?[-_].+/i.test(id)) return true;
  return false;
}

function detectInstallableVersionEntries(rootDir: string): InstallableVersionEntry[] {
  const vDir = path.join(rootDir, 'versions');
  if (!safeStat(vDir)?.isDirectory()) return [];
  const entries: InstallableVersionEntry[] = [];
  const seenFolders = new Set<string>();
  for (const folder of safeReaddir(vDir)) {
    if (JUNK_NAMES.has(folder)) continue;
    const verDir = path.join(vDir, folder);
    if (!safeStat(verDir)?.isDirectory()) continue;
    const jsonPath = path.join(verDir, folder + '.json');
    const jarPath = path.join(verDir, folder + '.jar');
    const j = readJson(jsonPath) as Record<string, unknown> | null;
    const hasJson = !!j && looksLikeRealMinecraftVersionJson(j);
    const hasJar = !!safeStat(jarPath)?.isFile();
    if (!hasJson && !hasJar) continue;

    const sourceId = typeof j?.id === 'string' && j.id ? j.id : folder;
    const inheritsFrom = typeof j?.inheritsFrom === 'string' && j.inheritsFrom ? j.inheritsFrom : undefined;
    const javaIdForValidation = inheritsFrom || sourceId;
    if (!isLikelyJavaVersionId(javaIdForValidation) && !isLikelyJavaVersionId(folder)) continue;
    // For downloadable vanilla fallback use the parent id for modded profiles,
    // but keep the folder too so local profile files can be copied without
    // creating fake Mojang downloads for Forge/Fabric/TLauncher profiles.
    const id = inheritsFrom || sourceId;
    if (seenFolders.has(folder.toLowerCase())) continue;
    seenFolders.add(folder.toLowerCase());
    entries.push({ id, folder, hasJar, hasJson, sourceId, inheritsFrom });
  }
  return entries.sort((a, b) => a.folder.localeCompare(b.folder, undefined, { numeric: true }));
}

export function detectInstallableVersions(rootDir: string): string[] {
  // For import UI/counts show actual local profile folders. A Forge/Fabric
  // profile may inherit from a vanilla id, but it is still a separate local
  // version folder that must be copied.
  return detectInstallableVersionEntries(rootDir).map((x) => x.folder);
}


// ─── SHA-1 dedup (async) ────────────────────────────────────────────────

async function fileSha1(filePath: string): Promise<string | null> {
  try {
    const hash = crypto.createHash('sha1');
    // 512 KB chunks: fewer syscalls on big jars. Yielding to the event loop —
    // once every ~8 MB: the UI stays alive and the speed is nearly the same as
    // without yielding.
    const stream = fs.createReadStream(ntPath(filePath), { highWaterMark: 512 * 1024 });
    let chunks = 0;
    for await (const chunk of stream) {
      hash.update(chunk as Buffer);
      if (++chunks % 16 === 0) await new Promise<void>((r) => setImmediate(r));
    }
    return hash.digest('hex');
  } catch { return null; }
}

/**
 * Sizes of the source files. Identical content ⇒ identical size, so an existing
 * destination file is only worth hashing for deduplication if its size matches
 * at least one source file. On a fresh install the dedup pre-scan becomes
 * almost free.
 */
function collectSourceSizes(dir: string, depth: number, sizes: Set<number>): void {
  if (depth <= 0 || !safeStat(dir)?.isDirectory()) return;
  for (const name of safeReaddir(dir)) {
    if (JUNK_NAMES.has(name)) continue;
    const full = path.join(dir, name);
    const st = safeStat(full);
    if (!st) continue;
    if (st.isDirectory()) collectSourceSizes(full, depth - 1, sizes);
    else sizes.add(st.size);
  }
}

/**
 * SHA-1 cache between import runs.
 *
 * Deduplication hashes every file in the destination folder, and on a repeated
 * import of the same source all that work was done from scratch: on 10 GB of
 * mods and resourcepacks that is minutes of disk reads. The key is path + size
 * + mtime: if the file was touched, the entry simply does not match and the
 * hash is recalculated.
 *
 * The cache is an optimization, not a source of truth: any read/write error is
 * silently ignored, worst case — the previous behaviour.
 */
const HASH_CACHE_FILE = '.trel_hash_cache.json';
const HASH_CACHE_MAX_ENTRIES = 200_000;

type HashCache = Map<string, string>;

function hashCacheKey(file: string, size: number, mtimeMs: number): string {
  return `${file}|${size}|${Math.floor(mtimeMs)}`;
}

function loadHashCache(gameDir: string): HashCache {
  const cache: HashCache = new Map();
  const raw = readJson(path.join(gameDir, HASH_CACHE_FILE));
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string' && v.length === 40) cache.set(k, v);
    }
  }
  return cache;
}

async function saveHashCache(gameDir: string, cache: HashCache): Promise<void> {
  try {
    // A huge cache becomes a problem on its own (memory + parse time), so we
    // keep only the fresh tail: it would be rebuilt during the next import anyway.
    const entries = cache.size > HASH_CACHE_MAX_ENTRIES
      ? [...cache.entries()].slice(-HASH_CACHE_MAX_ENTRIES)
      : [...cache.entries()];
    await fsp.writeFile(
      ntPath(path.join(gameDir, HASH_CACHE_FILE)),
      JSON.stringify(Object.fromEntries(entries)),
      'utf-8',
    );
  } catch { /* the cache is optional */ }
}

/**
 * SHA-1 of a file backed by the cache. The key is path + size + mtime, so a
 * touched file is recalculated automatically. It is used both for the
 * destination folder (the dedup pre-scan) and for the source files: on a
 * repeated import of the same launcher both sides come from the cache, and
 * deduplication costs almost nothing.
 */
async function fileSha1Cached(file: string, cache?: HashCache, st?: fs.Stats): Promise<string | null> {
  const stat = st ?? safeStat(file);
  if (!stat) return fileSha1(file);
  const key = hashCacheKey(file, stat.size, stat.mtimeMs);
  const hit = cache?.get(key);
  if (hit) return hit;
  const h = await fileSha1(file);
  if (h) cache?.set(key, h);
  return h;
}

async function buildExistingHashes(
  dir: string, depth: number, sizeFilter?: Set<number>, cache?: HashCache,
): Promise<Set<string>> {
  const hashes = new Set<string>();
  if (depth <= 0 || !safeStat(dir)?.isDirectory()) return hashes;
  for (const name of safeReaddir(dir)) {
    if (JUNK_NAMES.has(name)) continue;
    const full = path.join(dir, name);
    const st = safeStat(full);
    if (!st) continue;
    if (st.isDirectory()) {
      const sub = await buildExistingHashes(full, depth - 1, sizeFilter, cache);
      for (const h of sub) hashes.add(h);
    } else {
      // The size does not match any source file — the content cannot match either.
      if (sizeFilter && !sizeFilter.has(st.size)) continue;
      const h = await fileSha1Cached(full, cache, st);
      if (h) hashes.add(h);
    }
  }
  return hashes;
}

// ─── Async copy with progress ───────────────────────────────────────────

/**
 * Copy concurrency limiter. The copy used to run in batches of 8 only on the
 * top level, while the nested folders (worlds!) were copied strictly
 * sequentially. Now all levels run in parallel, but no more than
 * MAX_CONCURRENT_COPIES files are in flight at once — the folder recursion does
 * not take a slot, so a deadlock on deep trees is impossible.
 */
const MAX_CONCURRENT_COPIES = Math.max(8, Math.min(24, (os.availableParallelism?.() ?? os.cpus()?.length ?? 4) * 2));

let _copyActive = 0;
const _copyWaiters: Array<() => void> = [];
async function withCopySlot<T>(fn: () => Promise<T>): Promise<T> {
  while (_copyActive >= MAX_CONCURRENT_COPIES) {
    await new Promise<void>((resolve) => _copyWaiters.push(resolve));
  }
  _copyActive++;
  try { return await fn(); } finally {
    _copyActive--;
    _copyWaiters.shift()?.();
  }
}

/**
 * Import pause: the UI sets a flag, the copying loops freeze in place (a file
 * is not torn in half — the pause is checked between files), and cancelling
 * works while paused too.
 */
let _importPaused = false;
export function setImportPaused(paused: boolean): void {
  if (paused && !_importPaused) _pauseCount++;
  _importPaused = paused;
}
export function isImportPaused(): boolean { return _importPaused; }
let _pausedMs = 0;
export function takePausedMs(): number { const v = _pausedMs; _pausedMs = 0; return v; }
async function respectPause(signal?: AbortSignal): Promise<void> {
  while (_importPaused && !signal?.aborted) {
    const t = Date.now();
    await new Promise((r) => setTimeout(r, 120));
    _pausedMs += Date.now() - t;
  }
}

/**
 * A bounded pool instead of `Promise.all(items.map(...))`.
 *
 * The old code created 14k promises at once for a folder of 14k files: each one
 * holds a closure and waits for a slot, memory balloons, and "Stop" waits until
 * the queue drains. Now at most MAX_CONCURRENT_COPIES workers are in flight,
 * each pulling the next task from a shared index. Cancellation is checked
 * between the tasks, not only inside them.
 */
async function runPooled<T>(items: T[], fn: (item: T) => Promise<void>, signal?: AbortSignal): Promise<void> {
  let next = 0;
  let failed = false;
  const workers: Promise<void>[] = [];
  const n = Math.min(MAX_CONCURRENT_COPIES, items.length);
  for (let w = 0; w < n; w++) {
    workers.push((async () => {
      for (;;) {
        if (signal?.aborted || failed) return;
        await respectPause(signal);
        if (signal?.aborted || failed) return;
        const idx = next++;
        if (idx >= items.length) return;
        try {
          await fn(items[idx]);
        } catch (e) {
          // The first failure stops the queue: otherwise after a rejected
          // Promise.all the remaining workers would keep writing files in the background.
          failed = true;
          throw e;
        }
      }
    })());
  }
  await Promise.all(workers);
}

interface CopyResult { copied: number; skipped: number; errors: string[]; warnings: string[] }

type CopyOutcome = 'copied' | 'skipped' | 'aborted';

/**
 * Deduplication context for the duration of one import.
 *
 * `known` is a snapshot of the destination folder taken BEFORE the import, and
 * it is intentionally not extended with the copied files. Otherwise two
 * different files with identical content (a dozen empty configs, default
 * .toml files, the same mod under two names) would collapse into one: the first
 * is copied, the rest are "skipped as duplicates". And it is unpredictable —
 * while there are few files they are hashed in parallel and do not see each
 * other, but on a big folder the queue serializes and some files get silently
 * lost. The promise in the UI is simple: we skip what is already in Trel.
 */
interface DedupContext {
  known: Set<string>;
  /** Cache of "path|size|mtime → sha1" that survives a launcher restart. */
  cache?: HashCache;
}

/**
 * Hash + copy of a single file inside a concurrency slot.
 *
 * We check for cancellation AFTER taking the slot, not only before joining the
 * queue: Promise.all creates all tasks at once, so by the time the cancellation
 * arrives thousands of files have already passed the outer check and are
 * waiting for their turn. Without this check "Stop" would wait for the whole
 * folder to be copied.
 */
async function copyFileMaybeDedup(
  from: string, to: string, size: number,
  dedup?: DedupContext, mode: CopyMode = 'copy', signal?: AbortSignal,
  created?: string[],
): Promise<CopyOutcome> {
  return withCopySlot(async () => {
    if (signal?.aborted) return 'aborted';
    await respectPause(signal);
    if (signal?.aborted) return 'aborted';
    if (dedup) {
      const h = await fileSha1Cached(from, dedup.cache);
      if (h && dedup.known.has(h)) {
        // The network and clever tooling can change the content while keeping the
        // mtime: the cache then lies and the file is silently lost. We re-check
        // ~2% of the hits with a real rehash — cheap and it catches staleness.
        if (dedup.cache && Math.random() < 0.02) {
          const fresh = await fileSha1(from);
          if (fresh && fresh !== h) {
            _staleFixed++;
            for (const [k, v] of dedup.cache) if (v === h) { dedup.cache.delete(k); break; }
          } else { _bytesSaved += size; return 'skipped'; }
        } else { _bytesSaved += size; return 'skipped'; }
      }
      // Hashing a big file takes tens of milliseconds more, during which the
      // cancellation could arrive.
      if (signal?.aborted) return 'aborted';
    }
    await copyFileAtomic(from, to, size, mode);
    created?.push(to);
    _copyPairs?.set(to, from);
    return 'copied';
  });
}

async function copyTreeNoOverwrite(
  src: string, dest: string,
  dedup?: DedupContext,
  onProgress?: (copied: number) => void,
  signal?: AbortSignal,
  mode: CopyMode = 'copy',
  created?: string[],
  takenReg?: Map<string, Set<string>>,
  exclude?: Set<string>,
): Promise<CopyResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let copied = 0;
  let skipped = 0;
  try { await fsp.mkdir(ntPath(dest), { recursive: true }); } catch (e) {
    errors.push(`mkdir "${dest}": ${(e as Error).message}`);
    return { copied, skipped, errors, warnings };
  }
  const names = safeReaddir(src).filter(n => !JUNK_NAMES.has(n) && !exclude?.has(n));
  if (names.length === 0) { return { copied, skipped, errors, warnings }; }
  // Pre-compute all destinations serially to avoid rename race conditions
  const entries: Array<{ from: string; to: string; isDir: boolean; size: number }> = [];
  // Shared registry of taken names on dest: worlds/saves and version-content/saves
  // write into one folder through different calls — without a shared set the
  // same worlds would end up as "World (1)" instead of an honest skip/overwrite.
  let taken = takenReg?.get(dest);
  if (!taken) { taken = new Set<string>(); takenReg?.set(dest, taken); }
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
    if (!st.isDirectory() && !st.isFile()) {
      warnings.push(`skipping special file: ${path.relative(src, from)}`);
      continue;
    }
    // Repeat after an interruption without deduplication: the same file is
    // already in place — we skip it without reading (two stats instead of a
    // copy), and the skipped counter stays honest. FAT rounds the mtime to 2s,
    // so the window is 2s; for files < 1 MB we compare the first 4 KB of the
    // content to avoid skipping a foreign same-name file.
    if (!dedup && st.isFile()) {
      const dstSt = safeStat(path.join(dest, name));
      if (dstSt?.isFile() && dstSt.size === st.size && Math.abs(dstSt.mtimeMs - st.mtimeMs) < 2000
        && (st.size >= 1024 * 1024 || sameHead(path.join(dest, name), from))) {
        skipped++;
        continue;
      }
    }
    const to = resolveDestPath(dest, name, taken);
    taken.add(process.platform === 'win32' || process.platform === 'darwin' ? to.toLowerCase() : to);
    entries.push({ from, to, isDir: st.isDirectory(), size: st.size });
  }
  await runPooled(entries, async (e) => {
    if (signal?.aborted) return;
    try {
      if (e.isDir) {
        await copyDirAtomic(e.from, e.to, MAX_COPY_DEPTH, warnings, dedup, signal, mode, created);
      } else {
        const outcome = await copyFileMaybeDedup(e.from, e.to, e.size, dedup, mode, signal, created);
        // A cancelled file is counted neither as copied nor as skipped by the
        // deduplication: otherwise the report lies about the work done.
        if (outcome === 'aborted') return;
        if (outcome === 'skipped') { skipped++; return; }
      }
      copied++;
      onProgress?.(copied);
    } catch (e2) { errors.push(`cp "${path.relative(path.dirname(src), e.from)}" -> "${path.relative(path.dirname(dest), e.to)}": ${(e2 as Error).message}`); }
  }, signal);
  return { copied, skipped, errors, warnings };
}

async function copyFileIfExists(src: string, destDir: string, destName?: string, onProgress?: () => void, errors?: string[], created?: string[], signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return false;
  if (!safeStat(src)) return false;
  try {
    await fsp.mkdir(ntPath(destDir), { recursive: true });
    const dest = resolveDestPath(destDir, destName || path.basename(src));
    await respectPause(signal);
    if (signal?.aborted) return false;
    await copyFileAtomic(src, dest);
    created?.push(dest);
    _copyPairs?.set(dest, src);
    onProgress?.();
    return true;
  } catch (e) {
    errors?.push(`"${path.basename(src)}": ${(e as Error).message}`);
    return false;
  }
}

// ─── Atomic file/dir copy with retry ────────────────────────────────────

/**
 * Strategy for transferring a single file.
 *   'copy'     — a regular copy (the default);
 *   'hardlink' — a hardlink: instant and with no extra space used, but the file
 *                becomes shared with the source launcher (one inode).
 * Reflink (copy-on-write) is always enabled: on Btrfs/XFS/ZFS/APFS the kernel
 * makes a CoW copy instantly, on other filesystems the flag is silently ignored.
 */
type CopyMode = 'copy' | 'hardlink';

/** Bytes actually written to disk (for the speed measurement in the report). */
let _bytesWritten = 0;
/** Bytes saved by the dedup (the file was already in Trel and was not copied). */
let _bytesSaved = 0;
/**
 * "Destination → source" pairs for the current import. They are needed by the
 * verify and by the move: a pair cannot be restored from the name alone —
 * resolveDestPath renames the collisions to " (n)", and a same-name file in
 * the destination may be a completely different file. Filled in only during
 * performImport (the IPC holds importLock).
 */
let _copyPairs: Map<string, string> | null = null;
/** Stale cache entries repaired (selective re-check, see below). */
let _staleFixed = 0;
export function takeStaleFixed(): number { const v = _staleFixed; _staleFixed = 0; return v; }
/** Pauses during the import (for the report). */
let _pauseCount = 0;
export function takePauseCount(): number { const v = _pauseCount; _pauseCount = 0; return v; }
export function takeBytesWritten(): number {
  const v = _bytesWritten;
  _bytesWritten = 0;
  return v;
}
export function takeBytesSaved(): number {
  const v = _bytesSaved;
  _bytesSaved = 0;
  return v;
}
/** Current counter value without a reset — for the live progress. */
function peekBytesWritten(): number {
  return _bytesWritten;
}

/**
 * Copy speed meter.
 *
 * The speed is computed from the byte delta over a window, not as an average
 * since the start: otherwise a long pause for hashing (deduplication) lowers
 * the number forever, and the user sees "2 MB/s" for a copy that has long been
 * running twice as fast. While the window is still open we show the average
 * since the start — rougher, but more honest than zero during a running copy.
 * The first ~50 ms show nothing: dividing by a near-zero interval produces
 * meaningless spikes.
 *
 * The time is passed in as an argument so that the logic can be tested without
 * really copying anything.
 */
export function createSpeedMeter(startedAt: number, windowMs = 250, minElapsedMs = 50) {
  let lastBytes = 0;
  let lastAt = startedAt;
  let lastSpeed = 0;
  return function speedAt(bytes: number, now: number): number {
    const dt = now - lastAt;
    if (dt >= windowMs) {
      const delta = bytes - lastBytes;
      // A negative delta cannot happen, but there is nothing to do with a bogus
      // value in the UI either.
      lastSpeed = delta > 0 ? delta / (dt / 1000) : 0;
      lastBytes = bytes;
      lastAt = now;
      return lastSpeed;
    }
    if (lastSpeed === 0 && bytes > 0) {
      const sinceStart = now - startedAt;
      if (sinceStart >= minElapsedMs) return bytes / (sinceStart / 1000);
    }
    return lastSpeed;
  };
}

/** Name of the file being copied right now — for the live progress in the UI. */
let _currentCopyFile = '';
export function peekCurrentCopyFile(): string { return _currentCopyFile; }

async function copyFileAtomic(src: string, dest: string, expectedSize?: number, mode: CopyMode = 'copy'): Promise<void> {
  const tmp = dest + '.trel_tmp';
  const MAX_ATTEMPTS = 3;
  _currentCopyFile = path.basename(src);
  try {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      try {
        if (mode === 'hardlink') {
          // A hardlink is only possible inside one filesystem; on EXDEV/EPERM
          // (another volume, FAT/exFAT, a network drive) we fall back to copying.
          try {
            await fsp.link(ntPath(src), ntPath(dest));
            // The link is the same inode, so the size still has to be checked: a
            // race with a write to the source file would give a broken "copy"
            // without a single byte of I/O.
            const [ss, ds] = await Promise.all([fsp.stat(ntPath(src)), fsp.stat(ntPath(dest))]);
            if (expectedSize !== undefined && ss.size !== expectedSize) {
              throw new Error(`[CORRUPT] size mismatch: ${expectedSize} source vs ${ss.size} dest`);
            }
            if (ds.size !== ss.size) throw new Error(`[CORRUPT] size mismatch: ${ss.size} source vs ${ds.size} dest`);
            _bytesWritten += ds.size;
            return;
          } catch (le) {
            if ((le as Error).message.startsWith('[CORRUPT]')) {
              try { await fsp.unlink(ntPath(dest)); } catch {}
              throw le;
            }
            const code = (le as NodeJS.ErrnoException).code;
            if (code !== 'EXDEV' && code !== 'EPERM' && code !== 'ENOSYS' && code !== 'EMLINK') throw le;
          }
        }
        // COPYFILE_FICLONE: ask the filesystem for a reflink, otherwise a regular copy.
        await fsp.copyFile(ntPath(src), ntPath(tmp), fs.constants.COPYFILE_FICLONE);
        await fsp.rename(ntPath(tmp), ntPath(dest));
        // Post-copy size verification (best-effort). The source size comes from
        // the pre-scan — an extra stat is not needed.
        try {
          const ds = await fsp.stat(ntPath(dest));
          const size = expectedSize ?? (await fsp.stat(ntPath(src))).size;
          if (ds.size !== size) throw new Error(`[CORRUPT] size mismatch: ${size} source vs ${ds.size} dest`);
          // The executable bit: scripts (.sh) and native libs from a foreign
          // launcher otherwise silently lose +x and then "do not run".
          if (process.platform !== 'win32' && expectedSize !== undefined) {
            try {
              const ss = await fsp.stat(ntPath(src));
              const execBits = ss.mode & 0o111;
              if (execBits) await fsp.chmod(ntPath(dest), (ds.mode & 0o7777) | execBits);
            } catch {}
          }
          _bytesWritten += ds.size;
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
  } finally {
    // Several files are in flight — we do not overwrite a foreign name, let the
    // last relevant one stay instead of flickering into emptiness.
    if (_currentCopyFile === path.basename(src)) _currentCopyFile = '';
  }
}

async function copyDirAtomic(
  src: string, dest: string, maxDepth = MAX_COPY_DEPTH, warnings?: string[],
  dedup?: DedupContext, signal?: AbortSignal, mode: CopyMode = 'copy',
  created?: string[], exclude?: Set<string>,
): Promise<void> {
  if (signal?.aborted) return;
  if (maxDepth <= 0) { warnings?.push(`max depth exceeded at ${path.relative(path.dirname(src), src)}`); return; }
  await fsp.mkdir(ntPath(dest), { recursive: true });
  const names = safeReaddir(src).filter(n => !JUNK_NAMES.has(n) && !exclude?.has(n));
  if (names.length === 0) return;
  // Pre-scan: the destination paths are computed serially (no rename races),
  // the symlink/junction guard runs once — earlier every file was checked
  // twice, and the files themselves were copied strictly sequentially.
  const entries: Array<{ from: string; to: string; isDir: boolean; size: number }> = [];
  const taken = new Set<string>();
  for (const name of names) {
    const from = path.join(src, name);
    const st = safeStat(from);
    if (!st) continue;
    if (isSymlinkOrJunction(from)) {
      warnings?.push(`skipping symlink/junction: ${path.relative(src, from)}`);
      continue;
    }
    const real = realpathSafe(from);
    if (real && !isInsideDir(real, src)) {
      warnings?.push(`skipping escaped path: ${path.relative(src, from)} -> ${real}`);
      continue;
    }
    // Sockets, FIFOs and the other irregular files have nothing to copy —
    // failing silently in copyFile with a cryptic error is worse than skipping
    // them honestly.
    if (!st.isDirectory() && !st.isFile()) {
      warnings?.push(`skipping special file: ${path.relative(src, from)}`);
      continue;
    }
    // Repeat after an interruption without deduplication: a file with the same
    // name, size and mtime is already in place — there is no point in copying
    // it again (and spawning "(1)"). Two cheap stats instead of reading the
    // whole file.
    if (!dedup && st.isFile()) {
      const dstSt = safeStat(path.join(dest, name));
      if (dstSt?.isFile() && dstSt.size === st.size && Math.abs(dstSt.mtimeMs - st.mtimeMs) < 2000
        && (st.size >= 1024 * 1024 || sameHead(path.join(dest, name), from))) continue;
    }
    const to = resolveDestPath(dest, name, taken);
    taken.add(process.platform === 'win32' || process.platform === 'darwin' ? to.toLowerCase() : to);
    entries.push({ from, to, isDir: st.isDirectory(), size: st.size });
  }
  await runPooled(entries, async (e) => {
    if (signal?.aborted) return;
    if (e.isDir) {
      await copyDirAtomic(e.from, e.to, maxDepth - 1, warnings, dedup, signal, mode, created, exclude);
      return;
    }
    await copyFileMaybeDedup(e.from, e.to, e.size, dedup, mode, signal, created);
  }, signal);
}

// ─── Accounts extraction ────────────────────────────────────────────────

export type ImportedAccount = { name: string; uuid?: string; type?: 'offline' | 'online'; accessToken?: string; refreshToken?: string; owned?: boolean };

function normalizeUuid(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.replace(/-/g, '').trim();
  if (!/^[0-9a-f]{32}$/i.test(raw)) return undefined;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`.toLowerCase();
}

const VALID_NAME_RE = /^[a-zA-Z0-9_]{1,16}$/;

/** Keys by which an object is a version profile (launcher_profiles.profiles), not an account. */
const VERSION_PROFILE_KEYS = ['lastVersionId', 'gameDir', 'javaArgs', 'javaDir', 'icon', 'resolution', 'logConfig'];

function isVersionProfile(obj: Record<string, unknown>): boolean {
  return VERSION_PROFILE_KEYS.some((k) => k in obj);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && value !== 'null' ? value : undefined;
}

/**
 * Recognizes a single account object. Supported shapes:
 *  - Minecraft Launcher (launcher_accounts.json): { accessToken, minecraftProfile: { id, name }, ... }
 *  - legacy launcher_profiles.authenticationDatabase: { accessToken, username(email), profiles: { <uuid>: { displayName } } }
 *  - Prism/PolyMC/MultiMC accounts.json: { profile: { id, name }, type: "MSA" | "Offline" }
 *  - TLauncher / SKlauncher: { username | displayName, uuid, type: "MOJANG"|"ELY"|"FREE" }
 *  - HMCL (hmcl.json): { type: "offline"|"microsoft", username(email), displayName, uuid }
 *  - Modrinth App (accounts.json): { <uuid>: { name, access_token, refresh_token } }
 */
function accountFromObject(value: unknown, keyHint?: string): ImportedAccount | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (isVersionProfile(obj)) return null;

  const nested = (obj.minecraftProfile ?? obj.profile) as Record<string, unknown> | undefined;
  const profile = nested && typeof nested === 'object' && !Array.isArray(nested) ? nested : undefined;

  // legacy authenticationDatabase: the player name lives in profiles[<uuid>].displayName
  let legacyName: string | undefined;
  let legacyUuid: string | undefined;
  const profiles = obj.profiles;
  if (profiles && typeof profiles === 'object' && !Array.isArray(profiles)) {
    for (const [key, val] of Object.entries(profiles as Record<string, unknown>)) {
      const display = val && typeof val === 'object' ? str((val as Record<string, unknown>).displayName) : undefined;
      if (display && VALID_NAME_RE.test(display)) { legacyName = display; legacyUuid = normalizeUuid(key); break; }
    }
  }

  // The nickname is the first valid candidate. displayName comes BEFORE username:
  // in HMCL the username is often an email login that fails the nickname check
  // and used to block the whole record — displayName was never even reached.
  const name = [profile?.name, legacyName, obj.name, obj.displayName, obj.username, obj.userName, obj.playerName, obj.lastUsername]
    .map((v) => { const s = str(v); return s && VALID_NAME_RE.test(s) ? s : undefined; })
    .find((s): s is string => !!s);
  if (!name) return null;

  // The object key may carry a UUID as well (Modrinth App stores the accounts as
  // { "<uuid>": { name, ... } }).
  const uuid = normalizeUuid(profile?.id) ?? legacyUuid ?? normalizeUuid(obj.uuid) ?? normalizeUuid(obj.id)
    ?? normalizeUuid(obj.userid) ?? normalizeUuid(keyHint);
  const kind = String(obj.type ?? obj.accountType ?? '').toLowerCase();
  const offlineKind = kind === 'offline' || kind === 'free' || kind === 'legacy_offline';
  const onlineKind = kind === 'online' || kind === 'msa' || kind === 'microsoft' || kind === 'mojang' || kind === 'ely' || kind === 'premium';
  // snake_case token variants — Modrinth App and some GDLauncher exports.
  const accessToken = str(obj.accessToken) ?? str(obj.access_token);
  const refreshToken = str(obj.refreshToken) ?? str(obj.msRefreshToken) ?? str(obj.refresh_token);
  const online = !offlineKind && (onlineKind || !!refreshToken || !!str(obj.xuid) || !!accessToken);
  // An online account without a UUID is useless: the game will not accept the
  // session, and the UUID has to be fetched again anyway — so we register it as
  // offline with the same nickname
  const type: 'offline' | 'online' = online && uuid ? 'online' : 'offline';
  return {
    name,
    uuid,
    type,
    accessToken: type === 'online' ? accessToken : undefined,
    refreshToken: type === 'online' ? refreshToken : undefined,
    owned: type === 'online' ? true : undefined,
  };
}

/** The more informative record wins: online > offline, with UUID > without UUID, with token > without. */
function accountScore(a: ImportedAccount): number {
  return (a.type === 'online' ? 4 : 0) + (a.uuid ? 2 : 0) + (a.refreshToken ? 1 : 0);
}

function mergeAccount(out: Map<string, ImportedAccount>, account: ImportedAccount): void {
  const key = account.name.toLowerCase();
  const prev = out.get(key);
  if (!prev) { out.set(key, account); return; }
  if (accountScore(account) > accountScore(prev)) {
    out.set(key, { ...prev, ...account, uuid: account.uuid ?? prev.uuid });
  } else if (!prev.uuid && account.uuid) {
    out.set(key, { ...prev, uuid: account.uuid });
  }
}

function collectImportedAccounts(value: unknown, out: Map<string, ImportedAccount>, depth = 0, keyHint?: string): void {
  if (depth > 7 || value == null || typeof value !== 'object') return;
  const account = accountFromObject(value, keyHint);
  if (account) mergeAccount(out, account);
  if (Array.isArray(value)) { for (const item of value) collectImportedAccounts(item, out, depth + 1); return; }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    // we do not descend into the profiles of a processed account: they were already parsed above
    if (account && key === 'profiles') continue;
    collectImportedAccounts(item, out, depth + 1, key);
  }
}

function collectNamesDeep(value: unknown, out: Set<string>, depth = 0): void {
  if (depth > 5 || value == null) return;
  if (typeof value === 'string') return;
  if (Array.isArray(value)) {
    for (const v of value) collectNamesDeep(v, out, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Version profiles (launcher_profiles.profiles) have a name field as well ("Forge", "latest-release"),
    // without this filter the import created fake accounts with such names.
    if (isVersionProfile(obj)) return;
    for (const key of ['name', 'username', 'userName', 'displayName', 'playerName', 'lastUsername', 'selectedProfileName']) {
      const v = obj[key];
      if (typeof v === 'string' && /^[a-zA-Z0-9_]{1,16}$/.test(v)) out.add(v);
    }
    for (const key of ['minecraftProfile', 'profile', 'selectedProfile', 'selectedUser', 'accounts', 'users', 'profiles', 'authenticationDatabase']) {
      if (key in obj) collectNamesDeep(obj[key], out, depth + 1);
    }
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') collectNamesDeep(v, out, depth + 1);
    }
  }
}

function extractImportedAccounts(rootDir: string, extraRoots: string[] = []): ImportedAccount[] {
  const accounts = new Map<string, ImportedAccount>();
  const roots = [rootDir, ...extraRoots];
  const seenRoots = new Set<string>();
  for (const root of roots) {
    const real = realpathSafe(root) ?? path.resolve(root);
    if (seenRoots.has(real)) continue;
    seenRoots.add(real);
    for (const file of ACCOUNT_FILES) {
      const data = readJson(path.join(root, file));
      if (data) collectImportedAccounts(data, accounts);
    }
  }
  for (const name of extractOfflineNames(rootDir)) mergeAccount(accounts, { name, type: 'offline' });
  return [...accounts.values()];
}

function extractOfflineNames(rootDir: string): string[] {
  const names = new Set<string>();
  const jsonFiles = [
    'launcher_accounts.json',
    'launcher_profiles.json',
    'TLauncherProfile.json',
    'sklauncher_accounts.json',
    'accounts.json',
    'usercache.json',
    'usernamecache.json',
  ];

  for (const file of jsonFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(ntPath(path.join(rootDir, file)), 'utf-8'));
      collectNamesDeep(data, names);
    } catch {}
  }

  // Some launchers keep tiny text files with the last offline username.
  for (const file of ['lastlogin', 'username.txt', 'user.txt', 'login.txt']) {
    try {
      const raw = fs.readFileSync(ntPath(path.join(rootDir, file)), 'utf-8').trim();
      const m = raw.match(/[a-zA-Z0-9_]{1,16}/);
      if (m) names.add(m[0]);
    } catch {}
  }

  return Array.from(names).filter((n) => /^[a-zA-Z0-9_]{1,16}$/.test(n));
}


// ─── Source detection ───────────────────────────────────────────────────


/** Human-readable instance name from instance.cfg (Prism/MultiMC/PolyMC). */
function readInstanceName(instRoot: string): string | null {
  const cfg = readIniLike(path.join(instRoot, 'instance.cfg'));
  const cfgName = cfg?.name?.trim();
  if (cfgName) return withGroup(instRoot, cfgName);
  // FTB App: instance.json → name; Technic: installedPacks.json in the parent.
  for (const file of ['instance.json', 'minecraftinstance.json', 'manifest.json', 'profile.json']) {
    const j = readJson(path.join(instRoot, file)) as Record<string, unknown> | null;
    const n = j && typeof j.name === 'string' ? j.name.trim() : '';
    if (n) return withGroup(instRoot, n.slice(0, 80));
    // Modrinth App stores the name inside metadata.name.
    const meta = j && typeof j.metadata === 'object' && j.metadata ? (j.metadata as Record<string, unknown>) : null;
    const mn = meta && typeof meta.name === 'string' ? meta.name.trim() : '';
    if (mn) return withGroup(instRoot, mn.slice(0, 80));
  }
  // MultiMC instgroups.json: "Group / Name" — the group sorting is visible in Trel too.
  const base = readInstanceBaseName(instRoot);
  if (base) return withGroup(instRoot, base);
  // Technic: the pack name in installedPacks.json at the launcher root (slug → name).
  for (let d = instRoot, i = 0; i < 3; i++) {
    const packs = readJson(path.join(d, 'installedPacks.json')) as Record<string, { name?: string }> | null;
    if (packs && typeof packs === 'object') {
      const hit = packs[path.basename(instRoot)];
      if (hit && typeof hit.name === 'string' && hit.name.trim()) return hit.name.trim().slice(0, 80);
    }
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return null;
}

/** Base instance name without the group (for withGroup). */
function readInstanceBaseName(instRoot: string): string | null {
  for (const file of ['instance.json', 'minecraftinstance.json', 'manifest.json', 'profile.json']) {
    const j = readJson(path.join(instRoot, file)) as Record<string, unknown> | null;
    const n = j && typeof j.name === 'string' ? j.name.trim() : '';
    if (n) return n.slice(0, 80);
    const meta = j && typeof j.metadata === 'object' && j.metadata ? (j.metadata as Record<string, unknown>) : null;
    const mn = meta && typeof meta.name === 'string' ? meta.name.trim() : '';
    if (mn) return mn.slice(0, 80);
  }
  return null;
}

/** MultiMC instgroups.json: "Name (Group)" — the groups are visible in the Trel list too. */
function withGroup(instRoot: string, name: string): string {
  try {
    const raw = readJson(path.join(path.dirname(instRoot), 'instgroups.json')) as {
      groups?: Record<string, { instances?: string[] }>;
    } | null;
    const groups = raw?.groups;
    if (groups) {
      const id = path.basename(instRoot);
      for (const [g, v] of Object.entries(groups)) {
        if (Array.isArray(v?.instances) && v.instances.includes(id) && g.trim()) {
          return `${name} (${g.trim().slice(0, 30)})`;
        }
      }
    }
  } catch { /* no groups — plain name */ }
  return name;
}

/** Simplistic parsing of key=value files (instance.cfg in the MultiMC family). */
function readIniLike(file: string): Record<string, string> | null {
  try {
    const raw = fs.readFileSync(ntPath(file), 'utf-8');
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9_.]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch { return null; }
}

/**
 * Memory/JVM arguments of the source launcher. Trel does not apply them
 * automatically (a foreign -Xmx may not fit into this machine's memory), but it
 * shows them in the report: otherwise a build meant for 8 GB silently starts
 * with the default 2 GB and lags.
 */
function detectLauncherTweaks(instRoot: string, gameRoot: string): LauncherTweaks | undefined {
  const out: LauncherTweaks = {};
  // MultiMC / Prism / PolyMC / PollyMC / Fjord
  const cfg = readIniLike(path.join(instRoot, 'instance.cfg'));
  if (cfg) {
    const max = Number(cfg.MaxMemAlloc);
    const min = Number(cfg.MinMemAlloc);
    if (Number.isFinite(max) && max > 0) out.maxMemoryMb = max;
    if (Number.isFinite(min) && min > 0) out.minMemoryMb = min;
    if (cfg.JvmArgs?.trim()) out.jvmArgs = cfg.JvmArgs.trim().slice(0, 500);
    if (cfg.JavaPath?.trim()) out.javaPath = cfg.JavaPath.trim().slice(0, 500);
  }
  // CurseForge: minecraftinstance.json → allocatedMemory (MB), jvmArgs
  const cf = readJson(path.join(instRoot, 'minecraftinstance.json')) as Record<string, unknown> | null;
  if (cf) {
    const mem = Number(cf.allocatedMemory);
    if (Number.isFinite(mem) && mem > 0) out.maxMemoryMb ??= mem;
    if (typeof cf.jvmArgs === 'string' && cf.jvmArgs.trim()) out.jvmArgs ??= cf.jvmArgs.trim().slice(0, 500);
  }
  // Vanilla launcher: user_jvm_args.txt / launcher_profiles javaArgs
  const jvmFile = path.join(gameRoot, 'user_jvm_args.txt');
  if (!out.jvmArgs && safeStat(jvmFile)) {
    try {
      const args = fs.readFileSync(ntPath(jvmFile), 'utf-8')
        .split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')).join(' ').trim();
      if (args) out.jvmArgs = args.slice(0, 500);
    } catch {}
  }
  if (!out.maxMemoryMb && out.jvmArgs) {
    const m = out.jvmArgs.match(/-Xmx(\d+)([gGmM])/);
    if (m) out.maxMemoryMb = m[2].toLowerCase() === 'g' ? Number(m[1]) * 1024 : Number(m[1]);
  }
  // Required Java version from the first version json (HMCL/Mojang write javaVersion).
  if (out.maxMemoryMb || out.jvmArgs || out.javaPath) {
    try {
      const vDir = path.join(gameRoot, 'versions');
      for (const ver of safeReaddir(vDir)) {
        const vj = readJson(path.join(vDir, ver, `${ver}.json`)) as { javaVersion?: { majorVersion?: number } } | null;
        const major = vj?.javaVersion?.majorVersion;
        if (typeof major === 'number' && major >= 8 && major <= 30) { out.javaMajor = major; break; }
      }
    } catch {}
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const LOADER_KEYS: Array<[RegExp, DetectedModpack['loader']]> = [
  [/neoforge/i, 'neoforge'],
  [/quilt/i, 'quilt'],
  [/fabric/i, 'fabric'],
  [/forge/i, 'forge'],
];

function loaderFromId(id: string): DetectedModpack['loader'] {
  for (const [re, loader] of LOADER_KEYS) if (re.test(id)) return loader;
  return 'vanilla';
}

/**
 * Recognizes a modpack next to the instance.
 *
 * The idea: if the build is a Modrinth/CurseForge modpack, copying it file by
 * file is pointless. Better to install it through Trel's own mechanism: that
 * gives a regular version with a loader that can be updated. We only extract
 * the metadata — the decision is made by the user in the UI.
 */
function detectModpack(rootDir: string, instRoot: string): DetectedModpack | undefined {
  for (const dir of [rootDir, instRoot]) {
    // Modrinth App: profile.json with game_version/loader (there may be no index).
    const profile = readJson(path.join(dir, 'profile.json')) as Record<string, unknown> | null;
    const pgv = profile?.game_version ?? (profile?.metadata as Record<string, unknown> | undefined)?.game_version;
    if (typeof pgv === 'string' && pgv) {
      const pl = profile?.loader ?? (profile?.metadata as Record<string, unknown> | undefined)?.loader;
      const pls = typeof pl === 'string' ? pl : '';
      const plv = profile?.loader_version ?? (profile?.metadata as Record<string, unknown> | undefined)?.loader_version;
      return {
        origin: 'modrinth',
        name: (typeof profile?.name === 'string' && profile.name.trim() ? profile.name.trim() : path.basename(dir)).slice(0, 120),
        mc: pgv, loader: loaderFromId(pls),
        loaderVersion: typeof plv === 'string' ? plv : undefined,
        fileCount: 0,
      };
    }
    // packwiz: a text-based build (packwiz.toml). Trel has no native installation
    // for it — we copy the files, but we honestly say that this is packwiz.
    try {
      const pw = fs.readFileSync(ntPath(path.join(dir, 'packwiz.toml')), 'utf-8');
      const pwName = pw.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
      const pwMc = pw.match(/minecraft\s*=\s*"([^"]+)"/m)?.[1] ?? pw.match(/mc-version\s*=\s*"([^"]+)"/m)?.[1];
      if (pwMc) {
        return {
          origin: 'packwiz',
          name: (pwName ?? path.basename(dir)).slice(0, 120),
          mc: pwMc, loader: loaderFromId(pw),
          fileCount: (pw.match(/^\[\[mods\]\]/gm) ?? []).length,
        };
      }
    } catch { /* not packwiz */ }
    const mrIndex = readJson(path.join(dir, 'modrinth.index.json')) as Record<string, any> | null;
    if (mrIndex && typeof mrIndex.name === 'string' && mrIndex.dependencies) {
      const deps = mrIndex.dependencies as Record<string, string>;
      const mc = deps.minecraft;
      if (typeof mc === 'string' && mc) {
        let loader: DetectedModpack['loader'] = 'vanilla';
        let loaderVersion: string | undefined;
        for (const [key, value] of Object.entries(deps)) {
          if (key === 'minecraft') continue;
          const l = loaderFromId(key);
          if (l !== 'vanilla') { loader = l; loaderVersion = value; break; }
        }
        return {
          origin: 'modrinth',
          name: String(mrIndex.name).slice(0, 120),
          version: typeof mrIndex.versionId === 'string' ? mrIndex.versionId : undefined,
          mc, loader, loaderVersion,
          fileCount: Array.isArray(mrIndex.files) ? mrIndex.files.length : 0,
        };
      }
    }
    // MultiMC family: mmc-pack.json next to the instance (components).
    // uid net.minecraft → game version, the other uids → loader.
    try {
      const mmc = readJson(path.join(dir, 'mmc-pack.json')) as { components?: Array<{ uid?: string; version?: string }> } | null
        ?? readJson(path.join(dir, '..', 'mmc-pack.json')) as { components?: Array<{ uid?: string; version?: string }> } | null;
      const comps = Array.isArray(mmc?.components) ? mmc.components : [];
      const mcComp = comps.find((c) => c?.uid === 'net.minecraft' && typeof c.version === 'string');
      if (mcComp?.version) {
        let loader: DetectedModpack['loader'] = 'vanilla';
        let loaderVersion: string | undefined;
        for (const c of comps) {
          if (!c || typeof c.uid !== 'string' || c.uid === 'net.minecraft') continue;
          const l = loaderFromId(`${c.uid} ${c.version ?? ''}`);
          if (l !== 'vanilla') { loader = l; loaderVersion = typeof c.version === 'string' ? c.version : undefined; break; }
        }
        return {
          origin: 'mmc',
          name: path.basename(dir === rootDir ? instRoot : dir).slice(0, 120),
          mc: mcComp.version, loader, loaderVersion,
          fileCount: comps.length,
        };
      }
    } catch { /* not mmc */ }
    const cfManifest = readJson(path.join(dir, 'manifest.json')) as Record<string, any> | null;
    const mcBlock = cfManifest?.minecraft;
    if (cfManifest && mcBlock && typeof mcBlock.version === 'string') {
      const loaderId = Array.isArray(mcBlock.modLoaders) && mcBlock.modLoaders.length > 0
        ? String(mcBlock.modLoaders[0]?.id ?? '') : '';
      const loader = loaderFromId(loaderId);
      // ids like "forge-47.2.0" / "neoforge-21.1.65" / "fabric-0.16.0"
      const lv = loaderId.includes('-') ? loaderId.slice(loaderId.indexOf('-') + 1) : undefined;
      return {
        origin: 'curseforge',
        name: String(cfManifest.name ?? 'CurseForge modpack').slice(0, 120),
        version: typeof cfManifest.version === 'string' ? cfManifest.version : undefined,
        mc: mcBlock.version,
        loader,
        loaderVersion: loader === 'vanilla' ? undefined : lv,
        fileCount: Array.isArray(cfManifest.files) ? cfManifest.files.length : 0,
      };
    }
  }
  return undefined;
}


function inferJavaSourceLabel(rootDir: string, fallback: string): string {
  const has = (f: string) => !!safeStat(path.join(rootDir, f));
  // Markers of specific launchers — the name must be exact, not a "data folder".
  if (has('TLauncherProfile.json') || has('TLauncherProfiles.json')) return 'TLauncher';
  if (safeStat(path.join(path.dirname(rootDir), 'tlauncher.properties'))) return 'TLauncher';
  if (has('sklauncher_accounts.json')) return 'SKlauncher';
  if (has('launcher_accounts_microsoft_store.json')) return 'Minecraft (Microsoft Store)';
  if (has('launcher_accounts.json')) return 'Minecraft Launcher';
  if (safeStat(path.join(path.dirname(rootDir), 'atlauncher.conf'))) return 'ATLauncher';
  const profiles = readJson(path.join(rootDir, 'launcher_profiles.json')) as any;
  if (profiles?.profiles || profiles?.authenticationDatabase || profiles?.selectedUser) return 'Minecraft (.minecraft)';
  if (safeStat(path.join(rootDir, 'versions'))?.isDirectory() || safeStat(path.join(rootDir, 'saves'))?.isDirectory()) return 'Minecraft (.minecraft)';
  return fallback;
}


/** Whether there are account files with real content in at least one of the roots.
    Empty/service json (profiles: {}) do not enable the "accounts" category. */
function hasAccountFiles(roots: string[]): boolean {
  for (const root of roots) {
    for (const f of ACCOUNT_FILES) {
      if (!safeStat(path.join(root, f))) continue;
      const tmp = new Map<string, ImportedAccount>();
      const data = readJson(path.join(root, f));
      if (data) collectImportedAccounts(data, tmp);
      if (tmp.size > 0) return true;
    }
  }
  return false;
}

function hasRealJavaImportContent(categories: ImportCategory[], installableVersions?: string[]): boolean {
  const realCats = new Set<ImportCategory>([
    'worlds', 'mods', 'shaderpacks', 'resourcepacks', 'texturepacks', 'servers',
    'screenshots', 'config', 'datapacks', 'advancements', 'logs', 'scripts',
    'defaultconfigs', 'backups', 'local', 'world_templates', 'resources', 'pin',
    'version-content', 'pack-meta', 'version-install', 'accounts',
  ]);
  return categories.some((c) => realCats.has(c)) || !!installableVersions?.length;
}

/**
 * Non-standard game dirs from the HMCL settings (.hmcl/game-directories/*.json).
 * The format is free-form ({ path } / { gameDir } / a plain string), so we read
 * it leniently: anything that looks like a path to an existing folder is a candidate.
 */
export function hmclExtraGameDirs(bases: string[], home: string): string[] {
  const out: string[] = [];
  const roots = [...bases.map((b) => path.join(b, '.hmcl')), path.join(home, '.hmcl')];
  for (const root of roots) {
    const gd = path.join(root, 'game-directories');
    if (!safeStat(gd)?.isDirectory()) continue;
    for (const name of safeReaddir(gd)) {
      if (!name.endsWith('.json')) continue;
      const raw = readJson(path.join(gd, name)) as Record<string, unknown> | string | null;
      const candidates = typeof raw === 'string' ? [raw]
        : raw && typeof raw === 'object'
          ? [raw.path, raw.gameDir, raw.gameDirectory, raw.directory].filter((v): v is string => typeof v === 'string')
          : [];
      for (const c of candidates) {
        if (c.length > 0 && c.length < 1024 && safeStat(c)?.isDirectory()) out.push(c);
      }
    }
  }
  return [...new Set(out)];
}

/**
 * Notes about the client/quirks next to the source. They do not block the
 * import, but they explain the oddities: the built-in mods of Feather/Lunar are
 * not carried over, the Nostalgia worlds are LevelDB and will not run on Java,
 * Betacraft pollutes options.txt.
 */
export function sourceNotes(source: DetectedSource): string[] {
  const notes: string[] = [];
  const { appdata, home } = baseSearchPaths();
  const hasDir = (p: string) => safeStat(p)?.isDirectory();
  const near = (...segs: string[]) => hasDir(path.join(source.rootDir, ...segs));
  if (source.id.startsWith('sk:') || near('..', 'sklauncher') || hasDir(path.join(appdata, 'SKlauncher'))) {
    notes.push('SKlauncher: isolated profiles live in skprofiles/ — each one is imported separately (custom --workDir can only be added as a custom directory)');
  }
  if (near('feather') || hasDir(path.join(appdata, 'Feather'))) {
    notes.push('Feather Client: its 40+ built-in mods stay in Feather, only saves/config/resourcepacks are imported');
  }
  if (hasDir(path.join(home, '.lunarclient'))) {
    notes.push('Lunar Client detected: accounts and built-in mods are server-side and cannot be imported');
  }
  if (near('BLClient-Mod-Profiles') || safeReaddir(source.rootDir).some((n) => n.startsWith('BLClient-Mod-Profiles'))) {
    notes.push('Badlion Client: mod configs (BLClient-Mod-Profiles-*) and replay_recordings are imported, account stays server-side');
  }
  if (source.id.startsWith('betacraft')) {
    notes.push('Betacraft: legacy versions hardcode .minecraft paths and may pollute options.txt — back it up');
  }
  if (/nostalg|nlauncher|ninecraft/i.test(source.rootDir)) {
    notes.push('Nostalgia/NLauncher worlds are LevelDB (Bedrock alpha) and cannot run on Java — imported as an artifact only');
  }
  if (near('TLMods') && !near('mods')) {
    notes.push('TLauncher keeps mods in TLMods/ instead of mods/ — imported from there');
  }
  if (source.id.startsWith('curseforge')) {
    notes.push('CurseForge custom modding folder: if packs live elsewhere, open Settings > Minecraft in CurseForge and point Trel at that folder via custom directory');
  }
  if (/twitch/i.test(source.rootDir)) {
    notes.push('Twitch App is dead — its tokens are invalid, worlds and mods import fine but the account will not');
  }
  if (source.id.startsWith('gdc')) {
    notes.push('GDLauncher Carbon: the real game dir is instances/<name>/instance/ (runtime_path_override may move it)');
  }
  if (source.id.startsWith('betacraft')) {
    const v2 = source.rootDir.includes('.local/share');
    notes.push(v2 ? 'Betacraft v2 layout detected' : 'Betacraft v1 layout detected');
  }
  if (/\/lunarclient|\.lunarclient/i.test(source.rootDir) || hasDir(path.join(home, '.lunarclient'))) {
    if (!notes.some((n) => n.includes('Lunar'))) notes.push('Lunar Client: only the default .minecraft content imports; versions live in offline/multiver');
  }
  if (near('feather')) {
    notes.push('Feather is now Dawn (InPvP): check the custom Game Directory in its settings if saves are missing here');
  }
  for (const d of ['runtime', 'java', 'jre']) {
    if (near(d)) { notes.push(`bundled Java (${d}/) is not imported — Trel downloads its own runtime`); break; }
  }
  if (source.kind === 'bedrock') {
    for (const d of ['development_resource_packs', 'development_behavior_packs', 'development_skin_packs']) {
      if (near(d)) { notes.push('development_* packs are test scaffolding and are skipped'); break; }
    }
  }
  return notes;
}

/**
 * Secret stores next to the source. Tokens are never dragged along silently:
 * HMCL keeps the accessToken in plain text, GDLauncher in the sqlite
 * gdl_conf.db, TLauncher in accounts.dat. We warn and offer an import without
 * secrets (skipSecrets).
 */
export function secretStoreWarnings(source: DetectedSource): string[] {
  const warns: string[] = [];
  const roots = new Set<string>([source.rootDir, ...(source.accountsRoots ?? [])].map((r) => path.resolve(r)));
  const hits: string[] = [];
  for (const root of roots) {
    if (!safeStat(root)?.isDirectory()) continue;
    if (safeStat(path.join(root, 'accounts.json'))?.isFile() && /hmcl/i.test(root + source.id)) {
      hits.push('HMCL accounts.json (access tokens in plain text)');
    }
    if (safeStat(path.join(root, 'gdl_conf.db'))?.isFile()) hits.push('GDLauncher gdl_conf.db (OAuth secrets in sqlite)');
    if (safeStat(path.join(root, 'accounts.dat'))?.isFile()) hits.push('TLauncher accounts.dat (Microsoft/Ely.by/TL tokens)');
    if (safeStat(path.join(root, 'TlauncherProfiles.json'))?.isFile()) hits.push('TLauncher TlauncherProfiles.json (profiles + tokens)');
    if (safeStat(path.join(root, 'legacy.properties'))?.isFile()) hits.push('TLauncher legacy.properties (legacy auth)');
    if (safeStat(path.join(root, 'launcher_accounts.json'))?.isFile()) {
      const raw = readJson(path.join(root, 'launcher_accounts.json')) as Record<string, unknown> | null;
      if (raw && JSON.stringify(raw).includes('accessToken')) hits.push('launcher_accounts.json (access tokens)');
    }
  }
  for (const h of [...new Set(hits)]) {
    warns.push(`secret store nearby (${h}) — accounts are imported as names only, re-login is required; use "without secrets" to skip them entirely`);
  }
  return warns;
}

/**
 * Authlib-injector / Ely.by endpoints from the source configs (HMCL and others).
 * We do not migrate or enable the servers themselves, but we show the list so
 * that the user knows what will be needed after the move.
 */
export function extractAuthServers(source: DetectedSource): string[] {
  const found = new Set<string>();
  const roots = [source.rootDir, ...(source.accountsRoots ?? [])];
  for (const root of roots) {
    if (!safeStat(root)?.isDirectory()) continue;
    for (const name of ['hmcl.json', 'authlib-injector.json', 'config.json', 'settings.json', 'launcher_profiles.json']) {
      const raw = readJson(path.join(root, name)) as Record<string, unknown> | null;
      if (!raw || typeof raw !== 'object') continue;
      const text = JSON.stringify(raw);
      for (const m of text.matchAll(/https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?\/?[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]*/g)) {
        const url = m[0];
        if (/auth|ely|yggdrasil|mojang|minecraftservices/i.test(url) && url.length < 200) found.add(url);
      }
      const inj = (raw as Record<string, unknown>).authlibInjectorServers;
      if (Array.isArray(inj)) for (const s of inj) if (typeof s === 'string' && s.length < 200) found.add(s);
    }
    if (found.size >= 10) break;
  }
  return [...found].slice(0, 10);
}

export function detectSources(excludeGameDir?: string): DetectedSource[] {
  const now = Date.now();
  const cacheKey = excludeGameDir ? path.resolve(excludeGameDir) : '';
  if (_detectCache && _detectCache.key === cacheKey && (now - _detectCache.timestamp) < DETECT_CACHE_TTL) return _detectCache.sources;
  const { appdata, userprofile, home } = baseSearchPaths();
  const sources: DetectedSource[] = [];

  // Bases where the launchers store their data: Windows/macOS — appdata,
  // Linux — also ~/.local/share (Prism, MultiMC and others live exactly there).
  const bases: string[] = process.platform === 'linux'
    ? [appdata, path.join(home, '.local', 'share')]
    : [appdata];
  const inBases = (sub: string): string[] => bases.map((b) => path.join(b, sub));
  // Portable installations live anywhere, but always next to the binary/process:
  // the portable MultiMC/Prism/ATLauncher keep instances/ next to the exe.
  const portableNeighbors = (sub: string): string[] => {
    const out: string[] = [];
    for (const base of [process.cwd()]) {
      try { if (safeStat(path.join(base, sub))?.isDirectory()) out.push(path.join(base, sub)); } catch {}
    }
    try {
      const exeDir = path.dirname(process.execPath);
      if (safeStat(path.join(exeDir, sub))?.isDirectory()) out.push(path.join(exeDir, sub));
    } catch {}
    return out;
  };
  const firstDir = (dirs: string[]): string | null => {
    for (const d of dirs) if (safeStat(d)?.isDirectory()) return d;
    return null;
  };

  // Flat launchers: the game data lives in .minecraft inside the launcher root,
  // accounts/settings — in the launcher root (covered via accountsRoots).
  const flatpakData = (appId: string, rel: string): string => path.join(home, '.var', 'app', appId, 'data', rel);
  const flatRoots: Array<{ id: string; label: string; dirs: string[] }> = [
    { id: 'mojang',     label: 'Mojang Launcher',  dirs: [path.join(appdata, '.minecraft')] },
    { id: 'tlauncher',  label: 'TLauncher',        dirs: [path.join(appdata, 'TLauncher', '.minecraft'), path.join(home, 'TLauncher', '.minecraft'), path.join(home, '.tlauncher', '.minecraft')] },
    { id: 'atlauncher', label: 'ATLauncher',       dirs: [path.join(appdata, 'ATLauncher', '.minecraft')] },
    { id: 'legacy',     label: '.minecraft (home)', dirs: [path.join(userprofile, '.minecraft')] },
    { id: 'sklauncher', label: 'SKlauncher',       dirs: [path.join(appdata, 'SKlauncher', '.minecraft')] },
    { id: 'crystal',    label: 'Crystal Launcher', dirs: [path.join(appdata, 'CrystalLauncher', '.minecraft')] },
    { id: 'cristalix',  label: 'Cristalix',          dirs: [path.join(appdata, '.cristalix', 'minecraft'), path.join(home, '.cristalix', 'minecraft')] },
    // HMCL keeps the game in .minecraft next to itself: earlier its versions
    // were listed as "instances", but the version folders contain no saves/mods
    // and were filtered out — HMCL was effectively never imported.
    { id: 'hmcl',       label: 'HMCL',             dirs: [path.join(appdata, 'hmcl', '.minecraft'), path.join(home, '.hmcl', '.minecraft')] },
  ];
  for (const r of flatRoots) {
    const dir = firstDir(r.dirs);
    if (!dir) continue;
    const installableVersions = detectInstallableVersions(dir);
    const cats = availableCategories(dir);
    if (cats.length === 0 || !hasRealJavaImportContent(cats, installableVersions)) continue;
    const accRoots = [dir, path.dirname(dir)];
    if (!cats.includes('accounts') && hasAccountFiles(accRoots)) cats.push('accounts');
    sources.push({ id: r.id, label: inferJavaSourceLabel(dir, r.label), rootDir: dir, available: cats, approxSize: approxSizeOf(dir, cats), kind: 'java', installableVersions, accountsRoots: accRoots, launcherTweaks: detectLauncherTweaks(dir, dir) });
  }

  // HMCL stores the game in arbitrary game dirs (settings → game-directories/*.json).
  // The default .minecraft is already covered above, here — only non-standard paths.
  for (const dir of hmclExtraGameDirs(bases, home)) {
    const installableVersions = detectInstallableVersions(dir);
    const cats = availableCategories(dir);
    if (cats.length === 0 || !hasRealJavaImportContent(cats, installableVersions)) continue;
    const accRoots = [dir];
    if (!cats.includes('accounts') && hasAccountFiles(accRoots)) cats.push('accounts');
    sources.push({ id: 'hmcl', label: inferJavaSourceLabel(dir, 'HMCL'), rootDir: dir, available: cats, approxSize: approxSizeOf(dir, cats), kind: 'java', installableVersions, accountsRoots: accRoots, launcherTweaks: detectLauncherTweaks(dir, dir) });
  }

  // Instance launchers: every instance is a separate source,
  // the accounts are taken from the launcher root as well.
  const localApp = process.platform === 'win32' ? path.join(userprofile, 'AppData', 'Local') : home;
  const prismPortable = process.env.PRISMLAUNCHER_DATA_DIR
    ? [path.join(process.env.PRISMLAUNCHER_DATA_DIR, 'instances')] : [];
  const instanceRoots: Array<{ idPrefix: string; labelPrefix: string; parents: string[]; instanceSub?: string; recursive?: boolean }> = [
    { idPrefix: 'prism',      labelPrefix: 'Prism Launcher', parents: inBases('PrismLauncher/instances').concat(flatpakData('org.prismlauncher.PrismLauncher', 'PrismLauncher/instances'), prismPortable, portableNeighbors('instances')), instanceSub: '.minecraft' },
    { idPrefix: 'polymc',     labelPrefix: 'PolyMC',      parents: inBases('PolyMC/instances').concat(flatpakData('io.github.PolyMC.PolyMC', 'PolyMC/instances')),        instanceSub: '.minecraft' },
    { idPrefix: 'pollymc',    labelPrefix: 'PollyMC',     parents: inBases('PollyMC/instances').concat(flatpakData('io.github.pollymc.PollyMC', 'PollyMC/instances')),       instanceSub: '.minecraft' },
    { idPrefix: 'fjord',      labelPrefix: 'Fjord Launcher', parents: inBases('FjordLauncher/instances'), instanceSub: '.minecraft' },
    { idPrefix: 'multimc',    labelPrefix: 'MultiMC',     parents: inBases('MultiMC/instances').concat(flatpakData('org.multimc.MultiMC', 'MultiMC/instances'), [path.join(home, 'MultiMC', 'instances')], portableNeighbors('instances')),        instanceSub: '.minecraft' },
    { idPrefix: 'salwyrr',    labelPrefix: 'Salwyrr',     parents: inBases('Salwyrr/instances'),        instanceSub: '.minecraft' },
    { idPrefix: 'curseforge', labelPrefix: 'CurseForge',  parents: [path.join(userprofile, 'curseforge', 'minecraft', 'Instances'), path.join(appdata, 'Twitch', 'Minecraft', 'Instances'), path.join(userprofile, 'Twitch', 'Minecraft', 'Instances'), path.join(userprofile, 'Documents', 'Curse', 'Minecraft', 'Instances'), path.join(userprofile, 'Documents', 'Twitch', 'Minecraft', 'Instances')], recursive: true },
    { idPrefix: 'gd',         labelPrefix: 'GDLauncher',  parents: inBases('gdlauncher_next/instances').concat(inBases('gdlauncher/instances'), inBases('gdl/instances'), inBases('gdlauncher_carbon/data/instances')) },
    { idPrefix: 'gdc',        labelPrefix: 'GDLauncher Carbon', parents: inBases('gdlauncher_carbon/data/instances'), instanceSub: 'instance' },
    { idPrefix: 'modrinth',   labelPrefix: 'Modrinth App', parents: inBases('com.modrinth.theseus/profiles').concat(inBases('ModrinthApp/profiles')) },
    { idPrefix: 'technic',    labelPrefix: 'Technic',     parents: inBases('technic/modpacks').concat(inBases('.technic/modpacks')) },
    { idPrefix: 'ftb',        labelPrefix: 'FTB App',     parents: [path.join(localApp, '.ftba', 'instances'), path.join(home, '.local', 'share', '.ftba', 'instances')], instanceSub: 'minecraft' },
    { idPrefix: 'sk',         labelPrefix: 'SKlauncher',  parents: inBases('.minecraft/skprofiles').concat([path.join(userprofile, '.minecraft', 'skprofiles')]) },
    { idPrefix: 'betacraft',  labelPrefix: 'Betacraft',   parents: inBases('.betacraft').concat([path.join(home, '.betacraft'), path.join(home, '.local', 'share', 'betacraft')]), recursive: true },
    { idPrefix: 'nostalgia',  labelPrefix: 'Nostalgia',   parents: [path.join(home, 'NostalgiaLauncher', 'instances'), path.join(home, '.nostalgia', 'instances')] },
    { idPrefix: 'atlauncher', labelPrefix: 'ATLauncher',  parents: inBases('ATLauncher/Instances').concat([path.join(home, 'ATLauncher', 'Instances')], portableNeighbors('Instances')), instanceSub: 'minecraft' },
    { idPrefix: 'legacyfabric', labelPrefix: 'Legacy Fabric', parents: inBases('LegacyFabric/instances'), instanceSub: '.minecraft' },
    { idPrefix: 'labymod',    labelPrefix: 'LabyMod',     parents: inBases('LabyMod/instances'), instanceSub: '.minecraft' },
  ];
  // Build exports (*.zip next to the Prism/MultiMC/ATLauncher instances):
  // we pick them up as archive sources — they get unpacked via the fromArchive flow.
  const exportParents = [inBases('PrismLauncher/instances'), inBases('MultiMC/instances'), inBases('ATLauncher/Instances')].flat();
  for (const parent of exportParents) {
    if (!safeStat(parent)?.isDirectory()) continue;
    for (const name of safeReaddir(parent)) {
      if (!name.toLowerCase().endsWith('.zip')) continue;
      const zipPath = path.join(parent, name);
      sources.push({ id: `export:${name}`, label: `Pack export: ${name}`, rootDir: zipPath,
        available: ['mods', 'worlds', 'config', 'resourcepacks'] as ImportCategory[],
        approxSize: safeStat(zipPath)?.size ?? 0, kind: 'java', isArchive: true });
    }
  }
  for (const r of instanceRoots) {
    const parent = firstDir(r.parents);
    if (!parent) continue;
    const launcherRoot = path.dirname(parent);
    const names = r.recursive ? collectNestedDirs(parent) : safeReaddir(parent);
    for (const name of names) {
      const instRoot = path.join(parent, name);
      if (!safeStat(instRoot)?.isDirectory()) continue;
      const root = r.instanceSub && safeStat(path.join(instRoot, r.instanceSub)) ? path.join(instRoot, r.instanceSub) : instRoot;
      const installableVersions = detectInstallableVersions(root);
      const cats = availableCategories(root);
      if (cats.length === 0 || !hasRealJavaImportContent(cats, installableVersions)) continue;
      const accRoots = [root, instRoot, launcherRoot];
      if (!cats.includes('accounts') && hasAccountFiles(accRoots)) cats.push('accounts');
      // Prism/MultiMC write the human-readable build name to instance.cfg,
      // CurseForge — to minecraftinstance.json, Modrinth App — to profile.json:
      // the folder may be called "q7x2fd21" while the build is "Better MC".
      const nice = readInstanceName(instRoot);
      sources.push({
        id: `${r.idPrefix}:${name}`,
        label: nice ? `${r.labelPrefix}: ${nice}` : `${r.labelPrefix}: ${name}`,
        rootDir: root, available: cats, approxSize: approxSizeOf(root, cats), kind: 'java',
        installableVersions, accountsRoots: accRoots,
        modpack: detectModpack(root, instRoot),
        launcherTweaks: detectLauncherTweaks(instRoot, root),
      });
    }
  }

  const bedrockRoot = detectBedrockRoot();
  // The Bedrock import source only matters on Windows: on Linux/macOS
  // Bedrock/TrelEmu is disabled, and importing worlds/add-ons has nowhere to go.
  if (bedrockRoot && process.platform === 'win32') {
    const cats = availableCategories(bedrockRoot, true);
    if (cats.length > 0) sources.push({ id: 'bedrock', label: 'Minecraft Bedrock Edition', rootDir: bedrockRoot, available: cats, approxSize: approxSizeOf(bedrockRoot, cats, true), kind: 'bedrock' });
  }

  // Drop the duplicates by real path and exclude Trel's own game folder:
  // a launcher cannot be imported "into itself", and the same .minecraft could
  // end up in the list twice under different ids (mojang/legacy and such).
  const seen = new Set<string>();
  const filtered = sources.filter((s) => {
    const real = realpathSafe(s.rootDir) ?? path.resolve(s.rootDir);
    if (seen.has(real)) return false;
    seen.add(real);
    if (excludeGameDir) {
      const game = realpathSafe(excludeGameDir) ?? path.resolve(excludeGameDir);
      if (real === game || real.startsWith(game + path.sep) || game.startsWith(real + path.sep)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => b.approxSize - a.approxSize);
  _detectCache = { sources: filtered, timestamp: now, key: cacheKey };
  return filtered;
}

/**
 * Async wrapper around detectSources: the scan runs in a separate thread so
 * that it does not block the main process (and with it the whole UI) on slow disks.
 *
 * Any problem with the worker (no file after the build, asar, threads forbidden,
 * a stuck disk) must not break the import: in that case we honestly count
 * synchronously. The result is cached by the same _detectCache as the sync path.
 */
export async function detectSourcesAsync(excludeGameDir?: string, timeoutMs = 20_000): Promise<DetectedSource[]> {
  const now = Date.now();
  const cacheKey = excludeGameDir ? path.resolve(excludeGameDir) : '';
  if (_detectCache && _detectCache.key === cacheKey && (now - _detectCache.timestamp) < DETECT_CACHE_TTL) return _detectCache.sources;

  // The worker is compiled next to this file (dist-electron/main/import-worker.js).
  const workerFile = path.join(__dirname, 'import-worker.js');
  if (!safeStat(workerFile)) return detectSources(excludeGameDir);

  try {
    const { Worker } = await import('node:worker_threads');
    const sources = await new Promise<DetectedSource[]>((resolve, reject) => {
      const worker = new Worker(workerFile, { workerData: { excludeGameDir } });
      const timer = setTimeout(() => {
        worker.terminate().catch(() => {});
        reject(new Error('detect timeout'));
      }, timeoutMs);
      const finish = (fn: () => void) => { clearTimeout(timer); fn(); };
      worker.once('message', (msg: { ok: boolean; sources?: DetectedSource[]; error?: string }) => {
        finish(() => {
          if (msg?.ok && Array.isArray(msg.sources)) resolve(msg.sources);
          else reject(new Error(msg?.error ?? 'worker failed'));
        });
        worker.terminate().catch(() => {});
      });
      worker.once('error', (e) => finish(() => reject(e)));
      worker.once('exit', (code) => { if (code !== 0) finish(() => reject(new Error('worker exit ' + code))); });
    });
    _detectCache = { sources, timestamp: Date.now(), key: cacheKey };
    return sources;
  } catch (e) {
    console.warn('[import] worker detect failed, falling back to sync:', (e as Error).message);
    return detectSources(excludeGameDir);
  }
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
  addImportedAccount?: (account: ImportedAccount) => boolean,
): Promise<ImportReport> {
  const report: ImportReport = { copied: {}, skipped: {}, newAccounts: [], installedVersions: [], errors: [], warnings: [], durationsMs: {} };
  const importStarted = Date.now();
  takeBytesWritten(); takeBytesSaved();  // reset the counters of the previous run
  _copyPairs = new Map();

  // The nested categories (skin-cache inside assets and such) would copy the
  // very same thing twice, leaving "skins/ab (1)" next to it. We drop them here
  // rather than in the UI: the plan comes both from the IPC and from the tests.
  const effective = dropNestedCategories(plan.categories, source.kind === 'bedrock');
  if (effective.length !== plan.categories.length) {
    const dropped = plan.categories.filter((c) => !effective.includes(c));
    report.warnings.push(`skipped categories already covered by a broader one: ${dropped.join(', ')}`);
    // Further down the function the plan is only read — we replace it entirely
    // so that no branch works with the old list.
    plan = { ...plan, categories: effective };
  }
  // Import without secrets: accounts and usercache are not touched at all.
  if (plan.skipSecrets && (plan.categories.includes('accounts') || plan.categories.includes('usercache'))) {
    plan = { ...plan, categories: plan.categories.filter((c) => c !== 'accounts' && c !== 'usercache') };
    report.secretsSkipped = true;
    report.warnings.push('accounts and tokens skipped ("without secrets" mode)');
  }

  const logPath = await importOps.appendImportLog(gameDir, `start ${plan.sourceId} cats=[${plan.categories.join(',')}] dedup=${!!plan.deduplicate} hardlinks=${!!plan.useHardlinks} move=${!!plan.moveSource}`);
  report.logPath = logPath;
  // The client quirks and the secret store next to the source — straight into the
  // report, so that the user sees them even when the import is cancelled midway.
  for (const n of sourceNotes(source)) report.warnings.push(n);
  for (const w of secretStoreWarnings(source)) report.warnings.push(w);
  const authServers = extractAuthServers(source);
  if (authServers.length > 0) {
    report.authServers = authServers;
    report.warnings.push(`auth servers used by the source (not migrated, re-login needed): ${authServers.join(', ')}`);
  }
  // Safety net for the Trel worlds before a foreign import.
  if (plan.archiveWorlds && !signal?.aborted) {
    const savesDir = path.join(gameDir, 'saves');
    if (safeStat(savesDir)?.isDirectory()) {
      const zipName = `saves-before-import-${new Date().toISOString().slice(0, 10)}.zip`;
      const zipPath = path.join(gameDir, 'backups', zipName);
      const n = await importOps.archiveDirToZip(savesDir, zipPath);
      if (n > 0) {
        report.archivedWorlds = zipPath;
        report.warnings.push(`current worlds archived to backups/${zipName} (${n} files)`);
      }
    }
  }

  const copyMode: CopyMode = plan.useHardlinks ? 'hardlink' : 'copy';
  if (plan.useHardlinks) {
    report.warnings.push('hardlink mode: imported files share storage with the source launcher');
  }
  // Memory of the source launcher: Trel does not apply a foreign -Xmx
  // automatically (it may not fit into this machine's memory), but staying
  // silent is not an option — otherwise a heavy build starts with the default
  // and lags.
  if (source.launcherTweaks?.maxMemoryMb) {
    report.warnings.push(`source launcher allocated ${source.launcherTweaks.maxMemoryMb} MB RAM — set the same value in Trel settings`);
  }
  if (source.launcherTweaks?.jvmArgs) {
    report.warnings.push(`source launcher JVM args: ${source.launcherTweaks.jvmArgs}`);
  }
  if (source.launcherTweaks?.javaPath) {
    report.warnings.push(`source launcher uses its own Java: ${source.launcherTweaks.javaPath} — set the same runtime in Trel if the pack refuses to start`);
  }
  if (source.launcherTweaks?.javaMajor) {
    report.warnings.push(`source pack needs Java ${source.launcherTweaks.javaMajor} — install that runtime or the game will crash on launch`);
  }

  // Cleanup orphaned .trel_tmp from previous aborted runs. A full walk of the
  // gameDir (assets/libraries — tens of thousands of files) was a noticeable
  // part of the import startup, so the depth is limited: the temporary files
  // live only next to the copy destination (the root, versions/<id>, the
  // category folders). The category folders are cleaned up separately before
  // their own copy.
  try { rmTrelTmps(gameDir, 4); } catch {}

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
  let versionEntries: InstallableVersionEntry[] = [];
  if (plan.categories.includes('version-install')) {
    versionEntries = detectInstallableVersionEntries(source.rootDir);
    versionsToInstall = source.installableVersions ?? detectInstallableVersions(source.rootDir);
    const versionSteps = versionEntries.length > 0 ? versionEntries.length : (versionsToInstall?.length ?? 0);
    if (versionSteps > 0) totalSteps += versionSteps - 1;
  }
  let completedSteps = 0;
  /**
   * Progress with a byte counter and an instant speed.
   *
   * The bytes were already counted in copyFileAtomic, but they only made it
   * into the final report: during the copy the user saw "mods (120/400)" and
   * could not tell whether the transfer was running or hung.
   */
  const speedAt = createSpeedMeter(importStarted);
  const emit = (stage: string, etaSeconds?: number) => {
    const total = peekBytesWritten();
    onProgress?.(completedSteps, totalSteps, stage, total, speedAt(total, Date.now()), etaSeconds, peekCurrentCopyFile() || undefined);
  };
  const step = (stage = '') => { completedSteps++; emit(stage); };

  // ── Accounts ──
  if (plan.categories.includes('accounts')) {
    if (source.available.includes('accounts')) {
      const accounts = extractImportedAccounts(source.rootDir, source.accountsRoots ?? []);
      for (const account of accounts) {
        try {
          const added = addImportedAccount ? addImportedAccount(account) : addAccount(account.name);
          if (added) report.newAccounts.push(account.name);
          else report.skipped.accounts = (report.skipped.accounts ?? 0) + 1;
          // The access token in the foreign launchers lives for ~24 hours, and the
          // Microsoft refresh token usually sits in a separate encrypted store and
          // is not migrated. So we migrate a licensed account together with its
          // UUID/name, but we honestly warn that online servers require a fresh
          // login.
          if (account.type === 'online' && !account.refreshToken) {
            report.warnings.push(`account "${account.name}": imported as online (UUID preserved), re-login via Microsoft required to refresh session`);
          }
        } catch (e) { report.errors.push(`account "${account.name}": ${(e as Error).message}`); }
      }
      report.copied.accounts = report.newAccounts.length;
    } else { report.copied.accounts = 0; }
    step('Accounts');
  }

  // ── File-based categories (servers/options/usercache/pack-meta) ──
  // The file lists live in FILE_CATS, so that the move (moveSource) knows the same names.
  const journalByCat: Record<string, string[]> = {};
  const copyFileCat = async (cat: ImportCategory, stage: string) => {
    const files = FILE_CATS[cat] ?? [];
    const created: string[] = [];
    journalByCat[cat] = created;
    let copied = 0;
    for (let i = 0; i < files.length; i++) {
      if (signal?.aborted) break;
      emit(`${stage} (${i + 1}/${files.length})`);
      const before = created.length;
      if (await copyFileIfExists(path.join(source.rootDir, files[i]), gameDir, undefined, undefined, report.errors, created, signal)) {
        copied++;
        for (let k = before; k < created.length; k++) warnIfJsonBroken(created[k], report.warnings);
      }
    }
    report.copied[cat] = copied;
    if (created.length > 0) await importOps.journalAdd(gameDir, plan.sourceId, cat, created);
    if (!signal?.aborted) await importOps.journalComplete(gameDir, cat);
    step(stage);
  };
  if (plan.categories.includes('servers')) {
    await copyFileCat('servers', 'Servers');
    // ATLauncher keeps the servers not in servers.dat, but one by one in Servers/*.dat.
    const atServers = path.join(source.rootDir, 'Servers');
    if (safeStat(atServers)?.isDirectory()) {
      const created: string[] = [];
      journalByCat['servers-at'] = created;
      let n = 0;
      for (const f of safeReaddir(atServers)) {
        if (signal?.aborted) break;
        if (!f.endsWith('.dat')) continue;
        if (await copyFileIfExists(path.join(atServers, f), gameDir, undefined, undefined, report.errors, created, signal)) n++;
      }
      if (n > 0) {
        report.copied.servers = (report.copied.servers ?? 0) + n;
        await importOps.journalAdd(gameDir, plan.sourceId, 'servers-at', created);
      }
    }
  }
  if (plan.categories.includes('options')) await copyFileCat('options', 'Options');
  if (plan.categories.includes('usercache')) await copyFileCat('usercache', 'User cache');
  if (plan.categories.includes('pack-meta')) await copyFileCat('pack-meta', 'Pack metadata');

  // ── Version install ──
  if (plan.categories.includes('version-install')) {
    const entries = versionEntries;
    if (entries.length > 0) {
      const vDirSrc = path.join(source.rootDir, 'versions');
      const vDirDst = path.join(gameDir, 'versions');
      try { rmTrelTmps(vDirDst, 4); } catch {}
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const vid = entry.id;
        emit(`Importing ${vid}...`);
        const srcFolder = path.join(vDirSrc, entry.folder);
        const dstFolder = path.join(vDirDst, entry.folder);
        try {
          if (safeStat(srcFolder)?.isDirectory() && (entry.hasJar || entry.hasJson)) {
            const warnings: string[] = [];
            const created: string[] = [];
            // natives/ — the platform .dll/.so built for a foreign machine: Trel
            // downloads its own, and the foreign ones are dead weight plus a
            // risk of a broken runtime.
            const excluded = safeStat(path.join(srcFolder, 'natives'))?.isDirectory() ? new Set(['natives']) : undefined;
            if (excluded) warnings.push(`version "${vid}": natives/ skipped (platform libraries download for this machine)`);
            await copyDirAtomic(srcFolder, dstFolder, MAX_COPY_DEPTH, warnings, undefined, signal, copyMode, created, excluded);
            report.warnings.push(...warnings);
            if (created.length > 0) await importOps.journalAdd(gameDir, plan.sourceId, 'version-install', created);
            report.installedVersions.push(entry.folder === vid ? vid : `${entry.folder} → ${vid}`);
            report.copied['version-install'] = (report.copied['version-install'] ?? 0) + 1;
          } else if (installVersion) {
            await installVersion(vid);
            // A download belongs to the launcher as a whole — the rollback does
            // not delete it, but the trace stays in the journal (audit) and is
            // silently skipped.
            await importOps.journalAdd(gameDir, plan.sourceId, 'version-install-downloaded', [`downloaded:${vid}`]);
            report.installedVersions.push(vid);
            report.copied['version-install'] = (report.copied['version-install'] ?? 0) + 1;
          } else {
            report.warnings.push(`version "${vid}": no local files and no installer available`);
          }
        } catch (e) {
          // Do not spam one cryptic error per custom launcher profile. Keep the
          // profile copied when possible; if it cannot be copied, report the
          // exact folder/id pair for diagnostics.
          report.errors.push(`version "${entry.folder}" (${vid}): ${(e as Error).message}`);
        }
        completedSteps++;
      }
    } else if (versionsToInstall && versionsToInstall.length > 0 && installVersion) {
      for (let i = 0; i < versionsToInstall.length; i++) {
        const vid = versionsToInstall[i];
        emit(`Installing ${vid}...`);
        try { await installVersion(vid); report.installedVersions.push(vid); report.copied['version-install'] = (report.copied['version-install'] ?? 0) + 1; }
        catch (e) { report.errors.push(`version "${vid}": ${(e as Error).message}`); }
        completedSteps++;
      }
    } else { report.copied['version-install'] = 0; step(); }
    if (!signal?.aborted) await importOps.journalComplete(gameDir, 'version-install');
  }

  // ── Pre-build dedup hashes ──
  let dedup: DedupContext | undefined;
  let hashCache: HashCache | undefined;
  if (plan.deduplicate) {
    hashCache = loadHashCache(gameDir);
    dedup = { known: new Set<string>(), cache: hashCache };
    emit('Scanning existing files...');
    const contentCats = ['mods', 'shaderpacks', 'resourcepacks', 'texturepacks', 'config', 'datapacks', 'scripts', 'version-content', 'schematics', 'minimap', 'coremods', 'openloader'];
    // First — the sizes of the source files: hashing an existing destination
    // file only makes sense if its size occurs among the source files
    // (identical content ⇒ identical size).
    const sourceSizes = new Set<number>();
    for (const cat of plan.categories) {
      if (!contentCats.includes(cat)) continue;
      if (cat === 'version-content') {
        const vDirSrc = path.join(source.rootDir, 'versions');
        for (const ver of safeReaddir(vDirSrc)) {
          for (const sub of versionContentSubs(source.rootDir)) {
            collectSourceSizes(path.join(vDirSrc, ver, sub), DEDUP_HASH_DEPTH, sourceSizes);
          }
        }
      } else {
        for (const spec of CATEGORY_DIRS[cat] ?? []) {
          for (const from of specSourceDirs(source.rootDir, spec, source.kind === 'java')) {
            collectSourceSizes(from, DEDUP_HASH_DEPTH, sourceSizes);
          }
        }
      }
    }
    for (const cat of plan.categories) {
      if (!contentCats.includes(cat)) continue;
      if (cat === 'version-content') {
        const vDir = path.join(gameDir, 'versions');
        for (const ver of safeReaddir(vDir)) {
          for (const sub of versionContentSubs(source.rootDir)) {
            const destDir = versionContentDest(gameDir, vDir, ver, sub);
            const hh = await buildExistingHashes(destDir, DEDUP_HASH_DEPTH, sourceSizes, hashCache);
            for (const h of hh) dedup.known.add(h);
          }
        }
      } else {
        for (const spec of CATEGORY_DIRS[cat] ?? []) { const hh = await buildExistingHashes(path.join(gameDir, ...(spec.to ?? spec.from)), DEDUP_HASH_DEPTH, sourceSizes, hashCache); for (const h of hh) dedup.known.add(h); }
      }
    }
  }

  // ── Pre-scan file totals for accurate sub-progress ──
  const DIRS = source.kind === 'bedrock' ? BEDROCK_DIRS : CATEGORY_DIRS;
  const skipCats = new Set(['accounts', 'servers', 'options', 'usercache', 'pack-meta', 'version-install', 'version-content']);
  const catTotals: Record<string, number> = {};
  if (!signal?.aborted) {
    emit('Counting files...');
    for (const cat of plan.categories) {
      if (skipCats.has(cat)) continue;
      const specs = DIRS[cat];
      if (!specs || specs.length === 0) continue;
      const MAX_PRESCAN = 5000;
      let total = 0;
      for (const spec of specs) {
        for (const from of specSourceDirs(source.rootDir, spec, source.kind === 'java')) {
          if (!safeStat(from)?.isDirectory()) continue;
          if (safeReaddir(from).length > MAX_PRESCAN) { total = 0; break; }
          total += countFilesRecursive(from, cat === 'worlds' ? 3 : 2);
        }
      }
      if (total > 0) catTotals[cat] = total;
    }
  }

  // ── Content folders ──
  // Shared name registry: the categories with a common destination (worlds/saves
  // and version-content/saves) share one set, otherwise you get "World (1)".
  const takenReg = new Map<string, Set<string>>();
  // Category atomicity: if the copy of a category failed with an exception (disk,
  // permissions), what it has already created is rolled back via the journal —
  // no "half of mods".
  for (const cat of plan.categories) {
    if (signal?.aborted) break;
    if (skipCats.has(cat)) continue;
    const specs = DIRS[cat];
    if (!specs || specs.length === 0) { step(cat); continue; }
    const created: string[] = [];
    journalByCat[cat] = created;
    let catCopied = 0; let catSkipped = 0;
    let lastSubTick = 0;
    const catStart = Date.now();
    const hasTotal = catTotals[cat] && catTotals[cat] > 0;
    const fileTotal = hasTotal ? catTotals[cat]! : 0;
    let specAccum = 0;
    // Cleanup orphaned .trel_tmp in this category (recursive)
    for (const spec of specs) {
      const catDest = path.join(gameDir, ...(spec.to ?? spec.from));
      try { rmTrelTmps(catDest, 8); } catch {}
    }
    for (const spec of specs) {
      if (signal?.aborted) break;
      // There may be several matches (glob: the Badlion profiles per version) —
      // they all go to one destination, and the shared taken-registry resolves
      // the collisions.
      const froms = specSourceDirs(source.rootDir, spec, source.kind === 'java');
      if (froms.length === 0) continue;
      const to = path.join(gameDir, ...(spec.to ?? spec.from));
      for (const from of froms) {
      if (signal?.aborted) break;
      // We show in the warning that the content was taken from overrides/ —
      // that means the source instance was never launched.
      const mainDir = path.join(source.rootDir, ...spec.from);
      if (from !== mainDir) report.warnings.push(`${cat}: taken from ${path.relative(source.rootDir, from)}`);
      try {
        const r = await copyTreeNoOverwrite(from, to, dedup, (cnt) => {
          const now = Date.now();
          if (now - lastSubTick > 200) {
            lastSubTick = now;
            const totalCnt = specAccum + cnt;
            const elapsed = (now - catStart) / 1000;
            const suffix = fileTotal ? ` (${totalCnt}/${fileTotal})` : ` (${totalCnt})`;
            const eta = totalCnt > 0 && fileTotal > 0 ? Math.round((elapsed / totalCnt) * (fileTotal - totalCnt)) : 0;
            emit(`${cat}${suffix}${eta > 0 ? ` ~${eta}s` : ''}`, eta > 0 ? eta : undefined);
          }
        }, signal, copyMode, created, takenReg);
        specAccum += r.copied;
        catCopied += r.copied; catSkipped += r.skipped; report.errors.push(...r.errors); report.warnings.push(...r.warnings);
      } catch (e) {
        // The category is all or nothing: we roll back what was created and move on.
        const gone = await importOps.rollbackJournal(gameDir, cat).catch(() => 0);
        // rollbackJournal reads the journal from disk — and we have not written
        // there yet, so we clean up the live list directly as well.
        for (const f of [...created].sort((a, b) => b.length - a.length)) {
          try { await fsp.unlink(ntPath(f)); } catch {}
        }
        report.rolledBackFiles = (report.rolledBackFiles ?? 0) + gone + created.length;
        report.errors.push(`${cat}: ${(e as Error).message} (partial files rolled back)`);
        created.length = 0;
        break;
      }
      } // for from of froms
    }
    report.durationsMs![cat] = Date.now() - catStart;
    report.copied[cat] = catCopied; report.skipped[cat] = catSkipped;
    if (created.length > 0) await importOps.journalAdd(gameDir, plan.sourceId, cat, created);
    if (!signal?.aborted) await importOps.journalComplete(gameDir, cat);
    step(cat);
  }

  // ── Per-version content ──
  if (plan.categories.includes('version-content') && !signal?.aborted) {
    const vDirSrc = path.join(source.rootDir, 'versions');
    const vDirDst = path.join(gameDir, 'versions');
    let catCopied = 0; let catSkipped = 0;
    const vcStart = Date.now();
    let worldsDupes = 0;
    if (safeStat(vDirSrc)?.isDirectory()) {
      let lastSubTick = 0;
      for (const ver of safeReaddir(vDirSrc)) {
        if (signal?.aborted) break;
        for (const sub of versionContentSubs(source.rootDir)) {
          const from = path.join(vDirSrc, ver, sub);
          if (!safeStat(from)?.isDirectory()) continue;
          // TLauncher isolation: the worlds from versions/<v>/saves go to the
          // shared saves, because Trel reads the saves from nowhere else.
          const to = versionContentDest(gameDir, vDirDst, ver, sub);
          // The same world has already arrived from the shared saves: we do not
          // spawn "World (1)", but skip it honestly with a warning (the source
          // is left untouched).
          let exclude: Set<string> | undefined;
          if (sub === 'saves') {
            const dupes = safeReaddir(from).filter((w) =>
              safeStat(path.join(from, w))?.isDirectory() && safeStat(path.join(to, w))?.isDirectory());
            if (dupes.length > 0) {
              worldsDupes += dupes.length;
              catSkipped += dupes.length;
              exclude = new Set(dupes);
            }
          }
          const r = await copyTreeNoOverwrite(from, to, dedup, (cnt) => {
            const now = Date.now();
            if (now - lastSubTick > 200) {
              lastSubTick = now;
              emit(`version-content (${cnt})`);
            }
          }, signal, copyMode, journalByCat['version-content'] ??= [], takenReg, exclude);
          catCopied += r.copied; catSkipped += r.skipped; report.errors.push(...r.errors); report.warnings.push(...r.warnings);
        }
      }
    }
    if (worldsDupes > 0) report.warnings.push(`${worldsDupes} isolated world(s) already imported from shared saves — skipped, not duplicated`);
    report.durationsMs!['version-content'] = Date.now() - vcStart;
    report.copied['version-content'] = catCopied; report.skipped['version-content'] = catSkipped;
    if ((journalByCat['version-content'] ?? []).length > 0) {
      await importOps.journalAdd(gameDir, plan.sourceId, 'version-content', journalByCat['version-content']);
    }
    if (!signal?.aborted) await importOps.journalComplete(gameDir, 'version-content');
    step('version-content');
  }

  report.aborted = signal?.aborted ?? false;
  if (report.aborted) {
    // An aborted import is neither an error nor a success: some files are
    // already in place. A re-run picks up what was skipped (skip identical /
    // dedup), the journal knows what is done.
    report.warnings.push('import was cancelled: already copied files were kept, re-run resumes where it stopped');
  }

  // ── Post-checks (only on success, so that a cancellation stays quiet) ──
  if (!report.aborted) {
    // Case conflicts on Windows/macOS: two names into one file.
    for (const c of findCaseConflicts(source.rootDir, plan.categories, source.kind === 'bedrock')) {
      report.warnings.push(`name case conflict (one file may have overwritten the other): ${c}`);
    }
    // Quarantine + duplicate modids + verify the integrity of the mods.
    if ((report.copied.mods ?? 0) > 0 || (report.skipped.mods ?? 0) > 0) {
      emit('Checking mods...');
      const destMods = path.join(gameDir, 'mods');
      const srcMods = specSourceDirs(source.rootDir, CATEGORY_DIRS.mods[0], source.kind === 'java')[0];
      let jars: string[] = [];
      try { jars = fs.readdirSync(ntPath(destMods)).filter((f) => f.endsWith('.jar')).slice(0, 200); } catch {}
      const quar: string[] = [];
      let checked = 0;
      for (const j of jars) {
        const destJar = path.join(destMods, j);
        const why = importOps.scanJarSuspicious(destJar);
        if (why) quar.push(`${j} — ${why}`);
        // Verify: the hash of the copy must match the hash of its source. We take
        // the pair from the copy journal, not by name: the collisions lie next
        // to it as " (n)".
        const sj = _copyPairs?.get(destJar);
        if (sj && checked < 50) {
          const [hs, hd] = await Promise.all([fileSha1Cached(sj, hashCache), fileSha1Cached(destJar, hashCache)]);
          if (hs && hd && hs !== hd) {
            report.errors.push(`mod corrupted in transfer: ${j}`);
            quar.push(`${j} — hash mismatch after copy`);
          }
          checked++;
        }
      }
      if (quar.length > 0) {
        report.quarantine = quar.slice(0, 20);
        report.warnings.push(`quarantine: ${quar.length} mod(s) look suspicious — check before launching: ${quar.slice(0, 3).join('; ')}`);
      }
      if (srcMods) {
        const dups = importOps.findDuplicateMods(srcMods);
        if (dups.length > 0) {
          report.duplicateMods = dups.slice(0, 10);
          report.warnings.push(`same mod in several versions: ${dups.slice(0, 3).join('; ')} — keep the one your loader needs`);
        }
      }
    }
    // Dedup savings: the bytes that were not copied (already present in Trel).
    report.savedBytes = takeBytesSaved() || undefined;
    // Move: the source is deleted only if everything matched (no errors/cancellation).
    if (plan.moveSource && report.errors.length === 0) {
      emit('Moving source files...');
      let moved = 0;
      // We delete only what we copied in this run (the pairs from the journal),
      // and only if the sizes matched. Looking it up by name does not work:
      // " (n)" lies.
      for (const [dest, srcFile] of _copyPairs ?? []) {
        try {
          const [ss, ds] = await Promise.all([fsp.stat(ntPath(srcFile)), fsp.stat(ntPath(dest))]);
          if (ss.isFile() && ds.isFile() && ss.size === ds.size) { await fsp.unlink(ntPath(srcFile)); moved++; }
        } catch { /* the twin did not match — leave it */ }
      }
      const swept = await importOps.sweepMovedSource(
        [...new Set([...(_copyPairs ?? new Map()).values()].map((f) => path.dirname(f)))].slice(0, 50));
      if (moved > 0) {
        report.movedSource = true;
        let msg = `source files removed after verified move (${moved} files`;
        if (copyMode === 'hardlink') msg += ', hardlinks: data stays alive through Trel copies';
        msg += ')';
        report.warnings.push(msg);
        if (swept.left > 0) report.warnings.push(`${swept.left} file(s) left in source (dedup-skipped or unverified) — remove manually if the move is complete`);
      }
    }
  }

  // Rename summary: " (n)" in the created paths = name collisions.
  // The worlds are special: "World (1)" means a duplicate from another launcher.
  let renamed = 0;
  for (const created of Object.values(journalByCat)) {
    for (const f of created) if (/ \(\d+\)/.test(f)) renamed++;
  }
  if (renamed > 0) report.warnings.push(`${renamed} file(s) renamed with ' (n)' suffix due to name collisions — check worlds for duplicates`);
  const staleFixed = takeStaleFixed();
  if (staleFixed > 0) report.warnings.push(`${staleFixed} file(s) re-copied: hash cache was stale (content changed with same mtime)`);
  // The counters — after the post-checks: the "Checking mods…" tick must carry
  // live bytes, not zero after take. The checks themselves only read, they do
  // not write.
  report.bytesWritten = takeBytesWritten();
  report.totalMs = Date.now() - importStarted;
  report.pausedMs = takePausedMs();
  report.pauses = takePauseCount();
  _copyPairs = null;

  // We write the hash cache after the copy: some entries appeared during the
  // deduplication, and a repeated import of the same source reuses them.
  // TTL/GC: the entries older than 30 days and the tail beyond the limit are
  // dropped, otherwise the cache file grows forever on live builds.
  if (hashCache) {
    const CUTOFF = Date.now() - 30 * 24 * 3600 * 1000;
    for (const [k] of hashCache) {
      const mtime = Number(k.slice(k.lastIndexOf('|') + 1));
      if (Number.isFinite(mtime) && mtime < CUTOFF) hashCache.delete(k);
      if (hashCache.size < 200_000) break;
    }
    await saveHashCache(gameDir, hashCache);
  }

  // ── Import manifest ──
  const avgSpeed = report.totalMs > 0 && (report.bytesWritten ?? 0) > 0
    ? Math.round((report.bytesWritten ?? 0) / (report.totalMs / 1000)) : undefined;
  try {
    await fsp.writeFile(ntPath(path.join(gameDir, '.trel_import.json')),
      JSON.stringify({ timestamp: new Date().toISOString(), sourceId: plan.sourceId, categories: plan.categories,
        copied: report.copied, skipped: report.skipped, newAccounts: report.newAccounts.length,
        installedVersions: report.installedVersions, errors: report.errors,
        durationsMs: report.durationsMs, bytesWritten: report.bytesWritten, totalMs: report.totalMs,
        hardlinks: plan.useHardlinks ?? false, deduplicate: plan.deduplicate ?? false,
        aborted: report.aborted, lastSpeedBps: avgSpeed,
        quarantine: report.quarantine?.length ?? 0, movedSource: report.movedSource ?? false }, null, 2), 'utf-8');
  } catch { /* skip */ }
  await importOps.appendImportLog(gameDir,
    `done ${plan.sourceId} copied=${Object.values(report.copied).reduce((a, b) => a + (b ?? 0), 0)} errors=${report.errors.length} aborted=${report.aborted}`);

  return report;
}

export function detectFromDir(dir: string): DetectedSource | null {
  if (!safeStat(dir)?.isDirectory()) return null;
  if (!isPathAllowed(dir)) { console.warn(`[import] detectFromDir: blocked system path: ${dir}`); return null; }
  const isBedrock = safeStat(path.join(dir, 'minecraftWorlds'))?.isDirectory() && !safeStat(path.join(dir, 'saves'))?.isDirectory();
  const cats = availableCategories(dir, isBedrock);
  if (cats.length === 0) return null;
  const installableVersions = isBedrock ? undefined : detectInstallableVersions(dir);
  if (!isBedrock && !hasRealJavaImportContent(cats, installableVersions)) return null;
  const accRoots = isBedrock ? [] : [dir, path.dirname(dir)];
  if (!isBedrock && !cats.includes('accounts') && hasAccountFiles(accRoots)) cats.push('accounts');
  // The instance metadata (instance.cfg, minecraftinstance.json) sits one level
  // higher only in the MultiMC family, where the instance contains .minecraft.
  // We must never look in the parent unconditionally: the user may pick a folder
  // that happens to have a foreign instance.cfg next to it — and we would sign
  // the build with a foreign name and a foreign -Xmx.
  const base = path.basename(dir).toLowerCase();
  const instRoot = (base === '.minecraft' || base === 'minecraft') ? path.dirname(dir) : dir;
  const nice = isBedrock ? null : (readInstanceName(dir) ?? (instRoot !== dir ? readInstanceName(instRoot) : null));
  return {
    id: 'custom',
    label: isBedrock ? 'Minecraft Bedrock Edition' : (nice ?? inferJavaSourceLabel(dir, path.basename(dir) + ' (' + dir + ')')),
    rootDir: dir, available: cats, approxSize: approxSizeOf(dir, cats, isBedrock),
    kind: isBedrock ? 'bedrock' : 'java', installableVersions,
    accountsRoots: isBedrock ? undefined : accRoots,
    modpack: isBedrock ? undefined : detectModpack(dir, instRoot),
    launcherTweaks: isBedrock ? undefined : detectLauncherTweaks(instRoot, dir),
  };
}

// ─── Preview / free space ───────────────────────────────────────────────

/**
 * Free bytes on the volume where the game folder lives (or will live).
 * null — the volume statistics are unavailable (no statfsSync, an exotic
 * filesystem): then the space check cannot be reported as successful, and it
 * has to be reported honestly.
 */
function freeSpaceFor(dir: string): number | null {
  // The folder may not exist yet — we walk up to the first existing parent.
  let probe = path.resolve(dir);
  for (let i = 0; i < 8; i++) {
    if (safeStat(probe)?.isDirectory()) break;
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  try {
    const st = (fs as unknown as { statfsSync?: (p: string) => { bsize: number; bavail: number } }).statfsSync?.(probe);
    if (st) return st.bsize * st.bavail;
  } catch {}
  return null;
}

/**
 * Plan preview: how many files and bytes will move for each category and
 * whether there is enough space. The user used to see only an approximate size
 * of the whole source and ran into a lack of space in the middle of the copy
 * (ENOSPC).
 *
 * Unlike approxSizeOf (a fast estimate for the source list) the tree is walked
 * here to the full copy depth: the number goes into the free space check and
 * must not be underestimated.
 */
export function previewImport(plan: ImportPlan, source: DetectedSource, gameDir: string): ImportPreview {
  const files: Partial<Record<ImportCategory, number>> = {};
  const bytes: Partial<Record<ImportCategory, number>> = {};
  const warnings: string[] = [];
  const DIRS = source.kind === 'bedrock' ? BEDROCK_DIRS : CATEGORY_DIRS;
  const allowOverrides = source.kind === 'java';

  // The same cleanup as in performImport: otherwise the preview counts
  // assets/skins twice (both in assets and in skin-cache) and scares the user
  // with a lack of space.
  const categories = dropNestedCategories(plan.categories, source.kind === 'bedrock');
  if (categories.length !== plan.categories.length) {
    const dropped = plan.categories.filter((c) => !categories.includes(c));
    warnings.push(`categories already covered by a broader one (not counted twice): ${dropped.join(', ')}`);
  }

  const add = (cat: ImportCategory, m: { files: number; bytes: number }) => {
    if (m.files) files[cat] = (files[cat] ?? 0) + m.files;
    if (m.bytes) bytes[cat] = (bytes[cat] ?? 0) + m.bytes;
  };
  // The first files for the preview tree + the diff estimate (same-name+size).
  // One walk per category: scanDir already counts the files/bytes.
  const tree: Array<{ path: string; bytes: number }> = [];
  let diffFresh = 0; let diffOverwrite = 0; let diffIdentical = 0; let savedEst = 0;
  let scanTruncated = false;
  // We split the tree evenly between the folders: otherwise the first assets
  // folder eats the whole cap of 300, and mods are not visible in the preview
  // at all.
  const dirCatCount = Math.max(1, categories.filter((c) => {
    if (c === 'version-install') return false;
    const specs = DIRS[c];
    return !!specs && specs.length > 0;
  }).length + (categories.includes('version-content') ? 1 : 0));
  const TREE_PER_CAT = Math.max(20, Math.ceil(300 / dirCatCount));
  const scanInto = (cat: ImportCategory, from: string, destBase: string) => {
    const sc = scanDir(from, MAX_COPY_DEPTH, TREE_PER_CAT);
    if (sc.truncated) scanTruncated = true;
    add(cat, sc);
    for (const t of sc.top) {
      if (tree.filter((x) => x.path.startsWith(`${cat}/`)).length < TREE_PER_CAT) {
        tree.push({ path: `${cat}/${t.rel}`, bytes: t.bytes });
      }
      // Diff against the twin in the destination: missing / same size / different size.
      const twin = path.join(destBase, t.rel);
      const dst = safeStat(twin);
      if (!dst) diffFresh++;
      else if (dst.isFile() && dst.size === t.bytes) { diffIdentical++; savedEst += t.bytes; }
      else diffOverwrite++;
    }
  };

  for (const cat of categories) {
    if (cat === 'version-install') continue;
    if (cat === 'version-content') {
      const vDirSrc = path.join(source.rootDir, 'versions');
      for (const ver of safeReaddir(vDirSrc)) {
        for (const sub of versionContentSubs(source.rootDir)) {
          const from = path.join(vDirSrc, ver, sub);
          if (!safeStat(from)?.isDirectory()) continue;
          const destBase = versionContentDest(gameDir, path.join(gameDir, 'versions'), ver, sub);
          scanInto('version-content', from, destBase);
        }
      }
      continue;
    }
    const specs = DIRS[cat];
    if (!specs || specs.length === 0) {
      // File-based categories (accounts/servers/options/...) — bytes only.
      const b = fileSizeInRoot(source.rootDir, cat, Infinity);
      if (b) bytes[cat] = b;
      continue;
    }
    for (const spec of specs) {
      for (const from of specSourceDirs(source.rootDir, spec, allowOverrides)) {
        scanInto(cat, from, path.join(gameDir, ...(spec.to ?? spec.from)));
      }
    }
  }

  const versions = categories.includes('version-install')
    ? (source.installableVersions ?? detectInstallableVersions(source.rootDir))
    : [];
  if (versions.length > 0) {
    // Without a limit on the number of versions: the number goes into the space check.
    const b = fileSizeInRoot(source.rootDir, 'version-install', Infinity);
    if (b) bytes['version-install'] = b;
    files['version-install'] = versions.length;
  }

  const totalFiles = Object.values(files).reduce((a, b2) => a + (b2 ?? 0), 0);
  const totalBytes = Object.values(bytes).reduce((a, b2) => a + (b2 ?? 0), 0);
  const free = freeSpaceFor(gameDir);
  // A 5% (or at least 200 MB) reserve for the service files and fragmentation.
  const headroom = Math.max(totalBytes * 0.05, 200 * 1024 * 1024);
  // Hardlinks do not take up any space, so checking it would be pointless.
  // But a fallback to copying is possible (another volume), so we cannot stay silent.
  const spaceMatters = !plan.useHardlinks;
  const notEnoughSpace = spaceMatters && free !== null && totalBytes + headroom > free;
  if (notEnoughSpace && free !== null) {
    warnings.push(`not enough free space: need ~${Math.ceil((totalBytes + headroom) / 1024 / 1024)} MB, free ${Math.floor(free / 1024 / 1024)} MB`);
  }
  if (free === null) {
    warnings.push('could not read free space for the game volume — space check skipped');
  }
  if (plan.useHardlinks) {
    warnings.push('hardlink mode: files will be shared with the source launcher (same inode)');
  }
  if (source.launcherTweaks?.maxMemoryMb) {
    warnings.push(`source launcher allocates ${source.launcherTweaks.maxMemoryMb} MB of RAM — set the same in Trel settings`);
  }
  if (scanTruncated) warnings.push('preview listing truncated at 200k files per folder — totals are exact, the file list is not');
  for (const n of sourceNotes(source)) warnings.push(n);
  for (const w of secretStoreWarnings(source)) warnings.push(w);
  // Estimate of the time before the start based on the speed of the last import into this folder.
  let etaSecondsEstimate: number | undefined;
  try {
    const last = readLastImportReport(gameDir);
    if (last?.lastSpeedBps && last.lastSpeedBps > 0 && totalBytes > 0) {
      etaSecondsEstimate = Math.round(totalBytes / last.lastSpeedBps);
    }
  } catch {}
  const servers = parseServersDat(path.join(source.rootDir, 'servers.dat'));
  // Estimate of the modpack compatibility with what is already installed (from the nearby index).
  const packCompat = previewPackCompat(source);
  if (packCompat) warnings.push(packCompat);
  return { files, bytes, totalFiles, totalBytes, freeBytes: free ?? 0, freeSpaceUnknown: free === null, notEnoughSpace, versions, warnings,
    servers: servers.length > 0 ? servers : undefined,
    diff: { fresh: diffFresh, overwrite: diffOverwrite, identical: diffIdentical },
    savedBytesEstimate: savedEst > 0 ? savedEst : undefined,
    etaSecondsEstimate, fileTree: tree.length > 0 ? tree : undefined };
}

/**
 * Compatibility of the source modpack with the already installed Trel stack.
 * Without network: we compare the mc/loader from the pack index with the
 * versions in gameDir/versions. A mismatch is a warning, not a ban: the pack
 * may still travel as plain files.
 */
export function previewPackCompat(source: DetectedSource): string | null {
  if (!source.modpack || source.modpack.loader === 'vanilla') return null;
  // We check the index next to rootDir (the overrides/minecraft layouts).
  const idxDirs = [source.rootDir, path.dirname(source.rootDir)];
  for (const d of idxDirs) {
    for (const mf of ['modrinth.index.json', 'manifest.json']) {
      let raw: unknown = null;
      try { raw = JSON.parse(fs.readFileSync(ntPath(path.join(d, mf)), 'utf-8')); } catch { continue; }
      if (!raw || typeof raw !== 'object') continue;
      const deps = (raw as Record<string, unknown>).dependencies as Record<string, string> | undefined;
      const mc = deps?.minecraft ?? (raw as Record<string, unknown>).minecraft;
      const mcVer = typeof mc === 'string' ? mc : (mc as Record<string, unknown> | undefined)?.version;
      if (typeof mcVer === 'string' && mcVer.length > 0) {
        return `modpack targets Minecraft ${mcVer} (${source.modpack.loader}) — make sure Trel has the same game + loader installed`;
      }
      return `modpack manifest found (${source.modpack.loader}) — make sure Trel has the same game + loader installed`;
    }
  }
  return null;
}

/**
 * Report about the last import into this game folder.
 *
 * The manifest was written from the very beginning, but nobody read it: a user
 * opening the import page a second time saw the same list of sources with no
 * trace of the transfer having happened. Deduplication saves from duplicate
 * files, but it does not answer the question "did I already do this?".
 */
export function readLastImportReport(gameDir: string): LastImportInfo | null {
  const raw = readJson(path.join(gameDir, '.trel_import.json')) as Record<string, unknown> | null;
  if (!raw || typeof raw.timestamp !== 'string' || typeof raw.sourceId !== 'string') return null;
  const at = Date.parse(raw.timestamp);
  if (!Number.isFinite(at)) return null;
  const copiedRaw = (raw.copied ?? {}) as Record<string, unknown>;
  let copiedFiles = 0;
  for (const v of Object.values(copiedRaw)) if (typeof v === 'number') copiedFiles += v;
  return {
    at,
    sourceId: raw.sourceId,
    categories: Array.isArray(raw.categories) ? raw.categories.filter((c): c is string => typeof c === 'string') : [],
    copiedFiles,
    aborted: raw.aborted === true,
    hardlinks: raw.hardlinks === true,
    lastSpeedBps: typeof raw.lastSpeedBps === 'number' && raw.lastSpeedBps > 0 ? raw.lastSpeedBps : undefined,
  };
}
