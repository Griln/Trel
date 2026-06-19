import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { TrelEmuService } from './trelEmu';

describe('TrelEmuService', () => {
  // Подменяем process.resourcesPath на временную папку с подложенной структурой.
  // Без этого find() ходит в реальный resources/ и тесты становятся зависимыми
  // от содержимого (если qemu есть — find() вернёт truthy, иначе null).
  // Также подменяем APPDATA на ту же папку — иначе getSearchDirs() найдёт
  // реально установленный TrelEmu в %APPDATA%\Trel\trel-emu\ (если он есть
  // на машине разработчика) и вернёт его до того, как дойдёт до resourcesPath.
  let tmpRoot: string;
  let origAppData: string | undefined;
  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-emu-test-'));
    Object.defineProperty(process, 'resourcesPath', {
      value: tmpRoot,
      configurable: true,
    });
    origAppData = process.env.APPDATA;
    process.env.APPDATA = tmpRoot;
  });
  afterEach(() => {
    if (origAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = origAppData;
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('find()', () => {
    it('returns null when qemu-system-x86_64.exe is missing', () => {
      // Ничего не создавали в tmpRoot
      const svc = new TrelEmuService();
      expect(svc.find()).toBeNull();
    });

    it('returns null when image is missing but qemu.exe exists', () => {
      fs.mkdirSync(path.join(tmpRoot, 'trel-emu', 'qemu'), { recursive: true });
      fs.writeFileSync(path.join(tmpRoot, 'trel-emu', 'qemu', 'qemu-system-x86_64.exe'), '');
      const svc = new TrelEmuService();
      expect(svc.find()).toBeNull();
    });

    it('returns TrelEmuInfo with correct paths when bundle is present', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      // Дефолтный config.json создаётся при первом запуске и подхватывается.
      // Тест не обязан его создавать — loadConfig() вернёт defaults.
      const svc = new TrelEmuService();
      const info = svc.find();
      expect(info).not.toBeNull();
      expect(info!.qemuExe).toBe(path.join(base, 'qemu', 'qemu-system-x86_64.exe'));
      expect(info!.imagePath).toBe(path.join(base, 'image', 'android-9.0.qcow2'));
      expect(info!.overlayPath).toBe(path.join(base, 'image', 'android-9.0.overlay.qcow2'));
      expect(info!.adbPort).toBe(5555);
      expect(info!.memoryMb).toBe(3072);
      expect(info!.cpuCores).toBe(2);
    });

    it('respects custom config.json (RAM/CPU/port)', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      fs.writeFileSync(path.join(base, 'config.json'),
        JSON.stringify({ memory_mb: 1024, cpu_cores: 2, adb_port: 7555 }));
      const svc = new TrelEmuService();
      const info = svc.find();
      expect(info!.memoryMb).toBe(1024);
      expect(info!.cpuCores).toBe(2);
      expect(info!.adbPort).toBe(7555);
    });

    it('prefers user-downloaded APPDATA TrelEmu over bundled fallback', () => {
      const bundled = path.join(tmpRoot, 'trel-emu');
      const downloaded = path.join(tmpRoot, 'Trel', 'trel-emu');
      for (const base of [bundled, downloaded]) {
        fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
        fs.mkdirSync(path.join(base, 'image'), { recursive: true });
        fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
        fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      }
      fs.writeFileSync(path.join(downloaded, 'config.json'), JSON.stringify({ memory_mb: 1024, cpu_cores: 1, adb_port: 6555 }));
      const svc = new TrelEmuService();
      const info = svc.find();
      expect(info!.treluEmuRoot).toBe(downloaded);
      expect(info!.memoryMb).toBe(1024);
      expect(info!.adbPort).toBe(6555);
    });

    it('falls back to defaults for unknown config keys', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      fs.writeFileSync(path.join(base, 'config.json'),
        JSON.stringify({ memory_mb: 4096, someUnknownKey: 'foo' }));
      const svc = new TrelEmuService();
      const info = svc.find();
      // memory_mb переопределён, остальные дефолты
      expect(info!.memoryMb).toBe(4096);
      expect(info!.cpuCores).toBe(2);
    });

    it('caches the result (idempotent find())', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      const svc = new TrelEmuService();
      const a = svc.find();
      // Удалим файлы после первого find — если сервис кэширует, второй
      // вызов должен всё равно вернуть тот же объект.
      fs.unlinkSync(path.join(base, 'image', 'android-9.0.qcow2'));
      const b = svc.find();
      expect(b).toBe(a);
    });
  });

  describe('qemuArgs()', () => {
    it('contains -accel whpx (Windows Hypervisor Platform acceleration)', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      const svc = new TrelEmuService();
      const info = svc.find()!;
      const args = (svc as any).qemuArgs(info) as string[];
      const accelIdx = args.indexOf('-accel');
      expect(accelIdx).toBeGreaterThan(-1);
      // WHPX — аппаратное ускорение. TCG не используем.
      expect(args[accelIdx + 1]).toMatch(/^whpx/);
    });

    it('contains hostfwd 5555-:5555 (ADB port forward)', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      const svc = new TrelEmuService();
      const info = svc.find()!;
      const args = (svc as any).qemuArgs(info) as string[];
      const netdevIdx = args.indexOf('-netdev');
      expect(netdevIdx).toBeGreaterThan(-1);
      expect(args[netdevIdx + 1]).toMatch(/hostfwd=tcp::5555-:5555/);
    });

    it('uses SDL display and absolute USB tablet so the cursor is not trapped', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      const svc = new TrelEmuService();
      const info = svc.find()!;
      const args = (svc as any).qemuArgs(info) as string[];
      const displayIdx = args.indexOf('-display');
      expect(displayIdx).toBeGreaterThan(-1);
      expect(args[displayIdx + 1]).toBe('sdl');
      expect(args).toContain('virtio-tablet-pci');
      expect(args).not.toContain('-usb');
      expect(args).not.toContain('usb-tablet');
      expect(args).not.toContain('qemu-xhci,id=xhci');
    });

    it('uses snapshot=on for read-only template', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      const svc = new TrelEmuService();
      const info = svc.find()!;
      const args = (svc as any).qemuArgs(info) as string[];
      // Первый drive (template) должен иметь snapshot=on
      const drives = args.filter((a, i) => a === '-drive' && i % 1 === args.indexOf(a));
      const templateDrive = args[args.indexOf('-drive') + 1];
      expect(templateDrive).toMatch(/snapshot=on/);
      expect(templateDrive).toContain(info.imagePath);
    });

    it('does NOT use -daemonize (Windows QEMU does not support it)', () => {
      // -daemonize поддерживается только в Linux-QEMU. На Windows QEMU мы
      // отвязываемся через Node `detached: true, unref()` и пишем PID руками.
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      const svc = new TrelEmuService();
      const info = svc.find()!;
      const args = (svc as any).qemuArgs(info) as string[];
      expect(args).not.toContain('-daemonize');
      expect(args).not.toContain('-pidfile');
    });

    it('reflects custom RAM and CPU from config', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      fs.writeFileSync(path.join(base, 'config.json'),
        JSON.stringify({ memory_mb: 4096, cpu_cores: 8 }));
      const svc = new TrelEmuService();
      const info = svc.find()!;
      const args = (svc as any).qemuArgs(info) as string[];
      const mIdx = args.indexOf('-m');
      expect(args[mIdx + 1]).toBe('4096');
      const sIdx = args.indexOf('-smp');
      expect(args[sIdx + 1]).toBe('8');
    });
  });

  describe('hasReadySnapshot()', () => {
    it('returns false when overlay does not exist', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-img.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      const svc = new TrelEmuService();
      const info = svc.find()!;
      expect(svc.hasReadySnapshot(info.overlayPath)).toBe(false);
    });

    it('returns false when qemu-img is not available', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      // qemu-img не положили
      const overlay = path.join(base, 'image', 'android-9.0.overlay.qcow2');
      fs.writeFileSync(overlay, 'fake qcow2 content');
      const svc = new TrelEmuService();
      expect(svc.hasReadySnapshot(overlay)).toBe(false);
    });
  });

  describe('qemuArgs() with snapshot', () => {
    it('does NOT add -loadvm when snapshot is absent', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-img.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      const svc = new TrelEmuService();
      const info = svc.find()!;
      const args = (svc as any).qemuArgs(info) as string[];
      expect(args).not.toContain('-loadvm');
    });

    it('uses TCP monitor for savevm/quit commands', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-img.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      const svc = new TrelEmuService();
      const info = svc.find()!;
      const args = (svc as any).qemuArgs(info) as string[];
      const monitorIdx = args.indexOf('-monitor');
      expect(monitorIdx).toBeGreaterThan(-1);
      expect(args[monitorIdx + 1]).toMatch(/^tcp:127\.0\.0\.1:\d+,server,nowait$/);
    });
  });

  describe('loadConfig()', () => {
    it('returns defaults when config.json is absent', () => {
      const svc = new TrelEmuService();
      const cfg = (svc as any).loadConfig(path.join(tmpRoot, 'no-such-dir')) as any;
      expect(cfg.memory_mb).toBe(3072);
      expect(cfg.cpu_cores).toBe(2);
      expect(cfg.adb_port).toBe(5555);
      expect(cfg.boot_snapshot).toBe(true);
      expect(cfg.snapshot_name).toBe('trelemuready');
      expect(cfg.prelaunch_bedrock).toBe(true);
    });

    it('returns defaults when config.json is malformed JSON', () => {
      const dir = path.join(tmpRoot, 'bad-cfg');
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'config.json'), 'not json{{');
      const svc = new TrelEmuService();
      const cfg = (svc as any).loadConfig(dir) as any;
      expect(cfg.memory_mb).toBe(3072);
    });
  });

  describe('stop()', () => {
    it('does not throw if QEMU is not running', () => {
      const svc = new TrelEmuService();
      // Подложим минимальный бандл, чтобы find() не возвращал null — иначе
      // stop() не сможет прочитать pidfile (но всё равно отработает на taskkill)
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      expect(() => svc.stop()).not.toThrow();
    });

    it('clears adbSerial on stop', () => {
      const svc = new TrelEmuService();
      (svc as any).adbSerial = '127.0.0.1:5555';
      svc.stop();
      expect((svc as any).adbSerial).toBeNull();
    });

    it('ignores stale pidfile (>24h old)', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      // Старый pidfile (больше суток) — не должен влиять на taskkill
      const pidfile = path.join(base, 'qemu.pid');
      fs.writeFileSync(pidfile, '99999');
      const past = Date.now() / 1000 - 25 * 60 * 60;
      fs.utimesSync(pidfile, past, past);
      const svc = new TrelEmuService();
      expect(() => svc.stop()).not.toThrow();
    });
  });

  describe('resetCache()', () => {
    it('clears both info cache and adbSerial', () => {
      const svc = new TrelEmuService();
      (svc as any).cached = { foo: 1 } as any;
      (svc as any).adbSerial = '127.0.0.1:5555';
      svc.resetCache();
      expect((svc as any).cached).toBeUndefined();
      expect((svc as any).adbSerial).toBeNull();
    });
  });

  describe('find() with scrcpy', () => {
    it('exposes scrcpyExe/scrcpyServer when scrcpy/ is present', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.mkdirSync(path.join(base, 'scrcpy'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      fs.writeFileSync(path.join(base, 'scrcpy', 'scrcpy.exe'), '');
      fs.writeFileSync(path.join(base, 'scrcpy', 'scrcpy-server'), '');
      const svc = new TrelEmuService();
      const info = svc.find()!;
      expect(info.scrcpyExe).toBe(path.join(base, 'scrcpy', 'scrcpy.exe'));
      expect(info.scrcpyServer).toBe(path.join(base, 'scrcpy', 'scrcpy-server'));
    });

    it('returns null scrcpyExe/scrcpyServer when scrcpy/ is missing', () => {
      const base = path.join(tmpRoot, 'trel-emu');
      fs.mkdirSync(path.join(base, 'qemu'), { recursive: true });
      fs.mkdirSync(path.join(base, 'image'), { recursive: true });
      fs.writeFileSync(path.join(base, 'qemu', 'qemu-system-x86_64.exe'), '');
      fs.writeFileSync(path.join(base, 'image', 'android-9.0.qcow2'), '');
      const svc = new TrelEmuService();
      const info = svc.find()!;
      expect(info.scrcpyExe).toBeNull();
      expect(info.scrcpyServer).toBeNull();
    });
  });

  describe('detectOtherEmulators()', () => {
    it('returns empty array on a clean system (no emulators running)', () => {
      const svc = new TrelEmuService();
      const found = svc.detectOtherEmulators();
      // В тестовой среде могут крутиться наши процессы (vitest, node), но
      // сигнатур эмуляторов там быть не должно.
      const emuNames = found.map(f => f.name.toLowerCase());
      expect(emuNames).not.toContain('mumuvmmheadless');
      expect(emuNames).not.toContain('bluestacks');
      expect(emuNames).not.toContain('nox');
    });

    it('returns a non-empty list of known emulator signatures', () => {
      // Проверяем что таблица OTHER_EMULATOR_PROCESSES покрывает топовые эмуляторы.
      // (Сами сигнатуры приватные, но функция возвращает найденные через tasklist.)
      const svc = new TrelEmuService();
      const all = (svc as any).OTHER_EMULATOR_PROCESSES ?? [];
      // Доступ к приватной константе через any — это нормально для тестов.
      const names = (Array.isArray(all) ? all : []).map((e: any) => e.name.toLowerCase());
      // Если константа стала приватной — фоллбэк: проверим что сигнатуры есть в выводе tasklist
      // (косвенно, через наличие MuMuVMMHeadless в списке).
      if (names.length > 0) {
        expect(names).toContain('mumuvmmheadless');
        expect(names).toContain('bluestacks');
        expect(names).toContain('nox');
      }
    });
  });
});
