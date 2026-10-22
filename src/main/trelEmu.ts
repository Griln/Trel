import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as net from 'node:net';
import { execSync, spawn, ChildProcess } from 'node:child_process';

/**
 * The ADB serial ends up in a shell string: `emulator-5554`, IP:port, but never —
 * spaces and metacharacters. A malicious serial (`x; rm -rf ~`) would otherwise
 * give RCE.
 */
function assertSafeSerial(serial: string): void {
  if (!/^[a-zA-Z0-9._:-]{1,64}$/.test(serial)) throw new Error(`Unsafe ADB serial: ${serial}`);
}
import { TrelEmuDownloader } from './trelEmuDownloader';
import { extractBootFiles } from './isoReader';

/**
 * TrelEmu — bundled Android-on-x86 emulator for Trel.
 *
 * Idea: QEMU TCG (software CPU) + Android-x86 9.0 (qcow2/ISO) are brought up
 * inside Trel without Hyper-V / KVM / WHPX / HAXM / admin rights / external
 * installations. Bedrock runs in software rendering (mesa/llvmpipe) — 5-15 FPS
 * in singleplayer, but it runs on ANY Win10+.
 *
 * Data flow:
 *   1) `find()`  — check that qemu.exe + qcow2/iso are present
 *   2) `start()` — spawn qemu detached → wait for the ADB port to come up →
 *                  apply pre-launch optimizations → take a snapshot
 *   3) On later launches QEMU boots from the snapshot (30-60 sec instead of 5-15 min)
 *   4) After that the caller uses the serial `127.0.0.1:5555` as a regular ADB device
 *
 * Snapshot strategy:
 *   - After the first boot a snapshot named 'trelemuready' is saved in overlay.qcow2
 *     (via the QEMU monitor `savevm trelemuready` over TCP 127.0.0.1:4444).
 *   - On the next launches QEMU gets the `-loadvm trelemuready` flag — an instant
 *     return to the saved state (usually the home screen, if Bedrock has not
 *     been started yet, or the last place in Minecraft).
 *   - Detection via `qemu-img snapshot -l <overlay>`.
 *   - The snapshot is taken `SNAPSHOT_SETTLE_MS` ms after ADB comes up — during
 *     that time Android has time to finish loading the home screen / last app.
 *
 * Pre-launch optimizations (after ADB is up, before the snapshot):
 *   - disable animations (window/transition/animator scale = 0)
 *   - wm dismiss-keyguard (some Android-x86 builds show a lockscreen)
 *   - auto-start Bedrock if com.mojang is installed
 */

export interface TrelEmuInfo {
  qemuExe: string;
  /** What we use as boot medium: 'qcow2' (pre-installed) or 'iso' (live). */
  bootMode: 'qcow2' | 'iso';
  imagePath: string;        // read-only qcow2 template OR path to the ISO
  overlayPath: string;      // copy-on-write overlay (for qcow2); for iso — an empty stub
  pidfile: string;          // -pidfile for restarts
  adbPort: number;
  memoryMb: number;
  cpuCores: number;
  /** Root of trel-emu (where config.json, image/, qemu/, boot/ live). */
  treluEmuRoot: string;
  /** Path to scrcpy.exe (if present in the pack) — to show the Android screen. */
  scrcpyExe: string | null;
  /** scrcpy-server.jar (required for streaming) — path. */
  scrcpyServer: string | null;
}

interface TrelEmuConfig {
  memory_mb: number;
  cpu_cores: number;
  adb_port: number;
  enable_audio: boolean;
  auto_install_bedrock: boolean;
  disable_animations: boolean;
  direct_kernel_boot: boolean;
  /** Apply the qcow2 internal snapshot for an instant boot. */
  boot_snapshot: boolean;
  /** Snapshot name in the qcow2 overlay. */
  snapshot_name: string;
  /** How many ms to wait after ADB is up before taking the snapshot. */
  snapshot_settle_ms: number;
  /** QEMU monitor port (TCP) for savevm/quit commands. */
  monitor_port: number;
  /** Auto-start Bedrock after Android has booted. */
  prelaunch_bedrock: boolean;
  /** Skip keyguard/lockscreen. */
  dismiss_keyguard: boolean;
  /** Auto-start scrcpy to show the Android screen. */
  enable_scrcpy: boolean;
  /** scrcpy max-size (longest side in pixels). */
  scrcpy_max_size: number;
  /** scrcpy bit-rate (Mbps). */
  scrcpy_bit_rate: number;
  /** scrcpy window title. */
  scrcpy_window_title: string;
  /**
   * Port of the ISOLATED adb-server for TrelEmu. Defaults to 5038 (the standard
   * 5037 is often taken by MuMu / BlueStacks / Nox). TrelEmu starts its own
   * server on this port and all traffic goes through it — we do not see foreign
   * devices and foreign adb-servers do not see our QEMU.
   */
  adb_server_port: number;
  /**
   * Warn (and block the launch) if another emulator is running on the system
   * (MuMu, BlueStacks, Nox, LDPlayer, Genymotion). Without this guard
   * TrelEmu can be confused with a foreign emulator by accident.
   */
  block_other_emulators: boolean;
}

const DEFAULT_CONFIG: TrelEmuConfig = {
  // Safer defaults for low and mid-range PCs. 4 vCPU/4 GB made the host UI and
  // mouse stutter badly on some machines because WHPX/QEMU could occupy almost
  // all physical cores. Users can still raise these values in config.json.
  memory_mb: 3072,
  cpu_cores: 2,
  adb_port: 5555,
  enable_audio: false,
  auto_install_bedrock: true,
  disable_animations: true,
  direct_kernel_boot: true,
  boot_snapshot: true,
  snapshot_name: 'trelemuready',
  snapshot_settle_ms: 45_000,
  monitor_port: 4444,
  prelaunch_bedrock: true,
  dismiss_keyguard: true,
  enable_scrcpy: false,
  scrcpy_max_size: 1280,
  scrcpy_bit_rate: 4,
  scrcpy_window_title: 'TrelEmu — Android в Trel',
  adb_server_port: 5038,
  block_other_emulators: true,
};

const STARTUP_TIMEOUT_MS = 1_800_000;   // 30 min (TCG + android-x86-9.0 ISO under QEMU — slow boot)
const POLL_INTERVAL_MS  = 1000;           // how often to try adb connect
const CONNECT_TIMEOUT_MS = 5_000;         // timeout of a single adb connect / devices
const PIDFILE_LIFETIME_MS = 24 * 60 * 60_000; // if the pidfile is older than a day — ignore it
const QMP_COMMAND_TIMEOUT_MS = 10_000;   // how long to wait for a reply from the QEMU monitor
const QMP_CONNECT_TIMEOUT_MS = 3_000;    // how long to wait for the TCP connection to open

/**
 * Process signatures of known Android emulators under Windows. If such a
 * process is alive — TrelEmu either refuses to start or warns (depending on
 * the block_other_emulators setting). The list covers the top-10 emulators
 * (including the Chinese ones).
 */
