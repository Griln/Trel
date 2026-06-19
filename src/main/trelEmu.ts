import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as net from 'node:net';
import { execSync, spawn, ChildProcess } from 'node:child_process';
import { TrelEmuDownloader } from './trelEmuDownloader';
import { extractBootFiles } from './isoReader';

/**
 * TrelEmu — bundled Android-on-x86 эмулятор для Trel.
 *
 * Идея: QEMU TCG (software CPU) + Android-x86 9.0 (qcow2/ISO) поднимаются
 * внутри Trel без Hyper-V / KVM / WHPX / HAXM / admin / внешних установок.
 * Bedrock идёт в software-рендере (mesa/llvmpipe) — 5-15 FPS в singleplayer,
 * но запускается на ЛЮБОМ Win10+.
 *
 * Поток данных:
 *   1) `find()`  — проверить что qemu.exe + qcow2/iso присутствуют
 *   2) `start()` — spawn qemu detached → ждать поднятия ADB-порта →
 *                  применить pre-launch оптимизации → снять snapshot
 *   3) При последующих запусках QEMU грузится из snapshot (30-60 сек вместо 5-15 мин)
 *   4) После — caller использует серийник `127.0.0.1:5555` как обычное ADB-устройство
 *
 * Snapshot-стратегия:
 *   - В overlay.qcow2 после первой загрузки сохраняется снимок 'trelemuready'
 *     (через QEMU monitor `savevm trelemuready` по TCP 127.0.0.1:4444).
 *   - На следующих запусках QEMU получает флаг `-loadvm trelemuready` — мгновенный
 *     возврат в сохранённое состояние (обычно home screen, если Bedrock ещё не
 *     запущен, или последнее место в Minecraft).
 *   - Детекция через `qemu-img snapshot -l <overlay>`.
 *   - Снимок делается через `SNAPSHOT_SETTLE_MS` мс после поднятия ADB — за это
 *     время Android успевает догрузить home screen / последнее приложение.
 *
 * Pre-launch оптимизации (после ADB up, до snapshot):
 *   - отключение анимаций (window/transition/animator scale = 0)
 *   - wm dismiss-keyguard (на некоторых сборках Android-x86 бывает lockscreen)
 *   - авто-запуск Bedrock если com.mojang установлен
 */

