import axios, { AxiosRequestConfig } from 'axios';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import { BrowserWindow } from 'electron';
import AdmZip from 'adm-zip';
import { DownloadProgress } from '../shared/types';
import { isSafeVersionId } from './safeIds';
import { isUrlAllowed, scanDownloadedFileAsync, verifyDownloadSource } from './download-security';

const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
const RESOURCES_HOST = 'https://resources.download.minecraft.net';
const S3_LEGACY_HOST = 'https://s3.amazonaws.com/Minecraft.Download';

export { isUrlAllowed } from './download-security';

interface MojangDownload { url: string; sha1: string; size: number; }
interface MojangLibraryArtifact extends MojangDownload { path: string; }
interface MojangLibrary {
  name: string;
  downloads?: { artifact?: MojangLibraryArtifact; classifiers?: Record<string, MojangLibraryArtifact> };
  natives?: Record<string, string>;
  extract?: { exclude?: string[] };
  rules?: Array<{ action: 'allow' | 'disallow'; os?: { name?: string; version?: string; arch?: string } }>;
  url?: string;
}
interface VersionJson {
  id: string; inheritsFrom?: string; assets?: string;
  assetIndex?: { id: string; url: string; sha1: string; size: number; totalSize: number };
  downloads?: { client?: MojangDownload; server?: MojangDownload };
  libraries: MojangLibrary[];
  javaVersion?: { component: string; majorVersion: number };
  mainClass: string; type: string;
  minecraftArguments?: string; arguments?: { game: any[]; jvm: any[] };
  logging?: { client?: { argument: string; file: MojangDownload } };
  minimumLauncherVersion?: number;
  releaseTime?: string;
  time?: string;
}
interface AssetIndexJson { objects: Record<string, { hash: string; size: number }>; virtual?: boolean; map_to_resources?: boolean; }

function sha1File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(file);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function ensureDir(p: string) { await fs.promises.mkdir(p, { recursive: true }); }

function osName(): 'windows' | 'linux' | 'osx' {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'osx';
  return 'linux';
}

/** Normalise process.arch (ia32/x64/arm64) to Mojang manifest arch (x86/x64/arm64). */
function manifestArch(): string {
  if (process.arch === 'ia32') return 'x86';
  return process.arch;
}

function libraryAllowed(lib: MojangLibrary): boolean {
  if (!lib.rules || lib.rules.length === 0) return true;
  let allowed = false;
  for (const rule of lib.rules) {
    if (!rule.os) { allowed = rule.action === 'allow'; continue; }
    const nameMatch = !rule.os.name || rule.os.name === osName() || (rule.os.name === 'osx' && process.platform === 'darwin');
    const archMatch = !rule.os.arch || rule.os.arch === manifestArch();
    if (nameMatch && archMatch) allowed = rule.action === 'allow';
  }
  return allowed;
}

function nativeClassifier(lib: MojangLibrary): string | null {
  if (!lib.natives) return null;
  const raw = lib.natives[osName()] || null;
  if (!raw) return null;
  // Resolve ${arch} placeholder — some manifests use "natives-windows-${arch}"
  const arch = process.arch === 'arm64' ? 'arm64' : (process.arch === 'ia32' ? 'x86' : 'x64');
  return raw.replace('${arch}', arch);
}

/** Safe rename that falls back to copy+unlink on cross-device (EXDEV). */
function safeRenameSync(src: string, dest: string): void {
  try { fs.renameSync(src, dest); return; }
  catch (e: any) {
    if (e?.code === 'EXDEV') {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
      return;
    }
    throw e;
  }
}

/** Atomic JSON write: temp file + rename. */
function atomicWriteJson(filePath: string, data: unknown): void {
  const tmp = filePath + '.trel_tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  safeRenameSync(tmp, filePath);
}

