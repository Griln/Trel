import axios from 'axios';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import { BrowserWindow } from 'electron';
import { JavaService } from './java';
import { MinecraftInstaller } from './installer';
import { DownloadProgress } from '../shared/types';
import { isSafeVersionId } from './safeIds';

export type LoaderType = 'fabric' | 'quilt' | 'neoforge' | 'forge';

export interface LoaderVersion {
  loader: LoaderType;
  /** Loader version, e.g. "0.16.0" or "47.3.10" */
  version: string;
  /** True if marked stable / recommended */
  stable?: boolean;
  /** Some loaders include the MC version in the id (e.g. NeoForge) */
  mcVersion?: string;
}

export interface InstallLoaderResult {
  /** New version id that can be launched (and is now in versions/ folder). */
  versionId: string;
}

export class LoaderService {
  constructor(private gameDir: string, private java: JavaService, private installer: MinecraftInstaller) {}

  setGameDir(dir: string) {
    this.gameDir = dir;
    this.installer.setGameDir(dir);
  }

  // ------------------------------------------------------------------
  // Fetching available versions
  // ------------------------------------------------------------------

  async listVersions(loader: LoaderType, mc: string): Promise<LoaderVersion[]> {
    switch (loader) {
      case 'fabric':   return this.listFabric(mc);
      case 'quilt':    return this.listQuilt(mc);
      case 'neoforge': return this.listNeoForge(mc);
      case 'forge':    return this.listForge(mc);
    }
  }

  private async listFabric(mc: string): Promise<LoaderVersion[]> {
    const url = `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(mc)}`;
    try {
      const { data } = await axios.get(url, { timeout: 15000 });
      if (!Array.isArray(data)) throw new Error('Invalid response format from Fabric API');
      return data.map((it: any) => ({
        loader: 'fabric' as const,
        version: it.loader.version,
        stable: it.loader.stable,
      }));
    } catch (e) {
      throw new Error(`Failed to fetch Fabric versions: ${(e as Error).message}`);
    }
  }

  private async listQuilt(mc: string): Promise<LoaderVersion[]> {
    const url = `https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(mc)}`;
    try {
      const { data } = await axios.get(url, { timeout: 15000 });
      if (!Array.isArray(data)) throw new Error('Invalid response format from Quilt API');
      return data.map((it: any) => ({
        loader: 'quilt' as const,
        version: it.loader.version,
      }));
    } catch (e) {
      throw new Error(`Failed to fetch Quilt versions: ${(e as Error).message}`);
    }
  }

  private async listNeoForge(mc: string): Promise<LoaderVersion[]> {
    const url = 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge';
    try {
      const { data } = await axios.get(url, { timeout: 15000 });
      const versions = data?.versions ?? [];
      // NeoForge versions look like "21.1.10". MC version is encoded as the prefix:
      // 21.1.x -> 1.21.1, 20.4.x -> 1.20.4. We filter those that match.
      const expectedPrefix = mcToNeoForgePrefix(mc);
      return versions
        .filter((v: string) => !expectedPrefix || v.startsWith(expectedPrefix))
        .map((v: string) => ({ loader: 'neoforge' as const, version: v, mcVersion: mc }));
    } catch (e) {
      throw new Error(`Failed to fetch NeoForge versions: ${(e as Error).message}`);
    }
  }

  private async listForge(mc: string): Promise<LoaderVersion[]> {
    // Fast metadata source maintained by the Forge-files project

    // The official maven metadata is much heavier; instead we use the BMCLAPI mirror's index:
    const bmclUrl = `https://bmclapi2.bangbang93.com/forge/minecraft/${mc}`;
    try {
      const { data } = await axios.get(bmclUrl, { timeout: 15000 });
      if (!Array.isArray(data)) throw new Error('Invalid response format from BMCLAPI');
      return (data as any[])
        .map((it) => ({
          loader: 'forge' as const,
          version: `${it.mcversion}-${it.version}`,
          mcVersion: it.mcversion,
        }))
        .reverse();
    } catch {
      // Fallback to official Forge source if BMCLAPI fails
      const officialUrl = `https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json`;
      try {
        const { data } = await axios.get(officialUrl, { timeout: 15000 });
        const versions: string[] = [];
        for (const [key, artifacts] of Object.entries(data?.mapping ?? {})) {
          if (key.startsWith(mc + '-')) {
            for (const art of artifacts as any[]) {
              if (art?.version) versions.push(`${mc}-${art.version}`);
            }
          }
        }
        if (versions.length === 0) throw new Error('No Forge versions found for ' + mc);
        return versions
          .map((v) => ({ loader: 'forge' as const, version: v, mcVersion: mc }))
          .reverse();
      } catch (e2) {
        throw new Error(`Failed to fetch Forge versions: ${(e2 as Error).message}`);
      }
    }
  }

