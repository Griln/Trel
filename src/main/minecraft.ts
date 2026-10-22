import { analyzeCrash } from './crashAnalyzer';

// --- Crash Doctor: detects the cause of the Java client crash and sends the diagnosis to the UI ---
function readRecentText(file: string, maxBytes: number): string | undefined {
  try {
    if (!fs.existsSync(file)) return undefined;
    const st = fs.statSync(file);
    if (Date.now() - st.mtimeMs > 120_000) return undefined; // only fresh files
    const buf = fs.readFileSync(file);
    return buf.subarray(Math.max(0, buf.length - maxBytes)).toString('utf8');
  } catch {
    return undefined;
  }
}

function latestCrashReport(gameDir: string): string | undefined {
  try {
    const dir = path.join(gameDir, 'crash-reports');
    if (!fs.existsSync(dir)) return undefined;
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.txt'))
      .map((f) => ({ p: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (!files.length || Date.now() - files[0].t > 120_000) return undefined;
    return fs.readFileSync(files[0].p, 'utf8');
  } catch {
    return undefined;
  }
}

function emitCrashDiagnosis(win: BrowserWindow, gameDir: string, code: number | null): void {
  try {
    if ((code ?? -1) === 0) return; // normal exit — stay silent
    const logTail = readRecentText(path.join(gameDir, 'logs', 'latest.log'), 60_000) || '';
    const diagnosis = analyzeCrash({ exitCode: code ?? -1, logTail, crashReport: latestCrashReport(gameDir) });
    if (diagnosis && !win.isDestroyed()) win.webContents.send('minecraft:crash', diagnosis);
  } catch {
    /* crash analysis must never break the exit flow */
  }
}
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { BrowserWindow } from 'electron';
import { launch, LaunchOption } from '@xmcl/core';
import { spawn, execSync } from 'node:child_process';
import type { VersionInfo, BedrockVersionInfo, LaunchOptions, LauncherSettings, ContentKind } from '../shared/types';
import { CONTENT_FOLDERS } from '../shared/types';
import { BEDROCK_PACKAGE } from '../shared/constants';
import { supportsCustomSkin } from '../shared/skin-support';
import { JavaService } from './java';
import { MinecraftInstaller } from './installer';
import { BedrockInstaller } from './bedrock-installer';
import { LoaderService, LoaderType } from './loaders';
import { WorldService } from './worlds';
import { SkinServer } from './skin-server';
import { AuthlibInjector } from './authlib';
import { TrelEmuService } from './trelEmu';
import { LEGACY_VERSIONS, isLegacyVersion, launchLegacy, installLegacy } from './legacy-versions';
import { PlaytimeService } from './playtime';
export { BEDROCK_PACKAGE };

export interface InstalledVersionDetail {
  /** Raw folder name (e.g. "1.20.1", "1.20.1-forge-47.2.0" or Bedrock APK id). */
  id: string;
  /** Java base Minecraft version or Bedrock APK id. */
  baseMc: string;
  /** Distinguishes Java profiles from Bedrock APK installs. */
  edition: 'java' | 'bedrock';
  /** Mod loader if this is a modded Java profile, otherwise null. */
  loader: LoaderType | null;
  /** Loader-specific version (e.g. "47.2.0" for Forge). */
  loaderVersion: string | null;
}

/**
 * Pre-Classic / Classic / Indev / Infdev / early Alpha — versions that
 * instead of a `saves/<world>` folder write single world files right into gameDir
 * (or into gameDir/.minecraft when APPDATA is substituted system-wide):
 *   - rd-* / c0.*       → `level.dat`
 *   - in-* (Indev)      → `mclevel.dat`
 *   - inf-* (Infdev)    → `<name>.mclevel` (in saves/) or `level.dat`
 *   - a1.0.*, a1.1.0    → `level.dat` (old format, before a1.1.1)
 *
 * When such a version is fully (deep) removed, the loose files must be cleaned
 * up, otherwise the world "resurrects" itself on the next launch of any
 * compatible old version. WorldService.wipeAllLooseLevelDat() covers all
 * three formats.
 *
 * Matches only those prefixes whose save format is a single file.
 * Does not overlap with beta/release.
 */
function isPreClassicVersionId(id: string): boolean {
  return /^(rd-|c0\.|in-|inf-|a1\.0\.|a1\.1\.0)/.test(id);
}

/**
 * Detect loader + base MC from a versions folder name. Best-effort heuristic,
 * used together with the JSON's inheritsFrom field for accuracy.
 */
function detectLoaderFromId(
  id: string,
): { loader: LoaderType; baseMc: string; loaderVersion: string } | null {
  let m: RegExpExecArray | null;

  // Fabric: fabric-loader-<lv>-<mc>
  m = /^fabric-loader-(.+?)-(\d.+)$/.exec(id);
  if (m) return { loader: 'fabric', loaderVersion: m[1], baseMc: m[2] };

  // Quilt: quilt-loader-<lv>-<mc>
  m = /^quilt-loader-(.+?)-(\d.+)$/.exec(id);
  if (m) return { loader: 'quilt', loaderVersion: m[1], baseMc: m[2] };

  // Forge: <mc>-forge-<lv>  (e.g. 1.20.1-forge-47.2.0)
  m = /^(\d+(?:\.\d+){0,2})-forge-(.+)$/i.exec(id);
  if (m) return { loader: 'forge', baseMc: m[1], loaderVersion: m[2] };
  // Forge: forge-<mc>-<lv>
  m = /^forge-(\d+(?:\.\d+){0,2})-(.+)$/i.exec(id);
  if (m) return { loader: 'forge', baseMc: m[1], loaderVersion: m[2] };

  // NeoForge: neoforge-<lv>  (e.g. neoforge-21.1.10 -> 1.21.1)
  m = /^neoforge-(\d+\.\d+(?:\.\d+)?)$/i.exec(id);
  if (m) {
    const lv = m[1];
    const sm = /^(\d+)\.(\d+)(?:\.\d+)?/.exec(lv);
    if (sm) {
      const minor = parseInt(sm[2], 10);
      const baseMc = minor === 0 ? `1.${sm[1]}` : `1.${sm[1]}.${minor}`;
      return { loader: 'neoforge', baseMc, loaderVersion: lv };
    }
    return { loader: 'neoforge', baseMc: '?', loaderVersion: lv };
  }

  return null;
}

export class MinecraftService {
  private installer: MinecraftInstaller;
  public bedrock: BedrockInstaller;
  public loaders: LoaderService;
  public trelEmu: TrelEmuService;
  private worlds: WorldService;
  /** Shared between the client and the servers — auth and skins through a single mock. */
  private skinServer: SkinServer;
  private authlib: AuthlibInjector;
  private launcherDir: string;
  /** Version IDs currently being launched — protection against double clicks. */
  private launchingVersions = new Set<string>();
  /** Versions that are already running and have not finished yet. */
  private runningVersions = new Set<string>();

  /** Whether at least one game is currently running (for the screenshot hotkey, etc.). */
  get hasRunningGame(): boolean {
    return this.runningVersions.size > 0 || this.launchingVersions.size > 0;
  }
  /** Mutex for revertToVanilla — prevents a race condition on parallel IPC calls. */
  private revertLock: Promise<unknown> = Promise.resolve();
  /** Play-time accounting per version. */
  readonly playtime!: PlaytimeService;
  /** Cache for the ADB path — find it once and reuse it. */
  private adbPath: string | null | undefined = undefined;

  constructor(
    private gameDir: string,
    private java: JavaService,
    worlds?: WorldService,
    launcherDir?: string,
    skinServer?: SkinServer,
    authlib?: AuthlibInjector,
  ) {
    this.installer = new MinecraftInstaller(gameDir);
    this.bedrock = new BedrockInstaller(gameDir);
    this.trelEmu = new TrelEmuService();
    // launcherDir for the authlib-injector cache. If not passed — put it next to gameDir.
    this.launcherDir = launcherDir ?? path.dirname(gameDir);
    this.loaders = new LoaderService(gameDir, java, this.installer);
    this.worlds = worlds ?? new WorldService(gameDir);
    this.skinServer = skinServer ?? new SkinServer();
    this.authlib = authlib ?? new AuthlibInjector(this.launcherDir);
    this.playtime = new PlaytimeService(this.launcherDir);
  }

  setGameDir(dir: string) {
    this.gameDir = dir;
    this.installer.setGameDir(dir);
    this.bedrock.setGameDir(dir);
    this.loaders.setGameDir(dir);
    this.worlds.setGameDir(dir);
  }

  /** Aggregated play-time statistics for the Stats page. */
  getPlaytimeStats() {
    return this.playtime.getStats();
  }

  async fetchVersions(): Promise<VersionInfo[]> {
    const list = await this.installer.fetchVersions();
    // Append bundled legacy versions (not in Mojang manifest) AT THE END,
    // because the list goes from the newest to the oldest, and rd-131655 is the oldest.
    const legacy: VersionInfo[] = LEGACY_VERSIONS.map((v) => ({
      id: v.id,
      type: v.type,
      url: '',
      releaseTime: v.releaseTime,
    }));
    return [...(list as VersionInfo[]), ...legacy];
  }

  // ─── Bedrock ──────────────────────────────────────────────────────────

  async fetchBedrockVersions(): Promise<BedrockVersionInfo[]> {
    return this.bedrock.fetchVersions();
  }

  installedBedrockIds(): string[] {
    return this.bedrock.installedVersionIds();
  }

  isBedrockInstalled(versionId: string): boolean {
    return this.bedrock.isInstalled(versionId);
  }

  async installBedrock(versionId: string, win: BrowserWindow) {
    await this.bedrock.install(versionId, win);
  }

  uninstallBedrock(versionId: string): boolean {
    return this.bedrock.uninstall(versionId);
  }

  bedrockApkPath(versionId: string): string {
    return this.bedrock.apkPath(versionId);
  }

  /** Looks for adb.exe: first in bundled resources, then PATH and SDK. */
  private findAdb(): string | null {
    if (this.adbPath !== undefined) return this.adbPath;
    const candidates: string[] = [];

    if (process.platform === 'win32') {
      // Bundled with the launcher (resources/platform-tools/)
      try {
        const bundled = path.join(process.resourcesPath, 'platform-tools', 'adb.exe');
        if (fs.existsSync(bundled)) candidates.push(bundled);
      } catch {}

      // PATH
      const pathEnv = process.env.PATH || '';
      for (const dir of pathEnv.split(path.delimiter)) {
        candidates.push(path.join(dir, 'adb.exe'), path.join(dir, 'adb'));
      }
      // Android SDK
      const local = process.env.LOCALAPPDATA || '';
      if (local) candidates.push(path.join(local, 'Android', 'Sdk', 'platform-tools', 'adb.exe'));
      const appData = process.env.APPDATA || '';
      if (appData) candidates.push(path.join(appData, 'Android', 'Sdk', 'platform-tools', 'adb.exe'));
      // Program Files
      candidates.push(
        'C:\\Program Files\\Android\\Sdk\\platform-tools\\adb.exe',
        'C:\\adb\\adb.exe',
      );
    } else if (process.platform === 'linux' || process.platform === 'darwin') {
      // PATH (Unix). Native Android SDK installs keep adb there.
      const pathEnv = process.env.PATH || '';
      for (const dir of pathEnv.split(path.delimiter)) {
        candidates.push(path.join(dir, 'adb'));
      }
      // Android SDK on Unix — usually in ~/Android/Sdk/platform-tools/.
      candidates.push(
        path.join(os.homedir(), 'Android', 'Sdk', 'platform-tools', 'adb'),
        path.join(os.homedir(), 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
        '/usr/bin/adb',
        '/usr/local/bin/adb',
        '/opt/android-sdk/platform-tools/adb',
      );
    }

    for (const c of candidates) {
      if (fs.existsSync(c)) { this.adbPath = c; return c; }
    }
    this.adbPath = null;
    return null;
  }

  /**
   * ADB for TrelEmu runs on an isolated server port 5038. If you call the
   * regular `adb -s 127.0.0.1:5555 ...`, adb will talk to server 5037 and report
   * `device '127.0.0.1:5555' not found`, even though TrelEmu is already connected.
   */
  private adbServerArgsForSerial(serial?: string): string {
    if (serial && /^(127\.0\.0\.1|localhost):5555$/i.test(serial)) return '-P 5038 ';
    return '';
  }

  private adbEnvForSerial(serial?: string): NodeJS.ProcessEnv {
    if (serial && /^(127\.0\.0\.1|localhost):5555$/i.test(serial)) {
      return { ...process.env, ANDROID_ADB_SERVER_PORT: '5038', ADB_SERVER_PORT: '5038', ADB_SERVER_SOCKET: 'tcp:127.0.0.1:5038' };
    }
    return process.env;
  }

  private adbCmd(adb: string, serial: string | undefined, args: string): string {
    // The serial travels inside a shell string: cut everything except the legal alphabet.
    // A malicious serial from a foreign adb device would otherwise give RCE (shell:true below).
    if (serial && !/^[a-zA-Z0-9._:-]{1,64}$/.test(serial)) throw new Error(`Unsafe ADB serial: ${serial}`);
    return `"${adb}" ${this.adbServerArgsForSerial(serial)}${args}`;
  }

  private adbExec(adb: string, serial: string, args: string, timeout = 15_000): string {
    return execSync(this.adbCmd(adb, serial, `-s ${serial} ${args}`), {
      timeout,
      encoding: 'utf-8',
      stdio: 'pipe',
      env: this.adbEnvForSerial(serial),
      windowsHide: true,
    });
  }

  private execShellAsync(cmd: string, timeout = 15_000, env: NodeJS.ProcessEnv = process.env): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, {
        shell: true,
        windowsHide: true,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        const pid = child.pid;
        if (pid) {
          if (process.platform === 'win32') {
            try { execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', windowsHide: true, timeout: 5000 }); }
            catch { try { child.kill('SIGKILL'); } catch {} }
          } else {
            // On Linux/macOS SIGTERM gives the JVM a chance to close sockets and native
            // libraries, while SIGKILL leaves .so files and orphans behind.
            try { process.kill(pid, 'SIGTERM'); } catch {}
            // Wait 500ms, and if it has not exited — force SIGKILL.
            setTimeout(() => { try { process.kill(pid, 'SIGKILL'); } catch {} }, 500);
          }
        }
        reject(new Error(`Command timed out after ${timeout}ms: ${cmd}\n${stderr || stdout}`));
      }, timeout);

      child.stdout?.on('data', (d) => { stdout += d.toString(); });
      child.stderr?.on('data', (d) => { stderr += d.toString(); });
      child.on('error', (e) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(e);
      });
      child.on('close', (code) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (code === 0) resolve(stdout);
        else reject(new Error(`Command failed with code ${code}: ${cmd}\n${stderr || stdout}`));
      });
    });
  }

  private adbExecAsync(adb: string, serial: string, args: string, timeout = 15_000): Promise<string> {
    return this.execShellAsync(this.adbCmd(adb, serial, `-s ${serial} ${args}`), timeout, this.adbEnvForSerial(serial));
  }

  private async waitAndroidReady(adb: string, serial: string, win?: BrowserWindow): Promise<void> {
    for (let i = 0; i < 90; i++) {
      try {
        const boot = (await this.adbExecAsync(adb, serial, 'shell getprop sys.boot_completed', 5000)).trim();
        const packageReady = (await this.adbExecAsync(adb, serial, 'shell pm path android', 5000)).trim();
        if (boot === '1' && packageReady.length > 0) return;
      } catch {}
      if (win && !win.isDestroyed() && i % 5 === 0) {
        win.webContents.send('minecraft:log', `[bedrock] Жду готовность Android для запуска... ${i + 1}/90\n`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Android не успел загрузиться для запуска Bedrock');
  }

  private async resolveBedrockLaunchActivity(adb: string, serial: string): Promise<string | null> {
    const commands = [
      'shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER com.mojang.minecraftpe',
      'shell cmd package resolve-activity --brief com.mojang.minecraftpe',
    ];

    for (const cmd of commands) {
      try {
        const lines = (await this.adbExecAsync(adb, serial, cmd, 8000))
          .split(/\r?\n/)
          .map((x) => x.trim())
          .filter(Boolean);
        const component = [...lines].reverse().find((line) => line.includes('com.mojang.minecraftpe/') && !line.startsWith('priority='));
        if (component) return component;
      } catch {}
    }

    return null;
  }

  private async bedrockWindowFocus(adb: string, serial: string): Promise<string> {
    const commands = [
      'shell dumpsys window windows | grep -E "mCurrentFocus|mFocusedApp|mResumedActivity|mLastClosingApp"',
      'shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity|ResumedActivity|mLastPausedActivity"',
    ];
    const chunks: string[] = [];
    for (const cmd of commands) {
      try { chunks.push(await this.adbExecAsync(adb, serial, cmd, 8000)); } catch {}
    }
    return chunks.join('\n').trim();
  }

  private async isBedrockInForeground(adb: string, serial: string): Promise<boolean> {
    return (await this.bedrockWindowFocus(adb, serial)).includes('com.mojang.minecraftpe');
  }

  private async dismissImmersiveModeOverlay(adb: string, serial: string): Promise<void> {
    try { await this.adbExecAsync(adb, serial, 'shell settings put secure immersive_mode_confirmations confirmed', 5000); } catch {}
    const focus = await this.bedrockWindowFocus(adb, serial);
    if (focus.includes('ImmersiveModeConfirmation')) {
      try { await this.adbExecAsync(adb, serial, 'shell input keyevent KEYCODE_DPAD_CENTER', 5000); } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  private async ensureTrelEmuNativeBridgeReady(adb: string, serial: string, win: BrowserWindow): Promise<void> {
    if (!this.isTrelEmuSerial(serial)) return;
    const log = (s: string) => { if (!win.isDestroyed()) win.webContents.send('minecraft:log', s); };
    try {
      const done = (await this.adbExecAsync(adb, serial, 'shell getprop persist.trel.nativebridge_zygote_restarted', 5000)).trim();
      const abi = (await this.adbExecAsync(adb, serial, 'shell getprop ro.product.cpu.abilist', 5000)).trim();
      const binfmt = (await this.adbExecAsync(adb, serial, 'shell "[ -e /proc/sys/fs/binfmt_misc/arm_exe ] && echo ARM_OK || echo NO_ARM"', 5000)).trim();
      if (done === '1' && abi.includes('armeabi') && binfmt.includes('ARM_OK')) return;

      log('[bedrock] Включаю Houdini native bridge и перезапускаю Android Runtime (zygote) один раз\n');
      await this.adbExecAsync(
        adb,
        serial,
        'shell "settings put secure immersive_mode_confirmations confirmed; setprop persist.sys.nativebridge 1; if [ -x /system/bin/enable_nativebridge ]; then /system/bin/enable_nativebridge; fi; setprop persist.trel.nativebridge_zygote_restarted 1; setprop ctl.restart zygote"',
        20_000,
      );
      await new Promise((r) => setTimeout(r, 18_000));
      await this.ensureAdbConnected(adb, serial);
      await this.waitAndroidReady(adb, serial, win);
    } catch (e) {
      log(`[bedrock] Не удалось подтвердить Houdini native bridge: ${(e as Error).message}\n`);
    }
  }

  private async bedrockCrashLog(adb: string, serial: string): Promise<string> {
    try {
      const out = await this.adbExecAsync(adb, serial, 'logcat -d -t 700', 15_000);
      const lines = out.split(/\r?\n/).filter((line) =>
        /AndroidRuntime|FATAL EXCEPTION|com\.mojang\.minecraftpe|libminecraft|libfmod|UnsatisfiedLinkError|houdini|Native bridge|SIGSEGV|Fatal signal|EGL|OpenGL|ANR|ActivityManager|crash/i.test(line),
      );
      return lines.slice(-120).join('\n');
    } catch (e) {
      return `logcat недоступен: ${(e as Error).message}`;
    }
  }

  private async startBedrockForeground(adb: string, serial: string, win: BrowserWindow): Promise<void> {
    const log = (s: string) => {
      if (!win.isDestroyed()) win.webContents.send('minecraft:log', s);
    };

    await this.waitAndroidReady(adb, serial, win);

    // Android-x86 ISO often boots into Google Setup Wizard. It is a HOME
    // activity and can remain foreground forever, so Bedrock starts in the
    // background or never becomes visible. Mark setup as complete and stop it
    // right before launching the game too, not only from initrd.
    try { await this.adbExecAsync(adb, serial, 'shell settings put global device_provisioned 1', 5000); } catch {}
    try { await this.adbExecAsync(adb, serial, 'shell settings put secure user_setup_complete 1', 5000); } catch {}
    try { await this.adbExecAsync(adb, serial, 'shell settings put secure tv_user_setup_complete 1', 5000); } catch {}
    try { await this.adbExecAsync(adb, serial, 'shell settings put secure immersive_mode_confirmations confirmed', 5000); } catch {}
    try { await this.adbExecAsync(adb, serial, 'shell pm disable-user --user 0 com.google.android.setupwizard', 8000); } catch {}
    try { await this.adbExecAsync(adb, serial, 'shell pm disable com.google.android.setupwizard', 8000); } catch {}
    try { await this.adbExecAsync(adb, serial, 'shell am force-stop com.google.android.setupwizard', 5000); } catch {}

    // Make Home app deterministic at runtime too. If Android keeps several
    // HOME candidates enabled, it opens ResolverActivity and steals the screen.
    try { await this.adbExecAsync(adb, serial, 'shell pm enable com.farmerbb.taskbar.androidx86', 8000); } catch {}
    for (const pkg of [
      'com.android.launcher3',
      'com.android.launcher',
      'com.google.android.apps.nexuslauncher',
      'com.google.android.tvlauncher',
      'com.google.android.leanbacklauncher',
      'org.android_x86.launcher',
    ]) {
      try { await this.adbExecAsync(adb, serial, `shell pm disable-user --user 0 ${pkg}`, 8000); } catch {}
      try { await this.adbExecAsync(adb, serial, `shell pm disable ${pkg}`, 8000); } catch {}
    }
    try { await this.adbExecAsync(adb, serial, 'shell cmd package set-home-activity --user 0 com.farmerbb.taskbar.androidx86/com.farmerbb.taskbar.activity.DashboardActivity', 8000); } catch {}
    try { await this.adbExecAsync(adb, serial, 'shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME', 8000); } catch {}

    try { await this.adbExecAsync(adb, serial, 'shell input keyevent KEYCODE_WAKEUP', 5000); } catch {}
    try { await this.adbExecAsync(adb, serial, 'shell wm dismiss-keyguard', 5000); } catch {}
    // Close ResolverActivity/chooser if the user previously opened it. Do not press HOME, it may open chooser again.
    try { await this.adbExecAsync(adb, serial, 'shell input keyevent KEYCODE_BACK', 5000); } catch {}
    try { await this.adbExecAsync(adb, serial, 'shell input keyevent KEYCODE_BACK', 5000); } catch {}

    const installed = await this.adbExecAsync(adb, serial, 'shell pm list packages com.mojang.minecraftpe', 8000);
    if (!installed.includes('com.mojang.minecraftpe')) {
      throw new Error('Bedrock не установлен в Android после install');
    }

    const resolved = await this.resolveBedrockLaunchActivity(adb, serial);
    const candidates = [
      resolved,
      'com.mojang.minecraftpe/com.mojang.minecraftpe.MainActivity',
      'com.mojang.minecraftpe/.MainActivity',
    ].filter(Boolean) as string[];

    let lastErr = '';
    let lastCrashLog = '';
    for (const component of candidates) {
      try {
        log(`[bedrock] Запускаю Activity: ${component}\n`);
        try { await this.adbExecAsync(adb, serial, 'logcat -c', 8000); } catch {}
        try { await this.adbExecAsync(adb, serial, 'shell am force-stop com.mojang.minecraftpe', 8000); } catch {}
        await new Promise((r) => setTimeout(r, 1000));

        const out = await this.adbExecAsync(
          adb,
          serial,
          `shell am start -S -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n ${component}`,
          25_000,
        );
        log(`[bedrock] am start ответ:\n${out}\n`);
        await new Promise((r) => setTimeout(r, 5000));

        if (await this.isBedrockInForeground(adb, serial)) {
          await this.dismissImmersiveModeOverlay(adb, serial);
          log('[bedrock] Minecraft открыт на экране QEMU\n');
          return;
        }

        const pid = (await this.adbExecAsync(adb, serial, 'shell "pidof com.mojang.minecraftpe || echo NONE"', 8000)).trim();
        lastCrashLog = await this.bedrockCrashLog(adb, serial);
        if (pid && pid !== 'NONE') {
          const fatal = /FATAL EXCEPTION|UnsatisfiedLinkError|Fatal signal|SIGSEGV|has died/i.test(lastCrashLog);
          if (!fatal) {
            await this.dismissImmersiveModeOverlay(adb, serial);
            log(`[bedrock] Minecraft процесс жив (${pid}), считаю запуск успешным\n`);
            return;
          }
          log(`[bedrock] Minecraft процесс появился (${pid}), но logcat содержит crash-признаки\n`);
        }

        const focus = await this.bedrockWindowFocus(adb, serial);
        lastErr = `Activity ${component} запустилась, но Minecraft не стал foreground. Focus: ${focus || 'пусто'}`;
        log(`[bedrock] ${lastErr}\n`);
        if (lastCrashLog) log(`[bedrock] crash/logcat после запуска:\n${lastCrashLog}\n`);
      } catch (e) {
        lastErr = (e as Error).message;
        lastCrashLog = await this.bedrockCrashLog(adb, serial);
        log(`[bedrock] Activity ${component} не сработала: ${lastErr.split('\n')[0]}\n`);
        if (lastCrashLog) log(`[bedrock] crash/logcat после ошибки:\n${lastCrashLog}\n`);
      }
    }

    try {
      const pid = (await this.adbExecAsync(adb, serial, 'shell "pidof com.mojang.minecraftpe || echo NONE"', 8000)).trim();
      if (pid && pid !== 'NONE') {
        await this.dismissImmersiveModeOverlay(adb, serial);
        log(`[bedrock] Minecraft процесс всё ещё жив (${pid}), считаю запуск успешным\n`);
        return;
      }
    } catch (e) {
      lastErr = (e as Error).message;
    }

    const focus = await this.bedrockWindowFocus(adb, serial) || 'не удалось получить focus';
    const crash = await this.bedrockCrashLog(adb, serial) || lastCrashLog || 'crash log пустой';
    throw new Error(`Minecraft установлен, но не открылся на экране QEMU. Последняя ошибка: ${lastErr}\nFocus:\n${focus}\nCrash/logcat:\n${crash}`);
  }

  private isTrelEmuSerial(serial?: string): boolean {
    return !!serial && /^(127\.0\.0\.1|localhost):5555$/i.test(serial);
  }

  private async ensureAdbConnected(adb: string, serial: string): Promise<void> {
    if (!this.isTrelEmuSerial(serial)) return;
    try {
      await this.execShellAsync(this.adbCmd(adb, serial, `connect ${serial}`), 10_000, this.adbEnvForSerial(serial));
    } catch {}
  }

  private apkLooksArmOnly(apk: string): boolean {
    try {
      const buf = fs.readFileSync(apk);
      const text = buf.toString('latin1');
      const hasArm = text.includes('lib/armeabi-v7a/') || text.includes('lib/arm/');
      const hasX86 = text.includes('lib/x86/') || text.includes('lib/x86_64/');
      return hasArm && !hasX86;
    } catch {
      return false;
    }
  }

  private bedrockNeedsArmAbiInstall(apk: string, serial: string): boolean {
    return this.isTrelEmuSerial(serial) && this.apkLooksArmOnly(apk);
  }

  private async bedrockInstalledWithArmAbi(adb: string, serial: string): Promise<boolean> {
    try {
      const out = await this.adbExecAsync(adb, serial, 'shell dumpsys package com.mojang.minecraftpe | grep -E "primaryCpuAbi|secondaryCpuAbi|nativeLibrary"', 10_000);
      return out.includes('primaryCpuAbi=armeabi-v7a') || out.includes('primaryCpuAbi=armeabi');
    } catch {
      return false;
    }
  }

  /** Returns the list of serial numbers of connected devices/emulators via adb. */
  listAdbDevices(): { serial: string; state: string; model?: string }[] {
    const adb = this.findAdb();
    if (!adb) return [];
    try {
      const out = execSync(`"${adb}" devices -l`, { timeout: 5000, encoding: 'utf-8' });
      const lines = out.split('\n').slice(1);
      const devs: { serial: string; state: string; model?: string }[] = [];
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2 || parts[0] === '') continue;
        const serial = parts[0];
        const state = parts[1];
        const modelMatch = line.match(/model:(\S+)/);
        devs.push({ serial, state, model: modelMatch?.[1] });
      }
      return devs.filter((d) => d.state === 'device');
    } catch { return []; }
  }


  async installBedrockContentToAndroid(kind: ContentKind, localPath: string, serial: string | undefined, win: BrowserWindow): Promise<{ target: string; serial: string; output: string }> {
    const adb = this.findAdb();
    if (!adb) throw new Error('adb не найден — невозможно установить Bedrock-контент в Android');

    let targetSerial = serial && /^[a-zA-Z0-9._:-]+$/.test(serial) ? serial : (this.trelEmu.getAdbSerial() || undefined);
    if (!targetSerial) {
      const emu = this.trelEmu.find();
      if (!emu) throw new Error('TrelEmu не найден. Запусти Bedrock или установи TrelEmu перед установкой аддонов.');
      if (!win.isDestroyed()) win.webContents.send('minecraft:log', '[bedrock] Запускаю TrelEmu для установки контента\n');
      targetSerial = await this.trelEmu.start();
    }

    await this.ensureAdbConnected(adb, targetSerial);
    await this.waitAndroidReady(adb, targetSerial, win);

    const sub = kind === 'texturepack' ? 'minecraftWorlds' : (kind === 'mod' ? 'behavior_packs' : 'resource_packs');
    const targetBase = `/sdcard/Android/data/${BEDROCK_PACKAGE}/files/games/com.mojang/${sub}`;
    const itemName = path.basename(localPath).replace(/["'`$\\]/g, '_');
    const target = `${targetBase}/${itemName}`;

    await this.adbExecAsync(adb, targetSerial, `shell mkdir -p "${targetBase}"`, 10_000);
    const stat = fs.statSync(localPath);
    let output = '';
    if (stat.isDirectory()) {
      // Push directory contents into target/<pack>. `adb push dir target` creates target/dir on most ADB builds,
      // so pushing to the parent keeps the original pack folder name and matches Minecraft's folder layout.
      output = await this.execShellAsync(this.adbCmd(adb, targetSerial, `-s ${targetSerial} push "${localPath}" "${targetBase}/"`), 180_000, this.adbEnvForSerial(targetSerial));
    } else {
      output = await this.execShellAsync(this.adbCmd(adb, targetSerial, `-s ${targetSerial} push "${localPath}" "${target}"`), 180_000, this.adbEnvForSerial(targetSerial));
    }
    try { await this.adbExecAsync(adb, targetSerial, `shell am force-stop ${BEDROCK_PACKAGE}`, 8000); } catch {}
    if (!win.isDestroyed()) win.webContents.send('minecraft:log', `[bedrock] Контент установлен в Android: ${target}\n`);
    return { target, serial: targetSerial, output };
  }

  async launchBedrock(versionId: string, serial: string, win: BrowserWindow): Promise<number> {
    if (this.launchingVersions.has(versionId)) throw new Error('Запуск уже идёт — подождите');
    if (this.runningVersions.has(versionId)) {
      // Bedrock duplicate-launch protection: Trel does not receive an exit event
      // from the Android process inside TrelEmu. So before blocking we must
      // verify the actual process state. If the emulator is already closed or ADB
      // does not answer, the lock is considered stale and is released.
      let stillRunning = false;
      const adb = this.findAdb();
      if (adb) {
        const probeSerial = (serial && /^[a-zA-Z0-9._:-]+$/.test(serial))
          ? serial
          : (this.trelEmu.getAdbSerial() || '127.0.0.1:5555');
        try {
          if (probeSerial && await this.isBedrockProcessAlive(adb, probeSerial)) stillRunning = true;
        } catch {
          stillRunning = false;
        }
      }
      if (stillRunning) throw new Error('Эта версия уже запущена');
      this.runningVersions.delete(versionId);
      this.playtime.recordEnd(versionId);
    }

    const apk = this.bedrockApkPath(versionId);
    if (!fs.existsSync(apk)) throw new Error(`APK не найден: ${apk}. Сначала установите версию.`);

    // If the renderer passed a valid ADB serial (e.g. a real device
    // over USB or scrcpy) — use it and take the short install+launch path.
    const useExternalDevice = serial && /^[a-zA-Z0-9._:-]+$/.test(serial);
    if (useExternalDevice) {
      return this.launchBedrockOnAdb(versionId, apk, serial, win);
    }

    // Otherwise — automatically start TrelEmu if the user has already downloaded
    // the optional emulator pack through the launcher or placed a portable pack next to Trel.exe.
    const trelEmuInfo = this.trelEmu.find();
    if (trelEmuInfo) {
      if (!win.isDestroyed()) win.webContents.send('minecraft:log', `[bedrock] Запускаю TrelEmu: ${trelEmuInfo.qemuExe}\n`);
      const trelEmuSerial = await this.trelEmu.start();
      if (!win.isDestroyed()) win.webContents.send('minecraft:log', `[bedrock] TrelEmu подключён по ADB: ${trelEmuSerial}\n`);
      return this.launchBedrockOnAdb(versionId, apk, trelEmuSerial, win);
    }

    throw new Error('TrelEmu не установлен. Скачайте TrelEmu в лаунчере или положите папку trel-emu рядом с Trel.exe.');
  }

  /**
   * Shared tail part: install the APK and launch the main Bedrock activity
   * on an arbitrary ADB device. Used both for TrelEmu (bundled) and for
   * external devices (scrcpy, USB phone).
   */
  private async launchBedrockOnAdb(versionId: string, apk: string, serial: string, win: BrowserWindow): Promise<number> {
    const adb = this.findAdb();
    if (!adb) throw new Error('adb не найден — невозможно установить APK');
    await this.ensureAdbConnected(adb, serial);

    if (!win.isDestroyed()) win.webContents.send('minecraft:log', `[bedrock] Устанавливаю APK: ${apk}\n`);

    // First check whether Bedrock is already installed on this device.
    // For an ARM-only APK on TrelEmu the ABI matters: without --abi armeabi-v7a Android
    // starts the process as x86 and crashes on lib/arm/*.so with EM_ARM.
    const installed = await this.bedrockInstalledOnDevice(adb, serial);
    const needsArmAbi = this.bedrockNeedsArmAbiInstall(apk, serial);
    const installedAbiOk = !needsArmAbi || await this.bedrockInstalledWithArmAbi(adb, serial);
    if (installed && installedAbiOk) {
      if (!win.isDestroyed()) win.webContents.send('minecraft:log', `[bedrock] Bedrock уже установлен на ${serial}, пропускаю install\n`);
    } else {
      if (installed && !installedAbiOk) {
        if (!win.isDestroyed()) win.webContents.send('minecraft:log', '[bedrock] Bedrock установлен с неправильным ABI, переустанавливаю как ARM через Houdini\n');
        try { await this.adbExecAsync(adb, serial, 'uninstall com.mojang.minecraftpe', 30_000); } catch {}
      }
      try {
        const abiArg = needsArmAbi ? '--abi armeabi-v7a ' : '';
        if (needsArmAbi && !win.isDestroyed()) win.webContents.send('minecraft:log', '[bedrock] ARM-only APK, ставлю с --abi armeabi-v7a для Houdini\n');
        await this.execShellAsync(this.adbCmd(adb, serial, `-s ${serial} install -r -g ${abiArg}"${apk}"`), 240_000, this.adbEnvForSerial(serial));
      } catch (e) {
        throw new Error(`Не удалось установить Bedrock на ${serial}: ${(e as Error).message}`);
      }
    }

    if (!win.isDestroyed()) {
      win.webContents.send('minecraft:log', `[bedrock] Запускаю Minecraft на экране QEMU: ${serial}
`);
    }

    if (needsArmAbi) await this.ensureTrelEmuNativeBridgeReady(adb, serial, win);

    await this.startBedrockForeground(adb, serial, win);

    this.runningVersions.add(versionId);
    this.playtime.recordStart(versionId);
    // Track the exit — TrelEmu keeps running, but Bedrock exits when the
    // user presses "Back" in the emulator. Here we only clean the Set, so that
    // a repeated launch does not complain "already running".
    const cleanup = () => { this.runningVersions.delete(versionId);
      this.playtime.recordEnd(versionId); };
    // After 30 seconds we release the lock — this is a safeguard for the case when
    // the process did not report an exit (and it will not, because this is Android
    // inside TrelEmu, not a child process of Trel). On top of that, the check
    // via `pidof` added above in launchBedrock releases the lock as soon as
    // the user closes Bedrock.
    setTimeout(cleanup, 30_000);

    if (!win.isDestroyed()) win.webContents.send('minecraft:launchStart', versionId);
    return 0;
  }

  /** Checks whether Bedrock is installed on the ADB device (by package). */
  private async bedrockInstalledOnDevice(adb: string, serial: string): Promise<boolean> {
    try {
      const out = await this.adbExecAsync(adb, serial, 'shell pm list packages com.mojang.minecraftpe', 10_000);
      return out.includes('com.mojang.minecraftpe');
    } catch {
      return false;
    }
  }

  /**
   * Checks whether the com.mojang.minecraftpe process is really running on the device.
   * Used to release the duplicate-launch protection when the user has already
   * closed Bedrock via the "Back" button in TrelEmu — Trel learns nothing about it,
   * but `pidof` honestly returns an empty string.
   */
  private async isBedrockProcessAlive(adb: string, serial: string): Promise<boolean> {
    try {
      const out = await this.adbExecAsync(adb, serial, 'shell "pidof com.mojang.minecraftpe || echo NONE"', 5000);
      const pid = out.trim();
      return pid.length > 0 && pid !== 'NONE';
    } catch {
      return false;
    }
  }

  /**
   * Returns the IDs of installed versions: those that have their own
   * client jar on disk at `versions/<id>/<id>.jar`.
   *
   * Previously it counted "jar or json" — that produced false positives after
   * installing loaders: the vanilla parent (`1.21.11`) is stored as a single
   * folder with only a JSON file (for inheritsFrom resolution) and no jar.
   * After flatten it is removed, but fetchVersionJson can recreate the
   * JSON file on any access to a Forge profile — and then a
   * "third version" appears in the list that does not really exist.
   *
   * For loader profiles `flattenLoaderProfile()` copies the jar into their folder,
   * so Fabric/Quilt instances (which originally come as inherits-only)
   * also pass this check correctly after flatten.
   */
  installedVersionIds(): string[] {
    const versionsDir = path.join(this.gameDir, 'versions');
    if (!fs.existsSync(versionsDir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(versionsDir)) {
      const dir = path.join(versionsDir, entry);
      const jar = path.join(dir, `${entry}.jar`);
      if (fs.existsSync(jar)) out.push(entry);
    }
    return out;
  }

  /** Same as installedVersionIds but enriched with loader info per entry. */
  installedDetailed(): InstalledVersionDetail[] {
    const java = this.installedVersionIds().map((id) => this.detailFor(id));
    const bedrock: InstalledVersionDetail[] = this.installedBedrockIds().map((id) => ({
      id,
      baseMc: id,
      edition: 'bedrock',
      loader: null,
      loaderVersion: null,
    }));
    return [...bedrock, ...java];
  }

  detailFor(id: string): InstalledVersionDetail {
    const jsonPath = path.join(this.gameDir, 'versions', id, id + '.json');
    let inheritsFrom: string | undefined;
    try {
      const j = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      inheritsFrom = j.inheritsFrom;
    } catch {}

    const detected = detectLoaderFromId(id);
    if (detected) {
      return {
        id,
        baseMc: inheritsFrom ?? detected.baseMc,
        edition: 'java',
        loader: detected.loader,
        loaderVersion: detected.loaderVersion,
      };
    }
    if (inheritsFrom) {
      return { id, baseMc: inheritsFrom, edition: 'java', loader: null, loaderVersion: null };
    }
    return { id, baseMc: id, edition: 'java', loader: null, loaderVersion: null };
  }

  /** Returns all installed loader profiles for a given base MC version. */
  loadersForBase(baseMc: string): InstalledVersionDetail[] {
    return this.installedDetailed().filter((d) => d.loader && d.baseMc === baseMc);
  }

  /**
   * Careful cleanup: old builds created content folders
   * (mods/shaderpacks/resourcepacks/texturepacks) even for vanilla versions.
   * We delete them ONLY if they are empty and the version has no loader — user
   * files are never touched. Loader and Bedrock versions are not affected.
   */
  cleanupVanillaContentFolders(): void {
    try {
      for (const d of this.installedDetailed()) {
        if (d.edition !== 'java' || d.loader) continue;
        for (const sub of ['mods', 'shaderpacks', 'resourcepacks', 'texturepacks']) {
          const p = path.join(this.gameDir, 'versions', d.id, sub);
          try {
            if (fs.existsSync(p) && fs.readdirSync(p).length === 0) {
              fs.rmSync(p, { recursive: true, force: true });
            }
          } catch {}
        }
      }
    } catch {}
  }

  /**
   * Iterates over installed loader profiles and calls flatten for each —
   * this removes the "double" folders (loader + vanilla parent),
   * keeping the content (mods/saves/...) inside the loader.
   * Idempotent — after the first pass it does nothing.
   *
   * Additionally cleans up orphan vanilla folders: folders in `versions/<id>/`
   * with a single JSON and no JAR that match the base MC of an already installed
   * loader. Such "ghosts" appeared when the installer resolved inheritsFrom
   * and created a JSON file, but flatten did not remove them in time. The UI
   * saw them as a separate "third" version.
   */
  consolidateInstalls(): void {
    for (const d of this.installedDetailed()) {
      if (d.loader) this.loaders.flattenLoaderProfile(d.id);
    }
    this.cleanupOrphanedParents();
  }

  /**
   * Deletes `versions/<id>/` folders where:
   *  - there is no own JAR
   *  - and there is an installed loader with baseMc === id
   * This is exactly the "ghost" of the vanilla parent after flatten.
   */
  private cleanupOrphanedParents(): void {
    const versionsRoot = path.join(this.gameDir, 'versions');
    if (!fs.existsSync(versionsRoot)) return;
    // Collect the bases of the versions that have an installed loader.
    const installedLoaders = this.installedVersionIds()
      .map((id) => this.detailFor(id))
      .filter((d) => d.loader);
    const moddedBases = new Set(installedLoaders.map((d) => d.baseMc));

    for (const entry of fs.readdirSync(versionsRoot)) {
      if (!moddedBases.has(entry)) continue;
      const dir = path.join(versionsRoot, entry);
      const jar = path.join(dir, entry + '.jar');
      if (fs.existsSync(jar)) continue; // This is a normal vanilla install — do not touch it.
      // Folder present, no JAR, and this base has a loader → orphan.
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  }

  private withRevertLock<T>(fn: () => T | Promise<T>): Promise<T> {
    const next = this.revertLock.then(() => fn(), () => fn());
    this.revertLock = next;
    return next as Promise<T>;
  }

  /**
   * Removes all loader profiles for baseMc, migrating their content (mods,
   * shaders, resource/texture packs, worlds) into a clean vanilla install.
   * If the vanilla folder is missing (it was removed after flatten), it is reinstalled.
   */
  async revertToVanilla(baseMc: string, win: BrowserWindow): Promise<{ removed: string[]; reinstalledBase: boolean }> {
    return this.withRevertLock(async () => {
      const loaders = this.loadersForBase(baseMc);
      const removed: string[] = [];

      const baseDir = this.versionFolder(baseMc);
      const baseJsonPath = path.join(baseDir, baseMc + '.json');
      let reinstalledBase = false;
      if (!fs.existsSync(baseJsonPath)) {
        // The vanilla was "absorbed" into the loader during flatten — bring it back up.
        await this.installer.install(baseMc, win);
        reinstalledBase = true;
      }
      this.ensureContentFolders(baseMc);

      for (const d of loaders) {
        const loaderDir = path.join(this.gameDir, 'versions', d.id);
        let allMoved = 0;
        let totalFiles = 0;
        // Migrate content from the loader folder into the fresh vanilla, nothing is lost.
        for (const sub of ['mods', 'shaderpacks', 'resourcepacks', 'texturepacks', 'saves']) {
          const fromDir = path.join(loaderDir, sub);
          if (!fs.existsSync(fromDir)) continue;
          const toDir = path.join(baseDir, sub);
          try { fs.mkdirSync(toDir, { recursive: true }); } catch {}
          try {
            for (const entry of fs.readdirSync(fromDir)) {
              if (entry.includes('..') || entry.includes('\0')) continue;
              const from = path.join(fromDir, entry);
              totalFiles++;

              // Symlink — cut it off first
              let lSt: fs.Stats;
              try { lSt = fs.lstatSync(from); } catch { continue; }
              if (lSt.isSymbolicLink()) continue;

              // Unique name on conflict (with a counter)
              let to = path.join(toDir, entry);
              if (fs.existsSync(to)) {
                const ext = path.extname(entry);
                const base = path.basename(entry, ext);
                let n = 0;
                do {
                  const suffix = n === 0 ? '_from_loader' : `_from_loader (${n})`;
                  to = path.join(toDir, `${base}${suffix}${ext}`);
                  n++;
                } while (fs.existsSync(to));
              }

              // Move with a correct fallback for folders (saves/ etc.)
              try { fs.renameSync(from, to); allMoved++; }
              catch {
                try {
                  if (lSt.isDirectory()) {
                    fs.cpSync(from, to, { recursive: true });
                  } else {
                    fs.copyFileSync(from, to);
                  }
                  fs.rmSync(from, { recursive: true, force: true });
                  allMoved++;
                } catch {}
              }
            }
          } catch {}
        }

        // Only delete loader dir if all content was migrated or there was nothing to migrate
        if (totalFiles === 0 || allMoved >= totalFiles) {
          try { fs.rmSync(loaderDir, { recursive: true, force: true }); removed.push(d.id); } catch {}
        }
      }

      return { removed, reinstalledBase };
    });
  }

  /** Delete an installed version's files (its own folder under versions/<id>). */
  uninstall(versionId: string): boolean {
    const dir = path.join(this.gameDir, 'versions', versionId);
    if (!fs.existsSync(dir)) return false;
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  }

  /** Deep uninstall: version folder, orphaned libs & assets, per-version data dirs (saves/resourcepacks/mods inside versions/<id>). */
  uninstallDeep(versionId: string): { removed: string[] } {
    const removed: string[] = [];
    const versionDir = path.join(this.gameDir, 'versions', versionId);
    if (fs.existsSync(versionDir)) {
      fs.rmSync(versionDir, { recursive: true, force: true });
      removed.push(versionDir);
    }
    // Some launchers put saves/resourcepacks inside versions/<id>; wipe leftovers if any still exist
    for (const sub of ['saves', 'resourcepacks', 'mods', 'shaderpacks']) {
      const p = path.join(this.gameDir, 'versions', versionId, sub);
      if (fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
        removed.push(p);
      }
    }
    // Pre-Classic / Classic / Indev / rd-* write the world as a lone level.dat
    // into the APPDATA/.minecraft root (for us → gameDir or gameDir/.minecraft).
    // versions/<id>/saves does not exist for them, so without an explicit cleanup
    // the world stays on disk and "resurrects" on the next launch of an old version.
    // We clean it only if no other pre-classic versions are left,
    // so that a world shared by several rd-* is not affected.
    if (isPreClassicVersionId(versionId) && !this.hasOtherPreClassicInstalled(versionId)) {
      try {
        for (const file of this.worlds.wipeAllLooseLevelDat()) removed.push(file);
      } catch {}
    }
    // Clean up orphaned libraries/assets only if no other versions exist
    const versionsRoot = path.join(this.gameDir, 'versions');
    const hasOther = fs.existsSync(versionsRoot) && fs.readdirSync(versionsRoot).some((e) => {
      const jar = path.join(versionsRoot, e, e + '.jar');
      return fs.existsSync(jar);
    });
    if (!hasOther) {
      for (const sub of ['libraries', 'assets']) {
        const p = path.join(this.gameDir, sub);
        if (fs.existsSync(p)) {
          fs.rmSync(p, { recursive: true, force: true });
          removed.push(p);
        }
      }
    }
    return { removed };
  }

  /**
   * Checks whether installed pre-classic versions besides `excludeId` are left.
   * Used in uninstallDeep to avoid cleaning the shared loose level.dat
   * when the user has several rd-* / c0.* versions installed.
   */
  private hasOtherPreClassicInstalled(excludeId: string): boolean {
    const versionsRoot = path.join(this.gameDir, 'versions');
    if (!fs.existsSync(versionsRoot)) return false;
    try {
      for (const entry of fs.readdirSync(versionsRoot)) {
        if (entry === excludeId) continue;
        if (!isPreClassicVersionId(entry)) continue;
        // Must be really installed (jar or json)
        const dir = path.join(versionsRoot, entry);
        if (fs.existsSync(path.join(dir, entry + '.jar')) ||
            fs.existsSync(path.join(dir, entry + '.json'))) {
          return true;
        }
      }
    } catch {}
    return false;
  }

  gameFolder(): string {
    return this.gameDir;
  }

  versionFolder(versionId: string): string {
    return path.join(this.gameDir, 'versions', versionId);
  }

  /** Resolve content folder (mods/shaderpacks/...) for a given version. */
  contentFolder(versionId: string, sub: typeof CONTENT_FOLDERS[number]): string {
    return path.join(this.versionFolder(versionId), sub);
  }

  /** Ensure content folders exist inside the version directory. */
  ensureContentFolders(versionId: string): void {
    const dir = this.versionFolder(versionId);
    if (!fs.existsSync(dir)) return;
    for (const sub of CONTENT_FOLDERS) {
      try { fs.mkdirSync(path.join(dir, sub), { recursive: true }); } catch {}
    }
  }

  /**
   * Wire up content folders for the given version so the game (which always
   * reads gameDir/<mods|shaderpacks|...>) actually sees this version's content.
   *
   * Previously an NTFS junction was used → gameDir/mods was a symlink. Forge on JDK 21
   * does `Files.createDirectories(gameDir/mods)` on startup and fails on a junction
   * with `FileAlreadyExistsException` — so the strategy is different now:
   *   gameDir/<sub> — a regular folder (Forge sees it just fine)
   *   its content — hard-links to the files from versions/<id>/<sub>
   * A hard-link to a file from the NTFS point of view is the same inode, no
   * duplication of space, and the game sees it as a regular file.
   */
  linkContentFolders(versionId: string): void {
    const versionDir = this.versionFolder(versionId);
    if (!fs.existsSync(versionDir)) return;
    for (const sub of CONTENT_FOLDERS) {
      this.mirrorOneContentFolder(versionDir, sub);
    }
  }

  /**
   * Mirrors the content of versions/<id>/<sub> into gameDir/<sub> via hard-links.
   * If gameDir/<sub> previously held a junction (from an older launcher version) —
   * we carefully remove it (it is a dangling entry, not the folder itself).
   * If gameDir/<sub> already contains real files — migrate them to the version-folder.
   */
  private mirrorOneContentFolder(versionDir: string, sub: string): void {
    const target = path.join(this.gameDir, sub);
    const source = path.join(versionDir, sub);

    // Per-version folder — always present.
    try { fs.mkdirSync(source, { recursive: true }); } catch {}

    // If gameDir/<sub> is currently a junction (legacy mode) — remove it
    // as a linkfile. On NTFS a junction shows up as a symlink.
    let isLink = false;
    try { isLink = fs.lstatSync(target).isSymbolicLink(); } catch {}
    if (isLink) {
      try { fs.unlinkSync(target); }
      catch { try { fs.rmSync(target, { recursive: true, force: true }); } catch {} }
    }

    // Move NON-mirrored entries from gameDir/<sub> to the per-version folder if they
    // are not there yet. To avoid "dragging" mods from the PREVIOUS version
    // (hardlinks remain in target after the game), we skip files with nlink>1:
    // a hardlink has the same inode as in the source of the previous version, and nlink>=2.
    if (fs.existsSync(target) && !isLink) {
      try {
        for (const entry of fs.readdirSync(target)) {
          const from = path.join(target, entry);
          const to = path.join(source, entry);
          if (fs.existsSync(to)) continue;
          let st: fs.Stats;
          try { st = fs.lstatSync(from); } catch { continue; }
          if (st.isFile() && st.nlink > 1) continue;
          if (st.isSymbolicLink()) continue;
          try { fs.renameSync(from, to); }
          catch {
            try { fs.cpSync(from, to, { recursive: true }); fs.rmSync(from, { recursive: true, force: true }); } catch {}
          }
        }
      } catch {}
    }

    // Create gameDir/<sub> as a regular folder.
    try { fs.mkdirSync(target, { recursive: true }); } catch {}

    // Clean target from entries that are no longer in source (other versions,
    // removed mods, etc.). Real files are NOT touched — we only delete
    // hard-links: if a file has more than 1 link, it is safe to delete this one.
    try {
      const sourceEntries = new Set(fs.readdirSync(source));
      for (const entry of fs.readdirSync(target)) {
        if (sourceEntries.has(entry)) continue;
        const tp = path.join(target, entry);
        try {
          const st = fs.lstatSync(tp);
          if (st.isFile() && st.nlink > 1) {
            // This is a hardlink — our mirror artifact. Delete it.
            fs.unlinkSync(tp);
          }
          // If nlink == 1 (the only link) or it is a directory —
          // keep it: the user may have put something there manually.
        } catch {}
      }
    } catch {}

    // Mirror the current files from the version-folder into gameDir/<sub>.
    try {
      for (const entry of fs.readdirSync(source)) {
        const sp = path.join(source, entry);
        const tp = path.join(target, entry);
        let sStat: fs.Stats;
        try { sStat = fs.statSync(sp); } catch { continue; }
        if (!sStat.isFile()) continue; // mods/packs are files (.jar/.zip), nested folders are ignored

        // If target already exists — check that it is the same link.
        if (fs.existsSync(tp)) {
          try {
            const tStat = fs.statSync(tp);
            // The same inode on NTFS = identical ino. If they match,
            // nothing has to be done.
            if (tStat.ino && sStat.ino && tStat.ino === sStat.ino) continue;
            // Otherwise — a user file with the same name. We do not overwrite it,
            // so as not to lose someone else's file.
            continue;
          } catch {}
        }

        try {
          fs.linkSync(sp, tp);
        } catch {
          // If the hard-link failed (e.g. different volumes), we copy.
          // This is an acceptable fallback — just a bit of extra space.
          try { fs.copyFileSync(sp, tp); } catch {}
        }
      }
    } catch {}
  }

  async install(versionId: string, win: BrowserWindow) {
    // Bundled legacy versions are installed instantly — we just copy
    // jar + natives from the resources next to the .exe.
    if (isLegacyVersion(versionId)) {
      installLegacy(this.gameDir, versionId);
      // VersionJson-compatible stub: doLaunch never reaches this for legacy
      // (there is an early return in doLaunch), but the type must match.
      return { id: versionId } as any;
    }
    const result = await this.installer.install(versionId, win);
    this.ensureContentFolders(versionId);
    // Download the required Java right at install time, so that the version is fully
    // ready to launch (previously Java was downloaded only at launch time, which is why
    // the "Java N will be downloaded" label stayed after installation). We do not
    // propagate the Java error: the version is installed, Java will be downloaded at launch.
    const major = result?.javaVersion?.majorVersion;
    if (typeof major === 'number' && major > 0) {
      try {
        await this.java.ensure(major, win);
      } catch (e) {
        console.warn('[install] Java ensure failed, will retry on launch:', (e as Error)?.message ?? e);
      }
    }
    return result;
  }

  /** Decide which Java to use for a version. Returns executable path. */
  async resolveJava(requiredMajor: number, userJavaPath: string | undefined, win: BrowserWindow): Promise<{ path: string; reason: string }> {
    // Validate user override compatibility
    if (userJavaPath && userJavaPath.trim() && fs.existsSync(userJavaPath)) {
      const info = await this.java.inspectExe(userJavaPath);
      if (info && JavaService.isCompatible(info.major, requiredMajor)) {
        return { path: userJavaPath, reason: `user override (Java ${info.major})` };
      }
      // Incompatible — warn via log, fall through to auto-selection
      win.webContents.send(
        'minecraft:log',
        `[launcher] Ignoring user Java override at ${userJavaPath}: Java ${info?.major ?? '?'} is not compatible with required Java ${requiredMajor}. Auto-selecting.\n`
      );
    }
    const best = await this.java.findBest(requiredMajor);
    if (best) return { path: best.path, reason: `auto-selected Java ${best.major} from system` };
    const fresh = await this.java.ensure(requiredMajor, win);
    return { path: fresh.path, reason: `downloaded Java ${requiredMajor}` };
  }

  /** Updates the account list in the local skin-server. Called from ipc after changes in accounts.json. */
  updateSkinAccounts(list: import('../shared/types').MinecraftAccount[]): void {
    this.skinServer.setAccounts(list);
  }

  /**
   * Whether the Minecraft version supports authlib-injector. See shared/skin-support.ts —
   * the predicate is shared by main and renderer, so that UI and backend always
   * agree on the list of versions "without skins".
   */
  private supportsAuthlibInjector(versionId: string, baseMc: string | undefined): boolean {
    return supportsCustomSkin(versionId, baseMc);
  }

  async launch(opts: LaunchOptions, win: BrowserWindow, settings: LauncherSettings): Promise<number> {
    if (this.launchingVersions.has(opts.versionId)) {
      throw new Error('Запуск уже идёт — подождите');
    }
    if (this.runningVersions.has(opts.versionId)) {
      throw new Error('Эта версия уже запущена');
    }
    this.launchingVersions.add(opts.versionId);
    // Mark as running BEFORE spawn to prevent race: if process exits quickly,
    // the delete in exit handler fires before our add below.
    this.runningVersions.add(opts.versionId);
    this.playtime.recordStart(opts.versionId);
    // Auto-backup of worlds before launch (no more than once a day, silently in the background).
    // A backup failure does not block the launch — the game matters more than the safety net.
    if (settings.autoBackup) {
      try {
        const marker = path.join(this.gameDir, '.trel_autobackup');
        let last = 0;
        try { last = Number(fs.readFileSync(marker, 'utf-8')) || 0; } catch { /* first run */ }
        if (Date.now() - last > 24 * 3600 * 1000) {
          const worlds = this.worlds.list();
          for (const w of worlds.slice(0, 50)) {
            try { this.worlds.backup(w.name); } catch (e) {
              win.webContents.send('minecraft:log', `[launcher] Auto-backup failed for ${w.name}: ${(e as Error).message}\n`);
            }
          }
          try { fs.writeFileSync(marker, String(Date.now()), 'utf-8'); } catch { /* ignore */ }
          if (worlds.length > 0) win.webContents.send('minecraft:log', `[launcher] Auto-backup done: ${worlds.length} world(s)\n`);
        }
      } catch { /* backup must never break launch */ }
    }
    try {
      const pid = await this.doLaunch(opts, win, settings);
      win.webContents.send('minecraft:launchStart', opts.versionId);
      return pid;
    } catch (e) {
      this.runningVersions.delete(opts.versionId);
      this.playtime.recordEnd(opts.versionId);
      throw e;
    } finally {
      this.launchingVersions.delete(opts.versionId);
    }
  }

  /**
   * Launch of bundled legacy versions (Cave Game Tech Test and similar):
   * these are applet-like jars without an official version.json and without entries in the
   * Mojang manifest. We start them directly via `java -cp <jar>`.
   */
  private async launchLegacyPath(opts: LaunchOptions, win: BrowserWindow, settings: LauncherSettings): Promise<number> {
    // Cave Game Tech Test and similar — this is a standalone applet without a LaunchWrapper.
    // It runs fine on any Java >= 8. We do not tie ourselves to the major version, so that
    // a user with only Java 21 does not have to install Java 8 as well.
    let javaPath: string;
    const j = await this.resolveJava(8, settings.javaPath, win);
    javaPath = j.path;

    const playerName = opts.account?.name || 'Player';
    const child = launchLegacy({
      gameDir: this.gameDir,
      id: opts.versionId,
      javaPath,
      maxRamMb: settings.memoryMb || 1024,
      width: settings.gameWidth ?? 854,
      height: settings.gameHeight ?? 480,
      fullscreen: settings.fullscreen ?? false,
      playerName,
    });

    child.stdout?.on('data', (d) => {
      if (!win.isDestroyed()) win.webContents.send('minecraft:log', d.toString());
    });
    child.stderr?.on('data', (d) => {
      if (!win.isDestroyed()) win.webContents.send('minecraft:log', d.toString());
    });

    if (settings.closeOnLaunch && !win.isDestroyed()) {
      win.hide();
    }

    child.on('exit', (code) => {
      this.runningVersions.delete(opts.versionId);
      this.playtime.recordEnd(opts.versionId);
      if (!win.isDestroyed()) {
        if (settings.closeOnLaunch) win.show();
        win.webContents.send('minecraft:exit', code ?? -1);
        emitCrashDiagnosis(win, this.gameDir, code);
      }
    });

    return child.pid ?? 0;
  }

  private async doLaunch(opts: LaunchOptions, win: BrowserWindow, settings: LauncherSettings): Promise<number> {
    // ──── Legacy bundled versions (Cave Game Tech Test and similar) ───────────────
    // They have no vanilla version.json and no entries in the Mojang manifest.
    // We launch them via a direct java-spawn, bypassing @xmcl/core.
    if (isLegacyVersion(opts.versionId)) {
      return this.launchLegacyPath(opts, win, settings);
    }
    // ─────────────────────────────────────────────────────────────────────────
    const versionDir = path.join(this.gameDir, 'versions', opts.versionId);
    const clientJar = path.join(versionDir, opts.versionId + '.jar');
    const jsonPath = path.join(versionDir, opts.versionId + '.json');

    // Read the version-JSON once — previously it was parsed twice (for Java and for inheritsFrom).
    let versionJson: any = null;
    let requiredMajor: number;
    if (fs.existsSync(clientJar) && fs.existsSync(jsonPath)) {
      try {
        versionJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      } catch {}
      // Local json + inheritance chain + id heuristic — no network.
      const { requiredJavaMajorForVersion } = await import('./loaders');
      requiredMajor = requiredJavaMajorForVersion(this.gameDir, opts.versionId);
    } else {
      const ver = await this.install(opts.versionId, win);
      requiredMajor = ver.javaVersion?.majorVersion ?? 8;
      try { versionJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')); } catch {}
    }

    // Java resolution and content-folder preparation are not related at all — let them run
    // in parallel. On the hot path (warm Java cache) the gain is ~10-30ms.
    const javaPromise = this.resolveJava(requiredMajor, settings.javaPath, win);

    // In parallel with the Java/authlib resolution we hook up the content-folders.
    const contentPromise = Promise.resolve().then(() => {
      this.ensureContentFolders(opts.versionId);
      this.linkContentFolders(opts.versionId);
    });

    // ─── authlib-injector: online-mode and custom skins ────────────────
    // For online accounts authlib-injector is ALWAYS needed — it intercepts
    // yggdrasil authentication and redirects it to our local auth-server.
    // For offline accounts — only if a custom skin is set.
    let authlibArgs: string[] = [];
    const baseMc: string | undefined = versionJson?.inheritsFrom ?? undefined;
    const isOnline = opts.account.type === 'online' && opts.account.owned !== false;
    // Authlib-injector is needed for online accounts (yggdrauth), for offline with a
    // custom skin, and for guests (offline) so that they can join
    // local servers with online-mode=true through our local auth-server.
    const needsAuthlib = isOnline || !!opts.account.skin || opts.account.type === 'offline';
    const useAuthlib = needsAuthlib && this.supportsAuthlibInjector(opts.versionId, baseMc);
    if (useAuthlib) {
      try {
        const [apiUrl, agentPath] = await Promise.all([
          this.skinServer.start(),
          this.authlib.ensure(),
        ]);
        authlibArgs = [
          `-javaagent:${agentPath}=${apiUrl}`,
        ];
        win.webContents.send('minecraft:log', `[launcher] authlib-injector активен (${apiUrl})\n`);
      } catch (e) {
        win.webContents.send('minecraft:log', `[launcher] authlib-injector недоступен (${(e as Error).message}) — играем без online-режима\n`);
      }
    }

    await contentPromise;
    const { path: javaPath, reason } = await javaPromise;

    const preflightProblems: string[] = [];
    if (!fs.existsSync(javaPath)) preflightProblems.push(`Java не найдена: ${javaPath}`);
    if (!fs.existsSync(jsonPath)) preflightProblems.push(`version.json не найден: ${jsonPath}`);
    if (!fs.existsSync(clientJar)) preflightProblems.push(`client jar не найден: ${clientJar}`);
    const requestedMemory = opts.memoryMb || settings.memoryMb || 1024;
    const totalRamMb = Math.floor(os.totalmem() / 1024 / 1024);
    if (requestedMemory > Math.floor(totalRamMb * 0.85)) {
      preflightProblems.push(`Выделено слишком много памяти: ${requestedMemory} МБ из ${totalRamMb} МБ RAM`);
    }
    try {
      fs.mkdirSync(this.gameDir, { recursive: true });
      fs.accessSync(this.gameDir, fs.constants.W_OK);
    } catch {
      preflightProblems.push(`Нет прав записи в папку игры: ${this.gameDir}`);
    }
    if (preflightProblems.length) {
      throw new Error('Проверка перед запуском не пройдена:\n' + preflightProblems.map((x) => `• ${x}`).join('\n'));
    }
    win.webContents.send('minecraft:log', `[launcher] Preflight OK. Using Java: ${javaPath} (${reason})\n`);

    // Pre-Classic (rd-*, c0.*) and Indev/Infdev/early Alpha ignore gamePath
    // and write the world into %APPDATA%\.minecraft. We substitute env ONLY for them —
    // modern versions use user.home for caches/configs and break when it is substituted.
    const isPreClassic = isPreClassicVersionId(opts.versionId) || isLegacyVersion(opts.versionId);
    const childEnv: NodeJS.ProcessEnv = isPreClassic ? { ...process.env } : process.env;
    if (isPreClassic) {
      childEnv.APPDATA = this.gameDir;
      childEnv.HOME = this.gameDir;
      childEnv.USERPROFILE = this.gameDir;
    }

    const launchOption: LaunchOption = {
      version: opts.versionId,
      gamePath: this.gameDir,
      javaPath,
      nativeRoot: path.join(this.gameDir, 'versions', opts.versionId, 'natives'),
      gameProfile: {
        name: opts.account.name,
        id: opts.account.uuid,
      },
      accessToken: opts.account.accessToken || '0'.repeat(32),
      userType: isOnline ? 'mojang' : 'legacy',
      launcherName: 'Trel',
      launcherBrand: 'Trel',
      minMemory: Math.floor(opts.memoryMb / 2),
      maxMemory: opts.memoryMb,
      // JVM flags: duplicate the path overrides in case Java reads them from properties
      extraJVMArgs: [
        `-Duser.home=${this.gameDir}`,
        `-Duser.dir=${this.gameDir}`,
        // Safe on any JDK (8/11/17/21). Aggressive G1 tuning removed:
        // on Java 8 it killed the JVM with "JNI error / check your installation".
        '-Dlog4j2.formatMsgNoLookups=true',
        '-Dfml.readTimeout=300',
        '-Dfml.queryResult=confirm',
        ...authlibArgs,
        ...(settings.jvmArgs ? settings.jvmArgs.split(/\s+/).filter(Boolean) : []),
      ],
      resolution: {
        width: settings.gameWidth || 854,
        height: settings.gameHeight || 480,
        fullscreen: !!settings.fullscreen,
      },
      // Main thing: substitute the environment variables that legacy versions read
      extraExecOption: {
        env: childEnv,
        cwd: this.gameDir,
      },
    };

    if (settings.preCommand) {
      await new Promise<void>((resolve) => {
        try {
          const { exec } = require('node:child_process');
          const cp = exec(settings.preCommand, { cwd: this.gameDir, timeout: 30_000, windowsHide: true }, () => resolve());
          cp.on('error', () => resolve());
        } catch { resolve(); }
      });
    }

    const proc = await launch(launchOption);

    proc.stdout?.on('data', (d: Buffer) => {
      if (!win.isDestroyed()) win.webContents.send('minecraft:log', d.toString());
    });
    proc.stderr?.on('data', (d: Buffer) => {
      if (!win.isDestroyed()) win.webContents.send('minecraft:log', d.toString());
    });
    if (settings.closeOnLaunch && !win.isDestroyed()) {
      win.hide();
    }

    proc.on('exit', (code) => {
      this.runningVersions.delete(opts.versionId);
      this.playtime.recordEnd(opts.versionId);
      if (!win.isDestroyed()) {
        if (settings.closeOnLaunch) win.show();
        win.webContents.send('minecraft:exit', code ?? -1);
        emitCrashDiagnosis(win, this.gameDir, code);
      }
      if (settings.postCommand) {
        try {
          const { exec } = require('node:child_process');
          const cp = exec(settings.postCommand, { cwd: this.gameDir, timeout: 30_000, windowsHide: true });
          cp.on('error', () => {});
        } catch { /* ignore post-command errors */ }
      }
    });

    return proc.pid ?? -1;
  }
}