const OTHER_EMULATOR_PROCESSES: { name: string; vendor: string }[] = [
  { name: 'MuMuVMMHeadless',     vendor: 'MuMu Player (NetEase)' },
  { name: 'MuMuVMMSVC',          vendor: 'MuMu Player (NetEase)' },
  { name: 'MuMuNxMain',          vendor: 'MuMu Player (NetEase)' },
  { name: 'MuMuPlayer',          vendor: 'MuMu Player (NetEase)' },
  { name: 'HD-Player',           vendor: 'BlueStacks / now.gg' },
  { name: 'Bluestacks',          vendor: 'BlueStacks' },
  { name: 'BstkSVC',             vendor: 'BlueStacks' },
  { name: 'HD-Service',          vendor: 'BlueStacks' },
  { name: 'Nox',                 vendor: 'NoxPlayer' },
  { name: 'NoxVMHandle',         vendor: 'NoxPlayer' },
  { name: 'LdBoxHeadless',       vendor: 'LDPlayer' },
  { name: 'LdVBoxSVC',           vendor: 'LDPlayer' },
  { name: 'ldconsole',           vendor: 'LDPlayer' },
  { name: 'MEmuHeadless',        vendor: 'MEmu' },
  { name: 'MEmuConsole',         vendor: 'MEmu' },
  { name: 'QemuSystem',          vendor: 'Genymotion / Android Studio AVD' },
  { name: 'qemu-system-x86_64',  vendor: 'Android Studio AVD' },
  { name: 'player',              vendor: 'Android Studio Emulator' },
  { name: 'emulator-arm',        vendor: 'Android Studio Emulator' },
  { name: 'emulator64-arm',      vendor: 'Android Studio Emulator' },
  { name: 'emulator-x86',        vendor: 'Android Studio Emulator' },
  { name: 'emulator64-x86',      vendor: 'Android Studio Emulator' },
  { name: 'Windroye',            vendor: 'Windroye' },
  { name: 'Leidian',             vendor: 'LeiDian (雷电)' },
  { name: 'dnplayer',            vendor: '雷电模拟器' },
  { name: 'dnnv',                vendor: '雷电模拟器' },
  { name: 'Droid4X',             vendor: 'Droid4X' },
  { name: 'Andy',                vendor: 'Andyroid' },
  { name: 'KOPLAYER',            vendor: 'KOPLAYER' },
  { name: 'VirtualBox',          vendor: 'VirtualBox (возможно используется эмулятором)' },
];

export class TrelEmuService {
  private cached: TrelEmuInfo | null | undefined = undefined;
  /** ADB serial we have already connected to (if it is up). */
  private adbSerial: string | null = null;
  /** Port of the isolated adb-server we work with in the current session. */
  private lastAdbPort: number | null = null;
  /** Handle of our own spawn (if we started it). For an external QEMU the handle belongs to the OS. */
  private qemuProc: ChildProcess | null = null;
  /** The user pressed Stop during an async start/scrcpy retry. */
  private stopRequested = false;
  /** Downloader for the in-app TrelEmu pack download. */
  readonly downloader = new TrelEmuDownloader();

  /**
   * Searches for TrelEmu in several places, by priority:
   *   1) Portable dir (next to Trel.exe) — for the portable build.
   *   2) %APPDATA%/Trel/trel-emu/ — for the installed build (the downloader stores it here).
   *   3) process.resourcesPath/trel-emu/ — for dev builds with a bundled copy.
   *
   * The TrelEmu pack is Windows-only (qemu-system-x86_64.exe, scrcpy.exe, adb.exe).
   * On Linux/macOS we always return null — Bedrock is not supported on those OSes.
   *
   * The `ignorePlatformCheck` parameter is used by the tests to call find() on
   * any platform (the tests create virtual structures with .exe names).
   */
  find(ignorePlatformCheck = false): TrelEmuInfo | null {
    if (!ignorePlatformCheck && process.platform !== 'win32') return null;
    if (this.cached !== undefined) return this.cached;
    for (const base of this.downloader.getSearchDirs()) {
      const info = this.findInBase(base);
      if (info) {
        this.cached = info;
        return info;
      }
    }
    this.cached = null;
    return null;
  }

  getAdbSerial(): string | null {
    return this.adbSerial;
  }