async function downloadWithRetry(
  url: string, dest: string, expectedSha1: string | undefined,
  attempts = 5, expectedSize?: number,
  onProgress?: (bytesDownloadedForFile: number, deltaBytes: number) => void,
): Promise<void> {
  await ensureDir(path.dirname(dest));

  if (fs.existsSync(dest)) {
    if (expectedSha1) {
      try {
        const actual = await sha1File(dest);
        if (actual === expectedSha1) return;
        try { fs.unlinkSync(dest); } catch {}
      } catch {}
    } else if (typeof expectedSize === 'number' && expectedSize > 0) {
      try {
        const stat = fs.statSync(dest);
        if (stat.size === expectedSize) return;
        try { fs.unlinkSync(dest); } catch {}
      } catch {}
    } else { return; }
  }

  let lastErr: unknown;
  // Validate initial URL. Trusted Minecraft/Mojang/Microsoft/CDN sources are
  // auto-confirmed; unknown hosts stay blocked.
  const initialTrust = verifyDownloadSource(url);
  if (!initialTrust.allowed) throw new Error(`${initialTrust.reason}: ${url}`);
  let currentUrl = url;
  const CHAIN_DEADLINE_MS = 300000; // 5 minutes max for entire redirect chain + download
  for (let i = 0; i < attempts; i++) {
    try {
      const tmp = dest + '.part';
      const chainStart = Date.now();
      // Handle redirects manually: disable auto-redirects, validate each hop
      let resp = await axios.get(currentUrl, {
        responseType: 'stream', timeout: 60000, maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
      });
      // Follow redirects manually with host validation
      let redirectHops = 0;
      while (resp.status >= 300 && resp.status < 400 && resp.headers.location && redirectHops < 5) {
        if (Date.now() - chainStart > CHAIN_DEADLINE_MS) {
          throw new Error('Download redirect chain timed out');
        }
        const loc = resp.headers.location;
        // Resolve relative URLs
        const nextUrl = new URL(loc, currentUrl).toString();
        const redirectTrust = verifyDownloadSource(nextUrl);
        if (!redirectTrust.allowed) throw new Error(`${redirectTrust.reason}: ${nextUrl}`);
        currentUrl = nextUrl;
        redirectHops++;
        resp = await axios.get(currentUrl, {
          responseType: 'stream', timeout: 60000, maxRedirects: 0,
          validateStatus: (s) => s >= 200 && s < 400,
        });
      }
      let currentFileBytes = 0;
      await new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(tmp);
        resp.data.on('data', (chunk: Buffer) => {
          currentFileBytes += chunk.length;
          if (onProgress) {
            try { onProgress(currentFileBytes, chunk.length); } catch { /* swallow callback errors */ }
          }
        });
        resp.data.on('error', (e: Error) => { try { out.close(); } catch {} reject(e); });
        out.on('error', reject);
        out.on('finish', () => resolve());
        resp.data.pipe(out);
      });
      if (expectedSha1) {
        const actual = await sha1File(tmp);
        if (actual !== expectedSha1) {
          try { fs.unlinkSync(tmp); } catch {}
          throw new Error(`sha1 mismatch: expected ${expectedSha1}, got ${actual}`);
        }
      }
      try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch {}
      safeRenameSync(tmp, dest);
      await scanDownloadedFileAsync(dest);
      return;
    } catch (e) {
      lastErr = e;
      try { fs.unlinkSync(dest + '.part'); } catch {}
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 300 * Math.pow(2, i)));
      }
    }
  }
  throw new Error(`Failed to download ${url}: ${(lastErr as Error)?.message ?? lastErr}`);
}

async function parallelPool<T>(items: T[], worker: (item: T) => Promise<void>, concurrency: number, onOne?: () => void): Promise<void> {
  let i = 0;
  const runners: Promise<void>[] = [];
  const next = async (): Promise<void> => {
    while (i < items.length) { const idx = i++; try { await worker(items[idx]); } finally { onOne?.(); } }
  };
  for (let n = 0; n < concurrency; n++) runners.push(next());
  await Promise.all(runners);
}

export function getDynamicConcurrency(): number {
  try {
    const cores = os.cpus().length;
    return Math.min(16, Math.max(4, cores * 2));
  } catch {
    return 8;
  }
}

export function isLikelyValid(dest: string, expectedSize?: number): boolean {
  try {
    const stat = fs.statSync(dest);
    if (!stat.isFile()) return false;
    if (typeof expectedSize === 'number' && expectedSize > 0) return stat.size === expectedSize;
    return stat.size > 0;
  } catch { return false; }
}