  // ------------------------------------------------------------------
  // Installation
  // ------------------------------------------------------------------

  async install(
    loader: LoaderType,
    mc: string,
    loaderVersion: string,
    win: BrowserWindow,
  ): Promise<InstallLoaderResult> {
    // mc/lv end up in maven paths and file names: strict validation on input,
    // otherwise `../../` escapes the libraries folder.
    if (!isSafeVersionId(mc)) throw new Error(`Unsafe MC version: ${mc}`);
    if (!/^[a-zA-Z0-9._-]+$/.test(loaderVersion)) throw new Error(`Unsafe loader version: ${loaderVersion}`);
    // Make sure base MC is installed first.
    this.report(win, { stage: `Установка Minecraft ${mc}`, current: 0, total: 1, percent: 5 });
    await this.installer.install(mc, win);

    switch (loader) {
      case 'fabric':   return this.installFabric(mc, loaderVersion, win);
      case 'quilt':    return this.installQuilt(mc, loaderVersion, win);
      case 'neoforge': return this.installNeoForge(mc, loaderVersion, win);
      case 'forge':    return this.installForge(mc, loaderVersion, win);
    }
  }

  private async installProfileFromJson(jsonUrl: string, idTemplate: string, win: BrowserWindow): Promise<InstallLoaderResult> {
    this.report(win, { stage: 'Загрузка профиля лоадера', current: 0, total: 1, percent: 30 });
    const { data: profile } = await axios.get(jsonUrl, { timeout: 30000 });
    const versionId = profile.id || idTemplate;
    if (!isSafeVersionId(versionId)) throw new Error(`Unsafe loader version id: ${versionId}`);

    const versionsDir = path.join(this.gameDir, 'versions', versionId);
    fs.mkdirSync(versionsDir, { recursive: true });
    const jsonPath = path.join(versionsDir, versionId + '.json');
    fs.writeFileSync(jsonPath, JSON.stringify(profile, null, 2), 'utf-8');

    this.report(win, { stage: 'Скачивание библиотек лоадера', current: 0, total: 1, percent: 50 });
    // We put it in place via the standard installer (it handles inheritsFrom and downloads the libraries)
    await this.installer.install(versionId, win);

    this.flattenLoaderProfile(versionId);
    this.ensureContentFolders(versionId);
    this.report(win, { stage: 'Готово', current: 1, total: 1, percent: 100 });
    return { versionId };
  }

  /** Create standard content folders inside versions/<id>/. */
  private ensureContentFolders(versionId: string): void {
    const dir = path.join(this.gameDir, 'versions', versionId);
    for (const sub of ['mods', 'shaderpacks', 'resourcepacks', 'texturepacks']) {
      try { fs.mkdirSync(path.join(dir, sub), { recursive: true }); } catch {}
    }
  }