export interface TrelEmuInfo {
  qemuExe: string;
  /** Что используем как boot medium: 'qcow2' (pre-installed) или 'iso' (live). */
  bootMode: 'qcow2' | 'iso';
  imagePath: string;        // read-only qcow2 template ИЛИ путь к ISO
  overlayPath: string;      // copy-on-write overlay (для qcow2); для iso — пустая заглушка
  pidfile: string;          // -pidfile для перезапуска
  adbPort: number;
  memoryMb: number;
  cpuCores: number;
  /** Корень trel-emu (где лежат config.json, image/, qemu/, boot/). */
  treluEmuRoot: string;
  /** Путь к scrcpy.exe (если есть в pack) — для показа экрана Android. */
  scrcpyExe: string | null;
  /** scrcpy-server.jar (нужен для stream) — путь. */
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
  /** Применять qcow2 internal snapshot для мгновенной загрузки. */
  boot_snapshot: boolean;
  /** Имя snapshot'а в qcow2 overlay. */
  snapshot_name: string;
  /** Сколько мс ждать после ADB up перед тем как снять snapshot. */
  snapshot_settle_ms: number;
  /** Порт QEMU monitor (TCP) для savevm/quit команд. */
  monitor_port: number;
  /** Автозапуск Bedrock после загрузки Android. */
  prelaunch_bedrock: boolean;
  /** Пропускать keyguard/lockscreen. */
  dismiss_keyguard: boolean;
  /** Автозапуск scrcpy для показа экрана Android. */
  enable_scrcpy: boolean;
  /** scrcpy max-size (длинная сторона в пикселях). */
  scrcpy_max_size: number;
  /** scrcpy bit-rate (Mbps). */
  scrcpy_bit_rate: number;
  /** scrcpy window title. */
  scrcpy_window_title: string;
  /**
   * Порт ИЗОЛИРОВАННОГО adb-server для TrelEmu. По умолчанию 5038 (стандартный
   * 5037 часто занят MuMu / BlueStacks / Nox). TrelEmu поднимает свой сервер
   * на этом порту и весь обмен идёт через него — мы не видим чужие устройства
   * и чужие adb-серверы не видят наш QEMU.
   */
  adb_server_port: number;
  /**
   * Предупреждать (и блокировать запуск), если в системе запущен другой
   * эмулятор (MuMu, BlueStacks, Nox, LDPlayer, Genymotion). Без этой защиты
   * TrelEmu можно случайно перепутать с чужим эмулятором.
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

const STARTUP_TIMEOUT_MS = 1_800_000;   // 30 мин (TCG + android-x86-9.0 ISO под QEMU — медленный boot)
const POLL_INTERVAL_MS  = 1000;           // как часто пробовать adb connect
const CONNECT_TIMEOUT_MS = 5_000;         // timeout одного adb connect / devices
const PIDFILE_LIFETIME_MS = 24 * 60 * 60_000; // если pidfile старше суток — игнор
const QMP_COMMAND_TIMEOUT_MS = 10_000;   // сколько ждать ответа от QEMU monitor
const QMP_CONNECT_TIMEOUT_MS = 3_000;    // сколько ждать открытия TCP-соединения

/**
 * Сигнатуры процессов известных Android-эмуляторов под Windows. Если такой
 * процесс жив — TrelEmu либо откажется стартовать, либо предупредит (по
 * конфигу block_other_emulators). Список покрывает топ-10 эмуляторов
 * (китайские включительно).
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
  /** ADB-серийник, с которым мы уже законнектились (если поднят). */
  private adbSerial: string | null = null;
  /** Порт изолированного adb-сервера, с которым работаем в текущей сессии. */
  private lastAdbPort: number | null = null;
  /** Handle нашего spawn'а (если поднимали сами). Внешний QEMU — handle у ОС. */
  private qemuProc: ChildProcess | null = null;
  /** Пользователь нажал Stop во время async start/scrcpy retry. */
  private stopRequested = false;
  /** Downloader для in-app скачивания TrelEmu pack. */
  readonly downloader = new TrelEmuDownloader();

