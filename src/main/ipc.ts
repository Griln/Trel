import { BrowserWindow, ipcMain, dialog } from 'electron';
import { shell } from 'electron';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { MinecraftService } from './minecraft';
import { AuthService } from './auth';
import { SettingsStore } from './settings';
import { JavaService } from './java';
import { WorldService } from './worlds';
import { ResetService } from './reset';
import { ContentService } from './content';
import type { ContentKind } from '../shared/types';
import { LauncherUpdater } from './updater';
import * as launcherImport from './import';
import { ServerService } from './servers';
import { SkinServer } from './skin-server';
import { AuthlibInjector } from './authlib';
import { assertSafeVersionId, assertSafeServerId, assertSafeWorldName, isInsideDir } from './safeIds';
import { authenticateMicrosoft, refreshMicrosoftToken } from './microsoft-auth';
import { LaunchOptions, LauncherSettings, THEME_IDS, ServerProperties } from '../shared/types';
import { DANGEROUS_JVM_ARGS, SHELL_WHITELIST } from '../shared/constants';

const SYSTEM_DENYLIST = new Set([
  'c:\\windows', 'c:\\program files', 'c:\\program files (x86)',
  'c:\\programdata', 'c:\\$recycle.bin', 'c:\\system volume information',
  '/etc', '/usr', '/bin', '/sbin', '/var', '/proc', '/sys', '/dev', '/boot',
]);

function validateSettings(s: any): LauncherSettings {
  if (!s || typeof s !== 'object') throw new Error('Invalid settings');
  // gameDir
  if (typeof s.gameDir !== 'string' || s.gameDir.length === 0 || s.gameDir.length > 1024) throw new Error('Invalid gameDir');
  const resolved = path.resolve(s.gameDir);
  if (resolved.includes('\0')) throw new Error('Invalid gameDir');
  if (resolved.startsWith('\\\\')) throw new Error('Network paths not allowed for gameDir');
  const lcResolved = resolved.toLowerCase();
  for (const denied of SYSTEM_DENYLIST) {
    if (lcResolved === denied || lcResolved.startsWith(denied + path.sep)) throw new Error('System directory not allowed for gameDir');
  }
  // javaPath (optional)
  if (s.javaPath !== undefined && s.javaPath !== null && s.javaPath !== '') {
    if (typeof s.javaPath !== 'string' || s.javaPath.length > 1024 || s.javaPath.includes('\0')) throw new Error('Invalid javaPath');
    const lcJava = s.javaPath.toLowerCase();
    if (!lcJava.includes('java')) throw new Error('javaPath does not look like a Java executable');
  }
  // jvmArgs — deny dangerous flags
  if (typeof s.jvmArgs === 'string' && s.jvmArgs.length > 0) {
    const parts = s.jvmArgs.split(/\s+/).filter(Boolean);
    for (const p of parts) { if (DANGEROUS_JVM_ARGS.test(p)) throw new Error('Dangerous JVM argument blocked: ' + p); }
  }
  // preCommand/postCommand — whitelist safe characters only
  for (const key of ['preCommand', 'postCommand'] as const) {
    if (typeof s[key] === 'string' && s[key].length > 0) {
      if (s[key].length > 1024) throw new Error(key + ' too long');
      if (!SHELL_WHITELIST.test(s[key])) throw new Error(key + ' contains disallowed shell characters');
    }
  }
  // Build clean object with type-safe defaults
  const clean: LauncherSettings = { gameDir: s.gameDir, memoryMb: 2048 };
  if (typeof s.memoryMb === 'number' && s.memoryMb >= 256 && s.memoryMb <= 32768) clean.memoryMb = s.memoryMb;
  if (typeof s.javaPath === 'string' && s.javaPath.length > 0) clean.javaPath = s.javaPath;
  if (typeof s.lastVersionId === 'string') clean.lastVersionId = s.lastVersionId;
  if (typeof s.theme === 'string' && (THEME_IDS as readonly string[]).includes(s.theme)) clean.theme = s.theme as any;
  if (typeof s.jvmArgs === 'string') clean.jvmArgs = s.jvmArgs;
  if (typeof s.gameWidth === 'number' && s.gameWidth >= 1) clean.gameWidth = s.gameWidth;
  if (typeof s.gameHeight === 'number' && s.gameHeight >= 1) clean.gameHeight = s.gameHeight;
  if (typeof s.fullscreen === 'boolean') clean.fullscreen = s.fullscreen;
  if (typeof s.showSnapshots === 'boolean') clean.showSnapshots = s.showSnapshots;
  if (typeof s.closeOnLaunch === 'boolean') clean.closeOnLaunch = s.closeOnLaunch;
  if (typeof s.lockOnLaunch === 'boolean') clean.lockOnLaunch = s.lockOnLaunch;
  if (typeof s.showIntro === 'boolean') clean.showIntro = s.showIntro;
  if (typeof s.prevGameDir === 'string' && s.prevGameDir.length > 0) clean.prevGameDir = s.prevGameDir;
  if (typeof s.locale === 'string' && ['ru', 'en', 'zh', 'es', 'de'].includes(s.locale)) clean.locale = s.locale as any;
  if (typeof s.showConsole === 'boolean') clean.showConsole = s.showConsole;
  if (typeof s.preCommand === 'string') clean.preCommand = s.preCommand;
  if (typeof s.postCommand === 'string') clean.postCommand = s.postCommand;
  return clean;
}