  /**
   * Bakes the parent (inheritsFrom) into the loader profile and removes the
   * parent folder. After the flatten the loader profile is fully self-contained:
   * libraries/arguments/mainClass/assetIndex of the parent are inlined, and its
   * client jar is copied into the loader folder as <loaderId>.jar.
   *
   * Idempotent: if inheritsFrom is already gone — it does nothing.
   */
  flattenLoaderProfile(loaderId: string): void {
    const loaderDir = path.join(this.gameDir, 'versions', loaderId);
    const loaderJsonPath = path.join(loaderDir, loaderId + '.json');
    if (!fs.existsSync(loaderJsonPath)) return;

    let loaderJson: any;
    try { loaderJson = JSON.parse(fs.readFileSync(loaderJsonPath, 'utf-8')); }
    catch { return; }

    const parentId: string | undefined = loaderJson.inheritsFrom;
    if (!parentId) return;

    const parentDir = path.join(this.gameDir, 'versions', parentId);
    const parentJsonPath = path.join(parentDir, parentId + '.json');
    const parentJarPath  = path.join(parentDir, parentId + '.jar');

    if (!fs.existsSync(parentJsonPath)) return;

    let parentJson: any;
    try { parentJson = JSON.parse(fs.readFileSync(parentJsonPath, 'utf-8')); }
    catch { return; }

    // Scalars: the parent first, the child on top (mainClass/assetIndex/...)
    const merged: any = { ...parentJson, ...loaderJson };
    merged.id = loaderId;

    // libraries: the child first (its versions matter more), then the missing ones from the parent
    const childLibs:  any[] = Array.isArray(loaderJson.libraries) ? loaderJson.libraries : [];
    const parentLibs: any[] = Array.isArray(parentJson.libraries) ? parentJson.libraries : [];
    const keyOf = (lib: any): string => {
      if (!lib?.name || typeof lib.name !== 'string') return '';
      const parts = lib.name.split(':');
      return parts.length >= 2 ? parts[0] + ':' + parts[1] : lib.name;
    };
    const seen = new Set<string>();
    const finalLibs: any[] = [];
    for (const lib of childLibs) {
      finalLibs.push(lib);
      const k = keyOf(lib);
      if (k) seen.add(k);
    }
    for (const lib of parentLibs) {
      const k = keyOf(lib);
      if (k && seen.has(k)) continue;
      finalLibs.push(lib);
    }
    merged.libraries = finalLibs;

    // arguments (modern format): concatenation
    if (parentJson.arguments || loaderJson.arguments) {
      const pa = parentJson.arguments || {};
      const ca = loaderJson.arguments || {};
      merged.arguments = {
        game: [
          ...(Array.isArray(pa.game) ? pa.game : []),
          ...(Array.isArray(ca.game) ? ca.game : []),
        ],
        jvm: [
          ...(Array.isArray(pa.jvm) ? pa.jvm : []),
          ...(Array.isArray(ca.jvm) ? ca.jvm : []),
        ],
      };
    }
    // minecraftArguments (legacy): joined with a space
    if (parentJson.minecraftArguments || loaderJson.minecraftArguments) {
      const parts = [parentJson.minecraftArguments, loaderJson.minecraftArguments].filter(Boolean);
      merged.minecraftArguments = parts.join(' ');
    }

    // We do not inherit anymore; there should be no custom "jar" override
    delete merged.inheritsFrom;
    delete merged.jar;

    // Atomicity: first copy the parent's JAR into the loader folder, and only
    // then overwrite the JSON with `inheritsFrom` removed. If the process
    // dies between the steps, the loader either still has inheritsFrom (the
    // flatten can be repeated) or already has the JAR (it is launchable).
    if (fs.existsSync(parentJarPath)) {
      const newJarPath = path.join(loaderDir, loaderId + '.jar');
      try { fs.copyFileSync(parentJarPath, newJarPath); } catch {}
    }

    fs.writeFileSync(loaderJsonPath, JSON.stringify(merged, null, 2), 'utf-8');

    // If the parent had content folders (e.g. the user installed vanilla
    // earlier) — we move the contents into the loader folder so nothing is lost.
    for (const sub of ['mods', 'shaderpacks', 'resourcepacks', 'texturepacks', 'saves']) {
      const fromDir = path.join(parentDir, sub);
      if (!fs.existsSync(fromDir)) continue;
      const toDir = path.join(loaderDir, sub);
      try { fs.mkdirSync(toDir, { recursive: true }); } catch {}
      try {
        for (const entry of fs.readdirSync(fromDir)) {
          if (entry.includes('..') || entry.includes('\0')) continue;
          const from = path.join(fromDir, entry);
          const to = path.join(toDir, entry);
          if (fs.existsSync(to)) continue;
          // Symlink/junction check via realpath boundary validation
          try {
            const real = fs.realpathSync(from);
            const base = fs.realpathSync(fromDir);
            if (!real.startsWith(base + path.sep) && real !== base) continue;
          } catch { continue; }
          try { fs.renameSync(from, to); }
          catch {
            try {
              // Re-check boundary before copy (TOCTOU)
              const realFrom = fs.realpathSync(from);
              const baseFrom = fs.realpathSync(fromDir);
              if (!realFrom.startsWith(baseFrom + path.sep)) continue;
              fs.copyFileSync(from, to);
              fs.unlinkSync(from);
            } catch {}
          }
        }
      } catch {}
    }

    // We check whether other loaders still need the parent (the same inheritsFrom).
    // If so — we keep it, otherwise the second loader breaks during bulk-consolidate.
    let parentNeededByOthers = false;
    try {
      const versionsDir = path.join(this.gameDir, 'versions');
      if (fs.existsSync(versionsDir)) {
        for (const entry of fs.readdirSync(versionsDir)) {
          if (entry === parentId || entry === loaderId) continue;
          const jsonPath = path.join(versionsDir, entry, entry + '.json');
          if (!fs.existsSync(jsonPath)) continue;
          try {
            const j = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            if (j.inheritsFrom === parentId) { parentNeededByOthers = true; break; }
          } catch {}
        }
      }
    } catch {}
    if (parentNeededByOthers) return;

    // We remove the parent folder only if all of its content was moved over.
    let parentHasExtraFiles = false;
    try {
      for (const sub of ['mods', 'shaderpacks', 'resourcepacks', 'texturepacks', 'saves']) {
        const fromDir = path.join(parentDir, sub);
        if (!fs.existsSync(fromDir)) continue;
        if (fs.readdirSync(fromDir).length > 0) { parentHasExtraFiles = true; break; }
      }
    } catch {}
    if (!parentHasExtraFiles) {
      try { fs.rmSync(parentDir, { recursive: true, force: true }); } catch {}
    }
  }