  /**
   * Ищет TrelEmu в нескольких местах по приоритету:
   *   1) Portable dir (рядом с Trel.exe) — для портативной версии.
   *   2) %APPDATA%/Trel/trel-emu/ — для установленной версии (сюда качает downloader).
   *   3) process.resourcesPath/trel-emu/ — для dev-сборки с бандлом.
   */
  find(): TrelEmuInfo | null {
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
   * Возвращает true если в overlay уже есть snapshot с именем config.snapshot_name.
   * Использует `qemu-img snapshot -l`.
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
      // Вывод: "Snapshot list:\nID TAG VM SIZE DATE VM CLOCK\n1 trelemuready ..."
      // Проще всего grep'нуть по имени — с учётом границ слова.
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
   * Поднимает QEMU (если не запущен) и ждёт, пока ADB-порт `adb_port` ответит
   * на `adb connect`. Возвращает серийник `127.0.0.1:<port>`.
   *
   * Если snapshot включён и overlay уже содержит trelemuready — QEMU
   * загружается в это состояние мгновенно.
   *
   * После успешного подключения ADB: в фоне запускаются pre-launch оптимизации
   * (анимации, keyguard, автозапуск Bedrock) и через snapshot_settle_ms — снимок
   * состояния для следующих запусков.
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

    // 0) Защита от других эмуляторов: если MuMu/BlueStacks/Nox/LDPlayer и т.п.
    //    запущены — отказываемся стартовать TrelEmu (или предупреждаем).
    //    Без этого TrelEmu может случайно перепутать устройства с чужим эмулятором
    //    (особенно если у того тоже 5555). Юзер должен явно закрыть чужой эмулятор.
    if (cfg.block_other_emulators) {
      const others = this.detectOtherEmulators();
      // Исключаем НАШ qemu-system-x86_64 — мы же его сами и спавним.
      const realOthers = others.filter(o => o.name !== 'qemu-system-x86_64');
      if (realOthers.length > 0) {
        const list = realOthers.map(o => `  • ${o.name} (PID ${o.pid}) — ${o.vendor}`).join('\n');
        throw new Error(
          'Обнаружены другие Android-эмуляторы. Закрой их и попробуй снова:\n' + list +
          '\n\nЛибо отключи block_other_emulators в config.json.',
        );
      }
    }

    // 0.5) Изолированный adb-сервер. По умолчанию 5038 (стандартный 5037 часто
    //      занят MuMu/BlueStacks/Nox). После этого все adb-вызовы идут через
    //      наш сервер, и мы изолированы от чужих эмуляторов.
    this.lastAdbPort = cfg.adb_server_port;
    await this.startIsolatedAdbServer(adb, cfg.adb_server_port);

    // 0.7) Проверка занятости критических портов перед запуском QEMU
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

    // 1) Пытаемся законнектиться: вдруг QEMU уже бежит.
    try {
      this.runAdb(adb, ['connect', serial]);
    } catch {}
    if (await this.isDeviceOnline(adb, serial)) {
      this.adbSerial = serial;
      // TrelEmu уже бежит (мы поднимали раньше или юзер извне). Snapshot трогать
      // нельзя — QEMU не наш. Но pre-launch оптимизации безвредны и быстры.
      this.postBootOptimize(adb, serial, cfg).catch(() => {});
      return serial;
    }

    // 2) QEMU не работает. Готовим overlay. Для qcow2 — бэкап на шаблон.
    //    Для iso — пустой qcow2 как data-disk, без бэкапа.
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

    // 3) Для ISO готовим direct kernel boot. Из ISO извлекаются kernel/initrd,
    //    а initrd патчится так, чтобы androidboot.adb.tcp.port реально включал
    //    ADB-over-TCP в headless-режиме. Важно: initrd пересобираем на каждом
    //    старте ISO-режима, даже если boot/initrd.img уже существует. У старых
    //    установок в %APPDATA% мог остаться кэшированный initrd без patched adbd
    //    и без trel_net_setup, из-за чего ADB становился offline.
    if (info.bootMode === 'iso' && cfg.direct_kernel_boot) {
      const bootDir = path.join(info.treluEmuRoot, 'boot');
      try {
        await extractBootFiles(info.imagePath, bootDir);
      } catch (e) {
        console.warn(`[TrelEmu] Не удалось подготовить direct kernel boot: ${(e as Error).message}`);
      }
    }

    // 4) Spawn QEMU. На Windows -daemonize/-pidfile НЕ работают, поэтому
    //    просто отвязываемся через `detached: true, unref()` и пишем PID
    //    в файл руками (для stop()).
    //
    //    ВАЖНО: stderr QEMU пишем в qemu_stderr.log — без этого при падении
    //    QEMU на старте мы не увидим причину (раньше лог был 0 байт, и при
    //    ошибке приходилось 600 сек ждать впустую).
    const stderrLogPath = path.join(info.treluEmuRoot, 'qemu_stderr.log');
    let stderrFd: number | null = null;
    const args = this.qemuArgs(info);

    try {
      // append-режим, чтобы не затирать старый лог при серии запусков.
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
        // ВАЖНО: QEMU теперь показывает экран через -display sdl. windowsHide=true
        // прячет SDL-окно, и пользователь видит статус 'запущен' без экрана.
        // Служебные adb/taskkill/qemu-img остаются hidden, но QEMU должен быть visible.
        windowsHide: false,
        cwd: path.dirname(info.qemuExe),
      });
      this.qemuProc.unref?.();
      // Пишем PID-файл вручную. Если QEMU упал сразу — PID всё равно валидный
      // и пригодится для диагностики.
      try {
        if (this.qemuProc.pid) {
          fs.writeFileSync(info.pidfile, String(this.qemuProc.pid));
        }
      } catch {}
      // Heartbeat: каждые 30 сек пишем в qemu_stderr.log "[heartbeat] alive @ t".
    // Если QEMU завис в GRUB/чёрный ящик — будем видеть, что процесс жив
    // и просто ничего не делает (а не упал в первые 2 сек).
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