export function registerIpc(win: BrowserWindow, launcherDir: string, updater: LauncherUpdater) {
  const store = new SettingsStore(launcherDir);
  const settings = store.loadSettings();
  const java = new JavaService(launcherDir);
  const worlds = new WorldService(settings.gameDir);
  // SkinServer и AuthlibInjector — общие между клиентом и серверами.
  // Один mock-сервер обслуживает скины клиента и server-side authlib проверки.
  const skinServer = new SkinServer();
  const authlib = new AuthlibInjector(launcherDir);
  const mc = new MinecraftService(settings.gameDir, java, worlds, launcherDir, skinServer, authlib);
  const resetSvc = new ResetService(launcherDir, settings.gameDir, worlds);
  const content = new ContentService(settings.gameDir);
  const auth = new AuthService();
  const servers = new ServerService(launcherDir, settings.gameDir, java, skinServer, authlib, () => store.loadAccounts());

  // Прокидываем актуальный список аккаунтов в skin-сервер. Без этого
  // authlib-injector при запуске игры не нашёл бы профиль с текстурой.
  mc.updateSkinAccounts(store.loadAccounts());

  // Сводим существующие установки к одному folder per loader: для каждого
  // лоадера с inheritsFrom впитываем родительскую ваниль и удаляем её папку.
  // Безопасно для тех у кого уже всё «плоское» — flatten идемпотентен.
  // NOT called here: consolidateInstalls() is now called from the IPC handler below,
  // so the renderer can be notified about changes. Calling it here caused the
  // renderer to receive stale data (phantom orphan folders) since IPC handlers
  // are registered before the first renderer connects.

  // ─── Cold-start prewarm ────────────────────────────────────────────────
  // Прогреваем Java-кэш в фоне ещё до того как renderer успеет подключиться.
  // К моменту когда пользователь жмёт «Играть», `findBest` отдаёт результат
  // мгновенно из persistent-кэша и не запускает scan на горячем пути.
  java.prewarm().catch((e) => console.error('[ipc] Java prewarm failed:', e));

  // Параллельно: поднимаем skinServer и authlib, чтобы не ждать их при первом
  // запуске. Для online-аккаунтов skin-сервер нужен всегда — он обслуживает
  // всю yggdrasil-аутентификацию, не только скины.
  skinServer.start().catch((e) => console.error('[ipc] Skin server start failed:', e));
  authlib.ensure().catch((e) => console.error('[ipc] Authlib ensure failed:', e));

  // При каждом запуске ОБНОВЛЯЕМ ярлык на рабочем столе
  // (NSIS может удалить старый при обновлении, а новый не создать).
  // Для portable версии используем PORTABLE_EXECUTABLE_FILE — иначе
  // ярлык будет указывать на временный файл, который исчезает при выходе.
  (function ensureShortcut() {
    try {
      const isPortable = !!process.env.PORTABLE_EXECUTABLE_FILE;
      const exe = isPortable ? process.env.PORTABLE_EXECUTABLE_FILE! : process.execPath;
      if (!exe || !fs.existsSync(exe)) return;
      const dir = path.dirname(exe);
      const iconFile = path.join(dir, 'resources', 'build', 'icon.ico');
      const icon = fs.existsSync(iconFile) ? iconFile : exe;
      for (const desktop of [path.join(os.homedir(), 'OneDrive', 'Desktop'), path.join(os.homedir(), 'Desktop')]) {
        if (!fs.existsSync(desktop)) continue;
        const lnk = path.join(desktop, 'Trel.lnk');
        // Не перезаписываем валидный ярлык — пользователь мог его создать вручную.
        if (fs.existsSync(lnk)) {
          try {
            const meta = shell.readShortcutLink(lnk);
            if (meta.target && fs.existsSync(meta.target)) continue;
          } catch {}
        }
        shell.writeShortcutLink(lnk, 'create', {
          target: exe,
          cwd: dir,
          icon,
          iconIndex: 0,
        });
      }
    } catch (e) {
      console.error('[ipc] ensureShortcut failed:', e);
    }
  })();

  // Заодно резолвим Java под последнюю запущенную версию: к моменту клика
  // resolveJava() уже знает путь и не делает ни одного дискового запроса.
  if (settings.lastVersionId) {
    (async () => {
      try {
        const vDir = path.join(settings.gameDir, 'versions', settings.lastVersionId!);
        const jsonPath = path.join(vDir, settings.lastVersionId + '.json');
        if (!fs.existsSync(jsonPath)) return;
        const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        let major = json.javaVersion?.majorVersion;
        if (!major && json.inheritsFrom) {
          const parentJson = path.join(settings.gameDir, 'versions', json.inheritsFrom, json.inheritsFrom + '.json');
          if (fs.existsSync(parentJson)) {
            const pj = JSON.parse(fs.readFileSync(parentJson, 'utf-8'));
            major = pj.javaVersion?.majorVersion;
          }
        }
        if (typeof major === 'number') await java.findBest(major);
      } catch (e) { console.warn('Ignored error:', e); }
    })();
  }

  ipcMain.handle('settings:get', () => store.loadSettings());
  ipcMain.handle('settings:set', (_e, s: LauncherSettings) => {
    const clean = validateSettings(s);
    const prev = store.loadSettings();
    const prevDir = prev.gameDir;
    if (clean.gameDir !== prevDir) {
      // Сохраняем предыдущую папку если её ещё нет (не затираем при повторных сменах без удаления)
      if (!prev.prevGameDir || prev.prevGameDir !== clean.gameDir) {
        clean.prevGameDir = prevDir;
      }
    }
    store.saveSettings(clean);
    mc.setGameDir(clean.gameDir);
    worlds.setGameDir(clean.gameDir);
    resetSvc.setGameDir(clean.gameDir);
    content.setGameDir(clean.gameDir);
    servers.setGameDir(clean.gameDir);
    if (clean.gameDir !== prevDir) {
      try { mc.consolidateInstalls(); } catch (e) {
        console.error('[ipc] consolidateInstalls failed after gameDir change:', e);
      }
    }
    return clean;
  });
  ipcMain.handle('settings:pickDir', async () => {
    const res = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
    return res.canceled ? null : res.filePaths[0];
  });

  // ─── Desktop shortcut ──────────────────────────────────────────────
  function desktopPath(): string {
    const home = os.homedir();
    // OneDrive redirects the Desktop folder: e.g. C:\Users\...\OneDrive\Desktop
    for (const candidate of [
      path.join(home, 'OneDrive', 'Desktop'),
      path.join(home, 'Desktop'),
    ]) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return path.join(home, 'Desktop');
  }

  ipcMain.handle('settings:desktopShortcutExists', () => {
    const linkPath = path.join(desktopPath(), 'Trel.lnk');
    if (!fs.existsSync(linkPath)) return false;
    try {
      const meta = shell.readShortcutLink(linkPath);
      return !!(meta.target && fs.existsSync(meta.target));
    } catch { return false; }
  });
  ipcMain.handle('settings:createDesktopShortcut', () => {
    try {
      const desktop = desktopPath();
      const linkPath = path.join(desktop, 'Trel.lnk');
      // Portable: process.execPath — это временный файл (распакованный во время работы).
      // Оригинальный portable .exe лежит в PORTABLE_EXECUTABLE_FILE.
      const isPortable = !!process.env.PORTABLE_EXECUTABLE_FILE;
      const exePath = isPortable ? process.env.PORTABLE_EXECUTABLE_FILE! : process.execPath;
      if (!exePath || !fs.existsSync(exePath)) return false;

      // Удаляем старый битый ярлык если есть
      if (fs.existsSync(linkPath)) {
        try {
          const meta = shell.readShortcutLink(linkPath);
          if (!meta.target || !fs.existsSync(meta.target)) {
            try { fs.unlinkSync(linkPath); } catch (e) { console.warn('Ignored error:', e); }
          }
        } catch {
          try { fs.unlinkSync(linkPath); } catch (e) { console.warn('Ignored error:', e); }
        }
      }

      // Icon: для portable ищем рядом с оригинальным exe; для установленного — рядом с execPath (в app dir)
      const iconDir = isPortable ? path.dirname(exePath) : path.dirname(process.execPath);
      const iconPath = path.join(iconDir, 'resources', 'build', 'icon.ico');
      const icon = fs.existsSync(iconPath) ? iconPath : exePath;
      shell.writeShortcutLink(linkPath, fs.existsSync(linkPath) ? 'update' : 'create', {
        target: exePath,
        cwd: path.dirname(exePath),
        icon,
        iconIndex: 0,
      });
      return fs.existsSync(linkPath);
    } catch (e) {
      console.error('[ipc] createDesktopShortcut failed:', e);
      return false;
    }
  });
  ipcMain.handle('settings:removeDesktopShortcut', () => {
    try {
      const desktop = desktopPath();
      const linkPath = path.join(desktop, 'Trel.lnk');
      if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath);
      return true;
    } catch { return false; }
  });

    // ─── Move game directory ────────────────────────────────────────────
  /** Execute a PowerShell script safely via spawnSync with separate arguments. */
  function runPowerShellScript(script: string, args: string[], timeout = 5000): string {
    const result = spawnSync('powershell', ['-NoProfile', '-Command', script, ...args], {
      windowsHide: true,
      timeout,
      encoding: 'utf-8',
    });
    if (result.error) throw result.error;
    if (result.status !== 0 && result.status !== null) {
      throw new Error(`PowerShell exited with code ${result.status}: ${result.stderr || ''}`);
    }
    return result.stdout || '';
  }

  ipcMain.handle('settings:moveGameDir', async (_e, oldDir: string, newDir: string) => {
    if (!oldDir || !newDir || oldDir === newDir) return { moved: 0, errors: [] as string[] };
    // Validate both paths: no system directories, no null bytes, no network paths
    for (const d of [oldDir, newDir]) {
      const resolved = path.resolve(d);
      if (resolved.includes('\0')) throw new Error('Invalid path');
      if (resolved.startsWith('\\\\')) throw new Error('Network paths not allowed');
      const lc = resolved.toLowerCase();
      for (const denied of SYSTEM_DENYLIST) {
        if (lc === denied || lc.startsWith(denied + path.sep)) throw new Error('System directory not allowed');
      }
    }
    // Prevent nested paths (one directory inside another)
    const absOld = path.resolve(oldDir);
    const absNew = path.resolve(newDir);
    const sep = path.sep;
    if (absNew.startsWith(absOld + sep) || absOld.startsWith(absNew + sep)) {
      throw new Error('Cannot move into or from a subdirectory');
    }
    const errors: string[] = [];
    let moved = 0;

    const safeCopy = async (src: string, dst: string) => {
      try { await fsp.copyFile(src, dst); return true; } catch { return false; }
    };

    const safeUnlink = (p: string) => {
      try { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); } catch (e) { console.warn('Ignored error:', e); }
    };

    // Rollback: rename source to backup, delete only after all copies succeed
    const pendingDeletions: string[] = [];

    // Проверяет содержит ли директория файлы (не считая мусор и пустые подпапки)
    const dirHasContent = async (dir: string): Promise<boolean> => {
      try {
        const entries = await fsp.readdir(dir);
        for (const n of entries) {
          if (['.git', 'Thumbs.db', 'desktop.ini', '.DS_Store', '.trel_tmp'].includes(n)) continue;
          const full = path.join(dir, n);
          const st = await fsp.stat(full);
          if (st.isDirectory()) {
            if (await dirHasContent(full)) return true;
          } else {
            return true;
          }
        }
      } catch (e) { console.warn('Ignored error:', e); }
      return false;
    };

    /**
     * Copy dir recursively, SKIPPING existing files (no overwrite).
     * Returns { copied: number, skipped: number, total: number } — total
     * is count of ALL source files (excluding dirs), so caller can verify
     * that copied+skipped === total before deleting source.
     */
    const copyDir = async (src: string, dst: string): Promise<{ copied: number; skipped: number; total: number }> => {
      let copied = 0;
      let skipped = 0;
      let total = 0;
      if (!(await dirHasContent(src))) return { copied, skipped, total };
      try { await fsp.mkdir(dst, { recursive: true }); } catch (e) { console.warn('Ignored error:', e); }
      let entries: fs.Dirent[];
      try { entries = await fsp.readdir(src, { withFileTypes: true }); } catch { return { copied, skipped, total }; }
      for (const entry of entries) {
        const sp = path.join(src, entry.name);
        const dp = path.join(dst, entry.name);
        if (entry.isDirectory()) {
          const sub = await copyDir(sp, dp);
          copied += sub.copied; skipped += sub.skipped; total += sub.total;
        } else {
          total++;
          if (fs.existsSync(dp)) {
            skipped++;
          } else {
            if (await safeCopy(sp, dp)) copied++;
          }
        }
      }
      return { copied, skipped, total };
    };

    try { await fsp.mkdir(newDir, { recursive: true }); } catch (e) { console.warn('Ignored error:', e); }

    // Топ-уровневые папки для переноса
    const items = ['saves', 'mods', 'resourcepacks', 'shaderpacks', 'texturepacks',
      'config', 'logs', 'crash-reports', 'datapacks', 'screenshots', 'backups',
      'local', 'world_templates', 'resources', 'stats', 'advancements',
      'defaultconfigs', 'scripts', 'kubejs'];
    for (const item of items) {
      const src = path.join(oldDir, item);
      const dst = path.join(newDir, item);
      if (!fs.existsSync(src)) continue;
      try {
        const r = await copyDir(src, dst);
        moved += r.copied;
        // Schedule deletion only if ALL files were processed (copied + skipped)
        if (r.copied + r.skipped >= r.total && r.total > 0) pendingDeletions.push(src);
      } catch (e) { errors.push(`${item}: ${(e as Error).message}`); }
    }

    // versions — копируем только папки с реальным содержимым (jar, json)
    let versionsBackupDir: string | null = null;
    const versionsSrc = path.join(oldDir, 'versions');
    if (fs.existsSync(versionsSrc)) {
      const versionsDst = path.join(newDir, 'versions');
      try { await fsp.mkdir(versionsDst, { recursive: true }); } catch (e) { console.warn('Ignored error:', e); }
      let entries: fs.Dirent[];
      try { entries = await fsp.readdir(versionsSrc, { withFileTypes: true }); } catch { entries = []; }
      let verMoved = 0;
      let verSkipped = 0;
      let verTotal = 0;
      const processedDirs: string[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const verSrc = path.join(versionsSrc, entry.name);
        const verDst = path.join(versionsDst, entry.name);
        const hasJar = fs.existsSync(path.join(verSrc, entry.name + '.jar'));
        const hasJson = fs.existsSync(path.join(verSrc, entry.name + '.json'));
        if (hasJar || hasJson) {
          try {
            const r = await copyDir(verSrc, verDst);
            verMoved += r.copied;
            verSkipped += r.skipped;
            verTotal += r.total;
            if (r.copied + r.skipped >= r.total && r.total > 0) {
              processedDirs.push(entry.name);
            }
          } catch (e) { errors.push(`versions/${entry.name}: ${(e as Error).message}`); }
        }
      }
      moved += verMoved;
      // Schedule versionsSrc deletion only if no errors and no leftovers
      if (verTotal > 0 && errors.length === 0) {
        let hasLeftovers = false;
        try {
          const remaining = await fsp.readdir(versionsSrc);
          const junk = new Set(['.git', 'Thumbs.db', 'desktop.ini', '.DS_Store', '.trel_tmp']);
          for (const name of remaining) {
            if (junk.has(name)) continue;
            if (processedDirs.includes(name)) continue;
            hasLeftovers = true;
            break;
          }
        } catch (e) { console.warn('Ignored error:', e); }
        if (!hasLeftovers) pendingDeletions.push(versionsSrc);
      }
    }

    // libraries и assets — копируем как есть
    for (const cache of ['libraries', 'assets']) {
      const src = path.join(oldDir, cache);
      const dst = path.join(newDir, cache);
      if (!fs.existsSync(src)) continue;
      try {
        const r = await copyDir(src, dst);
        moved += r.copied;
        if (r.copied + r.skipped >= r.total && r.total > 0) pendingDeletions.push(src);
      } catch (e) { errors.push(`${cache}: ${(e as Error).message}`); }
    }

    // Файлы
    const files = ['options.txt', 'servers.dat', 'servers.dat_old', 'usercache.json',
      'usernamecache.json', 'launcher_profiles.json'];
    for (const file of files) {
      const src = path.join(oldDir, file);
      const dst = path.join(newDir, file);
      if (!fs.existsSync(src)) continue;
      if (await safeCopy(src, dst)) {
        moved++;
        pendingDeletions.push(src);
      } else {
        errors.push(`${file}: copy failed`);
      }
    }

    // Commit phase: delete only if no critical errors occurred
    if (errors.length === 0) {
      for (const p of pendingDeletions) safeUnlink(p);
    } else {
      // Rollback: log what would have been deleted
      console.warn(`[ipc] moveGameDir aborted due to ${errors.length} errors. Pending deletions not executed:`, pendingDeletions);
    }

    return { moved, errors };
  });

  ipcMain.handle('accounts:list', () => store.loadAccounts());
  // Простой mutex: все мутации accounts.json идут через одну Promise-цепочку.
  // Без этого параллельные setSkin (drag-drop + клик) могут перезаписать
  // друг друга — оба читают одинаковый снапшот, второй проигрывает.
  let accountsLock: Promise<unknown> = Promise.resolve();
  const withAccountsLock = <T>(fn: () => T | Promise<T>): Promise<T> => {
    const next = accountsLock.then(() => fn(), () => fn());
    accountsLock = next;
    return next as Promise<T>;
  };
  // Обновляет skin-сервер актуальным списком аккаунтов после любой записи.
  const refreshSkinServer = () => {
    try { mc.updateSkinAccounts(store.loadAccounts()); } catch (e) { console.warn('Ignored error:', e); }
  };
  ipcMain.handle('accounts:addMicrosoft', async () => withAccountsLock(async () => {
    const profile = await authenticateMicrosoft();
    const list = store.loadAccounts();
    const existing = list.findIndex((a) => a.uuid === profile.uuid);
    const acc = auth.createMicrosoft(profile.uuid, profile.name, profile.msRefreshToken, profile.owned);
    if (existing >= 0) {
      list[existing] = { ...list[existing], ...acc };
    } else {
      list.push(acc);
    }
    store.saveAccounts(list);
    refreshSkinServer();
    return { account: list[existing >= 0 ? existing : list.length - 1], owned: profile.owned };
  }));
  ipcMain.handle('accounts:refreshMicrosoft', (_e, uuid: string) => withAccountsLock(async () => {
    const list = store.loadAccounts();
    const idx = list.findIndex((a) => a.uuid === uuid);
    if (idx < 0) throw new Error('Account not found');
    const refreshToken = list[idx].msRefreshToken;
    if (!refreshToken) throw new Error('No refresh token stored — log in again');
    const profile = await refreshMicrosoftToken(refreshToken);
    list[idx] = {
      ...list[idx],
      uuid: profile.uuid,
      name: profile.name,
      msRefreshToken: profile.msRefreshToken || list[idx].msRefreshToken,
      owned: profile.owned,
    };
    store.saveAccounts(list);
    refreshSkinServer();
    return list[idx];
  }));
  ipcMain.handle('accounts:addGuest', (_e, name: string) => withAccountsLock(() => {
    if (typeof name !== 'string' || !/^[A-Za-z0-9_]{1,16}$/.test(name.trim())) {
      throw new Error('Name must be 1-16 chars: letters, digits, underscore');
    }
    const list = store.loadAccounts();
    const acc = auth.createGuest(name.trim());
    const existing = list.findIndex((a) => a.uuid === acc.uuid);
    if (existing >= 0) {
      list[existing] = { ...list[existing], ...acc };
    } else {
      list.push(acc);
    }
    store.saveAccounts(list);
    refreshSkinServer();
    return list[existing >= 0 ? existing : list.length - 1];
  }));
  ipcMain.handle('accounts:remove', (_e, uuid: string, clearCache?: boolean) => withAccountsLock(() => {
    const list = store.loadAccounts().filter((a) => a.uuid !== uuid);
    store.saveAccounts(list);
    refreshSkinServer();
    if (clearCache) wipeSkinCache();
    return list;
  }));

  // ---- Скины ----
  // Скин хранится у аккаунта как data-URL (PNG, 64×64 или 64×32).
  // Чтобы скин был виден ВНУТРИ игры — лаунчер при запуске поднимает
  // локальный yggdrasil-mock на 127.0.0.1:RANDOM и передаёт игре через
  // authlib-injector (-javaagent).
  //
  // При смене скина мы дополнительно чистим дисковый кэш скинов Minecraft
  // (assets/skins). Игра кэширует загруженные текстуры по SHA256 от URL,
  // и хотя URL теперь завязан на хэш PNG (см. SkinServer.profileResponse),
  // на ОЧЕНЬ старых запусках мог остаться файл со старым URL. Чистка
  // гарантирует что в игре никогда не покажется прошлый скин из кэша.
  const wipeSkinCache = () => {
    try {
      const skinCache = path.join(store.loadSettings().gameDir, 'assets', 'skins');
      if (fs.existsSync(skinCache)) {
        fs.rmSync(skinCache, { recursive: true, force: true });
      }
    } catch (e) { console.warn('Ignored error:', e); }
  };

  ipcMain.handle('accounts:setSkin', async (_e, uuid: string, dataUrl: string, model: 'classic' | 'slim') => withAccountsLock(() => {
    const list = store.loadAccounts();
    const idx = list.findIndex((a) => a.uuid === uuid);
    if (idx < 0) throw new Error('Account not found');
    // Базовая валидация: должен быть data:image/png;base64,...
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
      throw new Error('Skin must be PNG. Drag a .png file or select one via the dialog.');
    }
    // Защита от слишком больших скинов: PNG 64×64 ~5KB, 64×128 ~10KB,
    // больше 128KB — это явно не скин (либо фото, либо потенциальный DoS).
    const approxBytes = Math.floor(dataUrl.length * 0.75); // base64 → bytes
    if (approxBytes > 128 * 1024) {
      throw new Error('Skin file too large (>128 KB). Must be PNG 64×64 or 64×32.');
    }
    list[idx] = { ...list[idx], skin: dataUrl, skinModel: model };
    store.saveAccounts(list);
    refreshSkinServer();
    wipeSkinCache();
    return list[idx];
  }));
  ipcMain.handle('accounts:removeSkin', (_e, uuid: string) => withAccountsLock(() => {
    const list = store.loadAccounts();
    const idx = list.findIndex((a) => a.uuid === uuid);
    if (idx < 0) throw new Error('Account not found');
    const { skin, skinModel, ...rest } = list[idx];
    list[idx] = rest;
    store.saveAccounts(list);
    refreshSkinServer();
    wipeSkinCache();
    return list[idx];
  }));
  ipcMain.handle('accounts:pickSkinFile', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Выбери файл скина',
      properties: ['openFile'],
      filters: [{ name: 'PNG-скин', extensions: ['png'] }],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    const filePath = res.filePaths[0];
    try {
      const buf = fs.readFileSync(filePath);
      // Проверяем что это реально PNG (магические байты 89 50 4E 47)
      if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
        throw new Error('File is not a PNG');
      }
      return 'data:image/png;base64,' + buf.toString('base64');
    } catch (e) {
      throw new Error('Failed to read file: ' + (e as Error).message);
    }
  });

  // Сводим существующие установки к одному folder per loader: для каждого
  // лоадера с inheritsFrom впитываем родительскую ваниль и удаляем её папку.
  // Безопасно для тех у кого уже всё «плоское» — flatten идемпотентен.
  //
  // Consolate выполняется ЛАЗНО: при первом запросе данных от renderer-а.
  // Это гарантирует что consolidate отработал ДО того как renderer получит
  // первый ответ (иначе phantom-папки попадают в данные раньше чем удаляются).
  let consolidated = false;
  const ensureConsolidated = () => {
    if (consolidated) return;
    consolidated = true;
    try { mc.consolidateInstalls(); } catch (e) { console.warn('Ignored error:', e); }
    // После очистки orphan-папок шлём событие чтобы renderer обновил счётчики.
    // Без этого sidebar/hero показывают неправильные числа пока не перезайдёт.
    if (!win.isDestroyed()) {
      const details = mc.installedDetailed();
      win.webContents.send('minecraft:manifestUpdated', details);
    }
  };

  ipcMain.handle('minecraft:versions', () => {
    ensureConsolidated();
    return mc.fetchVersions();
  });
  ipcMain.handle('minecraft:installed', () => {
    ensureConsolidated();
    return mc.installedVersionIds();
  });
  ipcMain.handle('minecraft:installedDetailed', () => {
    ensureConsolidated();
    return mc.installedDetailed();
  });
  ipcMain.handle('minecraft:install', async (_e, versionId: string) => {
    assertSafeVersionId(versionId);
    await mc.install(versionId, win);
    if (!win.isDestroyed()) {
      win.webContents.send('minecraft:manifestUpdated', mc.installedDetailed());
    }
    return true;
  });

  // Принудительный consolidate: запускает flatten для всех лоадеров и чистит
  // orphan-папки ванили. Вызывается после установки лоадера, чтобы если до этого
  // криво встали другие лоадеры — их orphaned-ваниль тоже подчистилась.
  ipcMain.handle('minecraft:consolidate', () => {
    try { mc.consolidateInstalls(); } catch (e) { console.warn('Ignored error:', e); }
    if (!win.isDestroyed()) {
      const details = mc.installedDetailed();
      win.webContents.send('minecraft:manifestUpdated', details);
    }
    return mc.installedDetailed();
  });
  // Сбрасывает settings.lastVersionId если он указывает на одну из переданных
  // версий. Это нужно, чтобы после удаления версии главная не показывала
  // удалённую как активную.
  const clearLastVersionIfDeleted = (deletedIds: string[]) => {
    const s = store.loadSettings();
    if (s.lastVersionId && deletedIds.includes(s.lastVersionId)) {
      s.lastVersionId = '';
      store.saveSettings(s);
    }
  };

  ipcMain.handle('minecraft:uninstall', (_e, versionId: string) => {
    assertSafeVersionId(versionId);
    const r = mc.uninstall(versionId);
    clearLastVersionIfDeleted([versionId]);
    if (!win.isDestroyed()) {
      win.webContents.send('minecraft:manifestUpdated', mc.installedDetailed());
    }
    return r;
  });
  ipcMain.handle('minecraft:uninstallDeep', (_e, versionId: string) => {
    assertSafeVersionId(versionId);
    const r = mc.uninstallDeep(versionId);
    clearLastVersionIfDeleted([versionId]);
    if (!win.isDestroyed()) {
      win.webContents.send('minecraft:manifestUpdated', mc.installedDetailed());
    }
    return r;
  });
  ipcMain.handle('minecraft:revertToVanilla', async (_e, baseMc: string) => {
    assertSafeVersionId(baseMc, 'baseMc');
    const result = await mc.revertToVanilla(baseMc, win);
    // Если активной была одна из удалённых модд-версий — переключаем на
    // базовую ваниль (она же только что переустановлена). Если активной была
    // не она вовсе — не трогаем.
    const s = store.loadSettings();
    if (s.lastVersionId && result.removed.includes(s.lastVersionId)) {
      s.lastVersionId = baseMc;
      store.saveSettings(s);
    }
    if (!win.isDestroyed()) {
      win.webContents.send('minecraft:manifestUpdated', mc.installedDetailed());
    }
    // Возвращаем актуальные настройки в renderer чтобы он тоже обновил state.
    return { ...result, settings: store.loadSettings() };
  });
  ipcMain.handle('minecraft:openFolder', (_e, kind: 'game' | 'version', versionId?: string) => {
    if (kind === 'version') {
      assertSafeVersionId(versionId);
    }
    const p = kind === 'version' && versionId ? mc.versionFolder(versionId) : mc.gameFolder();
    shell.openPath(p).catch(() => {});
    return p;
  });
  ipcMain.handle('minecraft:launch', async (_e, opts: LaunchOptions) => {
    assertSafeVersionId(opts?.versionId, 'opts.versionId');
    const s = store.loadSettings();
    return mc.launch(opts, win, s);
  });

  ipcMain.handle('java:list', () => java.list());
  ipcMain.handle('java:scan', () => java.scan());
  ipcMain.handle('java:planFor', async (_e, versionId: string) => {
    try {
      const vers = await mc.fetchVersions();
      const entry = vers.find(v => v.id === versionId);
      if (!entry) return null;
      const axios = (await import('axios')).default;
      const { data } = await axios.get((entry as any).url, { timeout: 15000 });
      let major = data.javaVersion?.majorVersion;
      if (!major && data.inheritsFrom) {
        const parentEntry = vers.find(v => v.id === data.inheritsFrom);
        if (parentEntry) {
          const { data: pd } = await axios.get((parentEntry as any).url, { timeout: 15000 });
          major = pd.javaVersion?.majorVersion;
        }
      }
      if (!major) major = 8;
      const s = store.loadSettings();
      // Validate user override
      if (s.javaPath) {
        const info = await java.inspectExe(s.javaPath);
        if (info && (await import('./java')).JavaService.isCompatible(info.major, major)) {
          return { required: major, plan: 'user', path: s.javaPath, major: info.major, version: info.version };
        }
        // user override incompatible — fall through
      }
      const best = await java.findBest(major);
      if (best) return { required: major, plan: 'reuse', path: best.path, version: best.version, major: best.major, vendor: best.vendor };
      return { required: major, plan: 'download', path: null };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });

  // ---- worlds ----
  ipcMain.handle('worlds:list', () => worlds.list());
  ipcMain.handle('worlds:icon', (_e, name: string) => {
    assertSafeWorldName(name);
    return worlds.iconDataUrl(name);
  });
  ipcMain.handle('worlds:delete', (_e, name: string) => {
    assertSafeWorldName(name);
    return worlds.delete(name);
  });
  ipcMain.handle('worlds:deleteWithBackups', (_e, name: string) => {
    assertSafeWorldName(name);
    return worlds.deleteWithBackups(name);
  });
  ipcMain.handle('worlds:backup', (_e, name: string) => {
    assertSafeWorldName(name);
    return worlds.backup(name);
  });
  ipcMain.handle('worlds:openFolder', (_e, name?: string) => {
    if (!name) {
      shell.openPath(worlds.savesDir()).catch(() => {});
      return worlds.savesDir();
    }
    assertSafeWorldName(name);
    // For synthetic Pre-Classic worlds findWorldPath returns the parent dir;
    // for regular worlds — the world folder itself.
    const resolved = worlds.findWorldPath(name) || path.join(worlds.savesDir(), name);
    shell.openPath(resolved).catch(() => {});
    return resolved;
  });

  // ---- content (mods, shaders, resourcepacks, texturepacks) ----
  const ensureSafeContentVersion = (versionId?: string) => {
    if (versionId !== undefined) assertSafeVersionId(versionId);
  };
  ipcMain.handle('content:list', (_e, kind: ContentKind, versionId?: string) => {
    ensureSafeContentVersion(versionId);
    return content.list(kind, versionId);
  });
  const validateContentName = (name: unknown): string => {
    if (typeof name !== 'string' || name.length === 0 || name.length > 256) throw new Error('Invalid content name');
    if (name.includes('\0') || name.includes('/') || name.includes('\\')) throw new Error('Invalid content name');
    return name;
  };
  ipcMain.handle('content:delete', (_e, kind: ContentKind, name: string, versionId?: string) => {
    ensureSafeContentVersion(versionId);
    return content.delete(kind, validateContentName(name), versionId);
  });
  ipcMain.handle('content:toggle', (_e, kind: ContentKind, name: string, versionId?: string) => {
    ensureSafeContentVersion(versionId);
    return content.toggle(kind, validateContentName(name), versionId);
  });
  ipcMain.handle('content:openFolder', (_e, kind: ContentKind, versionId?: string) => {
    ensureSafeContentVersion(versionId);
    const dir = content.dirFor(kind, versionId);
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir).catch(() => {});
    return dir;
  });
  ipcMain.handle('content:add', async (_e, kind: ContentKind, versionId?: string) => {
    ensureSafeContentVersion(versionId);
    const filters = kind === 'mod'
      ? [{ name: 'Моды (.jar)', extensions: ['jar', 'disabled'] }]
      : [{ name: 'Архивы (.zip)', extensions: ['zip'] }, { name: 'Все файлы', extensions: ['*'] }];
    const res = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters,
    });
    if (res.canceled) return { copied: 0, errors: [] as string[] };
    return content.add(kind, res.filePaths, versionId);
  });

  // ---- launcher reset ----
  ipcMain.handle('reset:perform', (_e, opts: { keepUserData: boolean }) => {
    const result = resetSvc.perform(opts);
    return result;
  });

  // ---- import from other launchers ----
  let importLock = false;
  let importAbortController: AbortController | null = null;
  ipcMain.handle('import:detect', () => {
    return launcherImport.detectSources();
  });
  ipcMain.handle('import:cancel', () => {
    if (importAbortController) { importAbortController.abort(); }
  });
  ipcMain.handle('import:perform', async (_e, plan: launcherImport.ImportPlan) => {
    if (importLock) throw new Error('Import already in progress');
    importLock = true;
    importAbortController = new AbortController();
    try {
    // Validate input
    if (!plan || typeof plan !== 'object') throw new Error('Invalid import plan');
    if (typeof plan.sourceId !== 'string' || plan.sourceId.length === 0 || plan.sourceId.length > 128) throw new Error('Invalid sourceId');
    if (plan.sourceRootDir !== undefined && (typeof plan.sourceRootDir !== 'string' || plan.sourceRootDir.length > 1024)) throw new Error('Invalid sourceRootDir');
    if (!Array.isArray(plan.categories)) throw new Error('Invalid categories');
    const VALID_CATS = new Set(['accounts','worlds','mods','shaderpacks','resourcepacks','texturepacks','servers','screenshots','options','config','datapacks','stats','advancements','logs','scripts','defaultconfigs','backups','local','usercache','world_templates','resources','pin','version-content','pack-meta','assets','libraries','skin-cache','log-configs','version-install']);
    for (const c of plan.categories) { if (!VALID_CATS.has(c)) throw new Error('Unknown category: ' + c); }

    const allSources = launcherImport.detectSources();
    let source = allSources.find((s) => s.id === plan.sourceId);
    if (!source && plan.sourceRootDir) {
      source = launcherImport.detectFromDir(plan.sourceRootDir) ?? undefined;
    }
    if (!source) throw new Error('Source not found: ' + plan.sourceId);
    const gameDir = store.loadSettings().gameDir;
    const addAccount = (name: string): boolean => {
      const list = store.loadAccounts();
      if (list.some((a) => a.name.toLowerCase() === name.toLowerCase())) return false;
      const guest = auth.createGuest(name);
      list.push(guest);
      store.saveAccounts(list);
      return true;
    };
    const installVersion = plan.categories.includes('version-install')
      ? async (versionId: string) => {
          try { mc.ensureContentFolders(versionId); } catch (e) { console.warn('Ignored error:', e); }
          await mc.install(versionId, win);
        }
      : undefined;
    const report = await launcherImport.performImport(plan, source, gameDir, addAccount, installVersion, (curr, total, stage) => {
      if (!win.isDestroyed()) {
        win.webContents.send('import:progress', { current: curr, total, stage });
      }
    }, importAbortController.signal);
    if (report.newAccounts.length > 0) refreshSkinServer();
    return report;
  } finally { importLock = false; importAbortController = null; }
  });
  ipcMain.handle('import:detectCache', (_e, sourceDir: string) => {
    if (typeof sourceDir !== 'string' || sourceDir.length === 0 || sourceDir.length > 1024) throw new Error('Invalid sourceDir');
    return launcherImport.detectCache(sourceDir);
  });
  ipcMain.handle('import:performCache', async (_e, plan: launcherImport.CacheImportPlan) => {
    if (!plan || typeof plan !== 'object') throw new Error('Invalid cache plan');
    if (typeof plan.sourceDir !== 'string' || plan.sourceDir.length === 0 || plan.sourceDir.length > 1024) throw new Error('Invalid sourceDir');
    if (!Array.isArray(plan.categories)) throw new Error('Invalid categories');
    const VALID_CACHE_CATS = new Set(['assets', 'libraries', 'skin-cache', 'versions']);
    for (const c of plan.categories) { if (!VALID_CACHE_CATS.has(c)) throw new Error('Unknown cache category: ' + c); }
    const gameDir = store.loadSettings().gameDir;
    return launcherImport.performCacheImport(plan, gameDir, (curr, total, stage) => {
      if (!win.isDestroyed()) {
        win.webContents.send('import:cacheProgress', { current: curr, total, stage });
      }
    });
  });
  ipcMain.handle('import:detectFromDir', (_e, dir: string) => {
    if (typeof dir !== 'string' || dir.length === 0 || dir.length > 1024) throw new Error('Invalid directory');
    return launcherImport.detectFromDir(dir);
  });

  // ---- launcher uninstall ----
  ipcMain.handle('reset:restart', () => {
    resetSvc.restart();
  });
  ipcMain.handle('reset:uninstallLauncher', (_e, keepUserData: boolean) => {
    return resetSvc.uninstallLauncher({ keepUserData });
  });

  // ---- mod loaders ----
  ipcMain.handle('loaders:list', (_e, loader: 'fabric' | 'quilt' | 'neoforge' | 'forge', mcVersion: string) => {
    assertSafeVersionId(mcVersion, 'mcVersion');
    return mc.loaders.listVersions(loader, mcVersion);
  });
  ipcMain.handle('loaders:install', async (
    _e,
    loader: 'fabric' | 'quilt' | 'neoforge' | 'forge',
    mcVersion: string,
    loaderVersion: string,
  ) => {
    assertSafeVersionId(mcVersion, 'mcVersion');
    assertSafeVersionId(loaderVersion, 'loaderVersion');
    return mc.loaders.install(loader, mcVersion, loaderVersion, win);
  });

  // ---- launcher updater ----
  ipcMain.handle('updater:state', () => updater.getState());
  ipcMain.handle('updater:check', () => updater.check());
  ipcMain.handle('updater:download', () => updater.download());
  ipcMain.handle('updater:install', () => updater.quitAndInstall());

  // ---- servers ----
  ipcMain.handle('servers:list', () => servers.list());
  ipcMain.handle('servers:statuses', () => servers.statuses());
  ipcMain.handle('servers:logBuffer', (_e, id: string) => {
    assertSafeServerId(id);
    return servers.logBuffer(id);
  });
  ipcMain.handle('servers:create', async (_e, input: { name: string; versionId: string; memoryMb: number; properties?: Partial<ServerProperties> }) => {
    assertSafeVersionId(input?.versionId, 'input.versionId');
    return servers.create({
      ...input,
      onProgress: (p) => {
        if (!win.isDestroyed()) win.webContents.send('servers:createProgress', p);
      },
    });
  });
  ipcMain.handle('servers:delete', (_e, id: string) => {
    assertSafeServerId(id);
    servers.delete(id);
  });
  ipcMain.handle('servers:start', (_e, id: string) => {
    assertSafeServerId(id);
    return servers.start(id, win);
  });
  ipcMain.handle('servers:stop', (_e, id: string) => {
    assertSafeServerId(id);
    return servers.stop(id, win);
  });
  ipcMain.handle('servers:sendCommand', (_e, id: string, command: string) => {
    assertSafeServerId(id);
    return servers.sendCommand(id, command);
  });
  ipcMain.handle('servers:setProperties', (_e, id: string, patch: Partial<ServerProperties>) => {
    assertSafeServerId(id);
    return servers.setProperties(id, patch);
  });
  ipcMain.handle('servers:rename', (_e, id: string, name: string) => {
    assertSafeServerId(id);
    return servers.rename(id, name);
  });
  ipcMain.handle('servers:setMemory', (_e, id: string, memoryMb: number) => {
    assertSafeServerId(id);
    return servers.setMemory(id, memoryMb);
  });
  ipcMain.handle('servers:openFolder', (_e, id: string) => {
    assertSafeServerId(id);
    const dir = servers.serverDir(id);
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir).catch(() => {});
    return dir;
  });
  ipcMain.handle('servers:connectAddresses', (_e, id: string) => {
    assertSafeServerId(id);
    return servers.connectAddresses(id);
  });

  // ---- periodic auto-check for Mojang manifest (so new versions appear without restart) ----
  const pushManifestUpdate = async () => {
    try {
      const list = await mc.fetchVersions();
      if (!win.isDestroyed()) win.webContents.send('minecraft:manifestUpdated', list);
    } catch (e) { console.warn('Ignored error:', e); }
  };
  // Smart manifest poller: тикает только когда окно реально видно и в фокусе.
  // Раньше setInterval работал в фоне постоянно — лишний сетевой запрос
  // и работа V8 раз в 30 минут даже если окно свернуто часами.
  let manifestInterval: NodeJS.Timeout | null = null;
  const startManifestPolling = () => {
    if (manifestInterval) return;
    manifestInterval = setInterval(pushManifestUpdate, 30 * 60 * 1000);
  };
  const stopManifestPolling = () => {
    if (!manifestInterval) return;
    clearInterval(manifestInterval);
    manifestInterval = null;
  };
  // Первый запуск чуть отложен — рендерер сам подтянет манифест при mount,
  // повторный запрос сразу при старте лишний.
  setTimeout(() => {
    if (!win.isDestroyed() && win.isVisible() && !win.isMinimized()) startManifestPolling();
  }, 5000);
  win.on('show', startManifestPolling);
  win.on('focus', startManifestPolling);
  win.on('restore', startManifestPolling);
  win.on('hide', stopManifestPolling);
  win.on('minimize', stopManifestPolling);
  win.on('blur', stopManifestPolling);

  // Грациозная остановка ВСЕХ ресурсов при закрытии окна лаунчера.
  // Раньше тут был только servers.shutdownAll(), но висели:
  //   - manifestInterval (засыпал webContents.send в destroyed window)
  //   - skinServer (HTTP-сокет на 127.0.0.1)
  // На macOS окна закрываются и переоткрываются, без cleanup ресурсы
  // накапливались бы между сессиями.
  win.on('close', () => {
    stopManifestPolling();
    try { skinServer.stop(); } catch (e) { console.warn('Ignored error:', e); }
  });

  // Экспортируем shutdownAll для app.on('before-quit') в main.ts,
  // чтобы можно было дождаться завершения серверов перед выходом.
  return {
    shutdownAll: () => servers.shutdownAll(),
  };
}