  private async installFabric(mc: string, lv: string, win: BrowserWindow) {
    const url = `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(mc)}/${encodeURIComponent(lv)}/profile/json`;
    const id = `fabric-loader-${lv}-${mc}`;
    return this.installProfileFromJson(url, id, win);
  }

  private async installQuilt(mc: string, lv: string, win: BrowserWindow) {
    const url = `https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(mc)}/${encodeURIComponent(lv)}/profile/json`;
    const id = `quilt-loader-${lv}-${mc}`;
    return this.installProfileFromJson(url, id, win);
  }

  private async installNeoForge(mc: string, lv: string, win: BrowserWindow): Promise<InstallLoaderResult> {
    const installerUrl =
      `https://maven.neoforged.net/releases/net/neoforged/neoforge/${lv}/neoforge-${lv}-installer.jar`;
    return this.runJarInstaller('neoforge', installerUrl, mc, lv, win);
  }

  private async installForge(mc: string, lv: string, win: BrowserWindow): Promise<InstallLoaderResult> {
    // lv looks like "1.20.1-47.2.0"
    const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${lv}/forge-${lv}-installer.jar`;
    return this.runJarInstaller('forge', installerUrl, mc, lv, win);
  }

  private async runJarInstaller(
    loader: 'forge' | 'neoforge',
    installerUrl: string,
    mc: string,
    lv: string,
    win: BrowserWindow,
  ): Promise<InstallLoaderResult> {
    // mkdtemp instead of a predictable name: otherwise another process in /tmp
    // could slip its own jar in between the creation and the write.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `${loader}-installer-`));
    const tmpFile = path.join(tmpDir, 'installer.jar');
    this.report(win, {
      stage: `Загрузка ${loader} installer`,
      current: 0, total: 100, percent: 30,
      bytesDownloaded: 0, bytesTotal: 0,
    });

    const resp = await axios.get(installerUrl, { responseType: 'stream', timeout: 120000, maxRedirects: 10 });
    const total = Number(resp.headers['content-length']) || 0;
    // Forge/NeoForge installers — tens of MB; cap at 512MB against disk-fill.
    if (total > 512 * 1024 * 1024) throw new Error('Loader installer too large');
    let downloaded = 0;
    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(tmpFile);
      resp.data.on('data', (c: Buffer) => {
        downloaded += c.length;
        if (downloaded > 512 * 1024 * 1024) { out.destroy(); reject(new Error('Loader installer too large')); return; }
        if (total > 0) {
          this.report(win, {
            stage: `Загрузка ${loader} installer`,
            current: downloaded, total,
            percent: 30 + Math.floor((downloaded / total) * 30),
            bytesDownloaded: downloaded, bytesTotal: total,
          });
        }
      });
      resp.data.on('error', reject);
      out.on('error', reject);
      out.on('finish', () => resolve());
      resp.data.pipe(out);
    });

    // Verify installer jar integrity (basic check: it's a real jar).
    // Only the first bytes and a stat — loading 30MB into RAM for magic is pointless.
    {
      const st = fs.statSync(tmpFile);
      const fd = fs.openSync(tmpFile, 'r');
      try {
        const head = Buffer.alloc(4);
        fs.readSync(fd, head, 0, 4, 0);
        if (st.size < 1000 || head[0] !== 0x50 || head[1] !== 0x4b) {
          try { fs.unlinkSync(tmpFile); } catch {}
          try { fs.rmdirSync(tmpDir); } catch {}
          throw new Error(`Downloaded ${loader} installer is not a valid JAR`);
        }
      } finally { fs.closeSync(fd); }
    }

    // Need Java to run the installer. We pick it according to the MC version:
    // 1.17+ → Java 17, otherwise Java 8.
    this.report(win, { stage: 'Подготовка Java', current: 0, total: 1, percent: 60 });
    const requiredMajor = mcRequiredJavaMajor(mc);
    const java =
      (await this.java.findBest(requiredMajor)) ??
      (await this.java.ensure(requiredMajor, win));

    this.report(win, { stage: `Запуск ${loader} installer`, current: 0, total: 1, percent: 70 });
    try {
      await this.runJar(java.path, tmpFile);
    } finally {
      // tmpFile must be deleted ALWAYS — even if runJar threw an exception.
      // Previously this only happened on success, and ~30 MB were left in
      // %TEMP% after every failed installation.
      try { fs.unlinkSync(tmpFile); } catch {}
      try { fs.rmdirSync(tmpDir); } catch {}
    }

    // Determine resulting version id by scanning versions/ for new entry
    const versionId = this.detectInstalledLoaderVersion(loader, mc, lv);
    this.flattenLoaderProfile(versionId);
    this.ensureContentFolders(versionId);
    this.report(win, { stage: 'Готово', current: 1, total: 1, percent: 100 });
    return { versionId };
  }

  private runJar(javaPath: string, jarFile: string): Promise<void> {
    // The Forge / NeoForge installer in --installClient mode reads
    // launcher_profiles.json and fails with code 1 if the file is missing.
    // We feed it a minimal valid stub to pass the check.
    const profilesFile = path.join(this.gameDir, 'launcher_profiles.json');
    if (!fs.existsSync(profilesFile)) {
      try {
        fs.mkdirSync(this.gameDir, { recursive: true });
        fs.writeFileSync(profilesFile, JSON.stringify({
          profiles: {},
          selectedProfileName: '',
          clientToken: '00000000-0000-0000-0000-000000000000',
          launcherVersion: { name: 'Trel', format: 21 },
        }, null, 2), 'utf-8');
      } catch {}
    }

    // On Windows JavaService returns javaw.exe (no console). For the
    // installers we switch to java.exe — otherwise stderr/stdout are not
    // piped through spawn, and on failure we are left with an empty message.
    let exe = javaPath;
    if (process.platform === 'win32' && exe.toLowerCase().endsWith('javaw.exe')) {
      const consoleExe = exe.slice(0, -'javaw.exe'.length) + 'java.exe';
      if (fs.existsSync(consoleExe)) exe = consoleExe;
    }

    return new Promise((resolve, reject) => {
      // Forge installer accepts --installClient <path>. NeoForge follows same pattern.
      const args = ['-jar', jarFile, '--installClient', this.gameDir];
      const proc = spawn(exe, args, { stdio: 'pipe', windowsHide: true });
      let stderr = '';
      let stdout = '';
      const onOut = (d: Buffer) => stdout += d.toString();
      const onErr = (d: Buffer) => stderr += d.toString();
      proc.stdout?.on('data', onOut);
      proc.stderr?.on('data', onErr);

      const cleanup = () => {
        proc.stdout?.off('data', onOut);
        proc.stderr?.off('data', onErr);
        proc.off('error', onError);
        proc.off('exit', onExit);
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const onExit = (code: number | null) => {
        cleanup();
        if (code === 0) return resolve();
        const combined = (stderr + (stderr && stdout ? '\n' : '') + stdout).trim();
        const detail = combined ? `:\n${combined.slice(-1500)}` : '';
        reject(new Error(`Installer завершился с кодом ${code}${detail}`));
      };

      proc.on('error', onError);
      proc.on('exit', onExit);
    });
  }

  private detectInstalledLoaderVersion(loader: 'forge' | 'neoforge', mc: string, lv: string): string {
    const versionsDir = path.join(this.gameDir, 'versions');
    if (!fs.existsSync(versionsDir)) throw new Error('versions folder not found');
    const entries = fs.readdirSync(versionsDir);
    const needle = loader === 'forge' ? 'forge' : 'neoforge';
    // Prefer entry that contains both loader name and version
    const match = entries.find((n) => n.toLowerCase().includes(needle) && n.includes(lv.split('-').pop() || ''));
    if (match) return match;
    const fallback = entries.find((n) => n.toLowerCase().includes(needle) && n.includes(mc));
    if (fallback) return fallback;
    throw new Error(`Не удалось определить установленную версию ${loader}`);
  }

  private report(win: BrowserWindow, p: DownloadProgress) {
    if (!win.isDestroyed()) win.webContents.send('minecraft:progress', p);
  }
}

function mcToNeoForgePrefix(mc: string): string | null {
  // 1.20.1 -> "20.1."
  // 1.21    -> "21."
  // 1.21.1 -> "21.1."
  const m = /^1\.(\d+)(?:\.(\d+))?$/.exec(mc);
  if (!m) return null;
  return m[2] ? `${m[1]}.${m[2]}.` : `${m[1]}.`;
}

/**
 * Which Java version is needed to run the Forge/NeoForge installer for a
 * given MC version. 1.18+ — Java 17, anything older — Java 8.
 */
/**
 * Required Java for a version: first the local json (no network — instant), then
 * the inheritsFrom chain, and finally a heuristic based on the id. Previously the
 * plan always went to the network for the manifest and fell back to 8 — old custom
 * json files without javaVersion got the wrong eight instead of 17/21.
 */
export function requiredJavaMajorForVersion(gameDir: string, versionId: string): number {
  try {
    let current: string | undefined = versionId;
    const seen = new Set<string>();
    for (let i = 0; i < 5 && current && !seen.has(current); i++) {
      seen.add(current);
      const fp = path.join(gameDir, 'versions', current, current + '.json');
      let j: Record<string, unknown> | null = null;
      try { j = JSON.parse(fs.readFileSync(fp, 'utf-8')); } catch { break; }
      if (!j || typeof j !== 'object') break;
      const mj = (j.javaVersion as { majorVersion?: number } | undefined)?.majorVersion;
      if (typeof mj === 'number' && mj >= 8 && mj <= 30) return mj;
      current = typeof j.inheritsFrom === 'string' ? j.inheritsFrom : undefined;
    }
  } catch { /* heuristic below */ }
  return mcRequiredJavaMajor(versionId);
}

export function mcRequiredJavaMajor(mc: string): number {
  // 1.20.5+ and 1.21+ require Java 21; future 2x (26.x) also need 21, not 17.
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(mc);
  if (!m) return 17;
  const major = parseInt(m[1], 10);
  if (major >= 2) return 21;
  if (major !== 1) return 17;
  const minor = parseInt(m[2], 10);
  const patch = m[3] !== undefined ? parseInt(m[3], 10) : 0;
  if (minor >= 21 || (minor === 20 && patch >= 5)) return 21;
  if (minor >= 18) return 17;
  return 8;
}