    // 4.5) Грейс на 2 сек: если QEMU упал на старте (несовместимый ISO,
    //      залочен порт, не найдена DLL), узнаем об этом сейчас, а не через
    //      600 секунд. Это типичный случай "serial.log 0 байт + ADB висит".
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

    // 5) Ждём поднятия ADB.
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    let lastErr: string | null = null;
    let pollCount = 0;
    let lastSuccessfulCheck = Date.now();
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;
    
    // Максимальное время ожидания после последнего успешного контроля
    const maxIdleTime = 60_000; // 1 мин терпимости к простою
    
    // Сначала проверяем что QEMU действительно работает перед ожиданием ADB
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
    
    // Логируем начальные настройки для диагностики
    console.log(`[TrelEmu] Начало ожидания ADB-соединения (порт ${serial})`);
    console.log(`[TrelEmu] Конфигурация: порт ADB-сервера ${cfg.adb_server_port}, snapshot ${cfg.boot_snapshot}, auto-install Bedrock ${cfg.auto_install_bedrock}`);
    
    while (Date.now() < deadline) {
      const now = Date.now();

      // Проверяем, не простаиваем ли мы слишком долго без активности
      if (now - lastSuccessfulCheck > maxIdleTime) {
        console.log(`[TrelEmu] ADB не ответил ${Math.round((now - lastSuccessfulCheck) / 1000)} сек — возможная проблема с QEMU или ADB-порту`);
      }

      // Проверка живости QEMU каждые 10 секунд. Если QEMU умер в середине
      // ожидания (например, kernel panic внутри VM, OOM-kill хоста) — узнаем
      // сразу, а не через оставшиеся минуты таймаута.
      if (pollCount % 10 === 0 && qemuExited) {
        const tail = this.tailFile(stderrLogPath, 2000);
        throw new Error(
          `QEMU умер во время ожидания ADB (code=${qemuExitCode}, signal=${qemuExitSignal}).\n` +
          `stderr QEMU: ${stderrLogPath}\n` +
          (tail ? `Последние строки stderr:\n${tail}\n` : 'stderr пустой.\n'),
        );
      }
      
      // Пытаемся подключиться к ADB
      try {
        this.runAdb(adb, ['connect', serial]);
        // Если подключились успешно, сбрасываем счетчик провалов
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
        // В фоне: auto-install Bedrock (если APK лежит) + pre-launch оптимизации + snapshot.
        this.tryAutoInstallBedrock(adb, serial).catch(() => {});
        this.postBootOptimizeAndSnapshot(adb, serial, info, cfg).catch(() => {});
        // В фоне: scrcpy для показа экрана Android. Не критично — если упадёт,
        // TrelEmu продолжает работать, просто не будет окошка с экраном.
        this.maybeStartScrcpy(adb, serial, info, cfg).catch(() => {});
        return serial;
      }
      
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      pollCount++;
      // Логируем прогресс каждые 30 секунд
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
   * Pre-launch оптимизации + снятие snapshot для следующих загрузок.
   * Вызывается в фоне после успешного start().
   *
   * Алгоритм:
   *   1) Дождаться `pm list packages com.mojang` если auto_install_bedrock —
   *      snapshot лучше делать когда Bedrock уже установлен.
   *   2) Подождать `snapshot_settle_ms` — за это время Android догружает
   *      home screen и любое приложение, запущенное при старте.
   *   3) Pre-launch: выключить анимации, снять keyguard, запустить Bedrock.
   *   4) Snapshot через QEMU monitor `savevm <name>`.
   */
  private async postBootOptimizeAndSnapshot(
    adb: string,
    serial: string,
    info: TrelEmuInfo,
    cfg: TrelEmuConfig,
  ): Promise<void> {
    try {
      if (cfg.auto_install_bedrock) {
        // Ждём до 90 сек что com.mojang появится (auto-install в tryAutoInstallBedrock).
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

      // Pre-launch оптимизации.
      await this.postBootOptimize(adb, serial, cfg);

      // Snapshot (если включён).
      if (cfg.boot_snapshot) {
        // Не перезаписываем снимок, если он уже есть — иначе рискуем потерять
        // хорошее состояние если Android глюканул.
        if (!this.hasReadySnapshot(info.overlayPath, cfg.snapshot_name)) {
          await this.takeReadySnapshot(cfg.monitor_port, cfg.snapshot_name);
        }
      }
    } catch (e) {
      console.warn('[TrelEmu] postBootOptimizeAndSnapshot:', (e as Error).message);
    }
  }

  /**
   * Pre-launch оптимизации: выключает анимации, снимает keyguard, запускает Bedrock.
   * Делает всё, что ускоряет субъективное время до появления Minecraft.
   */
  private async postBootOptimize(adb: string, serial: string, cfg: TrelEmuConfig): Promise<void> {
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
      // Проверяем что Bedrock установлен, и запускаем MainActivity.
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
   * Подключается к QEMU monitor по TCP и отправляет `savevm <name>`.
   * Использует простой текстовый human monitor (порт monitor_port, default 4444).
   * Snapshot делается на ЛЕТУ (без остановки VM) — QEMU поддерживает savevm
   * на работающей VM.
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
        // Human monitor (QEMU ≥ 2.10) на connect НЕ шлёт приветствие — он молча ждёт команд.
        // Шлём `savevm <name>\n` и закрываем соединение.
        sock.write(`savevm ${name}\n`);
      });
      sock.on('data', (data) => {
        buf += data.toString('utf-8');
        // QEMU human monitor отвечает пустой строкой + prompt "(qemu) ".
        // Просто закроемся через секунду после отправки команды.
      });
      sock.on('close', () => {
        // Если успели подключиться и отправить savevm — считаем успехом.
        done(true);
      });
      sock.connect(monitorPort, '127.0.0.1');
    });
  }

  /**
   * Опционально: устанавливает Minecraft Bedrock APK в Android, если APK лежит
   * рядом в image/bedrock.apk или image/bedrock-install.apk.
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
   * Запускает scrcpy для показа экрана Android в отдельном окне. Делается в
   * фоне — если упадёт, TrelEmu не страшно, просто не будет окошка.
   *
   * scrcpy получает наш ADB serial и стримит картинку. Управление мышью/клавиатурой
   * включено по умолчанию (без --no-control) — пользователь может тыкать в
   * Android прямо в этом окне.
   *
   * Передаём наш ADB через переменную ADB_SERVER_SOCKET не нужно — scrcpy сам
   * найдёт adb в PATH. Мы спавним scrcpy с CWD = <root>/scrcpy/, тогда он
   * подхватит свой adb.exe (идёт в комплекте) и DLL рядом.
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
   * Останавливает QEMU: сначала наш handle, затем подбираем все
   * qemu-system-x86_64.exe (если запускали извне). pidfile используем
   * для точного kill, иначе — широкий taskkill.
   */
  stop(): void {
    this.stopRequested = true;

    const info = this.find();
    const runHidden = (cmd: string, timeout = 7000) => {
      try { execSync(cmd, { timeout, stdio: 'ignore', windowsHide: true }); } catch {}
    };

    // Если QEMU был запущен текущим процессом, сначала пробуем его handle.
    if (this.qemuProc) {
      try { this.qemuProc.kill('SIGKILL'); } catch {}
      const pid = this.qemuProc.pid;
      if (pid) runHidden(`taskkill /F /T /PID ${pid}`);
    }

    // pidfile мог быть старым или отсутствовать, но если он есть, всё равно
    // пробуем убить PID. Не ограничиваемся mtime: stop должен быть идемпотентным
    // и работать после перезапуска приложения.
    if (info) {
      try {
        if (fs.existsSync(info.pidfile)) {
          const pid = parseInt(fs.readFileSync(info.pidfile, 'utf-8').trim(), 10);
          if (pid > 0) runHidden(`taskkill /F /T /PID ${pid}`);
          try { fs.unlinkSync(info.pidfile); } catch {}
        }
      } catch {}
    }

    // Главный fallback: убиваем все процессы TrelEmu runtime по имени. Это
    // покрывает случаи, когда qemu.pid потерян, приложение было перезапущено,
    // либо QEMU стартовал detached и handle уже недоступен.
    runHidden('taskkill /F /T /IM scrcpy.exe');
    runHidden('taskkill /F /T /IM qemu-system-x86_64.exe');

    // Закрываем ADB server на изолированном порту. Если lastAdbPort пустой
    // после перезапуска приложения, используем порт по умолчанию из config.
    const adb = this.findAdb();
    const ports = new Set<number>([this.lastAdbPort ?? DEFAULT_CONFIG.adb_server_port, DEFAULT_CONFIG.adb_server_port]);
    if (adb) {
      for (const port of ports) {
        try {
          execSync(`"${adb}" -P ${port} kill-server`, {
            timeout: 5000,
            stdio: 'ignore',
            windowsHide: true,
          });
        } catch {}
      }
    }
    // Если adb.exe завис на fork-server, kill-server может не ответить.
    runHidden('taskkill /F /T /IM adb.exe');

    this.qemuProc = null;
    this.scrcpyProc = null;
    this.adbSerial = null;
    this.lastAdbPort = null;
    this.resetCache();
  }

  /**
   * Проверяет, что TrelEmu уже запущен (либо нами, либо извне) и виден
   * в adb devices. Используется IPC-хендлером `bedrock:trelEmuStatus`.
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
   * Ключевой аргумент QEMU. Совпадает со спекой + наши улучшения.
   * Если overlay содержит snapshot `cfg.snapshot_name` — добавляет `-loadvm`,
   * QEMU мгновенно восстанавливает состояние (5-15 мин → 30-60 сек).
   */
  private qemuArgs(info: TrelEmuInfo): string[] {
    const cfg = this.loadConfig(info.treluEmuRoot);
    const useSnapshot = cfg.boot_snapshot && this.hasReadySnapshot(info.overlayPath, cfg.snapshot_name);
    const common: string[] = [
      '-name', 'trel-emu',
      '-machine', 'q35',
      '-m', String(info.memoryMb),
      '-smp', String(info.cpuCores),
      // WHPX (Windows Hypervisor Platform) — аппаратное ускорение.
      // Не используем host/Broadwell/Skylake CPU: на части Windows 11 машин
      // WHPX падает с "Unexpected VP exit code 4" из-за CPU-фич, которые
      // гипервизор не умеет корректно отдавать гостю. Проверенная рабочая
      // комбинация для этого бандла: минимальная модель qemu64 + WHPX.
      // kernel-irqchip=off оставляем, потому что это самый совместимый режим
      // WHPX для Android-x86/QEMU на Windows.
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
      // -vga std требуется android-x86 ISO: kernel ищет VGA-карту, без неё
      // может не загрузить framebuffer и упасть в kernel panic.
      // Показываем нативное окно QEMU. Раньше было '-display none' + scrcpy,
      // но scrcpy зависит от ADB и SurfaceFlinger: UI мог писать 'запущен',
      // а окна ещё не было или scrcpy падал. SDL-окно появляется сразу вместе
      // с QEMU и не зависит от ADB.
      '-vga', 'std',
      '-display', 'sdl',
      // Human monitor на TCP — для savevm/quit. server+nowait: ждёт подключения,
      // не блокирует QEMU.
      '-monitor', `tcp:127.0.0.1:${cfg.monitor_port},server,nowait`,
      // Serial log всегда в корне treluEmuRoot. Старый путь через dirname(imagePath)/..
      // ломался когда ISO/qcow2 лежали не в image/ (например в dev-сборке).
      '-serial', `file:${path.join(info.treluEmuRoot, 'serial.log').replace(/\\/g, '/')}`,
      // ВАЖНО: -daemonize НЕ поддерживается в QEMU для Windows (только Linux/Unix).
      // На Windows мы отвязываемся через `detached: true, unref()` в spawn() ниже.
      // -pidfile тоже Linux-only, поэтому пишем PID вручную после spawn.
      '-no-user-config',
      '-rtc', 'base=utc',
    ];
    if (useSnapshot) {
      // Восстанавливаем снимок. QEMU загружается в это состояние за секунды.
      common.push('-loadvm', cfg.snapshot_name);
    }
    if (cfg.enable_audio) {
      // AC97 — звуковой контроллер, эмулируется в QEMU TCG. Android-x86 видит
      // его как обычную звуковую карту и подхватывает alsa/audio HAL.
      //
      // ВАЖНО: на Windows QEMU по умолчанию пытается открыть WASAPI для AC97.
      // Если в системе нет активного аудио-устройства (или endpoint disabled),
      // QEMU уходит в бесконечный retry "WASAPI can't find requested audio endpoint"
      // и через ~10 мин сам себя убивает с exit code=1, не дойдя до GRUB/ADB.
      // Решение: явно говорим QEMU "audio backend не нужен" — карта AC97 всё равно
      // эмулируется (для совместимости с Android audio HAL), но звук не воспроизводится.
      //
      // СИНТАКСИС: -device AC97 БЕЗ audiodev = default audio device = QEMU требует
      // какой-нибудь -audiodev driver=... Но если драйверов вообще нет в системе
      // (нет WASAPI/SDL_audio), QEMU падает "no default audio driver available".
      // Поэтому: ровно ОДНО устройство AC97 с явным audiodev=silent0, без дефолтного.
      //
      // Источник бага:
      //   12.06.2026 15:24 qemu_stderr.log — 11 минут WASAPI retry → exit 1
      //   12.06.2026 15:44 qemu_stderr.log — "-device AC97: no default audio driver"
      //     (после первой попытки фикса с двумя -device AC97; default device
      //      без audiodev требует существующий драйвер, а его нет → exit 1)
      common.push('-audiodev', 'driver=none,id=silent0');
      common.push('-device', 'AC97,audiodev=silent0');
      // USB-микрофон — не нужен для Bedrock (звук идёт через AC97).
      // (Раньше тут был бредовый '-hda microphone,id=microphone0' — это
      // пытался быть ПЕРВЫМ ЖЁСТКИМ ДИСКОМ, что ломало QEMU.)
    }
    if (info.bootMode === 'qcow2') {
      const args = [
        ...common,
        // snapshot=on на базовом qcow2: QEMU не пишет в шаблон, изменения идут в overlay.
        '-drive', `file=${info.imagePath},format=qcow2,if=virtio,cache=writeback,snapshot=on`,
        '-drive', `file=${info.overlayPath},format=qcow2,if=virtio,cache=writeback`,
      ];
      return args;
    }
    // iso mode — DIRECT KERNEL BOOT. GRUB из ISO не передаёт console=ttyS0,
    // поэтому ядро пишет в VGA и serial.log пустой — не видно, что происходит.
    // Используем kernel/initrd из boot/ (копия ISO-файлов) и явно задаём append
    // с console=ttyS0 + DEBUG=1 для диагностики initrd.
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
        // android_x86_64: в ramdisk.img лежит init.android_x86_64.rc,
        // конкретная сборка под x86_64. Передаём правильное имя hardware.
        'androidboot.hardware=android_x86_64',
        'androidboot.selinux=permissive',
        'androidboot.adb.tcp.port=5555',
        // Явно выставляем USB-конфиг, чтобы init.rc обработал и
        // поднял adbd через TCP 5555. Без этого в headless-режиме adbd
        // не стартует вообще.
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
    // fallback на случай отсутствия boot/
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
      // Экран теперь показывает сам QEMU через -display sdl. Scrcpy оставляем
      // выключенным принудительно, потому что он зависит от ADB/SurfaceFlinger
      // и из-за него пользователь видел статус 'запущен' без окна.
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
    // 1) TrelEmu pack: <root>/scrcpy/adb.exe (5.7 МБ, 64-бит).
    //    Идёт в комплекте TrelEmu, не зависит от внешней установки platform-tools.
    try {
      const info = this.find();
      if (info?.treluEmuRoot) {
        const fromPack = path.join(info.treluEmuRoot, 'scrcpy', 'adb.exe');
        if (fs.existsSync(fromPack)) return fromPack;
      }
    } catch {}
    // 2) Bundled platform-tools в Trel.exe (resources/platform-tools/adb.exe).
    try {
      const bundled = path.join(process.resourcesPath, 'platform-tools', 'adb.exe');
      if (fs.existsSync(bundled)) return bundled;
    } catch {}
    // 3) PATH — подхватим любой установленный adb (Android SDK и т.п.).
    const pathEnv = process.env.PATH || '';
    for (const dir of pathEnv.split(path.delimiter)) {
      const c = path.join(dir, 'adb.exe');
      if (fs.existsSync(c)) return c;
    }
    return null;
  }

  /**
   * Сканирует запущенные процессы на наличие известных Android-эмуляторов.
   * Возвращает список найденных (пустой = всё чисто).
   */
  detectOtherEmulators(): { name: string; vendor: string; pid: number }[] {
    try {
      // tasklist /NH /FO CSV выдаёт строки вида "name","pid","session","sessionNum","mem"
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
   * Запускает изолированный adb-сервер TrelEmu на `cfg.adb_server_port`
   * (по умолчанию 5038). После этого ВСЕ adb-команды TrelEmu должны идти
   * через этот порт — иначе мы либо промахнёмся, либо ударим по чужому
   * серверу.
   *
   * Не стартует сервер, если он уже поднят. Не падает, если порт занят —
   * в этом случае просто возвращаемся (вероятно наш же сервер с прошлого
   * запуска).
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
   * Проверяет, открыт ли порт на localhost и, если да, возвращает имя процесса
   * (через `netstat -ano` → PID → `tasklist /FI "PID eq N"`).
   *
   * Используем нормальный netstat-маппинг, а не includes('mu') — иначе ловим
   * любой процесс с подстрокой "mu" в имени (command, communal, и т.д.).
   */
  private async checkPortIsOpen(host: string, port: number): Promise<{ processName: string; pid?: number } | null> {
    // 1) Порт вообще listening на 127.0.0.1?
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

    // 2) netstat -ano → ищем строку с нашим портом в LISTENING. На EN/RU
    //    Windows формат строки:  "  TCP    127.0.0.1:5555    0.0.0.0:0    LISTENING    1234"
    //    Локальный порт может быть IPv4 (127.0.0.1:port) или IPv6 ([::1]:port).
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
      // netstat упал — вернём unknown, но не null (порт-то listening).
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
      // ignore — process мог умереть между netstat и tasklist
    }
    return { processName: 'unknown', pid };
  }

  /**
   * Оборачивает execSync-вызов adb: добавляет `-P <port>` и прокидывает
   * ANDROID_ADB_SERVER_PORT в env, чтобы все дочерние процессы (включая
   * спавн scrcpy) тоже использовали наш сервер.
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

  /** Для тестов и диагностики. */
  resetCache() {
    this.cached = undefined;
    this.adbSerial = null;
  }

  /**
   * Возвращает последние `maxBytes` байт файла как строку. Если файл не
   * существует — пустую строку. Используется для диагностики (последние
   * строки qemu_stderr.log в сообщении об ошибке).
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

// === PATCH: увеличен таймаут, добавлена проверка портов и улучшена диагностика ===