export class MinecraftInstaller {
  private gameDir: string;
  private lastReport = 0;
  /** Per-version install mutex — prevents parallel installs of the same version. */
  private installing = new Map<string, Promise<any>>();

  constructor(gameDir: string) { this.gameDir = gameDir; }
  setGameDir(dir: string) { this.gameDir = dir; }

  private manifestCachePath(): string {
    return path.join(this.gameDir, '.trel-cache', 'version_manifest_v2.json');
  }

  private readCachedManifestVersions(): { id: string; type: string; url: string; releaseTime: string }[] {
    try {
      const cachePath = this.manifestCachePath();
      if (!fs.existsSync(cachePath)) return [];
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (!Array.isArray(data?.versions)) return [];
      return data.versions.filter((v: any) =>
        v && typeof v.id === 'string' && typeof v.type === 'string' &&
        typeof v.releaseTime === 'string' && typeof v.url === 'string',
      );
    } catch {
      return [];
    }
  }

  private writeManifestCache(data: any): void {
    try {
      if (!data?.versions || !Array.isArray(data.versions)) return;
      const cachePath = this.manifestCachePath();
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      atomicWriteJson(cachePath, data);
    } catch {}
  }

  private localInstalledVersionsFallback(): { id: string; type: string; url: string; releaseTime: string }[] {
    const versionsDir = path.join(this.gameDir, 'versions');
    if (!fs.existsSync(versionsDir)) return [];
    const out: { id: string; type: string; url: string; releaseTime: string }[] = [];
    for (const entry of fs.readdirSync(versionsDir)) {
      const dir = path.join(versionsDir, entry);
      const jar = path.join(dir, `${entry}.jar`);
      const jsonPath = path.join(dir, `${entry}.json`);
      if (!fs.existsSync(jar) && !fs.existsSync(jsonPath)) continue;
      try {
        const json = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) : {};
        out.push({
          id: entry,
          type: typeof json.type === 'string' ? json.type : 'release',
          url: typeof json.url === 'string' ? json.url : '',
          releaseTime: typeof json.releaseTime === 'string' ? json.releaseTime : (typeof json.time === 'string' ? json.time : new Date(0).toISOString()),
        });
      } catch {
        out.push({ id: entry, type: 'release', url: '', releaseTime: new Date(0).toISOString() });
      }
    }
    return out.sort((a, b) => b.releaseTime.localeCompare(a.releaseTime));
  }

  async fetchVersions(): Promise<{ id: string; type: string; url: string; releaseTime: string }[]> {
    const MAX_RETRIES = 3;
    let lastError: any;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data } = await axios.get(MANIFEST_URL, {
          timeout: 15000,
          headers: { 'User-Agent': 'Botlume-Launcher/0.1' },
        });
        if (!data?.versions || !Array.isArray(data.versions)) {
          throw new Error('Invalid manifest format: missing versions array');
        }
        this.writeManifestCache(data);
        return data.versions;
      } catch (err: any) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 1s, 2s. Retry all network errors, not only
          // socket hang up: Axios on Node 20 can wrap DNS/IPv6 failures into
          // AggregateError, and the launcher should not fail the whole catalog.
          await new Promise((r) => setTimeout(r, attempt * 1000));
          continue;
        }
      }
    }

    const cached = this.readCachedManifestVersions();
    if (cached.length > 0) {
      console.warn(`[installer] Mojang manifest unavailable, using cached manifest (${cached.length} versions): ${lastError?.message || lastError}`);
      return cached;
    }

    const local = this.localInstalledVersionsFallback();
    if (local.length > 0) {
      console.warn(`[installer] Mojang manifest unavailable, using local installed versions (${local.length} versions): ${lastError?.message || lastError}`);
      return local;
    }

    throw new Error(
      `Failed to fetch version manifest after ${MAX_RETRIES} attempts: ${lastError?.message || lastError}`,
    );
  }

  /** Throttled progress report — max once per 100ms. */
  private report(win: BrowserWindow | undefined, p: DownloadProgress) {
    const now = Date.now();
    if (now - this.lastReport < 100) return;
    this.lastReport = now;
    if (win && !win.isDestroyed()) win.webContents.send('minecraft:progress', p);
  }

  /** Validate basic structure of a version JSON to reject garbage/malicious data. */
  private validateVersionJson(json: any, versionId: string): void {
    if (!json || typeof json !== 'object') throw new Error(`Invalid version JSON for ${versionId}`);
    if (typeof json.id !== 'string' || json.id.length === 0 || json.id.length > 128) throw new Error(`Invalid version id in JSON`);
    if (typeof json.mainClass !== 'string' || json.mainClass.length > 256) throw new Error(`Invalid mainClass in version JSON`);
    if (!Array.isArray(json.libraries)) throw new Error(`Missing libraries array in version JSON`);
    if (json.inheritsFrom !== undefined && typeof json.inheritsFrom !== 'string') throw new Error(`Invalid inheritsFrom`);
    if (json.downloads) {
      if (json.downloads.client) {
        if (typeof json.downloads.client.url !== 'string' || !json.downloads.client.url.startsWith('http')) throw new Error(`Invalid client download URL`);
      }
    }
    if (json.assetIndex) {
      if (typeof json.assetIndex.url !== 'string' || !json.assetIndex.url.startsWith('http')) throw new Error(`Invalid assetIndex URL`);
    }
    // Validate library entries (check all)
    for (const lib of json.libraries) {
      if (lib && typeof lib === 'object') {
        if (lib.downloads?.artifact?.url && typeof lib.downloads.artifact.url !== 'string') throw new Error(`Invalid library artifact URL`);
      }
    }
  }

  /** Download version JSON with cyclic inheritance protection. */
  private async fetchVersionJson(versionId: string, visited = new Set<string>()): Promise<VersionJson> {
    if (visited.has(versionId)) throw new Error(`Circular inheritsFrom detected: ${versionId}`);
    visited.add(versionId);
    if (visited.size > 20) throw new Error(`Inheritance depth too deep for ${versionId}`);

    const versionDir = path.join(this.gameDir, 'versions', versionId);
    await ensureDir(versionDir);
    const jsonPath = path.join(versionDir, versionId + '.json');

    if (!fs.existsSync(jsonPath)) {
      // Reuse fetchVersions() which already has retry + User-Agent logic
      const versions = await this.fetchVersions();
      const entry = (versions as Array<{ id: string; url: string }>).find(v => v.id === versionId);
      if (!entry) throw new Error(`Version ${versionId} not found in manifest`);
      { const trust = verifyDownloadSource(entry.url); if (!trust.allowed) throw new Error(`${trust.reason}: ${entry.url}`); }
      const { data: versionJson } = await axios.get(entry.url, { timeout: 15000, maxContentLength: 2 * 1024 * 1024 });
      this.validateVersionJson(versionJson, versionId);
      atomicWriteJson(jsonPath, versionJson);
    }

    const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as VersionJson;
    this.validateVersionJson(parsed, versionId);

    if (parsed.inheritsFrom) {
      const parent = await this.fetchVersionJson(parsed.inheritsFrom, visited);
      return this.merge(parent, parsed);
    }
    return parsed;
  }

  private merge(parent: VersionJson, child: VersionJson): VersionJson {
    const childLibs: any[] = child.libraries ?? [];
    const parentLibs: any[] = parent.libraries ?? [];
    const keyOf = (lib: any): string => {
      if (!lib?.name || typeof lib.name !== 'string') return '';
      const parts = lib.name.split(':');
      return parts.length >= 2 ? parts[0] + ':' + parts[1] : lib.name;
    };
    const seen = new Set<string>();
    const mergedLibs: any[] = [];
    for (const lib of childLibs) { mergedLibs.push(lib); const k = keyOf(lib); if (k) seen.add(k); }
    for (const lib of parentLibs) { const k = keyOf(lib); if (k && seen.has(k)) continue; mergedLibs.push(lib); }

    return {
      ...parent, ...child,
      libraries: mergedLibs,
      javaVersion: child.javaVersion ?? parent.javaVersion,
      assetIndex: child.assetIndex ?? parent.assetIndex,
      assets: child.assets ?? parent.assets,
      downloads: { ...(parent.downloads ?? {}), ...(child.downloads ?? {}) },
      mainClass: child.mainClass ?? parent.mainClass,
      arguments: parent.arguments || child.arguments
        ? {
            game: [
              ...(Array.isArray(parent.arguments?.game) ? parent.arguments!.game : []),
              ...(Array.isArray(child.arguments?.game) ? child.arguments!.game : []),
            ],
            jvm: [
              ...(Array.isArray(parent.arguments?.jvm) ? parent.arguments!.jvm : []),
              ...(Array.isArray(child.arguments?.jvm) ? child.arguments!.jvm : []),
            ],
          }
        : undefined,
      minecraftArguments: [parent.minecraftArguments, child.minecraftArguments].filter(Boolean).join(' ')
        || undefined,
    };
  }

  async install(versionId: string, win?: BrowserWindow): Promise<VersionJson> {
    if (!isSafeVersionId(versionId)) throw new Error(`Invalid versionId: ${versionId}`);
    // Install mutex: wait if same version is already being installed
    const existing = this.installing.get(versionId);
    if (existing) return existing;
    const promise = this.doInstall(versionId, win);
    this.installing.set(versionId, promise);
    try { return await promise; } finally { this.installing.delete(versionId); }
  }

  private async doInstall(versionId: string, win?: BrowserWindow): Promise<VersionJson> {
    await ensureDir(this.gameDir);

    let totalBytes = 0;
    let downloadedBytes = 0;
    /** Running bytes for the single file currently being downloaded (sequential stages). */
    let currentFileBytes = 0;
    /** Sum of in-flight bytes across all parallel library downloads. */
    let libsInFlight = 0;
    /** Sum of in-flight bytes across all parallel asset downloads. */
    let assetsInFlight = 0;

    this.report(win, { stage: 'Чтение метаданных версии', current: 0, total: 1, percent: 2, bytesDownloaded: 0, bytesTotal: 0 });
    const ver = await this.fetchVersionJson(versionId);

    // --- Client JAR ---
    const versionDir = path.join(this.gameDir, 'versions', versionId);
    const clientJar = path.join(versionDir, versionId + '.jar');
    const clientSize = ver.downloads?.client?.size ?? 0;
    totalBytes += clientSize;
    const clientAlready = isLikelyValid(clientJar, clientSize);
    if (clientAlready) downloadedBytes += clientSize;
    this.report(win, { stage: 'Скачивание клиента', current: 0, total: 1, percent: 5, bytesDownloaded: downloadedBytes, bytesTotal: totalBytes });
    if (ver.downloads?.client) {
      { const trust = verifyDownloadSource(ver.downloads.client.url); if (!trust.allowed) throw new Error(`${trust.reason}: ${ver.downloads.client.url}`); }
      currentFileBytes = 0;
      await downloadWithRetry(ver.downloads.client.url, clientJar, ver.downloads.client.sha1, 5, clientSize, (running) => {
        currentFileBytes = running;
        const overall = downloadedBytes + currentFileBytes + libsInFlight + assetsInFlight;
        const pct = totalBytes > 0
          ? Math.max(0, Math.min(100, Math.floor((overall / totalBytes) * 100)))
          : 5;
        this.report(win, {
          stage: 'Скачивание клиента',
          current: running,
          total: clientSize,
          percent: pct,
          bytesDownloaded: overall,
          bytesTotal: totalBytes,
        });
      });
      if (!clientAlready) downloadedBytes += clientSize;
      currentFileBytes = 0;
    } else if (!fs.existsSync(clientJar)) {
      const legacyUrl = `${S3_LEGACY_HOST}/versions/${versionId}/${versionId}.jar`;
      currentFileBytes = 0;
      await downloadWithRetry(legacyUrl, clientJar, undefined, 5, undefined, (running) => {
        currentFileBytes = running;
        const overall = downloadedBytes + currentFileBytes + libsInFlight + assetsInFlight;
        const pct = totalBytes > 0
          ? Math.max(0, Math.min(100, Math.floor((overall / totalBytes) * 100)))
          : 5;
        this.report(win, {
          stage: 'Скачивание клиента',
          current: running,
          total: clientSize,
          percent: pct,
          bytesDownloaded: overall,
          bytesTotal: totalBytes,
        });
      });
    }

    // --- Libraries ---
    const librariesRoot = path.join(this.gameDir, 'libraries');
    const nativesDir = path.join(versionDir, 'natives');
    await ensureDir(nativesDir);

    const libs = (ver.libraries || []).filter(libraryAllowed);
    const libDownloadTasks: { run: (onProgress?: (running: number) => void) => Promise<void>; dest: string; size: number; sha1?: string }[] = [];
    const nativeArtifacts: MojangLibraryArtifact[] = [];
    const nativeExcludes: Record<string, string[]> = {};

    for (const lib of libs) {
      const art = lib.downloads?.artifact;
      if (art) {
        if (!isUrlAllowed(art.url)) continue;
        const dest = path.join(librariesRoot, art.path);
        libDownloadTasks.push({ run: (onProgress) => downloadWithRetry(art.url, dest, art.sha1, 5, art.size, onProgress), dest, size: art.size ?? 0, sha1: art.sha1 });
      } else if (lib.name && lib.url) {
        if (!isUrlAllowed(lib.url)) continue;
        const [group, artifact, version] = lib.name.split(':');
        const rel = `${group.replace(/\./g, '/')}/${artifact}/${version}/${artifact}-${version}.jar`;
        const url = lib.url.replace(/\/$/, '') + '/' + rel;
        const dest = path.join(librariesRoot, rel);
        libDownloadTasks.push({ run: (onProgress) => downloadWithRetry(url, dest, undefined, 5, undefined, onProgress), dest, size: 0 });
      }
      const classifier = nativeClassifier(lib);
      if (classifier && lib.downloads?.classifiers?.[classifier]) {
        const nat = lib.downloads.classifiers[classifier];
        nativeArtifacts.push(nat);
        if (lib.extract?.exclude) nativeExcludes[nat.path] = lib.extract.exclude;
        if (!isUrlAllowed(nat.url)) continue;
        const dest = path.join(librariesRoot, nat.path);
        libDownloadTasks.push({ run: (onProgress) => downloadWithRetry(nat.url, dest, nat.sha1, 5, nat.size, onProgress), dest, size: nat.size ?? 0, sha1: nat.sha1 });
      }
    }

    const libsBytes = libDownloadTasks.reduce((acc, t) => acc + t.size, 0);
    totalBytes += libsBytes;

    let libsAlreadyDone = 0;
    let libsAlreadyBytes = 0;
    for (const t of libDownloadTasks) { if (isLikelyValid(t.dest, t.size)) { libsAlreadyDone++; libsAlreadyBytes += t.size; } }
    downloadedBytes += libsAlreadyBytes;

    // Skip tasks for files that are already on disk — otherwise `libDone` would
    // overshoot `libTotal` because parallelPool's onOne fires for every task,
    // including the already-cached ones that downloadWithRetry handles in a stat check.
    const libTasksToRun = libDownloadTasks.filter((t) => !isLikelyValid(t.dest, t.size));

    let libDone = libsAlreadyDone;
    const libTotal = libDownloadTasks.length;
    this.report(win, { stage: `Скачивание библиотек ${libDone}/${libTotal}`, current: libDone, total: libTotal, percent: 10, bytesDownloaded: downloadedBytes, bytesTotal: totalBytes });
    await parallelPool(libTasksToRun, async (t) => {
      let taskBytes = 0;
      try {
        await t.run((running) => {
          const delta = running - taskBytes;
          taskBytes = running;
          libsInFlight += delta;
          const overall = downloadedBytes + currentFileBytes + libsInFlight + assetsInFlight;
          const pct = totalBytes > 0
            ? Math.max(0, Math.min(100, Math.floor((overall / totalBytes) * 100)))
            : 10;
          this.report(win, {
            stage: `Скачивание библиотек ${libDone}/${libTotal}`,
            current: libDone,
            total: libTotal,
            percent: pct,
            bytesDownloaded: overall,
            bytesTotal: totalBytes,
          });
        });
      } finally {
        libsInFlight -= taskBytes;
        if (libsInFlight < 0) libsInFlight = 0;
      }
      downloadedBytes += t.size;
    }, getDynamicConcurrency(), () => {
      libDone++;
      const overall = downloadedBytes + currentFileBytes + libsInFlight + assetsInFlight;
      const pct = totalBytes > 0
        ? Math.max(0, Math.min(100, Math.floor((overall / totalBytes) * 100)))
        : 10 + Math.floor((libDone / Math.max(1, libTotal)) * 20);
      this.report(win, { stage: `Скачивание библиотек ${libDone}/${libTotal}`, current: libDone, total: libTotal, percent: pct, bytesDownloaded: overall, bytesTotal: totalBytes });
    });

    // Extract natives — Zip Slip protection
    if (nativeArtifacts.length) {
      const overall = downloadedBytes + currentFileBytes + libsInFlight + assetsInFlight;
      this.report(win, { stage: 'Распаковка нативных библиотек', current: 0, total: nativeArtifacts.length, percent: 32, bytesDownloaded: overall, bytesTotal: totalBytes });
      for (const nat of nativeArtifacts) {
        const jarPath = path.join(librariesRoot, nat.path);
        try {
          const zip = new AdmZip(jarPath);
          const excludes = nativeExcludes[nat.path] || ['META-INF/'];
          for (const entry of zip.getEntries()) {
            if (entry.isDirectory) continue;
            if (excludes.some((ex) => entry.entryName.startsWith(ex))) continue;
            const name = entry.entryName;
            // Zip Slip protection
            if (path.isAbsolute(name)) { console.warn(`[installer] Zip Slip: absolute path blocked: ${name}`); continue; }
            if (name.includes('..') || name.includes('\0')) { console.warn(`[installer] Zip Slip: traversal blocked: ${name}`); continue; }
            if (name.includes('\\') && process.platform !== 'win32') { console.warn(`[installer] Zip Slip: backslash in path: ${name}`); continue; }
            const resolvedEntry = path.resolve(nativesDir, name);
            const resolvedBase = path.resolve(nativesDir);
            const normEntry = process.platform === 'win32' ? resolvedEntry.toLowerCase() : resolvedEntry;
            const normBase = process.platform === 'win32' ? resolvedBase.toLowerCase() : resolvedBase;
            if (!normEntry.startsWith(normBase + path.sep) && normEntry !== normBase) {
              console.warn(`[installer] Zip Slip: resolved outside dir: ${name} -> ${resolvedEntry}`);
              continue;
            }
            zip.extractEntryTo(entry, nativesDir, false, true);
          }
        } catch (e) {
          console.warn('[installer] Failed to extract natives from', jarPath, e);
        }
      }
    }

    // --- Asset index + assets ---
    const assetsRoot = path.join(this.gameDir, 'assets');
    await ensureDir(assetsRoot);
    await ensureDir(path.join(assetsRoot, 'indexes'));
    await ensureDir(path.join(assetsRoot, 'objects'));

    if (ver.assetIndex) {
      const indexPath = path.join(assetsRoot, 'indexes', ver.assetIndex.id + '.json');
      { const trust = verifyDownloadSource(ver.assetIndex.url); if (!trust.allowed) throw new Error(`${trust.reason}: ${ver.assetIndex.url}`); }
      await downloadWithRetry(ver.assetIndex.url, indexPath, ver.assetIndex.sha1, 5, ver.assetIndex.size);

      const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as AssetIndexJson;
      const entries = Object.entries(index.objects || {});
      const total = entries.length;
      const assetsBytes = entries.reduce((acc, [, o]) => acc + (o.size || 0), 0);
      totalBytes += assetsBytes;

      let assetsAlreadyDone = 0;
      let assetsAlreadyBytes = 0;
      for (const [, { hash, size }] of entries) {
        if (!/^[a-f0-9]{40}$/.test(hash)) continue;
        const prefix = hash.slice(0, 2);
        const dest = path.join(assetsRoot, 'objects', prefix, hash);
        if (isLikelyValid(dest, size)) { assetsAlreadyDone++; assetsAlreadyBytes += size || 0; }
      }
      downloadedBytes += assetsAlreadyBytes;

      this.report(win, { stage: `Скачивание ассетов ${assetsAlreadyDone}/${total}`, current: assetsAlreadyDone, total, percent: 40, bytesDownloaded: downloadedBytes, bytesTotal: totalBytes });

      // Skip tasks for assets that are already on disk — otherwise `assetDone`
      // would overshoot `total` because parallelPool's onOne fires for every task,
      // including the already-cached ones.
      const assetTasks = entries
        .filter(([, { hash, size }]) => {
          if (!/^[a-f0-9]{40}$/.test(hash)) return false;
          const prefix = hash.slice(0, 2);
          const dest = path.join(assetsRoot, 'objects', prefix, hash);
          return !isLikelyValid(dest, size);
        })
        .map(([name, { hash, size }]) => async () => {
          const prefix = hash.slice(0, 2);
          const url = `${RESOURCES_HOST}/${prefix}/${hash}`;
          const dest = path.join(assetsRoot, 'objects', prefix, hash);
          let taskBytes = 0;
          try {
            await downloadWithRetry(url, dest, hash, 5, size, (running) => {
              const delta = running - taskBytes;
              taskBytes = running;
              assetsInFlight += delta;
              const overall = downloadedBytes + currentFileBytes + libsInFlight + assetsInFlight;
              const pct = totalBytes > 0
                ? Math.max(0, Math.min(100, Math.floor((overall / totalBytes) * 100)))
                : 40;
              this.report(win, {
                stage: `Скачивание ассетов ${assetDone}/${total}`,
                current: assetDone,
                total,
                percent: pct,
                bytesDownloaded: overall,
                bytesTotal: totalBytes,
              });
            });
          } finally {
            assetsInFlight -= taskBytes;
            if (assetsInFlight < 0) assetsInFlight = 0;
          }
          downloadedBytes += size || 0;
          if (index.virtual) {
            const vdest = path.join(assetsRoot, 'virtual', ver.assetIndex!.id, name);
            const resolved = path.resolve(vdest);
            const base = path.resolve(assetsRoot, 'virtual');
            if (resolved.startsWith(base + path.sep) || resolved === base) {
              await ensureDir(path.dirname(vdest));
              if (!fs.existsSync(vdest)) fs.copyFileSync(dest, vdest);
            }
          }
          if (index.map_to_resources) {
            const rdest = path.join(this.gameDir, 'resources', name);
            const resolved = path.resolve(rdest);
            const base = path.resolve(this.gameDir, 'resources');
            if (resolved.startsWith(base + path.sep) || resolved === base) {
              await ensureDir(path.dirname(rdest));
              if (!fs.existsSync(rdest)) fs.copyFileSync(dest, rdest);
            }
          }
        });

      let assetDone = assetsAlreadyDone;
      await parallelPool(assetTasks, (t) => t(), getDynamicConcurrency(), () => {
        assetDone++;
        if (assetDone % 10 === 0 || assetDone === total) {
          const overall = downloadedBytes + currentFileBytes + libsInFlight + assetsInFlight;
          const pct = totalBytes > 0
            ? Math.max(0, Math.min(100, Math.floor((overall / totalBytes) * 100)))
            : 40 + Math.floor((assetDone / Math.max(1, total)) * 58);
          this.report(win, { stage: `Скачивание ассетов ${assetDone}/${total}`, current: assetDone, total, percent: pct, bytesDownloaded: overall, bytesTotal: totalBytes });
        }
      });
    }

    for (const sub of ['mods', 'shaderpacks', 'resourcepacks', 'texturepacks']) {
      try { await ensureDir(path.join(versionDir, sub)); } catch {}
    }

    this.report(win, { stage: 'Установка завершена', current: 1, total: 1, percent: 100, bytesDownloaded: totalBytes, bytesTotal: totalBytes });
    return ver;
  }
}
