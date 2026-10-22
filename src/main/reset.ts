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
  /** If true — keep the worlds (saves), settings (settings.json), accounts (accounts.json). */
  keepUserData: boolean;
}

export interface ResetResult {
  removed: string[];
  keptUserData: boolean;
}

/**
 * Full launcher reset: removal of the Java cache, downloaded versions, assets, libraries.
 * If keepUserData=false — settings, accounts, worlds and backups are removed as well.
 *
 * After execution the app restarts (or quits, if a restart is impossible).
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

    // Also clean the previous game folder (if the folder was changed)
    try {
      const settingsRaw = fs.readFileSync(path.join(this.launcherDir, 'settings.json'), 'utf-8');
      const settings = JSON.parse(settingsRaw);
      const prevGameDir = typeof settings.prevGameDir === 'string' && settings.prevGameDir.length > 0
        ? settings.prevGameDir : '';
      // prevGameDir comes from the user's own settings.json: we trust it only after
      // a strict check (realpath of symlinks, ban on home/root/system),
      // otherwise a poisoned path turns the reset into deletion of foreign data.
      const prevOk = (() => {
        if (!prevGameDir || prevGameDir === this.gameDir || !isPathAllowed(prevGameDir)) return false;
        const resolved = path.resolve(prevGameDir);
        if (resolved === path.parse(resolved).root) return false;
        if (resolved === os.homedir()) return false;
        try {
          const real = fs.realpathSync(resolved);
          if (real !== resolved) return false; // symlink — do not touch
        } catch { return false; } // no folder — nothing to clean
        return true;
      })();
      if (prevOk) {
        remove(path.join(prevGameDir, 'versions'));
        remove(path.join(prevGameDir, 'libraries'));
        remove(path.join(prevGameDir, 'assets'));
        remove(path.join(prevGameDir, 'logs'));
        remove(path.join(prevGameDir, 'crash-reports'));
        if (!opts.keepUserData) {
          remove(path.join(prevGameDir, 'saves'));
          remove(path.join(prevGameDir, 'backups'));
          remove(path.join(prevGameDir, 'resourcepacks'));
          remove(path.join(prevGameDir, 'texturepacks'));
          remove(path.join(prevGameDir, 'shaderpacks'));
          remove(path.join(prevGameDir, 'mods'));
          remove(path.join(prevGameDir, 'screenshots'));
          remove(path.join(prevGameDir, 'options.txt'));
        }
        // Delete the folder itself if it is empty
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
      remove(path.join(this.gameDir, 'texturepacks'));
      remove(path.join(this.gameDir, 'shaderpacks'));
      remove(path.join(this.gameDir, 'mods'));
      remove(path.join(this.gameDir, 'coremods'));
      remove(path.join(this.gameDir, 'schematics'));
      remove(path.join(this.gameDir, 'screenshots'));
      remove(path.join(this.gameDir, 'options.txt'));
      remove(path.join(this.gameDir, 'usercache.json'));
      remove(path.join(this.gameDir, 'launcher_profiles.json'));
      remove(path.join(this.gameDir, '.trel_import.json'));
      // Deduplication hash cache: it describes files that no longer exist after the reset,
      // and keeping it makes no sense (it is rebuilt on the first import).
      remove(path.join(this.gameDir, '.trel_hash_cache.json'));
      // The import journal and log refer to the very same deleted files.
      remove(path.join(this.gameDir, '.trel_import_journal.json'));
      remove(path.join(this.gameDir, '.trel_import.log'));

      // Pre-Classic (rd-*, c0.*, in-*, inf-*, early alpha) stores the world as a
      // lone `level.dat` right in the APPDATA/.minecraft root (or, with
      // our APPDATA→gameDir substitution, right in gameDir). These versions have
      // no saves/ folder, so remove(.../saves) does not help — we have to kill
      // the level.dat* files separately. wipeAllLooseLevelDat now also
      // only walks our own paths (see WorldService).
      try {
        for (const file of this.worlds.wipeAllLooseLevelDat()) removed.push(file);
      } catch {}

      // Delete the launcherDir and gameDir folders themselves if they are empty
      // or contain only junk (.git, Thumbs.db, etc.)
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
   * Full removal of the launcher via the NSIS-uninstaller.
   * If keepUserData=false — we first clean everything, then start the uninstaller.
   * Returns false if the uninstaller is not found (e.g. a portable build).
   */
  uninstallLauncher(opts: ResetOptions): { ok: boolean; reason?: string } {
    // First we clean the data
    this.perform(opts);

    // Delete the desktop shortcuts (in all possible locations)
    for (const d of desktopCandidates()) {
      const linkPath = path.join(d, 'Trel.lnk');
      try { if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath); } catch {}
      // Linux .desktop shortcut
      const desktopFile = path.join(d, 'trel.desktop');
      try { if (fs.existsSync(desktopFile)) fs.unlinkSync(desktopFile); } catch {}
    }

    // Linux/macOS: there is no NSIS-uninstaller — delete the binary manually
    // (AppImage / deb / rpm are removed by the system package manager).
    if (process.platform !== 'win32') {
      // We tell the user what to do separately.
      return {
        ok: false,
        reason: 'Удалите лаунчер системным пакетным менеджером (apt/rpm) или удалите AppImage вручную.',
      };
    }

    // Look for the NSIS uninstaller
    const exePath = process.execPath;            // ...\AppData\Local\Programs\Trel\Trel.exe
    const exeDir = path.dirname(exePath);
    const candidates = [
      path.join(exeDir, 'Uninstall Trel.exe'),
      path.join(exeDir, 'Uninstall.exe'),
      path.join(exeDir, '..', 'Uninstall Trel.exe'),
      // Legacy: users who installed an old version under the name AuroraLauncher
      path.join(exeDir, 'Uninstall AuroraLauncher.exe'),
      path.join(exeDir, 'Uninstall Aurora Launcher.exe'),
      path.join(exeDir, '..', 'Uninstall AuroraLauncher.exe'),
    ];
    const uninstaller = candidates.find((p) => fs.existsSync(p));
    if (!uninstaller) {
      return { ok: false, reason: 'NSIS uninstaller не найден. Возможно, это portable-сборка — удалите .exe вручную.' };
    }

    // Start the uninstaller detached from the parent and immediately exit the launcher
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
