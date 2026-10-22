import axios from 'axios';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { BrowserWindow } from 'electron';
import AdmZip from 'adm-zip';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DownloadProgress } from '../shared/types';

const pExecFile = promisify(execFile);

export interface JavaInstall {
  path: string;        // executable (javaw.exe / java)
  home: string;        // parent of bin/
  major: number;
  version: string;     // full version string, e.g. "21.0.1"
  vendor?: string;
  managed: boolean;    // true if installed by this launcher
}

// Adoptium Temurin API — public JRE distribution.
// Docs: https://api.adoptium.net/q/swagger-ui/
function adoptiumUrl(major: number, osName: string, arch: string, imageType: 'jre' | 'jdk' = 'jre'): string {
  return (
    'https://api.adoptium.net/v3/binary/latest/' +
    `${major}/ga/${osName}/${arch}/${imageType}/hotspot/normal/eclipse`
  );
}

function platformInfo(): { osName: string; arch: string; isZip: boolean; exe: string } {
  const plat = process.platform;
  const a = process.arch;
  let osName: string;
  let isZip: boolean;
  let exe: string;
  if (plat === 'win32') {
    osName = 'windows';
    isZip = true;
    exe = 'javaw.exe';
  } else if (plat === 'darwin') {
    osName = 'mac';
    isZip = false;
    exe = 'java';
  } else {
    osName = 'linux';
    isZip = false;
    exe = 'java';
  }
  const arch = a === 'arm64' ? 'aarch64' : 'x64';
  return { osName, arch, isZip, exe };
}

/** Parse JAVA_VERSION=... from the release file (much cheaper than spawning java -version). */
function parseMajorFromVersionString(raw: string): number | null {
  // Examples:
  // 1.8.0_351  -> 8
  // 11.0.20    -> 11
  // 17         -> 17
  // 21.0.1     -> 21
  const s = raw.replace(/^1\./, '').split('.')[0].replace(/[^\d].*$/, '');
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function readReleaseFile(javaHome: string): { version: string; vendor?: string } | null {
  const rel = path.join(javaHome, 'release');
  if (!fs.existsSync(rel)) return null;
  try {
    const text = fs.readFileSync(rel, 'utf-8');
    const vm = /^JAVA_VERSION="?([^"\r\n]+)"?/m.exec(text);
    const vendorM = /^IMPLEMENTOR="?([^"\r\n]+)"?/m.exec(text);
    if (!vm) return null;
    return { version: vm[1], vendor: vendorM?.[1] };
  } catch {
    return null;
  }
}

function isInKnownRoots(exe: string, roots: string[]): boolean {
  const resolved = path.resolve(exe).toLowerCase();
  return roots.some((r) => {
    const rr = path.resolve(r).toLowerCase();
    return resolved === rr || resolved.startsWith(rr + path.sep);
  });
}

async function probeJavaViaExec(exe: string, knownRoots: string[]): Promise<{ version: string; vendor?: string } | null> {
  try {
    // Validate: reject execution of java outside known directories (PATH hijack protection)
    if (!isInKnownRoots(exe, knownRoots)) {
      console.warn(`[java] Rejected Java probe outside known roots: ${exe}`);
      return null;
    }
    // `java -version` prints to stderr
    const { stderr } = await pExecFile(exe, ['-version'], { timeout: 5000, windowsHide: true });
    const m = /version "?([^"\s]+)"?/.exec(stderr);
    if (!m) return null;
    const vendorM = /(OpenJDK|Java\(TM\)|GraalVM|Corretto|Zulu|Liberica|Semeru|Temurin)/i.exec(stderr);
    return { version: m[1], vendor: vendorM?.[1] };
  } catch {
    return null;
  }
}