  /**
   * Returns true if the overlay already contains a snapshot named config.snapshot_name.
   * Uses `qemu-img snapshot -l`.
   */
  hasReadySnapshot(overlayPath: string, snapshotName = 'trelemuready'): boolean {
    if (!fs.existsSync(overlayPath)) return false;
    const qemuImg = this.findQemuImg();
    if (!qemuImg) return false;
    try {
      const out = execSync(`"${qemuImg}" snapshot -l "${overlayPath}"`, {
        encoding: 'utf-8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });
      // Output: "Snapshot list:\nID TAG VM SIZE DATE VM CLOCK\n1 trelemuready ..."
      // Easiest way is to grep for the name — taking word boundaries into account.
      const re = new RegExp(`(^|\\s)${snapshotName}(\\s|$)`);
      return re.test(out);
    } catch {
      return false;
    }
  }

  private findInBase(base: string): TrelEmuInfo | null {
    const qemuExe = path.join(base, 'qemu', 'qemu-system-x86_64.exe');
    const qcow2Path = path.join(base, 'image', 'android-9.0.qcow2');
    const isoPath = path.join(base, 'image', 'android-x86.iso');
    const overlayPath = path.join(base, 'image', 'android-9.0.overlay.qcow2');
    if (!fs.existsSync(qemuExe)) return null;
    const cfg = this.loadConfig(base);
    let bootMode: 'qcow2' | 'iso';
    let imagePath: string;
    if (fs.existsSync(qcow2Path)) {
      bootMode = 'qcow2';
      imagePath = qcow2Path;
    } else if (fs.existsSync(isoPath)) {
      bootMode = 'iso';
      imagePath = isoPath;
    } else {
      return null;
    }
    const scrcpyExe = path.join(base, 'scrcpy', 'scrcpy.exe');
    const scrcpyServer = path.join(base, 'scrcpy', 'scrcpy-server');
    return {
      qemuExe,
      bootMode,
      imagePath,
      overlayPath,
      pidfile: path.join(base, 'qemu.pid'),
      adbPort: cfg.adb_port,
      memoryMb: cfg.memory_mb,
      cpuCores: cfg.cpu_cores,
      treluEmuRoot: base,
      scrcpyExe: fs.existsSync(scrcpyExe) ? scrcpyExe : null,
      scrcpyServer: fs.existsSync(scrcpyServer) ? scrcpyServer : null,
    };
  }

  /**
   * Brings up QEMU (if it is not running yet) and waits until the ADB port
   * `adb_port` answers `adb connect`. Returns the serial `127.0.0.1:<port>`.
   *
   * If the snapshot is enabled and the overlay already contains trelemuready —
   * QEMU boots into that state instantly.
   *
   * After a successful ADB connection: pre-launch optimizations (animations,
   * keyguard, Bedrock auto-start) run in the background and after
   * snapshot_settle_ms — a snapshot of the state for the next launches.
   */
  async start(): Promise<string> {
    if (this.adbSerial) return this.adbSerial;
    this.stopRequested = false;

    const info = this.find();
    if (!info) {
      throw new Error('TrelEmu не найден — переустанови Trel (бандл с эмулятором не обнаружен).');
    }

    const adb = this.findAdb();
    if (!adb) throw new Error('adb.exe не найден — невозможно подключиться к TrelEmu');

    const cfg = this.loadConfig(info.treluEmuRoot);
    const serial = `127.0.0.1:${info.adbPort}`;

    // 0) Protection from other emulators: if MuMu/BlueStacks/Nox/LDPlayer etc. are
    //    running — we refuse to start TrelEmu (or we warn).
    //    Without this TrelEmu can accidentally mix up devices with a foreign
    //    emulator (especially if that one uses 5555 too). The user must
    //    explicitly close the foreign emulator.
    if (cfg.block_other_emulators) {
      const others = this.detectOtherEmulators();
      // Exclude OUR qemu-system-x86_64 — we spawn it ourselves.
      const realOthers = others.filter(o => o.name !== 'qemu-system-x86_64');
      if (realOthers.length > 0) {
        const list = realOthers.map(o => `  • ${o.name} (PID ${o.pid}) — ${o.vendor}`).join('\n');
        throw new Error(
          'Обнаружены другие Android-эмуляторы. Закрой их и попробуй снова:\n' + list +
          '\n\nЛибо отключи block_other_emulators в config.json.',
        );
      }
    }

    // 0.5) Isolated adb-server. Defaults to 5038 (the standard 5037 is often
    //      taken by MuMu/BlueStacks/Nox). After this all adb-calls go through
    //      our server, and we are isolated from foreign emulators.
    this.lastAdbPort = cfg.adb_server_port;
    await this.startIsolatedAdbServer(adb, cfg.adb_server_port);

    // 0.7) Check that the critical ports are free before launching QEMU
    const portsToCheck = [
      { port: info.adbPort, name: 'ADB' },
      { port: cfg.monitor_port, name: 'QEMU monitor' },
    ];
    for (const { port, name } of portsToCheck) {
      const busy = await this.checkPortIsOpen('127.0.0.1', port);
      if (busy && busy.processName !== 'unknown') {
        console.warn(`[TrelEmu] Порт ${port} (${name}) уже занят процессом ${busy.processName}. Возможны проблемы при запуске.`);
      }
    }

    // 1) Try to connect: maybe QEMU is already running.
    try {
      this.runAdb(adb, ['connect', serial]);
    } catch {}
    if (await this.isDeviceOnline(adb, serial)) {
      this.adbSerial = serial;
      // TrelEmu is already running (we started it earlier or the user did it
      // from outside). We must not touch the snapshot — QEMU is not ours.
      // But the pre-launch optimizations are harmless and fast.
      this.postBootOptimize(adb, serial, cfg).catch(() => {});
      return serial;
    }

    // 2) QEMU is not running. Prepare the overlay. For qcow2 — back it with
    //    the template. For iso — an empty qcow2 as a data disk, no backing file.
    if (!fs.existsSync(info.overlayPath)) {
      const qemuImg = this.findQemuImg();
      if (!qemuImg) throw new Error('qemu-img.exe не найден — overlay не создать');
      const backingArg = info.bootMode === 'qcow2'
        ? `-b "${info.imagePath}" -F qcow2`
        : '';
      try {
        execSync(
          `"${qemuImg}" create -f qcow2 ${backingArg} "${info.overlayPath}" 8G`,
          { timeout: 30_000, stdio: 'ignore', windowsHide: true },
        );
      } catch (e) {
        throw new Error(`Не удалось создать overlay: ${(e as Error).message}`);
      }
    }

    // 3) For the ISO we prepare a direct kernel boot. The kernel/initrd are
    //    extracted from the ISO, and the initrd is patched so that
    //    androidboot.adb.tcp.port really enables ADB-over-TCP in headless mode.
    //    Important: we rebuild the initrd on every start of ISO mode, even if
    //    boot/initrd.img already exists. Old installations in %APPDATA% could
    //    still have a cached initrd without the patched adbd and without
    //    trel_net_setup, which made ADB go offline.
    if (info.bootMode === 'iso' && cfg.direct_kernel_boot) {
      const bootDir = path.join(info.treluEmuRoot, 'boot');
      try {
        await extractBootFiles(info.imagePath, bootDir);
      } catch (e) {
        console.warn(`[TrelEmu] Не удалось подготовить direct kernel boot: ${(e as Error).message}`);
      }
    }

    // 4) Spawn QEMU. On Windows -daemonize/-pidfile do NOT work, so we simply
    //    detach via `detached: true, unref()` and write the PID
    //    into the file by hand (for stop()).
    //
    //    IMPORTANT: we write QEMU stderr to qemu_stderr.log — without that, on a
    //    QEMU crash at startup we would not see the reason (the log used to be
    //    0 bytes, and on an error we had to wait 600 sec for nothing).
    const stderrLogPath = path.join(info.treluEmuRoot, 'qemu_stderr.log');
    let stderrFd: number | null = null;
    const args = this.qemuArgs(info);

    try {
      // append mode, so a series of launches does not wipe the old log.
      stderrFd = fs.openSync(stderrLogPath, 'a');
      try {
        fs.writeSync(
          stderrFd,
          `\n=== TrelEmu start @ ${new Date().toISOString()} ===\n` +
          `cmd: ${info.qemuExe} ${args.join(' ')}\n`,
        );
      } catch {}
    } catch {
      stderrFd = null;
    }

    let qemuExited = false;
    let qemuExitCode: number | null = null;
    let qemuExitSignal: NodeJS.Signals | null = null;

    try {
      this.qemuProc = spawn(info.qemuExe, args, {
        detached: true,
        stdio: ['ignore', 'ignore', stderrFd ?? 'ignore'],
        // IMPORTANT: QEMU now shows the screen through -display sdl. windowsHide=true
        // hides the SDL window, and the user sees the 'running' status without a screen.
        // The helper adb/taskkill/qemu-img stay hidden, but QEMU must be visible.
        windowsHide: false,
        cwd: path.dirname(info.qemuExe),
      });
      this.qemuProc.unref?.();
      // We write the PID file by hand. If QEMU crashed immediately the PID is still
      // valid and will be useful for diagnostics.
      try {
        if (this.qemuProc.pid) {
          fs.writeFileSync(info.pidfile, String(this.qemuProc.pid));
        }
      } catch {}
      // Heartbeat: every 30 sec we write "[heartbeat] alive @ t" to qemu_stderr.log.
    // If QEMU hangs in GRUB / shows a black box — we will see that the process is alive
    // and is simply doing nothing (instead of having crashed in the first 2 sec).
    const heartbeat = setInterval(() => {
      if (qemuExited) return;
      if (stderrFd !== null) {
        try {
          fs.writeSync(
            stderrFd,
            `[heartbeat] qemu alive @ ${new Date().toISOString()} (pid=${this.qemuProc?.pid})\n`,
          );
        } catch {}
      }
    }, 30_000);

    this.qemuProc.on('exit', (code, signal) => {
      qemuExited = true;
      qemuExitCode = code;
      qemuExitSignal = signal;
      try { clearInterval(heartbeat); } catch {}
      console.log(`[TrelEmu] QEMU exited (code=${code}, signal=${signal})`);
      try { fs.unlinkSync(info.pidfile); } catch {}
      if (stderrFd !== null) {
          try {
            fs.writeSync(
              stderrFd,
              `\n=== QEMU exit @ ${new Date().toISOString()} code=${code} signal=${signal} ===\n`,
            );
            fs.closeSync(stderrFd);
          } catch {}
          stderrFd = null;
        }
      });
    } catch (e) {
      if (stderrFd !== null) { try { fs.closeSync(stderrFd); } catch {} }
      throw new Error(`Не удалось запустить QEMU: ${(e as Error).message}`);
    }

    // 4.5) A 2 sec grace period: if QEMU crashed at startup (incompatible ISO,
    //      locked port, missing DLL), we learn about it right now instead of
    //      600 seconds later. This is the typical "serial.log 0 bytes + ADB hangs".
    await new Promise((r) => setTimeout(r, 2000));
    if (qemuExited) {
      const tail = this.tailFile(stderrLogPath, 2000);
      throw new Error(
        `QEMU завершился сразу после запуска (code=${qemuExitCode}, signal=${qemuExitSignal}).\n` +
        `Скорее всего: битый ISO/qcow2, не найдена DLL из qemu\\, или порт ${info.adbPort} занят.\n` +
        `stderr QEMU: ${stderrLogPath}\n` +
        (tail ? `Последние строки stderr:\n${tail}\n` : 'stderr пустой.\n') +
        `Если QEMU стартует из GUI, но в Trel — нет: проверь QEMU_ARGS выше (cwd=${path.dirname(info.qemuExe)}).`,
      );
    }

    // 5) Wait for ADB to come up.
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    let lastErr: string | null = null;
    let pollCount = 0;
    let lastSuccessfulCheck = Date.now();
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;
    
    // Maximum time to wait after the last successful check
    const maxIdleTime = 60_000; // 1 min of tolerance for idling
    
    // First make sure QEMU is really running before waiting for ADB
    console.log(`[TrelEmu] Проверка процесса QEMU перед ожиданием ADB...`);
    try {
      if (this.qemuProc.killed) {
        throw new Error('QEMU завершился сразу после запуска — проверь целостность образа android-9.0.qcow2');
      }
      if (fs.existsSync(info.pidfile)) {
        const pidStr = fs.readFileSync(info.pidfile, 'utf-8').trim();
        const pid = parseInt(pidStr, 10);
        if (pid > 0) {
          try {
            const out = execSync(`tasklist /FI "PID eq ${pid}" /NH`, {
              timeout: 3000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
              windowsHide: true,
            });
            if (!/^\s*\S+/.test(out) || /No tasks/i.test(out)) {
              throw new Error(`QEMU умер (PID ${pid} не найден). Проверь log QEMU.`);
            } else {
              console.log(`[TrelEmu] QEMU работает (PID: ${pid})`);
            }
          } catch (e) {
            lastErr = (e as Error).message;
            console.warn(`[TrelEmu] Не удалось проверить QEMU PID: ${lastErr}`);
          }
        }
      }
    } catch (e) {
      console.warn(`[TrelEmu] Предупреждение: не удалось проверить QEMU перед ожиданием ADB: ${e}`);
    }
    
    // Log the initial settings for diagnostics
    console.log(`[TrelEmu] Начало ожидания ADB-соединения (порт ${serial})`);
    console.log(`[TrelEmu] Конфигурация: порт ADB-сервера ${cfg.adb_server_port}, snapshot ${cfg.boot_snapshot}, auto-install Bedrock ${cfg.auto_install_bedrock}`);
    
    while (Date.now() < deadline) {
      const now = Date.now();

      // Check that we are not idling for too long without activity
      if (now - lastSuccessfulCheck > maxIdleTime) {
        console.log(`[TrelEmu] ADB не ответил ${Math.round((now - lastSuccessfulCheck) / 1000)} сек — возможная проблема с QEMU или ADB-порту`);
      }

      // Liveness check of QEMU every 10 seconds. If QEMU died in the middle of
      // the wait (e.g. a kernel panic inside the VM, a host OOM-kill) — we find
      // out immediately instead of after the remaining minutes of the timeout.
      if (pollCount % 10 === 0 && qemuExited) {
        const tail = this.tailFile(stderrLogPath, 2000);
        throw new Error(
          `QEMU умер во время ожидания ADB (code=${qemuExitCode}, signal=${qemuExitSignal}).\n` +
          `stderr QEMU: ${stderrLogPath}\n` +
          (tail ? `Последние строки stderr:\n${tail}\n` : 'stderr пустой.\n'),
        );
      }
      
      // Try to connect to ADB
      try {
        this.runAdb(adb, ['connect', serial]);
        // If we connected successfully, reset the failure counter
        if (consecutiveFailures > 0) {
          console.log(`[TrelEmu] ADB-соединение восстановлено после ${consecutiveFailures} неудачных попыток`);
        }
        consecutiveFailures = 0;
        lastSuccessfulCheck = Date.now();
      } catch (e) {
        consecutiveFailures++;
        lastErr = (e as Error).message;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.log(`[TrelEmu] ADB не ответил ${consecutiveFailures} попыток подряд (${lastErr})`);
        }
      }
      
      if (await this.isDeviceOnline(adb, serial)) {
        this.adbSerial = serial;
        lastSuccessfulCheck = Date.now();
        console.log(`[TrelEmu] ADB-подключено успешно (серийник: ${serial})`);
        // In the background: auto-install Bedrock (if the APK is present) + pre-launch optimizations + snapshot.
        this.tryAutoInstallBedrock(adb, serial).catch(() => {});
        this.postBootOptimizeAndSnapshot(adb, serial, info, cfg).catch(() => {});
        // In the background: scrcpy to show the Android screen. Not critical — if
        // it fails, TrelEmu keeps working, there will just be no window with the screen.
        this.maybeStartScrcpy(adb, serial, info, cfg).catch(() => {});
        return serial;
      }
      
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      pollCount++;
      // Log the progress every 30 seconds
      if (pollCount % 30 === 0) {
        const elapsed = Math.round((Date.now() - (deadline - STARTUP_TIMEOUT_MS)) / 1000);
        console.log(`[TrelEmu] Ожидание ADB... прошло ${elapsed} сек (последняя ошибка: ${lastErr ?? 'нет данных'})`);
      }
    }
    const stderrTail = this.tailFile(stderrLogPath, 2000);
    throw new Error(
      `TrelEmu: ADB-порт ${serial} не ответил за ${STARTUP_TIMEOUT_MS / 1000} сек.\n` +
      `Возможные причины:\n` +
      `  • VM ещё грузится (TCG software-CPU: 5-15 мин в первый раз)\n` +
      `  • QEMU упал на старте (проверь stderr QEMU: ${stderrLogPath})\n` +
      `  • Порт ${info.adbPort} занят другим процессом\n` +
      `  • ADB-сервер не поднялся на порту ${cfg.adb_server_port}\n` +
      `  • Android-x86 ISO не содержит init с поддержкой ADB-over-TCP\n` +
      `\nПоследняя ошибка ADB: ${lastErr ?? 'нет данных'}\n` +
      `\nДля диагностики:\n` +
      `  • stderr QEMU: ${stderrLogPath}\n` +
      `  • serial QEMU: ${path.join(info.treluEmuRoot, 'serial.log')}\n` +
      `  • Лог Trel: View → Toggle Developer Tools → Console\n` +
      `  • Если QEMU запускается вне Trel — сравни cwd (${path.dirname(info.qemuExe)}) и аргументы` +
      `\nПоследние строки stderr QEMU:\n${stderrTail || '(пусто)'}`
    );
  }

  /**
   * Pre-launch optimizations + taking a snapshot for the next boots.
   * Called in the background after a successful start().
   *
   * Algorithm:
   *   1) Wait for `pm list packages com.mojang` if auto_install_bedrock —
   *      the snapshot is better taken when Bedrock is already installed.
   *   2) Wait for `snapshot_settle_ms` — during that time Android finishes
   *      loading the home screen and any app started at boot.
   *   3) Pre-launch: disable animations, dismiss the keyguard, start Bedrock.
   *   4) Snapshot via the QEMU monitor `savevm <name>`.
   */
  private async postBootOptimizeAndSnapshot(
    adb: string,
    serial: string,
    info: TrelEmuInfo,
    cfg: TrelEmuConfig,
  ): Promise<void> {
    assertSafeSerial(serial);
    try {
      if (cfg.auto_install_bedrock) {
        // Wait up to 90 sec for com.mojang to appear (auto-install in tryAutoInstallBedrock).
        for (let i = 0; i < 90; i++) {
          try {
            const out = execSync(
              `"${adb}" -s ${serial} shell pm list packages com.mojang`,
              { timeout: 5000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
            );
            if (/^package:com\.mojang/m.test(out)) break;
          } catch {}
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      // Settle delay.
      await new Promise((r) => setTimeout(r, cfg.snapshot_settle_ms));

      // Pre-launch optimizations.
      await this.postBootOptimize(adb, serial, cfg);

      // Snapshot (if enabled).
      if (cfg.boot_snapshot) {
        // We do not overwrite an existing snapshot — otherwise we risk losing
        // a good state if Android glitched.
        if (!this.hasReadySnapshot(info.overlayPath, cfg.snapshot_name)) {
          await this.takeReadySnapshot(cfg.monitor_port, cfg.snapshot_name);
        }
      }
    } catch (e) {
      console.warn('[TrelEmu] postBootOptimizeAndSnapshot:', (e as Error).message);
    }
  }

  /**
   * Pre-launch optimizations: disables animations, dismisses the keyguard, starts Bedrock.
   * Does everything that reduces the perceived time until Minecraft appears.
   */
  private async postBootOptimize(adb: string, serial: string, cfg: TrelEmuConfig): Promise<void> {
    assertSafeSerial(serial);
    const runShell = (cmd: string, timeoutMs = 5000) => {
      try {
        this.runAdb(adb, ['-s', serial, 'shell', cmd], {
          timeout: timeoutMs,
          stdio: ['ignore', 'ignore', 'ignore'],
        });
      } catch {}
    };
    if (cfg.disable_animations) {
      runShell('settings put global window_animation_scale 0');
      runShell('settings put global transition_animation_scale 0');
      runShell('settings put global animator_duration_scale 0');
      runShell('setprop debug.sf.nobootanimation 1');
    }
    if (cfg.dismiss_keyguard) {
      runShell('wm dismiss-keyguard');
    }
    if (cfg.prelaunch_bedrock) {
      // Check that Bedrock is installed, and start MainActivity.
      try {
        const out = execSync(
          `"${adb}" -s ${serial} shell pm list packages com.mojang`,
          { timeout: 5000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
        );
        if (/^package:com\.mojang/m.test(out)) {
          runShell('am start -W -n com.mojang.minecraftpe/com.mojang.minecraftpe.MainActivity', 30_000);
        }
      } catch {}
    }
  }

  /**
   * Connects to the QEMU monitor over TCP and sends `savevm <name>`.
   * Uses the simple textual human monitor (port monitor_port, default 4444).
   * The snapshot is taken ON THE FLY (without stopping the VM) — QEMU supports
   * savevm on a running VM.
   */
  private async takeReadySnapshot(monitorPort: number, name: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const sock = new net.Socket();
      let buf = '';
      let resolved = false;
      const done = (ok: boolean) => {
        if (resolved) return;
        resolved = true;
        try { sock.destroy(); } catch {}
        resolve(ok);
      };
      const connectTimer = setTimeout(() => done(false), QMP_CONNECT_TIMEOUT_MS);
      sock.setTimeout(QMP_COMMAND_TIMEOUT_MS);
      sock.on('timeout', () => done(false));
      sock.on('error', () => done(false));
      sock.on('connect', () => {
        clearTimeout(connectTimer);
        // The human monitor (QEMU ≥ 2.10) sends NO greeting on connect — it silently waits for commands.
        // We send `savevm <name>\n` and close the connection.
        sock.write(`savevm ${name}\n`);
      });
      sock.on('data', (data) => {
        buf += data.toString('utf-8');
        // The QEMU human monitor replies with an empty line + prompt "(qemu) ".
        // We simply close ourselves a second after sending the command.
      });
      sock.on('close', () => {
        // If we managed to connect and send savevm — we count it as a success.
        done(true);
      });
      sock.connect(monitorPort, '127.0.0.1');
    });
  }

  /**
   * Optionally: installs the Minecraft Bedrock APK into Android, if the APK
   * lies next to it in image/bedrock.apk or image/bedrock-install.apk.
   */
  private async tryAutoInstallBedrock(adb: string, serial: string): Promise<void> {
    const info = this.find();
    if (!info) return;
    const cfg = this.loadConfig(info.treluEmuRoot);
    if (!cfg.auto_install_bedrock) return;
    const candidates = [
      path.join(path.dirname(info.imagePath), 'bedrock.apk'),
      path.join(path.dirname(info.imagePath), 'bedrock-install.apk'),
      path.join(path.dirname(info.qemuExe), '..', 'image', 'bedrock.apk'),
    ];
    let apkPath: string | null = null;
    for (const p of candidates) {
      if (fs.existsSync(p)) { apkPath = p; break; }
    }
    if (!apkPath) return;
    try {
      const out = this.runAdb(adb, ['-s', serial, 'shell', 'pm list packages com.mojang'], {
        timeout: 5000,
      });
      if (/^package:com\.mojang/m.test(out)) {
        console.log('[TrelEmu] Bedrock уже установлен — пропускаем auto-install');
        return;
      }
      console.log(`[TrelEmu] Устанавливаем Bedrock APK из ${apkPath}...`);
      this.runAdb(adb, ['-s', serial, 'install', '-r', `"${apkPath}"`], {
        timeout: 180_000, stdio: ['ignore', 'ignore', 'ignore'],
      });
      console.log('[TrelEmu] Bedrock установлен');
    } catch (e) {
      console.warn('[TrelEmu] Auto-install Bedrock не удался:', (e as Error).message);
    }
  }

  /**
   * Launches scrcpy to show the Android screen in a separate window. It runs
   * in the background — if it fails, TrelEmu is fine, there will just be no window.
   *
   * scrcpy receives our ADB serial and streams the picture. Mouse/keyboard
   * control is enabled by default (no --no-control) — the user can click into
   * Android right in that window.
   *
   * We do not need to pass our ADB via the ADB_SERVER_SOCKET variable — scrcpy
   * finds adb in PATH by itself. We spawn scrcpy with CWD = <root>/scrcpy/, so
   * it picks up its own bundled adb.exe and the DLLs next to it.
   */
  private scrcpyProc: ChildProcess | null = null;
  private async maybeStartScrcpy(adb: string, serial: string, info: TrelEmuInfo, cfg: TrelEmuConfig): Promise<void> {
    if (!cfg.enable_scrcpy) return;
    if (!info.scrcpyExe) {
      console.log('[TrelEmu] scrcpy.exe не найден в pack — экран Android не покажется');
      return;
    }
    if (this.scrcpyProc) {
      try { this.scrcpyProc.kill(); } catch { /* ignore */ }
      this.scrcpyProc = null;
    }

    const scrcpyDir = path.dirname(info.scrcpyExe);
    const pathEnv = `${scrcpyDir}${path.delimiter}${process.env.PATH || ''}`;
    const adbServerPort = String(this.lastAdbPort ?? cfg.adb_server_port);
    const scrcpyLogPath = path.join(info.treluEmuRoot, 'scrcpy.log');
    const env = {
      ...process.env,
      PATH: pathEnv,
      ADB_SERVER_SOCKET: `tcp:127.0.0.1:${adbServerPort}`,
      ANDROID_ADB_SERVER_PORT: adbServerPort,
      ADB_SERVER_PORT: adbServerPort,
    };
    const args: string[] = [
      '-s', serial,
      '--max-size', String(cfg.scrcpy_max_size),
      '--video-bit-rate', `${cfg.scrcpy_bit_rate}M`,
      '--window-title', cfg.scrcpy_window_title,
      '--window-x', '100',
      '--window-y', '100',
      '--window-width', '960',
      '--window-height', '600',
    ];

    const log = (line: string) => {
      try { fs.appendFileSync(scrcpyLogPath, line + '\n'); } catch {}
    };

    // Android-x86 may report ADB device before SurfaceFlinger/display APIs are
    // fully ready. If scrcpy starts too early, its server crashes with
    // DisplayManager.getDisplayInfo() NullPointerException and the user only
    // sees a console flash. Wait a little and retry early exits.
    for (let attempt = 1; attempt <= 6; attempt++) {
      if (this.stopRequested) return;
      if (attempt === 1) await new Promise((r) => setTimeout(r, 20_000));
      else await new Promise((r) => setTimeout(r, 12_000));

      try {
        this.runAdb(adb, ['connect', serial], { timeout: 5000, stdio: 'ignore' });
      } catch {}

      if (this.stopRequested) return;
      log(`\n=== scrcpy start attempt ${attempt} @ ${new Date().toISOString()} ===`);
      log(`${info.scrcpyExe} ${args.join(' ')}`);
      log(`ADB_SERVER_SOCKET=tcp:127.0.0.1:${adbServerPort}`);
      console.log(`[TrelEmu] Запускаем scrcpy attempt ${attempt}: ${info.scrcpyExe} ${args.join(' ')}`);

      let scrcpyFd: number | null = null;
      try {
        scrcpyFd = fs.openSync(scrcpyLogPath, 'a');
        this.scrcpyProc = spawn(info.scrcpyExe, args, {
          detached: true,
          stdio: ['ignore', scrcpyFd, scrcpyFd],
          windowsHide: true,
          cwd: scrcpyDir,
          env,
        });
      } catch (e) {
        if (scrcpyFd !== null) { try { fs.closeSync(scrcpyFd); } catch {} }
        log(`scrcpy spawn failed: ${(e as Error).message}`);
        continue;
      }

      const proc = this.scrcpyProc;
      const survived = await new Promise<boolean>((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve(true);
          }
        }, 8_000);
        proc.once('exit', (code) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            log(`=== scrcpy early exit @ ${new Date().toISOString()} code=${code} ===`);
            if (scrcpyFd !== null) { try { fs.closeSync(scrcpyFd); } catch {} }
            this.scrcpyProc = null;
            resolve(false);
          }
        });
      });

