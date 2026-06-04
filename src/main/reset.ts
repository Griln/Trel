import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import { WorldService } from './worlds';

const SYSTEM_DENYLIST = new Set([
  'c:\\windows', 'c:\\program files', 'c:\\program files (x86)',
  'c:\\programdata', 'c:\\$recycle.bin', 'c:\\system volume information',
  '/etc', '/usr', '/bin', '/sbin', '/var', '/proc', '/sys', '/dev', '/boot',
]);

function isPathAllowed(dir: string): boolean {
  const resolved = path.resolve(dir).toLowerCase();
  if (resolved.length < 4) return false;
  for (const denied of SYSTEM_DENYLIST) {
    if (resolved === denied || resolved.startsWith(denied + path.sep)) return false;
  }
  if (resolved.startsWith('\\\\')) return false;
  const parent = path.dirname(resolved);
  if (parent === resolved) return false;
  return true;
}

function desktopCandidates(): string[] {
  const home = os.homedir();
  const list = [
    path.join(home, 'Desktop'),
    path.join(home, 'OneDrive', 'Desktop'),
  ];
  try {
    for (const n of fs.readdirSync(home)) {
      if (/^OneDrive(\s|-)/i.test(n)) list.push(path.join(home, n, 'Desktop'));
    }
  } catch {}
  if (process.env.USERPROFILE) list.push(path.join(process.env.USERPROFILE, 'Desktop'));
  return [...new Set(list)];
}

export interface ResetOptions {
  /** Если true — оставить миры (saves), настройки (settings.json), аккаунты (accounts.json). */
  keepUserData: boolean;
}

export interface ResetResult {
  removed: string[];
  keptUserData: boolean;
}

/**
 * Полный сброс лаунчера: удаление кеша Java, скачанных версий, ассетов, библиотек.
 * Если keepUserData=false — также удаляются настройки, аккаунты, миры и бэкапы.
 *
 * После выполнения приложение перезапускается (или закрывается, если перезапуск невозможен).
 */
export class ResetService {
  constructor(
    private launcherDir: string,
    private gameDir: string,
    private worlds: WorldService,
  ) {}

  setGameDir(dir: string) { this.gameDir = dir; }