function dedupeByPath(list: JavaInstall[]): JavaInstall[] {
  const seen = new Set<string>();
  const out: JavaInstall[] = [];
  for (const it of list) {
    const key = path.resolve(it.path).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function listDirSafe(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

/** Format version of java-cache.json. Bumped on structural breaking changes. */
const JAVA_CACHE_VERSION = 1;
/** How long we trust the persistent cache without a background re-scan. 7 days. */
const JAVA_CACHE_FRESH_MS = 7 * 24 * 60 * 60 * 1000;

interface JavaCacheFile {
  version: number;
  scannedAt: number;
  platform: string;          // process.platform + '-' + process.arch
  installs: JavaInstall[];
}

export class JavaService {
  private cache: JavaInstall[] | null = null;
  /** Promise of the current scan(), so that parallel calls share one traversal. */
  private scanInFlight: Promise<JavaInstall[]> | null = null;
  /** Whether the persistent cache was loaded into this.cache (not a scan result). */
  private cacheLoadedFromDisk = false;

  constructor(private launcherDir: string) {}

  private javaRoot(): string {
    const dir = path.join(this.launcherDir, 'java');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private cacheFile(): string {
    return path.join(this.launcherDir, 'java-cache.json');
  }

  /** Loads the persistent cache from disk, filtering out missing paths. Null if the cache is absent/corrupt/stale for the platform. */
  private loadCacheFromDisk(): { installs: JavaInstall[]; scannedAt: number } | null {
    try {
      const file = this.cacheFile();
      if (!fs.existsSync(file)) return null;
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as JavaCacheFile;
      if (raw.version !== JAVA_CACHE_VERSION) return null;
      const platform = `${process.platform}-${process.arch}`;
      if (raw.platform !== platform) return null;
      if (!Array.isArray(raw.installs)) return null;
      // Filter out invalid paths: missing on disk, null bytes, symlink, wrong owner
      const valid = raw.installs.filter((i) => {
        if (!i || typeof i.path !== 'string' || i.path.length > 1024 || i.path.includes('\0')) return false;
        try {
          if (!fs.existsSync(i.path)) return false;
          // Reject symlinks from cache — could be hijacked between sessions
          const st = fs.lstatSync(i.path);
          if (st.isSymbolicLink()) return false;
          // Best-effort owner check on Unix-like systems
          if (process.platform !== 'win32') {
            try {
              const currentUid = process.getuid?.();
              if (currentUid !== undefined && (st as any).uid !== currentUid) return false;
            } catch {}
          }
          return true;
        } catch { return false; }
      });
      if (valid.length === 0) return null;
      return { installs: valid, scannedAt: raw.scannedAt ?? 0 };
    } catch {
      return null;
    }
  }

  private saveCacheToDisk(installs: JavaInstall[]): void {
    try {
      const payload: JavaCacheFile = {
        version: JAVA_CACHE_VERSION,
        scannedAt: Date.now(),
        platform: `${process.platform}-${process.arch}`,
        installs,
      };
      fs.writeFileSync(this.cacheFile(), JSON.stringify(payload, null, 2), 'utf-8');
    } catch {}
  }

  /**
   * Warms up the Java cache in the background without blocking the caller.
   * Safe to call repeatedly: repeat calls just await the scan already in flight.
   * Used at launcher startup so the first "Play" click does not have to wait.
   */
  prewarm(): Promise<JavaInstall[]> {
    return this.list();
  }

  /** All directories where JDK/JRE installations typically live. */
  private candidateRoots(): string[] {
    const roots: string[] = [];
    if (process.platform === 'win32') {
      const programFiles = [
        process.env['ProgramFiles'] || 'C:\\Program Files',
        process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
        process.env['ProgramW6432'] || '',
      ].filter(Boolean) as string[];
      const vendorDirs = [
        'Java',
        'Eclipse Adoptium',
        'Eclipse Foundation',
        'AdoptOpenJDK',
        'Zulu',
        'Amazon Corretto',
        'BellSoft',
        'Microsoft',
        'OpenJDK',
        'SapMachine',
        'Semeru',
        'JetBrains\\Runtime',
        'Android\\Android Studio\\jbr',
      ];
      for (const pf of programFiles) {
        for (const v of vendorDirs) {
          roots.push(path.join(pf, v));
        }
      }
      // Minecraft official launcher runtime bundles
      const local = process.env['LOCALAPPDATA'];
      if (local) {
        roots.push(path.join(local, 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe', 'LocalCache', 'Local', 'runtime'));
      }
      // Scoop / user installs
      const user = process.env['USERPROFILE'];
      if (user) {
        roots.push(path.join(user, 'scoop', 'apps'));
        roots.push(path.join(user, '.jdks'));
      }
    } else if (process.platform === 'darwin') {
      roots.push('/Library/Java/JavaVirtualMachines');
      roots.push(path.join(os.homedir(), 'Library/Java/JavaVirtualMachines'));
    } else {
      roots.push('/usr/lib/jvm');
      roots.push('/usr/java');
      roots.push('/opt');
      roots.push(path.join(os.homedir(), '.jdks'));
      roots.push(path.join(os.homedir(), '.sdkman/candidates/java'));
    }
    // Our own managed folder
    roots.push(this.javaRoot());
    return roots;
  }

  /** Try to derive JavaInstall from a `javaHome` candidate. */
  private async inspect(javaHome: string, managed: boolean, knownRoots: string[] = []): Promise<JavaInstall | null> {
    const { exe } = platformInfo();
    // On macOS, JVM bundles have Contents/Home inside
    let home = javaHome;
    if (process.platform === 'darwin') {
      const inner = path.join(javaHome, 'Contents', 'Home');
      if (fs.existsSync(inner)) home = inner;
    }
    const binExe = path.join(home, 'bin', exe);
    if (!fs.existsSync(binExe)) return null;
    try { if (!fs.statSync(binExe).isFile()) return null; } catch { return null; }

    let parsed = readReleaseFile(home);
    if (!parsed) parsed = await probeJavaViaExec(binExe, knownRoots.length ? knownRoots : [home]);
    if (!parsed) return null;

    const major = parseMajorFromVersionString(parsed.version);
    if (!major) return null;

    return {
      path: binExe,
      home,
      major,
      version: parsed.version,
      vendor: parsed.vendor,
      managed,
    };
  }

  /**
   * Full system scan. Checks all candidate directories + JAVA_HOME + the
   * first `java` from PATH in parallel. On a cold disk it takes
   * ~200-500ms, on a warm one ~50-150ms.
   */
  async scan(): Promise<JavaInstall[]> {
    // Deduplicate parallel calls — several subsystems may request a scan
    // at startup at the same time, there is no point walking the FS twice.
    if (this.scanInFlight) return this.scanInFlight;
    this.scanInFlight = this.doScan();
    try {
      return await this.scanInFlight;
    } finally {
      this.scanInFlight = null;
    }
  }

  private async doScan(): Promise<JavaInstall[]> {
    const tasks: Promise<JavaInstall | null>[] = [];
    const knownRoots = this.candidateRoots();

    // 1) JAVA_HOME
    if (process.env.JAVA_HOME) {
      tasks.push(this.inspect(process.env.JAVA_HOME, false, knownRoots));
    }

    // 2) PATH — the first `java`. Started in parallel with the folder walk
    // so that the 50-200ms spent spawning `where` does not block the rest.
    tasks.push((async () => {
      try {
        const { stdout } = await pExecFile(
          process.platform === 'win32' ? 'where' : 'which',
          ['java'],
          { timeout: 3000, windowsHide: true },
        );
        const first = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
        if (first && fs.existsSync(first)) {
          // Validate: reject symlinks, directories, and non-java executables
          try {
            const st = fs.lstatSync(first);
            if (st.isSymbolicLink() || !st.isFile()) return null;
          } catch { return null; }
          const basename = path.basename(first).toLowerCase();
          if (!basename.includes('java')) return null;
          const home = path.resolve(path.dirname(first), '..');
          return this.inspect(home, false, knownRoots);
        }
      } catch {}
      return null;
    })());

    // 3) Known root directories — one and two levels deep.
    // This used to be a sequential double for-loop; now all inspect()
    // calls run in parallel via Promise.all.
    const javaRoot = this.javaRoot();
    const javaRootKey = path.resolve(javaRoot).toLowerCase();
    for (const root of knownRoots) {
      const managed = path.resolve(root).toLowerCase() === javaRootKey;
      for (const entry of listDirSafe(root)) {
        const full = path.join(root, entry);
        tasks.push(this.inspect(full, managed, knownRoots));
        // Two levels deep — Microsoft/jdk-21/, Eclipse Adoptium/jdk-17.0.x/...
        for (const subEntry of listDirSafe(full)) {
          const subFull = path.join(full, subEntry);
          tasks.push(this.inspect(subFull, managed, knownRoots));
        }
      }
    }

    const settled = await Promise.all(tasks);
    const results = settled.filter((x): x is JavaInstall => !!x);
    const out = dedupeByPath(results).sort((a, b) => b.major - a.major);

    this.cache = out;
    this.cacheLoadedFromDisk = false;
    this.saveCacheToDisk(out);
    return out;
  }

  /**
   * Returns the list of Java installations. Strategy:
   *   1. If there is an in-memory cache — return it (instant).
   *   2. Otherwise try the persistent cache on disk (filtering removed paths).
   *   3. Otherwise do a full scan.
   *
   * If the persistent cache is stale (older than 7 days) — return it right away,
   * but trigger a re-scan in the background so the data catches up by the next launch.
   */
  async list(): Promise<JavaInstall[]> {
    if (this.cache) return this.cache;

    const fromDisk = this.loadCacheFromDisk();
    if (fromDisk) {
      this.cache = fromDisk.installs;
      this.cacheLoadedFromDisk = true;

      // Stale? — rescan in the background while the user is playing.
      if (Date.now() - fromDisk.scannedAt > JAVA_CACHE_FRESH_MS) {
        this.scan().catch(() => {});
      }
      return this.cache;
    }

    return this.scan();
  }

  /** Inspect a specific java executable path. Returns null if not a valid java. */
  async inspectExe(exePath: string): Promise<JavaInstall | null> {
    if (!exePath || !fs.existsSync(exePath)) return null;
    // exePath = <home>/bin/javaw.exe -> home = two levels up
    const home = path.resolve(path.dirname(exePath), '..');
    return this.inspect(home, false);
  }

  /** Check if a given java major is compatible with the required major for Minecraft. */
  static isCompatible(javaMajor: number, requiredMajor: number): boolean {
    // Minecraft <= 1.16 (required 8) uses LaunchWrapper which needs exactly Java 8
    if (requiredMajor <= 8) return javaMajor === 8;
    // 1.17+ works with Java >= required. Newer Java usually works, old Java does not.
    return javaMajor >= requiredMajor;
  }

  /**
   * Find the best java for the given required major. Prefers exact match,
   * then newer, then older.
   *
   * If the lookup in the persistent cache comes up empty — force a re-scan
   * (the user may have installed a new Java between sessions). This gives
   * correct behaviour without a pointless download.
   */
  async findBest(required: number): Promise<JavaInstall | null> {
    let result = this.findBestIn(await this.list(), required);
    if (result) return result;
    if (this.cacheLoadedFromDisk) {
      // The persistent cache may be incomplete — rescan and try once more.
      const fresh = await this.scan();
      result = this.findBestIn(fresh, required);
      if (result) return result;
    }
    return null;
  }

  private findBestIn(all: JavaInstall[], required: number): JavaInstall | null {
    if (all.length === 0) return null;
    const exact = all.find((j) => j.major === required);
    if (exact) return exact;
    if (required <= 8) {
      // Only Java 8 works for LaunchWrapper-era versions
      return all.find((j) => j.major === 8) ?? null;
    }
    const greaterOrEqual = all.filter((j) => j.major >= required).sort((a, b) => a.major - b.major)[0];
    if (greaterOrEqual) return greaterOrEqual;
    return null;
  }

  async findManaged(major: number): Promise<JavaInstall | null> {
    const list = await this.list();
    return list.find(j => j.managed && j.major === major) ?? null;
  }

  /** Ensure Java of the given major is available. Reuse existing, download if missing. */
  async ensure(major: number, win?: BrowserWindow): Promise<JavaInstall> {
    const found = await this.findBest(major);
    if (found) return found;

    const { osName, arch, isZip } = platformInfo();
    const url = adoptiumUrl(major, osName, arch, 'jre');
    const slot = path.join(this.javaRoot(), `jre-${major}`);
    fs.mkdirSync(slot, { recursive: true });

    const tmpFile = path.join(os.tmpdir(), `trel-jre-${major}-${Date.now()}.${isZip ? 'zip' : 'tar.gz'}`);
    this.report(win, {
      stage: `Скачивание Java ${major}`,
      current: 0, total: 100, percent: 0,
      bytesDownloaded: 0, bytesTotal: 0,
    });

    await this.downloadFile(url, tmpFile, major, win);

    this.report(win, { stage: `Verifying Java ${major}`, current: 100, total: 100, percent: 99 });

    const expectedSha = await this.fetchAdoptiumChecksum(major, osName, arch, 'jre');
    if (expectedSha) {
      const actual = await this.sha256File(tmpFile);
      if (actual.toLowerCase() !== expectedSha.toLowerCase()) {
        try { fs.unlinkSync(tmpFile); } catch {}
        throw new Error(`Checksum mismatch for Java ${major}: expected ${expectedSha}, got ${actual}`);
      }
    } else {
      // Basic integrity check: downloaded data must look like a valid archive
      const buf = fs.readFileSync(tmpFile);
      if (buf.length < 1000) {
        try { fs.unlinkSync(tmpFile); } catch {}
        throw new Error(`Downloaded Java ${major} is too small (${buf.length} bytes) — download likely failed`);
      }
    }

    this.report(win, { stage: `Extracting Java ${major}`, current: 100, total: 100, percent: 100 });

    if (isZip) {
      const zip = new AdmZip(tmpFile);
      // Validate all entries for Zip Slip before extraction
      let totalUncompressed = 0;
      for (const entry of zip.getEntries()) {
        const resolved = path.resolve(slot, entry.entryName);
        if (!resolved.startsWith(path.resolve(slot) + path.sep) && resolved !== path.resolve(slot)) {
          throw new Error(`Zip Slip detected: ${entry.entryName}`);
        }
        if (((entry.header.attr >>> 16) & 0o170000) === 0o120000) {
          throw new Error(`Symlink in JRE archive: ${entry.entryName}`);
        }
        totalUncompressed += entry.header.size;
        // JRE — hundreds of MB uncompressed; gigabytes = a bomb.
        if (totalUncompressed > 2 * 1024 * 1024 * 1024) throw new Error('JRE archive too large (zip bomb guard)');
      }
      zip.extractAllTo(slot, true);
    } else {
      const { execFileSync } = await import('node:child_process');
      // tar from PATH — but first a listing: no absolute paths, no ../,
      // no symlinks pointing outside. Extraction only after checking all entries.
      const listing = execFileSync('tar', ['-tzvf', tmpFile], { windowsHide: true, encoding: 'utf-8', maxBuffer: 8 * 1024 * 1024 });
      for (const line of listing.split('\n')) {
        const m = line.match(/^([bcdlps-][rwxst-]{9})\s+\S+\s+(.+)$/);
        if (!m) continue;
        if (m[1][0] === 'l') throw new Error(`Symlink in JRE archive: ${m[2]}`);
        const name = m[2].replace(/\s+->\s+.*$/, '');
        if (path.isAbsolute(name) || /(^|\/)\.\.(\/|$)/.test(name)) {
          throw new Error(`Tar Slip detected: ${name}`);
        }
      }
      execFileSync('tar', ['-xzf', tmpFile, '-C', slot, '--no-same-owner', '--no-same-permissions'], { windowsHide: true });
    }
    try { fs.unlinkSync(tmpFile); } catch {}

    // Reset the cache and find the freshly extracted JRE via scan().
    // scan() inside doScan() will already save the updated cache to disk,
    // so the next launcher start will not re-download Java.
    this.cache = null;
    this.cacheLoadedFromDisk = false;
    const fresh = await this.findBest(major);
    if (!fresh) throw new Error('Java extracted but not found by scanner');
    return fresh;
  }

  /** Downloads a Java file. If the server supports Range requests and the file is
   *  large — we download it in parallel chunks (much faster than a single stream,
   *  which hits the per-connection CDN limit). Otherwise we fall back to one stream. */
  private async downloadFile(url: string, dest: string, major: number, win?: BrowserWindow): Promise<void> {
    const CHUNKS = 8;
    const MIN_PARALLEL = 8 * 1024 * 1024; // splitting below 8 MB makes no sense

    // HEAD: size + Range support (with redirects). HEAD may be forbidden —
    // then we simply go with a single stream.
    let total = 0;
    let acceptRanges = false;
    try {
      const head = await axios.head(url, { maxRedirects: 10, timeout: 30000 });
      total = Number(head.headers['content-length']) || 0;
      acceptRanges = String(head.headers['accept-ranges'] || '').toLowerCase().includes('bytes');
    } catch { /* ignore — fallback below */ }

    const onProgress = (downloaded: number, tot: number) => {
      if (tot <= 0) return;
      this.report(win, {
        stage: `Скачивание Java ${major}`,
        current: downloaded, total: tot,
        percent: Math.min(99, Math.floor((downloaded / tot) * 100)),
        bytesDownloaded: downloaded, bytesTotal: tot,
      });
    };

    if (acceptRanges && total >= MIN_PARALLEL) {
      const step = Math.ceil(total / CHUNKS);
      const ranges: { start: number; end: number }[] = [];
      for (let start = 0; start < total; start += step) {
        ranges.push({ start, end: Math.min(start + step - 1, total - 1) });
      }
      try {
        const fd = fs.openSync(dest, 'w');
        try { fs.ftruncateSync(fd, total); } catch { /* not every FS supports it — harmless */ }
        let downloaded = 0;
        try {
          await Promise.all(ranges.map(async (r) => {
            const resp = await axios.get(url, {
              responseType: 'arraybuffer',
              maxRedirects: 10,
              timeout: 120000,
              headers: { Range: `bytes=${r.start}-${r.end}` },
              validateStatus: (s) => s === 206,
            });
            const buf = Buffer.from(resp.data);
            fs.writeSync(fd, buf, 0, buf.length, r.start);
            downloaded += buf.length;
            onProgress(downloaded, total);
          }));
        } finally {
          fs.closeSync(fd);
        }
        return;
      } catch {
        // The Range download failed (the server did not return 206, etc.) — fallback below.
        try { fs.unlinkSync(dest); } catch {}
      }
    }

    // Fallback: a single stream.
    const response = await axios.get(url, { responseType: 'stream', maxRedirects: 10, timeout: 120000 });
    const tot = Number(response.headers['content-length']) || total;
    let downloaded = 0;
    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(dest);
      response.data.on('data', (chunk: Buffer) => { downloaded += chunk.length; onProgress(downloaded, tot); });
      response.data.on('error', reject);
      out.on('error', reject);
      out.on('finish', () => resolve());
      response.data.pipe(out);
    });
  }

  private async fetchAdoptiumChecksum(major: number, osName: string, arch: string, imageType: 'jre' | 'jdk'): Promise<string | null> {
    // Independent source: JSON release metadata, and NOT the header of the download
    // response (the same CDN serves the file — a compromised CDN could swap both the
    // file and the checksum). Fallback to the header only if the API stays silent.
    try {
      const { data } = await axios.get(
        `https://api.adoptium.net/v3/assets/feature_releases/${major}/ga`,
        { timeout: 15000, maxRedirects: 5 },
      );
      const releases = Array.isArray(data) ? data : data?.releases ?? [];
      for (const rel of Array.isArray(releases) ? releases : []) {
        for (const bin of rel?.binaries ?? []) {
          if (bin?.os !== osName || bin?.architecture !== arch || bin?.image_type !== imageType) continue;
          const sha = bin?.checksum;
          if (typeof sha === 'string' && /^[a-f0-9]{64}$/i.test(sha)) return sha;
        }
      }
    } catch { /* fallback below */ }
    try {
      const url = (
        'https://api.adoptium.net/v3/binary/latest/' +
        `${major}/ga/${osName}/${arch}/${imageType}/hotspot/normal/eclipse`
      );
      const { headers } = await axios.head(url, { timeout: 15000, maxRedirects: 10 });
      const sha = headers['x-checksum-sha256'] || headers['x-checksum'];
      if (typeof sha === 'string' && /^[a-f0-9]{64}$/i.test(sha)) return sha;
      return null;
    } catch {
      return null;
    }
  }

  /** sha256 of the file as a stream: a JRE weighs hundreds of MB, no need to load it into RAM entirely. */
  private async sha256File(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    for await (const chunk of stream) hash.update(chunk as Buffer);
    return hash.digest('hex');
  }

  private report(win: BrowserWindow | undefined, p: DownloadProgress) {
    if (win && !win.isDestroyed()) win.webContents.send('minecraft:progress', p);
  }
}