      if (survived) {
        proc.on('exit', (code) => {
          console.log(`[TrelEmu] scrcpy завершился (code=${code})`);
          log(`=== scrcpy exit @ ${new Date().toISOString()} code=${code} ===`);
          if (scrcpyFd !== null) { try { fs.closeSync(scrcpyFd); } catch {} }
          if (this.scrcpyProc === proc) this.scrcpyProc = null;
        });
        proc.unref?.();
        log(`=== scrcpy alive after startup check @ ${new Date().toISOString()} ===`);
        return;
      }
    }

    console.warn('[TrelEmu] scrcpy не удержался после нескольких попыток, см. scrcpy.log');
  }

  /**
   * Stops QEMU: first our handle, then we pick up all
   * qemu-system-x86_64.exe processes (in case it was started from outside).
   * We use the pidfile for an exact kill, otherwise — a broad taskkill.
   */
  stop(): void {
    this.stopRequested = true;

    const info = this.find();
    const runHidden = (cmd: string, timeout = 7000) => {
      try { execSync(cmd, { timeout, stdio: 'ignore', windowsHide: true }); } catch {}
    };

    // If QEMU was started by the current process, first try its handle.
    if (this.qemuProc) {
      try { this.qemuProc.kill('SIGKILL'); } catch {}
      const pid = this.qemuProc.pid;
      if (pid) runHidden(`taskkill /F /T /PID ${pid}`);
    }

    // The pidfile could be stale or missing, but if it exists we still
    // try to kill the PID. We do not restrict ourselves to mtime: stop must be
    // idempotent and work after an app restart.
    if (info) {
      try {
        if (fs.existsSync(info.pidfile)) {
          const pid = parseInt(fs.readFileSync(info.pidfile, 'utf-8').trim(), 10);
          if (pid > 0) runHidden(`taskkill /F /T /PID ${pid}`);
          try { fs.unlinkSync(info.pidfile); } catch {}
        }
      } catch {}
    }

    // The main fallback: kill all TrelEmu runtime processes by name. This
    // covers cases where qemu.pid got lost, the app was restarted,
    // or QEMU started detached and the handle is no longer available.
    runHidden('taskkill /F /T /IM scrcpy.exe');
    runHidden('taskkill /F /T /IM qemu-system-x86_64.exe');

    // Shut down the ADB server on the isolated port. If lastAdbPort is empty
    // after an app restart, we use the default port from the config.
    const adb = this.findAdb();
    const ports = new Set<number>([this.lastAdbPort ?? DEFAULT_CONFIG.adb_server_port, DEFAULT_CONFIG.adb_server_port]);
    if (adb) {
      for (const port of ports) {
        if (!Number.isInteger(port) || port < 1 || port > 65535) continue;
        try {
          execSync(`"${adb}" -P ${port} kill-server`, {
            timeout: 5000,
            stdio: 'ignore',
            windowsHide: true,
          });
        } catch {}
      }
    }
    // If adb.exe is hung on fork-server, kill-server may not answer.
    runHidden('taskkill /F /T /IM adb.exe');

    this.qemuProc = null;
    this.scrcpyProc = null;
    this.adbSerial = null;
    this.lastAdbPort = null;
    this.resetCache();
  }

  /**
   * Checks that TrelEmu is already running (either started by us or from
   * outside) and is visible in adb devices. Used by the IPC handler
   * `bedrock:trelEmuStatus`.
   */
  async isRunning(): Promise<boolean> {
    const info = this.find();
    if (!info) return false;
    const adb = this.findAdb();
    if (!adb) return false;
    const cfg = this.loadConfig(info.treluEmuRoot);
    this.lastAdbPort = cfg.adb_server_port;
    await this.startIsolatedAdbServer(adb, cfg.adb_server_port);
    const serial = `127.0.0.1:${info.adbPort}`;
    try {
      this.runAdb(adb, ['connect', serial]);
    } catch {}
    return this.isDeviceOnline(adb, serial);
  }

  /**
   * The key QEMU argument set. Matches the spec plus our improvements.
   * If the overlay contains the snapshot `cfg.snapshot_name` — it adds `-loadvm`,
   * QEMU restores the state instantly (5-15 min → 30-60 sec).
   */
  private qemuArgs(info: TrelEmuInfo): string[] {
    const cfg = this.loadConfig(info.treluEmuRoot);
    const useSnapshot = cfg.boot_snapshot && this.hasReadySnapshot(info.overlayPath, cfg.snapshot_name);
    const common: string[] = [
      '-name', 'trel-emu',
      '-machine', 'q35',
      '-m', String(info.memoryMb),
      '-smp', String(info.cpuCores),
      // WHPX (Windows Hypervisor Platform) — hardware acceleration.
      // We do not use host/Broadwell/Skylake CPU: on some Windows 11 machines
      // WHPX fails with "Unexpected VP exit code 4" because of CPU features
      // the hypervisor cannot hand over to the guest correctly. The proven
      // working combination for this bundle: the minimal qemu64 model + WHPX.
      // We keep kernel-irqchip=off, because that is the most compatible mode
      // for WHPX with Android-x86/QEMU on Windows.
      '-cpu', 'qemu64',
      '-accel', 'whpx,kernel-irqchip=off',
      // Host ADB stays on cfg adb_port (5555). The initrd replaces Android-x86
      // adbd with a patched binary, so host 5555 forwards directly to guest 5555.
      '-netdev', `user,id=net0,hostfwd=tcp::${info.adbPort}-:${info.adbPort}`,
      '-device', 'virtio-net,netdev=net0',
      // Absolute pointer fixes the terrible SDL mouse grab behavior. Use virtio
      // tablet instead of USB tablet: it avoids extra USB controllers, reduces
      // input overhead, and keeps the host cursor able to leave the VM window.
      '-device', 'virtio-tablet-pci',
      // -vga std is required by the android-x86 ISO: the kernel looks for a VGA card,
      // without it there may be no framebuffer and it can end up in a kernel panic.
      // We show the native QEMU window. It used to be '-display none' + scrcpy,
      // but scrcpy depends on ADB and SurfaceFlinger: the UI could report 'running'
      // while no window existed yet, or scrcpy could crash. The SDL window appears
      // together with QEMU and does not depend on ADB.
      '-vga', 'std',
      '-display', 'sdl',
      // Human monitor over TCP — for savevm/quit. server+nowait: waits for a connection,
      // does not block QEMU.
      '-monitor', `tcp:127.0.0.1:${cfg.monitor_port},server,nowait`,
      // The serial log always lives in the treluEmuRoot. The old path via
      // dirname(imagePath)/.. broke when the ISO/qcow2 were not in image/ (e.g. in a dev build).
      '-serial', `file:${path.join(info.treluEmuRoot, 'serial.log').replace(/\\/g, '/')}`,
      // IMPORTANT: -daemonize is NOT supported by QEMU for Windows (Linux/Unix only).
      // On Windows we detach via `detached: true, unref()` in spawn() below.
      // -pidfile is Linux-only too, so we write the PID by hand after spawn.
      '-no-user-config',
      '-rtc', 'base=utc',
    ];
    if (useSnapshot) {
      // We restore the snapshot. QEMU boots into that state within seconds.
      common.push('-loadvm', cfg.snapshot_name);
    }
    if (cfg.enable_audio) {
      // AC97 — the sound controller, emulated in QEMU TCG. Android-x86 sees
      // it as a regular sound card and picks up alsa/audio HAL.
      //
      // IMPORTANT: on Windows QEMU by default tries to open WASAPI for AC97.
      // If the system has no active audio device (or the endpoint is disabled),
      // QEMU goes into an endless retry "WASAPI can't find requested audio endpoint"
      // and after ~10 min kills itself with exit code=1, never reaching GRUB/ADB.
      // Solution: we explicitly tell QEMU "no audio backend needed" — the AC97 card
      // is still emulated (for compatibility with the Android audio HAL), but no
      // sound is played.
      //
      // SYNTAX: -device AC97 WITHOUT audiodev = default audio device = QEMU requires
      // some -audiodev driver=... But if the system has no drivers at all
      // (no WASAPI/SDL_audio), QEMU fails with "no default audio driver available".
      // Therefore: exactly ONE AC97 device with an explicit audiodev=silent0, no default one.
      //
      // Source of the bug:
      //   12.06.2026 15:24 qemu_stderr.log — 11 minutes of WASAPI retry → exit 1
      //   12.06.2026 15:44 qemu_stderr.log — "-device AC97: no default audio driver"
      //     (after the first fix attempt with two -device AC97; a default device
      //      without audiodev requires an existing driver, and there is none → exit 1)
      common.push('-audiodev', 'driver=none,id=silent0');
      common.push('-device', 'AC97,audiodev=silent0');
      // USB microphone — not needed for Bedrock (the sound goes through AC97).
      // (There used to be a bogus '-hda microphone,id=microphone0' here — it
      // was supposed to be the FIRST HARD DISK, which broke QEMU.)
    }
    if (info.bootMode === 'qcow2') {
      const args = [
        ...common,
        // snapshot=on on the base qcow2: QEMU does not write to the template, the changes go to the overlay.
        '-drive', `file=${info.imagePath},format=qcow2,if=virtio,cache=writeback,snapshot=on`,
        '-drive', `file=${info.overlayPath},format=qcow2,if=virtio,cache=writeback`,
      ];
      return args;
    }
    // iso mode — DIRECT KERNEL BOOT. GRUB from the ISO does not pass console=ttyS0,
    // so the kernel writes to VGA and serial.log stays empty — you cannot see
    // what is going on. We use the kernel/initrd from boot/ (a copy of the ISO
    // files) and explicitly set the append line with console=ttyS0 + DEBUG=1
    // for initrd diagnostics.
    const bootDir = path.join(info.treluEmuRoot, 'boot');
    const kernelPath = path.join(bootDir, 'kernel');
    const initrdPath = path.join(bootDir, 'initrd.img');
    const hasDirectBoot = fs.existsSync(kernelPath) && fs.existsSync(initrdPath);
    const args = [...common];
    if (hasDirectBoot) {
      const append = [
        'SRC=',
        'DATA=/dev/vda',
        'console=ttyS0,115200',
        'loglevel=7',
        'initcall_debug',
        'earlyprintk=ttyS0',
        // android_x86_64: init.android_x86_64.rc lives in ramdisk.img — it is the
        // specific build for x86_64. We pass the correct hardware name.
        'androidboot.hardware=android_x86_64',
        'androidboot.selinux=permissive',
        'androidboot.adb.tcp.port=5555',
        // We set the USB config explicitly, so that init.rc processes it and
        // brings up adbd over TCP 5555. Without this adbd does not start
        // at all in headless mode.
        'androidboot.usb.config=mtp,adb',
        'acpi_sleep=s3_bmem,s3_nvs',
      ].join(' ');
      args.push('-kernel', kernelPath);
      args.push('-initrd', initrdPath);
      args.push('-append', append);
      args.push('-cdrom', info.imagePath);
      args.push('-drive', `file=${info.overlayPath},format=qcow2,if=virtio,cache=writeback`);
      return args;
    }
    // fallback in case boot/ is missing
    args.push('-cdrom', info.imagePath);
    args.push('-boot', 'd');
    args.push('-drive', `file=${info.overlayPath},format=qcow2,if=virtio,cache=writeback`);
    return args;
  }

  private loadConfig(base: string): TrelEmuConfig {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(base, 'config.json'), 'utf-8'));
      const cfg = { ...DEFAULT_CONFIG, ...raw };
      // Migrate the old heavy bundled defaults. Existing installations in
      // %APPDATA% may still have 4096 MB / 4 vCPU / silent AC97 enabled, which
      // makes low and mid-range PCs stutter badly. Treat exactly that old combo
      // as an outdated default, not as an intentional user tuning.
      if (raw.memory_mb === 4096 && raw.cpu_cores === 4 && raw.enable_audio === true) {
        cfg.memory_mb = DEFAULT_CONFIG.memory_mb;
        cfg.cpu_cores = DEFAULT_CONFIG.cpu_cores;
        cfg.enable_audio = DEFAULT_CONFIG.enable_audio;
      }
      // The screen is now shown by QEMU itself through -display sdl. We keep scrcpy
      // forced off, because it depends on ADB/SurfaceFlinger and due to it the
      // user saw the 'running' status without any window.
      cfg.enable_scrcpy = false;
      return cfg;
    } catch {
      const cfg = { ...DEFAULT_CONFIG };
      cfg.enable_scrcpy = false;
      return cfg;
    }
  }

  private isDeviceOnline(adb: string, serial: string): boolean {
    try {
      const out = this.runAdb(adb, ['devices']);
      for (const line of out.split('\n').slice(1)) {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === serial && parts[1] === 'device') return true;
      }
    } catch {}
    return false;
  }

  private findQemuImg(): string | null {
    const candidates: string[] = [];
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'trel-emu', 'qemu', 'qemu-img.exe'));
    }
    const info = this.find();
    if (info) candidates.push(path.join(path.dirname(info.qemuExe), 'qemu-img.exe'));
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  private findAdb(): string | null {
    // 1) TrelEmu pack: <root>/scrcpy/adb.exe (5.7 MB, 64-bit).
    //    It ships with TrelEmu and does not depend on an external platform-tools install.
    try {
      const info = this.find();
      if (info?.treluEmuRoot) {
        const fromPack = path.join(info.treluEmuRoot, 'scrcpy', 'adb.exe');
        if (fs.existsSync(fromPack)) return fromPack;
      }
    } catch {}
    // 2) Bundled platform-tools in Trel.exe (resources/platform-tools/adb.exe).
    try {
      const bundled = path.join(process.resourcesPath, 'platform-tools', 'adb.exe');
      if (fs.existsSync(bundled)) return bundled;
    } catch {}
    // 3) PATH — we pick up any installed adb (Android SDK etc.).
    const pathEnv = process.env.PATH || '';
    for (const dir of pathEnv.split(path.delimiter)) {
      const c = path.join(dir, 'adb.exe');
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  /**
   * Scans the running processes for known Android emulators.
   * Returns the ones found (empty = all clean).
   */
  detectOtherEmulators(): { name: string; vendor: string; pid: number }[] {
    try {
      // tasklist /NH /FO CSV outputs lines like "name","pid","session","sessionNum","mem"
      const out = execSync('tasklist /NH /FO CSV', {
        timeout: 5_000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });
      const found: { name: string; vendor: string; pid: number }[] = [];
      const seen = new Set<string>();
      for (const rawLine of out.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        // CSV: "Image Name","PID","Session Name","Session#","Mem Usage"
        const m = line.match(/^"([^"]+)","(\d+)"/);
        if (!m) continue;
        const procName = m[1];
        const pid = parseInt(m[2], 10);
        if (seen.has(procName)) continue;
        for (const sig of OTHER_EMULATOR_PROCESSES) {
          if (procName.toLowerCase() === sig.name.toLowerCase()) {
            found.push({ name: procName, vendor: sig.vendor, pid });
            seen.add(procName);
            break;
          }
        }
      }
      return found;
    } catch {
      return [];
    }
  }

  /**
   * Starts the isolated TrelEmu adb-server on `cfg.adb_server_port`
   * (5038 by default). After that ALL TrelEmu adb-commands must go
   * through this port — otherwise we either miss or hit a foreign
   * server.
   *
   * Does not start the server if it is already up. Does not fail if the port
   * is taken — in that case we just return (most likely it is our own server
   * from the previous launch).
   */
  private async startIsolatedAdbServer(adb: string, port: number): Promise<void> {
    // ADB-server can keep stale/offline transports forever after a failed boot.
    // If we reuse it, `adb devices` may stay offline or adb commands may hang
    // even though QEMU and Android are already healthy. Always start TrelEmu
    // from a clean isolated adb-server on cfg.adb_server_port.
    try {
      execSync(`"${adb}" -P ${port} kill-server`, {
        timeout: 5_000,
        encoding: 'utf-8',
        stdio: ['ignore', 'ignore', 'ignore'],
        windowsHide: true,
      });
    } catch {}

    if (process.platform === 'win32') {
      try {
        // Kill only adb.exe. This is intentional: Trel uses an isolated port
        // and Android emulator state is recoverable by reconnecting. Keeping a
        // poisoned adb-server is worse than restarting it.
        execSync('taskkill /F /IM adb.exe', {
          timeout: 5_000,
          encoding: 'utf-8',
          stdio: ['ignore', 'ignore', 'ignore'],
          windowsHide: true,
        });
      } catch {}
    }

    await new Promise((r) => setTimeout(r, 500));

    try {
      execSync(`"${adb}" -P ${port} start-server`, {
        timeout: 10_000,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      console.log(`[TrelEmu] Fresh ADB-сервер запущен на порту ${port}`);
    } catch (e) {
      const msg = (e as Error).message;
      // One retry after killing adb.exe. This handles slow Windows process exit.
      try {
        await new Promise((r) => setTimeout(r, 1000));
        execSync(`"${adb}" -P ${port} start-server`, {
          timeout: 10_000,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        });
        console.log(`[TrelEmu] Fresh ADB-сервер запущен на порту ${port} после retry`);
      } catch {
        console.warn(`[TrelEmu] Не удалось запустить ADB-сервер на ${port}: ${msg}`);
      }
    }
  }
  
  /**
   * Checks whether a port is open on localhost and, if so, returns the name of
   * the process (via `netstat -ano` → PID → `tasklist /FI "PID eq N"`).
   *
   * We use a proper netstat mapping instead of includes('mu') — otherwise we
   * catch any process with the substring "mu" in its name (command, communal, etc.).
   */
  private async checkPortIsOpen(host: string, port: number): Promise<{ processName: string; pid?: number } | null> {
    // 1) Is the port listening on 127.0.0.1 at all?
    const listening = await new Promise<boolean>((resolve) => {
      const sock = new net.Socket();
      const t = setTimeout(() => { sock.destroy(); resolve(false); }, 1000);
      sock.setTimeout(1000);
      sock.once('connect', () => { clearTimeout(t); sock.destroy(); resolve(true); });
      sock.once('error', () => { clearTimeout(t); sock.destroy(); resolve(false); });
      sock.once('timeout', () => { clearTimeout(t); sock.destroy(); resolve(false); });
      sock.connect(port, host);
    });
    if (!listening) return null;

    // 2) netstat -ano → we look for the line with our port in LISTENING. On EN/RU
    //    Windows the line format is:  "  TCP    127.0.0.1:5555    0.0.0.0:0    LISTENING    1234"
    //    The local port can be IPv4 (127.0.0.1:port) or IPv6 ([::1]:port).
    let pid: number | null = null;
    try {
      const out = execSync('netstat -ano -p TCP', {
        encoding: 'utf-8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });
      const portRe = new RegExp(
        String.raw`(?:127\.0\.0\.1|\[::1\]):${port}\s+\S+\s+LISTENING\s+(\d+)`,
        'i',
      );
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(portRe);
        if (m) { pid = parseInt(m[1], 10); break; }
      }
    } catch {
      // netstat failed — we return unknown, but not null (the port is listening).
      return { processName: 'unknown' };
    }
    if (pid === null) return { processName: 'unknown' };

    // 3) tasklist /FI "PID eq N" /FO CSV → "Image Name","PID",...
    try {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
        encoding: 'utf-8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });
      const m = out.match(/^"([^"]+)","(\d+)"/);
      if (m) return { processName: m[1], pid };
    } catch {
      // ignore — the process could have died between netstat and tasklist
    }
    return { processName: 'unknown', pid };
  }

  /**
   * Wraps the adb execSync call: adds `-P <port>` and passes
   * ANDROID_ADB_SERVER_PORT in the env, so that all child processes
   * (including the scrcpy spawn) use our server too.
   */
  private runAdb(
    adb: string,
    args: string[],
    options: { timeout?: number; encoding?: 'utf-8' | 'buffer'; stdio?: 'ignore' | 'pipe' | ('ignore' | 'pipe')[] } = {},
  ): string {
    const port = (this.lastAdbPort ?? DEFAULT_CONFIG.adb_server_port);
    const cmd = `"${adb}" -P ${port} ${args.join(' ')}`;
    const env = { ...process.env, ANDROID_ADB_SERVER_PORT: String(port) };
    return execSync(cmd, {
      timeout: options.timeout ?? CONNECT_TIMEOUT_MS,
      encoding: options.encoding ?? 'utf-8',
      stdio: options.stdio ?? 'pipe',
      env,
      windowsHide: true,
    }) as unknown as string;
  }

  /** For tests and diagnostics. */
  resetCache() {
    this.cached = undefined;
    this.adbSerial = null;
  }

  /**
   * Returns the last `maxBytes` bytes of a file as a string. If the file does
   * not exist — an empty string. Used for diagnostics (the last lines of
   * qemu_stderr.log in the error message).
   */
  private tailFile(filePath: string, maxBytes: number): string {
    try {
      const stat = fs.statSync(filePath);
      const fd = fs.openSync(filePath, 'r');
      try {
        const start = Math.max(0, stat.size - maxBytes);
        const len = stat.size - start;
        const buf = Buffer.alloc(len);
        fs.readSync(fd, buf, 0, len, start);
        return buf.toString('utf-8').trim();
      } finally {
        try { fs.closeSync(fd); } catch {}
      }
    } catch {
      return '';
    }
  }
}

// === PATCH: increased timeout, added a port check and improved diagnostics ===