  perform(opts: ResetOptions): ResetResult {
    const removed: string[] = [];

    const remove = (p: string) => {
      if (fs.existsSync(p)) {
        try {
          fs.rmSync(p, { recursive: true, force: true });
          removed.push(p);
        } catch {}
      }
    };

    // Always-removable: cache + downloaded game data + java
    remove(path.join(this.launcherDir, 'java'));
    remove(path.join(this.launcherDir, 'cache'));
    remove(path.join(this.gameDir, 'versions'));
    remove(path.join(this.gameDir, 'libraries'));
    remove(path.join(this.gameDir, 'assets'));
    remove(path.join(this.gameDir, 'logs'));
    remove(path.join(this.gameDir, 'crash-reports'));

    // Также чистим предыдущую папку игры (если папку меняли)
    try {
      const settingsRaw = fs.readFileSync(path.join(this.launcherDir, 'settings.json'), 'utf-8');
      const settings = JSON.parse(settingsRaw);
      const prevGameDir = typeof settings.prevGameDir === 'string' && settings.prevGameDir.length > 0
        ? settings.prevGameDir : '';
      if (prevGameDir && prevGameDir !== this.gameDir && isPathAllowed(prevGameDir)) {
        remove(path.join(prevGameDir, 'versions'));
        remove(path.join(prevGameDir, 'libraries'));
        remove(path.join(prevGameDir, 'assets'));
        remove(path.join(prevGameDir, 'logs'));
        remove(path.join(prevGameDir, 'crash-reports'));
        if (!opts.keepUserData) {
          remove(path.join(prevGameDir, 'saves'));
          remove(path.join(prevGameDir, 'backups'));
          remove(path.join(prevGameDir, 'resourcepacks'));
          remove(path.join(prevGameDir, 'shaderpacks'));
          remove(path.join(prevGameDir, 'mods'));
          remove(path.join(prevGameDir, 'screenshots'));
          remove(path.join(prevGameDir, 'options.txt'));
        }
        // Удаляем саму папку если пуста
        try {
          if (fs.existsSync(prevGameDir)) {
            const remaining = fs.readdirSync(prevGameDir).filter((n) => !['.git', 'Thumbs.db', 'desktop.ini', '.DS_Store'].includes(n));
            if (remaining.length === 0) { fs.rmSync(prevGameDir, { recursive: true, force: true }); removed.push(prevGameDir); }
          }
        } catch {}
      }
    } catch {}

    if (!opts.keepUserData) {
      // Also wipe user data: configs, accounts, saves, backups, resourcepacks, mods, screenshots
      remove(path.join(this.launcherDir, 'settings.json'));
      remove(path.join(this.launcherDir, 'accounts.json'));
      remove(path.join(this.launcherDir, 'java-cache.json'));
      remove(path.join(this.gameDir, 'saves'));
      remove(path.join(this.gameDir, 'backups'));
      remove(path.join(this.gameDir, 'resourcepacks'));
      remove(path.join(this.gameDir, 'shaderpacks'));
      remove(path.join(this.gameDir, 'mods'));
      remove(path.join(this.gameDir, 'screenshots'));
      remove(path.join(this.gameDir, 'options.txt'));
      remove(path.join(this.gameDir, 'usercache.json'));
      remove(path.join(this.gameDir, 'launcher_profiles.json'));
      remove(path.join(this.gameDir, '.trel_import.json'));

      // Pre-Classic (rd-*, c0.*, in-*, inf-*, ранний alpha) хранит мир как
      // одинокий `level.dat` прямо в корне APPDATA/.minecraft (или, при
      // нашей подмене APPDATA→gameDir, прямо в gameDir). Папок saves/ у этих
      // версий нет, поэтому remove(.../saves) не помогает — нужно отдельно
      // прибить именно файлы level.dat*. wipeAllLooseLevelDat теперь тоже
      // ходит только по нашим путям (см. WorldService).
      try {
        for (const file of this.worlds.wipeAllLooseLevelDat()) removed.push(file);
      } catch {}

      // Удаляем сами папки launcherDir и gameDir, если они пусты
      // или содержат только мусор (.git, Thumbs.db и т.п.)
      const removeDirIfEmpty = (dir: string) => {
        try {
          if (!fs.existsSync(dir)) return;
          const remaining = fs.readdirSync(dir).filter((n) => !['.git', 'Thumbs.db', 'desktop.ini', '.DS_Store'].includes(n));
          if (remaining.length === 0) { fs.rmSync(dir, { recursive: true, force: true }); removed.push(dir); }
        } catch {}
      };
      removeDirIfEmpty(this.gameDir);
      removeDirIfEmpty(this.launcherDir);
    }

    return { removed, keptUserData: opts.keepUserData };
  }

  /** Restart the launcher cleanly. */
  restart() {
    app.relaunch();
    app.exit(0);
  }

  /**
   * Полное удаление лаунчера через NSIS-uninstaller.
   * Если keepUserData=false — сначала чистим всё, потом запускаем uninstaller.
   * Возвращает false если uninstaller не найден (например, portable-сборка).
   */
  uninstallLauncher(opts: ResetOptions): { ok: boolean; reason?: string } {
    // Сначала чистим данные
    this.perform(opts);

    // Удаляем ярлыки с рабочего стола (во всех возможных локациях)
    for (const d of desktopCandidates()) {
      const linkPath = path.join(d, 'Trel.lnk');
      try { if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath); } catch {}
    }

    // Ищем NSIS uninstaller
    const exePath = process.execPath;            // ...\AppData\Local\Programs\Trel\Trel.exe
    const exeDir = path.dirname(exePath);
    const candidates = [
      path.join(exeDir, 'Uninstall Trel.exe'),
      path.join(exeDir, 'Uninstall.exe'),
      path.join(exeDir, '..', 'Uninstall Trel.exe'),
      // Legacy: пользователи, которые ставили старую версию под именем AuroraLauncher
      path.join(exeDir, 'Uninstall AuroraLauncher.exe'),
      path.join(exeDir, 'Uninstall Aurora Launcher.exe'),
      path.join(exeDir, '..', 'Uninstall AuroraLauncher.exe'),
    ];
    const uninstaller = candidates.find((p) => fs.existsSync(p));
    if (!uninstaller) {
      return { ok: false, reason: 'NSIS uninstaller не найден. Возможно, это portable-сборка — удалите .exe вручную.' };
    }

    // Запускаем uninstaller отвязанно от родителя и сразу выходим из лаунчера
    const child = spawn(uninstaller, ['/allusers', '_?=' + exeDir], {
      detached: true,
      stdio: 'ignore',
      cwd: exeDir,
    });
    child.unref();

    setTimeout(() => app.exit(0), 200);
    return { ok: true };
  }
}
