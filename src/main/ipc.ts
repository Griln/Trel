
import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron';
import { shell } from 'electron';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { MinecraftService } from './minecraft';
import { parseProxyUrl, applyGlobalProxy, testProxy } from './http-proxy';
import { AuthService } from './auth';
import { SettingsStore } from './settings';
import { JavaService } from './java';
import { WorldService } from './worlds';
import { SnapshotService } from './snapshots';
import { WebdavSync } from './webdav';
import { ResetService } from './reset';
import { ContentService } from './content';
import type { ContentEdition } from './content';
import { ModpackService } from './modpacks';


import type { ModpackVersion } from './modpacks';
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
import { ScreenshotService } from './screenshots';
import { NativeScreenshotService } from './nativeScreenshot';
import { ServerPingService } from './serverping';
import { getAutoLaunch, setAutoLaunch } from './autostart';

const SYSTEM_DENYLIST = new Set([
  'c:\\windows', 'c:\\program files', 'c:\\program files (x86)',
  'c:\\programdata', 'c:\\$recycle.bin', 'c:\\system volume information',
  '/etc', '/usr', '/bin', '/sbin', '/var', '/proc', '/sys', '/dev', '/boot',
]);
// Корень дома (/home, C:\Users) в списке намеренно НЕТ: gameDir всегда внутри
// него. Сам дом и корень диска запрещены отдельно в validateSettings.

function validateSettings(s: any): LauncherSettings {
  if (!s || typeof s !== 'object') throw new Error('Invalid settings');
  // gameDir
  if (typeof s.gameDir !== 'string' || s.gameDir.length === 0 || s.gameDir.length > 1024) throw new Error('Invalid gameDir');
  const resolved = path.resolve(s.gameDir);
  if (resolved.includes('\0')) throw new Error('Invalid gameDir');
  if (resolved.startsWith('\\\\')) throw new Error('Network paths not allowed for gameDir');
  // Симлинк gameDir -> /etc проходил строковую проверку: сверяем реальный путь.
  let realResolved = resolved;
  try { realResolved = fs.realpathSync(resolved); } catch { /* ещё не создана — строкой */ }
  const checkRoots = [resolved, realResolved];
  for (const cand of checkRoots) {
    const lc = cand.toLowerCase();
    for (const denied of SYSTEM_DENYLIST) {
      if (lc === denied || lc.startsWith(denied + path.sep)) throw new Error('System directory not allowed for gameDir');
    }
    // Корень диска, дом и tmp — не место для папки игры (снос/запись мимо).
    if (cand === path.parse(cand).root) throw new Error('Filesystem root not allowed for gameDir');
  }
  const home = os.homedir();
  if (realResolved === home) throw new Error('Home folder itself not allowed for gameDir');
  // javaPath (optional)
  if (s.javaPath !== undefined && s.javaPath !== null && s.javaPath !== '') {
    if (typeof s.javaPath !== 'string' || s.javaPath.length > 1024 || s.javaPath.includes('\0')) throw new Error('Invalid javaPath');
    const lcJava = s.javaPath.toLowerCase();
    if (!lcJava.includes('java')) throw new Error('javaPath does not look like a Java executable');
    // Исполняемый чужой бинарь при следующем запуске: файл обязан существовать
    // и иметь exec-бит. Иначе — либо опечатка, либо подмена на неудаляемый путь.
    try {
      const st = fs.statSync(s.javaPath);
      if (!st.isFile()) throw new Error('javaPath is not a file');
      if (process.platform !== 'win32' && (st.mode & 0o111) === 0) throw new Error('javaPath is not executable');
    } catch (e) {
      if ((e as Error).message.startsWith('javaPath')) throw e;
      throw new Error('javaPath does not exist: ' + s.javaPath);
    }
  }
  // jvmArgs — deny dangerous flags
  if (typeof s.jvmArgs === 'string' && s.jvmArgs.length > 0) {
    const parts = s.jvmArgs.split(/\s+/).filter(Boolean);
    for (const p of parts) {
      if (DANGEROUS_JVM_ARGS.test(p)) throw new Error('Dangerous JVM argument blocked: ' + p);
      // Подмена classpath = подмена всего кода игры сторонним jar.
      if (p === '-cp' || p === '-classpath' || p.startsWith('-Djava.security.') || p.startsWith('-Djdk.')) {
        throw new Error('Dangerous JVM argument blocked: ' + p);
      }
    }
  }
  if (typeof s.proxyUrl === 'string' && s.proxyUrl.length > 0) {
    if (s.proxyUrl.length > 512) throw new Error('proxyUrl too long');
    if (!parseProxyUrl(s.proxyUrl)) throw new Error('Invalid proxyUrl (need http(s)://host:port)');
  }
  // preCommand/postCommand — whitelist safe characters only + явный запрет
  // подстановок, которые whitelist по символам не ловит.
  for (const key of ['preCommand', 'postCommand'] as const) {
    if (typeof s[key] === 'string' && s[key].length > 0) {
      if (s[key].length > 1024) throw new Error(key + ' too long');
      if (!SHELL_WHITELIST.test(s[key])) throw new Error(key + ' contains disallowed shell characters');
      if (s[key].includes('$(') || s[key].includes('`') || s[key].includes('%') || s[key].includes('^')) {
        throw new Error(key + ' contains disallowed substitution');
      }
    }
  }
  if (s.prevGameDir !== undefined && s.prevGameDir !== null && s.prevGameDir !== '') {
    if (typeof s.prevGameDir !== 'string' || s.prevGameDir.length > 1024 || s.prevGameDir.includes('\0')) {
      throw new Error('Invalid prevGameDir');
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
  if (typeof s.autoHideSidebar === 'boolean') clean.autoHideSidebar = s.autoHideSidebar;
  if (typeof s.prevGameDir === 'string' && s.prevGameDir.length > 0) clean.prevGameDir = s.prevGameDir;
  if (typeof s.locale === 'string' && ['ru', 'en'].includes(s.locale)) clean.locale = s.locale as any;
  if (typeof s.showConsole === 'boolean') clean.showConsole = s.showConsole;
  if (typeof s.preCommand === 'string') clean.preCommand = s.preCommand;
  if (typeof s.postCommand === 'string') clean.postCommand = s.postCommand;
  if (typeof s.proxyUrl === 'string' && s.proxyUrl.length > 0) clean.proxyUrl = s.proxyUrl;
  if (typeof s.autoBackup === 'boolean') clean.autoBackup = s.autoBackup;
  if (s.pinnedVersions !== undefined) {
    if (!Array.isArray(s.pinnedVersions)) throw new Error('Invalid pinnedVersions');
    clean.pinnedVersions = s.pinnedVersions.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 128).slice(0, 50);
  }
  if (s.perfPreset === 'potato' || s.perfPreset === 'balanced' || s.perfPreset === 'ultra') clean.perfPreset = s.perfPreset;
  return clean;
}


function classifyTrelEmuSource(root: string): 'downloaded' | 'portable' | 'bundled' | 'dev' | 'unknown' {
  const norm = (x: string) => path.normalize(x).toLowerCase();
  const r = norm(root);
  if (process.env.PORTABLE_EXECUTABLE_FILE && r === norm(path.join(path.dirname(process.env.PORTABLE_EXECUTABLE_FILE), 'trel-emu'))) return 'portable';
  if (process.platform === 'win32' && r === norm(path.join(process.env.APPDATA || os.homedir(), 'Trel', 'trel-emu'))) return 'downloaded';
  if (process.platform === 'darwin' && r === norm(path.join(os.homedir(), 'Library', 'Application Support', 'Trel', 'trel-emu'))) return 'downloaded';
  if (process.platform !== 'win32' && process.platform !== 'darwin' && r === norm(path.join(os.homedir(), '.config', 'Trel', 'trel-emu'))) return 'downloaded';
  if (process.resourcesPath && r === norm(path.join(process.resourcesPath, 'trel-emu'))) return 'bundled';
  if (r === norm(path.join(process.cwd(), 'resources', 'trel-emu'))) return 'dev';
  return 'unknown';
}

export function registerIpc(win: BrowserWindow, launcherDir: string, updater: LauncherUpdater) {
  const store = new SettingsStore(launcherDir);
  const settings = store.loadSettings();
  // Прокси из настроек (или env) — до любых скачиваний этого процесса.
  try {
    applyGlobalProxy(settings.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy);
  } catch { /* ignore */ }
  const java = new JavaService(launcherDir);
  const worlds = new WorldService(settings.gameDir);
  const snapshots = new SnapshotService(launcherDir, settings.gameDir);
  const webdav = new WebdavSync(launcherDir, settings.gameDir);
  // SkinServer и AuthlibInjector — общие между клиентом и серверами.
  // Один mock-сервер обслуживает скины клиента и server-side authlib проверки.
  const skinServer = new SkinServer();
  const authlib = new AuthlibInjector(launcherDir);
  const mc = new MinecraftService(settings.gameDir, java, worlds, launcherDir, skinServer, authlib);
  const resetSvc = new ResetService(launcherDir, settings.gameDir, worlds);
  const content = new ContentService(settings.gameDir);
  const modpacks = new ModpackService(settings.gameDir, mc);
  const auth = new AuthService();
  const servers = new ServerService(launcherDir, settings.gameDir, java, skinServer, authlib, () => store.loadAccounts());
  const screenshots = new ScreenshotService(settings.gameDir);
  const nativeShots = new NativeScreenshotService(() => store.loadSettings().gameDir, () => win, () => mc.hasRunningGame);
  const serverPing = new ServerPingService(settings.gameDir);

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

  // Удаляем пустые папки контента у ванильных версий — наследие старых сборок,
  // которые создавали их при установке. В фоне, не блокируя старт.
  setImmediate(() => { try { mc.cleanupVanillaContentFolders(); } catch {} });

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
      if (process.platform === 'linux') {
        ensureLinuxDesktopShortcut();
        return;
      }
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

  ipcMain.handle('emu:reset', async () => {
    if (mc.trelEmu.downloader.isBusy()) {
      throw new Error('TrelEmu download is running. Cancel it before reset.');
    }

    try { await mc.trelEmu.stop(); } catch (e) { console.warn('[ipc] TrelEmu stop before reset failed:', e); }

    const candidates = new Set<string>();
    const current = mc.trelEmu.find();
    if (current) {
      const source = classifyTrelEmuSource(current.treluEmuRoot);
      // Do not delete bundled app resources from Program Files/app.asar resources.
      if (source === 'downloaded' || source === 'portable' || source === 'dev' || source === 'unknown') {
        candidates.add(current.treluEmuRoot);
      }
    }
    candidates.add(mc.trelEmu.downloader.resolveTargetDir());
    // Compatibility cleanup: an older reset handler used launcherDir/emu.
    candidates.add(path.join(launcherDir, 'emu'));

    const removed: string[] = [];
    const errors: string[] = [];
    for (const dir of candidates) {
      try {
        const resolved = path.resolve(dir);
        if (resolved.includes('\0')) throw new Error('Invalid path');
        if (process.resourcesPath && resolved.toLowerCase().startsWith(path.resolve(process.resourcesPath).toLowerCase() + path.sep)) {
          continue;
        }
        if (fs.existsSync(resolved)) {
          await fsp.rm(resolved, { recursive: true, force: true });
          removed.push(resolved);
        }
      } catch (e) {
        errors.push(`${dir}: ${(e as Error).message}`);
      }
    }
    mc.trelEmu.resetCache();
    return { ok: errors.length === 0, removed, errors };
  });

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
    applyGlobalProxy(clean.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy);
    mc.setGameDir(clean.gameDir);
    worlds.setGameDir(clean.gameDir);
    snapshots.setGameDir(clean.gameDir);
    webdav.setGameDir(clean.gameDir);
    resetSvc.setGameDir(clean.gameDir);
    content.setGameDir(clean.gameDir);
    servers.setGameDir(clean.gameDir);
    modpacks.setGameDir(clean.gameDir);
    screenshots.setGameDir(clean.gameDir);
    serverPing.setGameDir(clean.gameDir);
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
    if (process.platform === 'linux') {
      // XDG_USER_DIRS: используем реально существующий Desktop, fallback на ~/Desktop.
      for (const candidate of [
        process.env.XDG_DESKTOP_DIR,
        path.join(home, 'Desktop'),
      ]) {
        if (candidate && fs.existsSync(candidate)) return candidate;
      }
      return path.join(home, 'Desktop');
    }
    // OneDrive redirects the Desktop folder: e.g. C:\Users\...\OneDrive\Desktop
    for (const candidate of [
      path.join(home, 'OneDrive', 'Desktop'),
      path.join(home, 'Desktop'),
    ]) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return path.join(home, 'Desktop');
  }

  /** Linux: содержимое .desktop-файла для ярлыка Trel. */
  function linuxDesktopFileContent(exePath: string, iconPath: string): string {
    return [
      '[Desktop Entry]',
      'Version=1.0',
      'Type=Application',
      'Name=Trel',
      'Comment=Trel — launcher for Minecraft',
      `Exec=${exePath} %U`,
      `Icon=${iconPath}`,
      'Terminal=false',
      'Categories=Game;',
      'StartupWMClass=Trel',
      'MimeType=x-scheme-handler/trel;',
      '',
    ].join('\n');
  }

  /** Linux: путь к иконке Trel. Prefer shared из /usr/share/pixmaps при системной установке, fallback на bundled icon.png рядом с бинарником. */
  function linuxIconPath(): string {
    const exe = process.execPath;
    const exeDir = path.dirname(exe);
    // AppImage: иконка лежит рядом (resources/build/icon.png) или в /usr/share/pixmaps.
    const candidates = [
      '/usr/share/pixmaps/trel.png',
      '/usr/share/icons/hicolor/256x256/apps/trel.png',
      path.join(exeDir, 'resources', 'build', 'icon.png'),
      path.join(exeDir, 'icon.png'),
    ];
    for (const c of candidates) if (fs.existsSync(c)) return c;
    // fallback — ResourcePath/pixmaps-like layout
    return '/usr/share/pixmaps/trel.png';
  }

  /** Linux: создаёт/обновляет .desktop-ярлык на рабочем столе, если его ещё нет или он битый. */
  function ensureLinuxDesktopShortcut(): void {
    try {
      const desktop = desktopPath();
      const desktopFile = path.join(desktop, 'trel.desktop');
      const exePath = process.execPath;
      const iconPath = linuxIconPath();
      const content = linuxDesktopFileContent(exePath, iconPath);
      // Если файл существует и валиден (Exec ведёт на существующий бинарник) — не трогаем.
      if (fs.existsSync(desktopFile)) {
        try {
          const existing = fs.readFileSync(desktopFile, 'utf-8');
          const execMatch = /^Exec=(\S+)/m.exec(existing);
          if (execMatch && fs.existsSync(execMatch[1])) return;
        } catch {}
      }
      try { fs.mkdirSync(desktop, { recursive: true }); } catch {}
      fs.writeFileSync(desktopFile, content, { mode: 0o755 });
      try { fs.chmodSync(desktopFile, 0o755); } catch {}
    } catch (e) {
      console.error('[ipc] ensureLinuxDesktopShortcut failed:', e);
    }
  }

  ipcMain.handle('settings:desktopShortcutExists', () => {
    if (process.platform === 'linux') {
      const desktopFile = path.join(desktopPath(), 'trel.desktop');
      if (!fs.existsSync(desktopFile)) return false;
      try {
        const content = fs.readFileSync(desktopFile, 'utf-8');
        const execMatch = /^Exec=(\S+)/m.exec(content);
        return !!(execMatch && execMatch[1] && fs.existsSync(execMatch[1]));
      } catch { return false; }
    }
    const linkPath = path.join(desktopPath(), 'Trel.lnk');
    if (!fs.existsSync(linkPath)) return false;
    try {
      const meta = shell.readShortcutLink(linkPath);
      return !!(meta.target && fs.existsSync(meta.target));
    } catch { return false; }
  });
  ipcMain.handle('settings:createDesktopShortcut', () => {
    try {
      if (process.platform === 'linux') {
        ensureLinuxDesktopShortcut();
        return fs.existsSync(path.join(desktopPath(), 'trel.desktop'));
      }
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
      if (process.platform === 'linux') {
        const desktopFile = path.join(desktopPath(), 'trel.desktop');
        if (fs.existsSync(desktopFile)) fs.unlinkSync(desktopFile);
        return true;
      }
      const desktop = desktopPath();
      const linkPath = path.join(desktop, 'Trel.lnk');
      if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath);
      return true;
    } catch { return false; }
  });

  // ─── Auto-launch at system startup ──────────────────────────────────
  // Linux: .desktop в ~/.config/autostart/, Windows: .lnk в Startup-папке,
  // macOS: нативный LoginItems через app.setLoginItemSettings. См. autostart.ts.
  ipcMain.handle('settings:autoLaunchGet', () => getAutoLaunch());
  ipcMain.handle('settings:autoLaunchSet', (_e, enabled: boolean) => setAutoLaunch(!!enabled));

    // ─── Move game directory ────────────────────────────────────────────
  /** Execute a PowerShell script safely via spawnSync with separate arguments. Win-only. */
  function runPowerShellScript(script: string, args: string[], timeout = 5000): string {
    if (process.platform !== 'win32') return '';
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

  // ─── Bedrock ─────────────────────────────────────────────────────────

  ipcMain.handle('bedrock:versions', () => mc.fetchBedrockVersions());
  ipcMain.handle('bedrock:installed', () => mc.installedBedrockIds());
  ipcMain.handle('bedrock:install', async (_e, versionId: string) => {
    assertSafeVersionId(versionId);
    await mc.installBedrock(versionId, win);
    return true;
  });
  ipcMain.handle('bedrock:uninstall', (_e, versionId: string) => {
    assertSafeVersionId(versionId);
    return mc.uninstallBedrock(versionId);
  });
  ipcMain.handle('bedrock:launch', async (_e, versionId: string, serial: string) => {
    assertSafeVersionId(versionId);
    // Пустой serial — это сигнал "запусти через TrelEmu (bundled, auto-start)".
    // Внешний ADB-серийник (USB/scrcpy) должен соответствовать строгому формату.
    if (serial && (typeof serial !== 'string' || serial.length > 256 || !/^[a-zA-Z0-9._:-]+$/.test(serial))) {
      throw new Error('Invalid device serial');
    }
    return mc.launchBedrock(versionId, serial ?? '', win);
  });
  ipcMain.handle('bedrock:openFolder', (_e, versionId: string) => {
    assertSafeVersionId(versionId);
    const p = path.join(mc.bedrock.versionDir(versionId));
    shell.openPath(p).catch(() => {});
    return p;
  });
  ipcMain.handle('bedrock:devices', () => {
    return mc.listAdbDevices();
  });
  ipcMain.handle('bedrock:genymotionInstalled', () => false);
  ipcMain.handle('bedrock:genymotionVms', () => []);
  ipcMain.handle('bedrock:genymotionStart', async () => {
    throw new Error('Бэкенд Bedrock не настроен');
  });
  ipcMain.handle('bedrock:genymotionSelectedVm', () => null);
  ipcMain.handle('bedrock:genymotionDownloadAndInstall', async () => {
    throw new Error('Автоустановка отключена');
  });
  ipcMain.handle('bedrock:cancelDownload', () => { mc.bedrock.cancelCurrentDownload(); return true; });
  ipcMain.handle('bedrock:cancelGenymotionStart', () => false);

  // ─── TrelEmu (bundled Android-x86 + QEMU TCG) ─────────────────────────
  // Приоритетный бэкенд для Bedrock: всегда с собой, ничего не надо ставить.
  // `info` отдаёт qemuExe/imagePath/port — UI использует чтобы показать
  // "bundled emulator готов" либо "не входит в бандл этой сборки".
  ipcMain.handle('bedrock:trelEmuInfo', () => {
    const i = mc.trelEmu.find();
    if (!i) {
      return {
        found: false,
        // Скажет UI куда положится TrelEmu после скачивания — чтобы пользователь
        // понимал куда уйдёт 1 ГБ.
        targetDir: mc.trelEmu.downloader.resolveTargetDir(),
        downloaderBusy: mc.trelEmu.downloader.isBusy(),
      };
    }
    // hasSnapshot — есть ли в overlay готовый snapshot для мгновенной загрузки.
    return {
      found: true,
      qemuExe: i.qemuExe,
      imagePath: i.imagePath,
      adbPort: i.adbPort,
      memoryMb: i.memoryMb,
      cpuCores: i.cpuCores,
      hasSnapshot: mc.trelEmu.hasReadySnapshot(i.overlayPath),
      source: classifyTrelEmuSource(i.treluEmuRoot),
      root: i.treluEmuRoot,
    };
  });
  ipcMain.handle('bedrock:trelEmuStatus', () => mc.trelEmu.isRunning());
  ipcMain.handle('bedrock:trelEmuStart', async () => {
    try {
      const serial = await mc.trelEmu.start();
      return { serial, running: true };
    } catch (e) {
      const message = (e as Error).message || String(e);
      // Some Android/ADB preparation commands can timeout while QEMU keeps
      // booting successfully. Do not surface those transient 8000ms messages
      // as a red user-facing launcher error if TrelEmu is already reachable.
      if (/timeout|timed out|exceeded/i.test(message)) {
        try {
          if (await mc.trelEmu.isRunning()) return { serial: '127.0.0.1:5555', running: true, warning: message };
        } catch {}
      }
      throw e;
    }
  });
  ipcMain.handle('bedrock:trelEmuStop', () => {
    mc.trelEmu.stop();
    return { running: false };
  });

  // In-app скачивание TrelEmu pack. URL и SHA1 можно переопределить
  // параметрами (для тестов / зеркал).
  ipcMain.handle('bedrock:trelEmuDownload', async (_e, url?: string, sha1?: string) => {
    if (typeof url === 'string' && url.length > 0) {
      if (url.length > 1024 || !/^https?:\/\//i.test(url)) throw new Error('Invalid download URL');
    }
    if (typeof sha1 === 'string' && sha1.length > 0) {
      if (sha1.length > 64 || !/^[0-9a-f]+$/i.test(sha1)) throw new Error('Invalid SHA1');
    }
    if (mc.trelEmu.downloader.isBusy()) throw new Error('TrelEmu: загрузка уже выполняется');
    // Подписываемся один раз — эмитим прогресс в renderer.
    const onProgress = (p: any) => {
      if (!win.isDestroyed()) win.webContents.send('trelEmu:downloadProgress', p);
    };
    mc.trelEmu.downloader.on('progress', onProgress);
    try {
      const target = await mc.trelEmu.downloader.downloadAndInstall(url, sha1);
      return { ok: true, target };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    } finally {
      mc.trelEmu.downloader.off('progress', onProgress);
    }
  });
  ipcMain.handle('bedrock:trelEmuDownloadCancel', () => {
    mc.trelEmu.downloader.cancel();
    return { cancelled: true };
  });
  ipcMain.handle('bedrock:trelEmuDownloadState', () => {
    return {
      state: mc.trelEmu.downloader.getState(),
      targetDir: mc.trelEmu.downloader.resolveTargetDir(),
    };
  });

  ipcMain.handle('java:list', () => java.list());
  ipcMain.handle('java:scan', () => java.scan());
  ipcMain.handle('java:planFor', async (_e, versionId: string) => {
    try {
      const gameDir = store.loadSettings().gameDir;
      const { requiredJavaMajorForVersion } = await import('./loaders');
      // Локальный json/эвристика — мгновенно и без сети. В манифест ходим
      // только если версии нет на диске (каталог) и локально версий нет.
      let major = requiredJavaMajorForVersion(gameDir, versionId);
      let hasLocal = false;
      try {
        hasLocal = fs.existsSync(path.join(gameDir, 'versions', versionId, versionId + '.json'));
      } catch { /* ignore */ }
      if (!hasLocal) {
        try {
          const vers = await mc.fetchVersions();
          const entry = vers.find(v => v.id === versionId);
          if (entry) {
            const axios = (await import('axios')).default;
            const { data } = await axios.get((entry as any).url, { timeout: 15000 });
            if (data.javaVersion?.majorVersion) major = data.javaVersion.majorVersion;
          }
        } catch { /* сеть необязательна — остаётся эвристика */ }
      }
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

  // ---- worlds: backups (restore) ----
  ipcMain.handle('worlds:listBackups', () => worlds.listBackups());
  ipcMain.handle('worlds:restore', (_e, backupFile: string) => worlds.restore(backupFile));
  ipcMain.handle('worlds:openBackupsFolder', () => {
    const dir = path.join(store.loadSettings().gameDir, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
    return dir;
  });

  // ---- screenshots gallery ----
  ipcMain.handle('screenshots:list', () => screenshots.list());
  ipcMain.handle('screenshots:read', (_e, p: string) => screenshots.read(p));
  ipcMain.handle('screenshots:delete', (_e, p: string) => screenshots.delete(p));
  ipcMain.handle('screenshots:reveal', (_e, p: string) => screenshots.reveal(p));
  ipcMain.handle('screenshots:openFolder', () => screenshots.openFolder());
  ipcMain.handle('screenshots:copy', (_e, p: string) => screenshots.copy(p));
  ipcMain.handle('screenshots:setHotkey', (_e, key: string) => {
    if (typeof key !== 'string' || key.length === 0 || key.length > 12) throw new Error('Invalid key');
    // Trel's own global capturer — independent from Minecraft's F2.
    const res = nativeShots.setHotkey(key);
    return res;
  });
  ipcMain.handle('screenshots:capture', () => nativeShots.capture());

  // ---- server monitoring ----
  ipcMain.handle('servers:saved', () => serverPing.listServers());
  ipcMain.handle('servers:ping', (_e, ip: string) => serverPing.ping(ip));
  ipcMain.handle('servers:publishWorld', async (_e, worldName: string, versionId: string) => {
    if (typeof worldName !== 'string' || worldName.length === 0 || worldName.length > 200) throw new Error('Invalid world');
    if (typeof versionId !== 'string' || versionId.length === 0 || versionId.length > 128) throw new Error('Invalid version');
    if (mc.hasRunningGame) throw new Error('Закройте Minecraft перед публикацией мира');
    const dir = worlds.findWorldPath(worldName);
    if (!dir) throw new Error('World not found: ' + worldName);
    const inst = await servers.publishWorld(dir, worldName, versionId, store.loadSettings().memoryMb ?? 2048);
    let addresses: Array<{ label: string; host: string; port: number }> = [];
    try { addresses = servers.connectAddresses(inst.id); } catch { /* ignore */ }
    return { instance: inst, addresses };
  });

  // ---- playtime stats ----
  ipcMain.handle('stats:playtime', () => mc.getPlaytimeStats());

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


  // ---- diagnostics / repair / logs ----
  type ToolCheck = { id: string; label: string; ok: boolean; level: 'ok' | 'warn' | 'error'; details: string; action?: string };
  const makeCheck = (id: string, label: string, ok: boolean, details: string, level?: 'ok' | 'warn' | 'error', action?: string): ToolCheck => ({
    id, label, ok, details, level: level ?? (ok ? 'ok' : 'warn'), action,
  });

  ipcMain.handle('tools:diagnostics', async () => {
    const checks: ToolCheck[] = [];
    const s = store.loadSettings();
    const trel = mc.trelEmu.find();
    const trelRunning = await mc.trelEmu.isRunning().catch(() => false);
    let devices: any[] = [];
    try { devices = mc.listAdbDevices(); } catch { devices = []; }
    const bedrockInstalled = mc.installedBedrockIds();
    const javaInstalled = mc.installedDetailed().filter((v) => v.edition === 'java');
    const adbDevices = devices.filter((d: any) => d.state === 'device');

    checks.push(makeCheck('gameDir', 'Папка игры', fs.existsSync(s.gameDir), s.gameDir, fs.existsSync(s.gameDir) ? 'ok' : 'error', 'Проверь gameDir в настройках'));
    checks.push(makeCheck('javaVersions', 'Java-версии', javaInstalled.length > 0, `Найдено: ${javaInstalled.length}`, javaInstalled.length > 0 ? 'ok' : 'warn', 'Установи Java-версию во вкладке Версии'));
    checks.push(makeCheck('bedrockApk', 'Bedrock APK', bedrockInstalled.length > 0, `Установлено Bedrock-версий: ${bedrockInstalled.length}`, bedrockInstalled.length > 0 ? 'ok' : 'warn', 'Установи Bedrock во вкладке Версии'));
    checks.push(makeCheck('trelEmu', 'TrelEmu', !!trel, trel ? `${classifyTrelEmuSource(trel.treluEmuRoot)}: ${trel.treluEmuRoot}` : `Не найден, будет скачан в ${mc.trelEmu.downloader.resolveTargetDir()}`, trel ? 'ok' : 'warn', 'Скачай TrelEmu или нажми сброс/скачивание Bedrock'));
    checks.push(makeCheck('trelRunning', 'TrelEmu запущен', trelRunning, trelRunning ? 'Эмулятор отвечает' : 'Эмулятор сейчас не запущен', trelRunning ? 'ok' : 'warn', 'Запусти Bedrock или TrelEmu'));
    checks.push(makeCheck('adb', 'ADB устройство', adbDevices.length > 0, adbDevices.length > 0 ? adbDevices.map((d: any) => `${d.serial} (${d.state})`).join(', ') : 'ADB не видит Android-устройство', adbDevices.length > 0 ? 'ok' : 'warn', 'Перезапусти TrelEmu или ADB'));
    if (process.platform === 'win32') {
      let virt = 'Не удалось проверить';
      try { virt = execSync('systeminfo', { encoding: 'utf8', timeout: 15000 }).split(/\r?\n/).filter((l) => /Hyper-V|Virtualization|виртуал/i.test(l)).slice(-6).join('\n') || virt; } catch {}
      checks.push(makeCheck('virtualization', 'Виртуализация Windows', true, virt, 'ok'));
    }
    return { generatedAt: new Date().toISOString(), checks };
  });

  ipcMain.handle('tools:integrityCheck', async (_e, versionId: string) => {
    assertSafeVersionId(versionId);
    const issues: string[] = [];
    const repaired: string[] = [];
    const details = mc.installedDetailed().find((v) => v.id === versionId);
    if (!details) return { ok: false, issues: ['Версия не установлена'], repaired };
    if (details.edition === 'bedrock') {
      const apk = mc.bedrock.apkPath(versionId);
      if (!fs.existsSync(apk)) issues.push('Bedrock APK отсутствует');
      else if (fs.statSync(apk).size < 10 * 1024 * 1024) issues.push('Bedrock APK слишком маленький или повреждён');
      if (!mc.trelEmu.find()) issues.push('TrelEmu не найден');
      return { ok: issues.length === 0, issues, repaired, edition: 'bedrock' };
    }
    const activeSettings = store.loadSettings();
    const vDir = path.join(activeSettings.gameDir, 'versions', versionId);
    const jsonPath = path.join(vDir, `${versionId}.json`);
    const jarPath = path.join(vDir, `${versionId}.jar`);
    if (!fs.existsSync(jsonPath)) issues.push('version.json отсутствует');
    if (!fs.existsSync(jarPath)) issues.push('client jar отсутствует');
    if (fs.existsSync(jsonPath)) {
      try {
        const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        for (const lib of json.libraries || []) {
          const rel = lib?.downloads?.artifact?.path;
          if (rel && !fs.existsSync(path.join(activeSettings.gameDir, 'libraries', rel))) issues.push(`Библиотека отсутствует: ${rel}`);
        }
        const assetIndex = json?.assetIndex?.id;
        if (assetIndex && !fs.existsSync(path.join(activeSettings.gameDir, 'assets', 'indexes', `${assetIndex}.json`))) issues.push(`Asset index отсутствует: ${assetIndex}`);
      } catch (e) { issues.push(`version.json повреждён: ${(e as Error).message}`); }
    }
    if (issues.length > 0) {
      try { await mc.install(versionId, win); repaired.push('Запущена переустановка/докачка версии'); } catch (e) { issues.push(`Автодокачка не удалась: ${(e as Error).message}`); }
    }
    return { ok: issues.length === 0, issues, repaired, edition: 'java' };
  });

  const logCandidates = () => {
    const out = [
      path.join(launcherDir, 'crash.log'),
      path.join(process.cwd(), 'crash.log'),
      path.join(app.getPath('userData'), 'crash.log'),
      path.join(app.getPath('userData'), 'logs'),
      path.join(store.loadSettings().gameDir, 'logs'),
    ];
    return out;
  };
  ipcMain.handle('tools:logsList', () => {
    const files: Array<{ name: string; path: string; size: number; mtime: number }> = [];
    for (const candidate of logCandidates()) {
      try {
        if (!fs.existsSync(candidate)) continue;
        const st = fs.statSync(candidate);
        const list = st.isDirectory() ? fs.readdirSync(candidate).map((f) => path.join(candidate, f)) : [candidate];
        for (const f of list) {
          try {
            const s = fs.statSync(f);
            if (s.isFile() && s.size < 10 * 1024 * 1024) files.push({ name: path.basename(f), path: f, size: s.size, mtime: s.mtimeMs });
          } catch {}
        }
      } catch {}
    }
    return files.sort((a, b) => b.mtime - a.mtime).slice(0, 40);
  });
  ipcMain.handle('tools:logRead', (_e, file: string) => {
    const resolved = path.resolve(file);
    const allowed = logCandidates().some((c) => isInsideDir(resolved, fs.existsSync(c) && fs.statSync(c).isDirectory() ? c : path.dirname(c)));
    if (!allowed) throw new Error('Log path is not allowed');
    return fs.readFileSync(resolved, 'utf8').slice(-120000);
  });
  ipcMain.handle('tools:copyReport', async () => {
    const reportDir = path.join(app.getPath('userData'), 'reports');
    fs.mkdirSync(reportDir, { recursive: true });
    const file = path.join(reportDir, `trel-report-${Date.now()}.txt`);
    const versions = mc.installedDetailed().map((v) => ({ id: v.id, edition: v.edition, loader: v.loader ?? null }));
    const content = [`Trel diagnostic report`, `Date: ${new Date().toISOString()}`, `Installed versions: ${JSON.stringify(versions, null, 2)}`].join('\n\n');
    fs.writeFileSync(file, content, 'utf8');
    shell.showItemInFolder(file);
    return file;
  });


  // ---- content (Java mods/shaders/resourcepacks and Bedrock packs/worlds) ----
  const ensureSafeContentVersion = (versionId?: string) => {
    if (versionId !== undefined) assertSafeVersionId(versionId);
  };
  const ensureContentEdition = (edition?: ContentEdition): ContentEdition => {
    if (edition === undefined) return 'java';
    if (edition !== 'java' && edition !== 'bedrock') throw new Error('Invalid content edition');
    return edition;
  };
  ipcMain.handle('content:checkModUpdates', async (_e, versionId: string, gameVersion: string, loaders: string[]) => {
    if (typeof versionId !== 'string' || versionId.length === 0 || versionId.length > 128) throw new Error('Invalid versionId');
    if (typeof gameVersion !== 'string' || gameVersion.length === 0 || gameVersion.length > 32) throw new Error('Invalid gameVersion');
    if (!Array.isArray(loaders) || loaders.length > 5) throw new Error('Invalid loaders');
    return content.checkModUpdates(versionId, gameVersion, loaders.filter((l): l is string => typeof l === 'string'));
  });
  ipcMain.handle('content:modProfiles', (_e, versionId: string) => {
    if (typeof versionId !== 'string' || versionId.length === 0 || versionId.length > 128) throw new Error('Invalid versionId');
    return content.listModProfiles(versionId);
  });
  ipcMain.handle('content:modProfileSave', (_e, versionId: string, name: string) => {
    if (typeof versionId !== 'string' || versionId.length === 0 || versionId.length > 128) throw new Error('Invalid versionId');
    if (typeof name !== 'string' || name.length === 0 || name.length > 64) throw new Error('Invalid name');
    return content.saveModProfile(versionId, name);
  });
  ipcMain.handle('content:modProfileDelete', (_e, versionId: string, name: string) => {
    if (typeof versionId !== 'string' || versionId.length === 0 || versionId.length > 128) throw new Error('Invalid versionId');
    if (typeof name !== 'string' || name.length === 0 || name.length > 64) throw new Error('Invalid name');
    return content.deleteModProfile(versionId, name);
  });
  ipcMain.handle('content:modProfileApply', (_e, versionId: string, name: string) => {
    if (typeof versionId !== 'string' || versionId.length === 0 || versionId.length > 128) throw new Error('Invalid versionId');
    if (typeof name !== 'string' || name.length === 0 || name.length > 64) throw new Error('Invalid name');
    return content.applyModProfile(versionId, name);
  });
  ipcMain.handle('content:updateMod', async (_e, versionId: string, fileName: string, url: string) => {
    if (typeof versionId !== 'string' || versionId.length === 0 || versionId.length > 128) throw new Error('Invalid versionId');
    if (typeof fileName !== 'string' || fileName.length === 0 || fileName.length > 256) throw new Error('Invalid fileName');
    if (typeof url !== 'string' || url.length === 0 || url.length > 2048) throw new Error('Invalid url');
    return content.updateMod(versionId, fileName, url);
  });
  ipcMain.handle('content:list', (_e, kind: ContentKind, versionId?: string, edition?: ContentEdition) => {
    ensureSafeContentVersion(versionId);
    return content.list(kind, versionId, ensureContentEdition(edition));
  });
  const validateContentName = (name: unknown): string => {
    if (typeof name !== 'string' || name.length === 0 || name.length > 256) throw new Error('Invalid content name');
    if (name.includes('\0') || name.includes('/') || name.includes('\\')) throw new Error('Invalid content name');
    return name;
  };
  ipcMain.handle('content:delete', (_e, kind: ContentKind, name: string, versionId?: string, edition?: ContentEdition) => {
    ensureSafeContentVersion(versionId);
    return content.delete(kind, validateContentName(name), versionId, ensureContentEdition(edition));
  });
  ipcMain.handle('content:toggle', (_e, kind: ContentKind, name: string, versionId?: string, edition?: ContentEdition) => {
    ensureSafeContentVersion(versionId);
    return content.toggle(kind, validateContentName(name), versionId, ensureContentEdition(edition));
  });
  ipcMain.handle('content:openFolder', (_e, kind: ContentKind, versionId?: string, edition?: ContentEdition) => {
    ensureSafeContentVersion(versionId);
    const resolvedEdition = ensureContentEdition(edition);
    const dir = content.dirFor(kind, versionId, resolvedEdition);
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir).catch(() => {});
    return dir;
  });

  ipcMain.handle('content:installToBedrock', async (_e, kind: ContentKind, name: string, versionId?: string, serial?: string) => {
    ensureSafeContentVersion(versionId);
    const safeName = validateContentName(name);
    const dir = content.dirFor(kind, versionId, 'bedrock');
    const full = path.join(dir, safeName);
    if (!isInsideDir(full, dir) || !fs.existsSync(full)) throw new Error('Bedrock-контент не найден');
    return mc.installBedrockContentToAndroid(kind, full, serial, win);
  });

  ipcMain.handle('content:add', async (_e, kind: ContentKind, versionId?: string, edition?: ContentEdition) => {
    ensureSafeContentVersion(versionId);
    const resolvedEdition = ensureContentEdition(edition);
    const filters = resolvedEdition === 'bedrock'
      ? (kind === 'texturepack'
        ? [{ name: 'Bedrock worlds (.mcworld/.mctemplate/.zip)', extensions: ['mcworld', 'mctemplate', 'zip'] }]
        : [{ name: 'Bedrock packs (.mcpack/.mcaddon/.zip)', extensions: ['mcpack', 'mcaddon', 'zip'] }])
      : (kind === 'mod'
        ? [{ name: 'Моды (.jar)', extensions: ['jar', 'disabled'] }]
        : [{ name: 'Архивы (.zip)', extensions: ['zip'] }, { name: 'Все файлы', extensions: ['*'] }]);
    const res = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters,
    });
    if (res.canceled) return { copied: 0, errors: [] as string[] };
    return content.add(kind, res.filePaths, versionId, resolvedEdition);
  });

  // ---- launcher reset ----
  ipcMain.handle('reset:perform', (_e, opts: { keepUserData: boolean }) => {
    const result = resetSvc.perform(opts);
    return result;
  });

  // ---- import from other launchers ----
  let importLock = false;
  let importAbortController: AbortController | null = null;
  /** Троттлинг прогресса в окно: флуд по каждому мелкому файлу вешал рендер. */
  function throttledProgress(intervalMs = 100) {
    let last = 0;
    let pending: unknown[] | null = null;
    let timer: NodeJS.Timeout | null = null;
    const flush = () => {
      timer = null;
      if (pending && !win.isDestroyed()) win.webContents.send('import:progress', ...(pending as [unknown]));
      pending = null;
    };
    return (payload: Record<string, unknown>) => {
      pending = [payload];
      const now = Date.now();
      if (now - last >= intervalMs) {
        last = now;
        if (timer) { clearTimeout(timer); timer = null; }
        if (!win.isDestroyed()) win.webContents.send('import:progress', payload);
        pending = null;
      } else if (!timer) {
        timer = setTimeout(() => { last = Date.now(); flush(); }, intervalMs - (now - last));
      }
    };
  }
  ipcMain.handle('import:detect', () => {
    // Скан в воркере: обход папок всех лаунчеров синхронными fs-вызовами
    // подвешивал окно на несколько секунд. При сбое воркера — синхронно.
    return launcherImport.detectSourcesAsync(store.loadSettings().gameDir);
  });
  ipcMain.handle('import:cancel', () => {
    if (importAbortController) { importAbortController.abort(); }
  });
  ipcMain.handle('import:preview', async (_e, plan: launcherImport.ImportPlan) => {
    // Только валидация и отчёт — копирование не запускается.
    if (!plan || typeof plan !== 'object') throw new Error('Invalid import plan');
    if (typeof plan.sourceId !== 'string' || plan.sourceId.length === 0 || plan.sourceId.length > 128) throw new Error('Invalid sourceId');
    if (plan.sourceRootDir !== undefined && (typeof plan.sourceRootDir !== 'string' || plan.sourceRootDir.length > 1024)) throw new Error('Invalid sourceRootDir');
    if (!Array.isArray(plan.categories)) throw new Error('Invalid categories');
    const gameDir = store.loadSettings().gameDir;
    const allSources = await launcherImport.detectSourcesAsync(gameDir);
    let source = allSources.find((s) => s.id === plan.sourceId);
    if (!source && plan.sourceRootDir) {
      source = launcherImport.detectFromDir(plan.sourceRootDir) ?? undefined;
    }
    if (!source) throw new Error('Source not found: ' + plan.sourceId);
    return launcherImport.previewImport(plan, source, gameDir);
  });
  const VALID_CATS = new Set(['accounts','worlds','mods','shaderpacks','resourcepacks','texturepacks','servers','screenshots','options','config','datapacks','stats','advancements','logs','scripts','defaultconfigs','backups','local','usercache','world_templates','resources','pin','version-content','pack-meta','assets','libraries','skin-cache','log-configs','version-install','schematics','replays','minimap','coremods','openloader','debug','behaviorpacks','skinpacks']);
  function validatePlan(plan: launcherImport.ImportPlan): void {
    if (!plan || typeof plan !== 'object') throw new Error('Invalid import plan');
    if (typeof plan.sourceId !== 'string' || plan.sourceId.length === 0 || plan.sourceId.length > 128) throw new Error('Invalid sourceId');
    if (plan.sourceRootDir !== undefined && (typeof plan.sourceRootDir !== 'string' || plan.sourceRootDir.length > 1024)) throw new Error('Invalid sourceRootDir');
    if (plan.sourceRootDir) {
      // Источник обязан жить внутри дома юзера или tmp (архивы): корень диска
      // или системные пути через .. не принимаем даже от своего UI.
      const resolved = path.resolve(plan.sourceRootDir);
      const home = os.homedir();
      const under = (p: string, base: string) => p === base || p.startsWith(base + path.sep);
      if (!under(resolved, home) && !under(resolved, os.tmpdir())) throw new Error('Source directory is outside your home folder');
    }
    if (plan.cleanupDir !== undefined) {
      // Удаляем только свою распаковку в tmp — и только её.
      if (typeof plan.cleanupDir !== 'string') throw new Error('Invalid cleanupDir');
      const resolved = path.resolve(plan.cleanupDir);
      if (!resolved.startsWith(os.tmpdir() + path.sep) || !path.basename(resolved).startsWith('trel-pack-')) {
        throw new Error('Invalid cleanupDir');
      }
    }
    if (!Array.isArray(plan.categories)) throw new Error('Invalid categories');
    for (const c of plan.categories) { if (!VALID_CATS.has(c)) throw new Error('Unknown category: ' + c); }
    if (plan.useHardlinks !== undefined && typeof plan.useHardlinks !== 'boolean') throw new Error('Invalid useHardlinks');
    if (plan.deduplicate !== undefined && typeof plan.deduplicate !== 'boolean') throw new Error('Invalid deduplicate');
    for (const f of ['skipSecrets', 'moveSource', 'archiveWorlds'] as const) {
      if (plan[f] !== undefined && typeof plan[f] !== 'boolean') throw new Error('Invalid ' + f);
    }
  }
  async function resolveSource(plan: launcherImport.ImportPlan) {
    const allSources = await launcherImport.detectSourcesAsync(store.loadSettings().gameDir);
    let source = allSources.find((s) => s.id === plan.sourceId);
    if (!source && plan.sourceRootDir) {
      source = launcherImport.detectFromDir(plan.sourceRootDir) ?? undefined;
    }
    if (!source) throw new Error('Source not found: ' + plan.sourceId);
    // Выгруженный .zip: распаковываем в tmp (zip-slip защита внутри),
    // дальше — обычный импорт из папки; tmp чистится через cleanupDir.
    if (source.isArchive) {
      const { extractPackArchive } = await import('./import-ops');
      const pack = await extractPackArchive(source.rootDir);
      const inner = launcherImport.detectFromDir(pack.rootDir);
      if (!inner) throw new Error('No game data found in archive: ' + source.rootDir);
      plan.cleanupDir = pack.tmpDir;
      return { ...inner, id: source.id, label: `${pack.packName} (archive)` };
    }
    return source;
  }
  ipcMain.handle('import:perform', async (_e, plan: launcherImport.ImportPlan) => {
    if (importLock) throw new Error('Import already in progress');
    importLock = true;
    importAbortController = new AbortController();
    try {
    validatePlan(plan);
    // Запущенная игра держит options.txt/config открытыми и при выходе
    // перезапишет их своими значениями — перенос молча пропал бы. На Windows
    // добавились бы ещё и [LOCKED]-ошибки на занятых файлах.
    if (mc.hasRunningGame) throw new Error('Закройте Minecraft перед импортом: запущенная игра перезапишет перенесённые настройки');

    const source = await resolveSource(plan);
    const gameDir = store.loadSettings().gameDir;
    const addAccount = (name: string): boolean => {
      const list = store.loadAccounts();
      if (list.some((a) => a.name.toLowerCase() === name.toLowerCase())) return false;
      list.push(auth.createGuest(name));
      store.saveAccounts(list);
      return true;
    };
    const addImportedAccount = (imported: launcherImport.ImportedAccount): boolean => {
      const list = store.loadAccounts();
      const existing = list.findIndex((a) => a.uuid === imported.uuid || a.name.toLowerCase() === imported.name.toLowerCase());
      const account = imported.type === 'online' && imported.uuid
        ? auth.createMicrosoft(imported.uuid, imported.name, imported.refreshToken, imported.owned)
        : auth.createGuest(imported.name);
      if (existing >= 0) { list[existing] = { ...list[existing], ...account, accessToken: imported.accessToken ?? account.accessToken }; }
      else list.push({ ...account, accessToken: imported.accessToken ?? account.accessToken });
      store.saveAccounts(list);
      return existing < 0;
    };
    const installVersion = plan.categories.includes('version-install')
      ? async (versionId: string) => {
          try { mc.ensureContentFolders(versionId); } catch (e) { console.warn('Ignored error:', e); }
          await mc.install(versionId, win);
        }
      : undefined;
    const sendProgress = throttledProgress();
    let lastTotal = 1;
    const report = await launcherImport.performImport(plan, source, gameDir, addAccount, installVersion, (curr, total, stage, bytes, bytesPerSecond, etaSeconds, currentFile) => {
      lastTotal = total;
      sendProgress({ current: curr, total, stage, bytes, bytesPerSecond, etaSeconds, currentFile, paused: launcherImport.isImportPaused() });
      // Прогресс в таскбаре: импорт идёт минутами, окно может быть свёрнуто.
      try { win.setProgressBar(total > 0 ? Math.min(curr / total, 1) : 0); } catch {}
    }, importAbortController.signal, addImportedAccount);
    if (!win.isDestroyed()) {
      win.webContents.send('import:progress', { current: lastTotal, total: lastTotal, stage: 'Done', bytes: report.bytesWritten ?? 0 });
    }
    if (report.newAccounts.length > 0) refreshSkinServer();
    // Своя распаковка архива больше не нужна: был fromArchive — чистим tmp.
    if (plan.cleanupDir) {
      try { await fsp.rm(path.resolve(plan.cleanupDir), { recursive: true, force: true }); } catch {}
    }
    try { win.setProgressBar(-1); } catch {}
    // Готово в фоне: окно может быть свёрнуто — стучимся нотификацией.
    try {
      const copied = Object.values(report.copied).reduce((a, b) => a + ((b as number) ?? 0), 0);
      new Notification({
        title: 'Trel Launcher — импорт завершён',
        body: report.errors.length > 0
          ? `Скопировано файлов: ${copied}, ошибок: ${report.errors.length}`
          : `Скопировано файлов: ${copied}${report.aborted ? ' (прерван)' : ''}`,
      }).show();
    } catch {}
    return report;
  } finally { importLock = false; importAbortController = null; launcherImport.setImportPaused(false); }
  });
  ipcMain.handle('import:pause', () => { launcherImport.setImportPaused(true); });
  ipcMain.handle('import:resume', () => { launcherImport.setImportPaused(false); });
  ipcMain.handle('import:rollback', async () => {
    const { rollbackJournal } = await import('./import-ops');
    return rollbackJournal(store.loadSettings().gameDir);
  });
  ipcMain.handle('import:openGameDir', () => {
    shell.openPath(store.loadSettings().gameDir).catch(() => {});
  });
  ipcMain.handle('import:applyTweaks', (_e, tweaks: { maxMemoryMb?: number; jvmArgs?: string }) => {
    // Кнопка «как у источника»: память и JVM-аргументы едут в настройки Trel.
    // Валидация та же, что в settings:set (settings.ts режет опасные флаги).
    const s = store.loadSettings();
    if (typeof tweaks?.maxMemoryMb === 'number' && tweaks.maxMemoryMb >= 256 && tweaks.maxMemoryMb <= 32768) {
      s.memoryMb = Math.round(tweaks.maxMemoryMb);
    }
    if (typeof tweaks?.jvmArgs === 'string' && tweaks.jvmArgs.length < 2048) {
      const parts = tweaks.jvmArgs.split(/\s+/).filter(Boolean);
      if (parts.every((part: string) => !DANGEROUS_JVM_ARGS.test(part))) s.jvmArgs = tweaks.jvmArgs;
    }
    store.saveSettings(s);
    return { memoryMb: s.memoryMb, jvmArgs: s.jvmArgs };
  });
  ipcMain.handle('import:checkAccount', async (_e, name: string) => {
    // Проверка токена в фоне: дергаем профиль Mojang, таймаут 8с.
    // Без refresh-токена проверять нечего — сразу «нужен вход».
    if (typeof name !== 'string' || name.length === 0 || name.length > 64) throw new Error('Invalid name');
    const acc = store.loadAccounts().find((a) => a.name.toLowerCase() === name.toLowerCase()) as (Record<string, unknown> & { name: string }) | undefined;
    if (!acc) return { ok: false, reason: 'not-found' };
    const token = acc.accessToken;
    if ((acc as { type?: string }).type === 'offline') return { ok: false, reason: 'offline' };
    if (typeof token !== 'string' || !token) return { ok: false, reason: 'relogin-required' };
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch('https://api.minecraftservices.com/minecraft/profile', {
        headers: { Authorization: `Bearer ${token}` }, signal: ctl.signal,
      }).catch(() => null);
      clearTimeout(t);
      if (!res) return { ok: false, reason: 'network' };
      return res.ok ? { ok: true } : { ok: false, reason: 'relogin-required' };
    } catch { return { ok: false, reason: 'network' }; }
  });
  ipcMain.handle('import:pickArchive', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Выбери архив сборки',
      filters: [{ name: 'Modpacks', extensions: ['zip', 'mrpack', 'trelpack'] }],
      properties: ['openFile'],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });
  ipcMain.handle('import:fromArchive', async (_e, archivePath: string) => {
    // Импорт модпака из zip/mrpack/trelpack: распаковка с zip-slip защитой + detect.
    if (typeof archivePath !== 'string' || archivePath.length === 0 || archivePath.length > 1024) throw new Error('Invalid path');
    if (!/\.(zip|mrpack|trelpack)$/i.test(archivePath)) throw new Error('Only .zip / .mrpack / .trelpack archives are supported');
    const { extractPackArchive } = await import('./import-ops');
    const pack = await extractPackArchive(archivePath);
    const source = launcherImport.detectFromDir(pack.rootDir);
    if (!source) throw new Error('No game data found in archive');
    return { ...source, id: 'archive', label: `${pack.packName} (archive)`, tmpDir: pack.tmpDir };
  });
  ipcMain.handle('import:performMany', async (_e, plans: launcherImport.ImportPlan[]) => {
    // Очередь источников: несколько лаунчеров за один заход, строго по очереди.
    // Отмена останавливает очередь (остаток помечается cancelled, файлы целы).
    if (importLock) throw new Error('Import already in progress');
    if (!Array.isArray(plans) || plans.length === 0 || plans.length > 5) throw new Error('Provide 1-5 plans');
    for (const p of plans) validatePlan(p);
    if (mc.hasRunningGame) throw new Error('Закройте Minecraft перед импортом: запущенная игра перезапишет перенесённые настройки');
    importLock = true;
    importAbortController = new AbortController();
    try {
      const gameDir = store.loadSettings().gameDir;
      const results: Array<{ sourceId: string; report?: launcherImport.ImportReport; status: 'done' | 'cancelled' }> = [];
      for (const p of plans) {
        if (importAbortController.signal.aborted) {
          results.push({ sourceId: p.sourceId, status: 'cancelled' });
          continue;
        }
        const source = await resolveSource(p);
        const addAccount = (name: string): boolean => {
          const list = store.loadAccounts();
          if (list.some((a) => a.name.toLowerCase() === name.toLowerCase())) return false;
          list.push(auth.createGuest(name));
          store.saveAccounts(list);
          return true;
        };
        const report = await launcherImport.performImport(p, source, gameDir, addAccount, undefined, (curr, total, stage, bytes, bps, eta, file) => {
          if (!win.isDestroyed()) win.webContents.send('import:progress', { current: curr, total, stage, bytes, bytesPerSecond: bps, etaSeconds: eta, currentFile: file, queueSource: p.sourceId });
        }, importAbortController.signal);
        results.push({ sourceId: p.sourceId, report, status: importAbortController.signal.aborted ? 'cancelled' : 'done' });
      }
      return results;
    } finally { importLock = false; importAbortController = null; launcherImport.setImportPaused(false); }
  });
  ipcMain.handle('tools:diskUsage', () => {
    const { diskUsage } = require('./storage') as typeof import('./storage');
    return diskUsage(store.loadSettings().gameDir);
  });
  ipcMain.handle('tools:clean', async (_e, target: string) => {
    if (target !== 'logs' && target !== 'tmp') throw new Error('Invalid clean target');
    const { cleanTarget } = await import('./storage');
    return cleanTarget(store.loadSettings().gameDir, target);
  });
  ipcMain.handle('tools:downloadsPause', () => {
    const { setDownloadsPaused } = require('./http-proxy') as typeof import('./http-proxy');
    setDownloadsPaused(true);
  });
  ipcMain.handle('tools:downloadsResume', () => {
    const { setDownloadsPaused } = require('./http-proxy') as typeof import('./http-proxy');
    setDownloadsPaused(false);
  });
  ipcMain.handle('tools:downloadsStatus', () => {
    const { downloadQueueStatus } = require('./http-proxy') as typeof import('./http-proxy');
    return downloadQueueStatus();
  });
  const OPEN_URL_HOSTS = new Set([
    'www.nvidia.com', 'nvidia.com', 'www.amd.com', 'amd.com',
    'www.intel.com', 'intel.com', 'modrinth.com', 'www.modrinth.com',
    'minecraft.net', 'www.minecraft.net', 'microsoft.com', 'support.microsoft.com',
  ]);
  ipcMain.handle('tools:openUrl', async (_e, url: string) => {
    if (typeof url !== 'string' || url.length === 0 || url.length > 512) throw new Error('Invalid url');
    let host = '';
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') throw new Error('Only https allowed');
      host = u.hostname.toLowerCase();
    } catch { throw new Error('Invalid url'); }
    if (!OPEN_URL_HOSTS.has(host)) throw new Error('Host not allowed: ' + host);
    await shell.openExternal(url);
  });
  ipcMain.handle('app:portable', () => {
    try {
      const exeDir = path.dirname(process.execPath);
      return fs.existsSync(path.join(exeDir, 'portable.txt')) || process.argv.includes('--portable') || process.env.TREL_PORTABLE === '1';
    } catch { return false; }
  });
  ipcMain.handle('tools:proxyTest', async (_e, proxyUrl: string) => {
    if (typeof proxyUrl !== 'string' || proxyUrl.length === 0 || proxyUrl.length > 512) throw new Error('Invalid proxyUrl');
    return testProxy(proxyUrl);
  });
  ipcMain.handle('snapshots:create', (_e, versionId: string, label?: string) => {
    if (typeof versionId !== 'string' || versionId.length === 0 || versionId.length > 128) throw new Error('Invalid versionId');
    if (label !== undefined && (typeof label !== 'string' || label.length > 40)) throw new Error('Invalid label');
    return snapshots.create(versionId, label);
  });
  ipcMain.handle('snapshots:list', (_e, versionId?: string) => {
    if (versionId !== undefined && (typeof versionId !== 'string' || versionId.length > 128)) throw new Error('Invalid versionId');
    return snapshots.list(versionId);
  });
  ipcMain.handle('snapshots:restore', (_e, file: string) => {
    if (typeof file !== 'string' || file.length === 0 || file.length > 256) throw new Error('Invalid file');
    if (mc.hasRunningGame) throw new Error('Закройте Minecraft перед откатом: запущенная игра перезапишет восстановленное');
    return snapshots.restore(file);
  });
  ipcMain.handle('snapshots:remove', (_e, file: string) => {
    if (typeof file !== 'string' || file.length === 0 || file.length > 256) throw new Error('Invalid file');
    return snapshots.remove(file);
  });
  ipcMain.handle('webdav:status', () => webdav.status());
  ipcMain.handle('webdav:configure', (_e, url: string, login: string, password: string) => {
    if (typeof url !== 'string' || url.length > 512) throw new Error('Invalid url');
    if (typeof login !== 'string' || login.length > 256) throw new Error('Invalid login');
    if (typeof password !== 'string' || password.length > 1024) throw new Error('Invalid password');
    return webdav.configure(url, login, password);
  });
  ipcMain.handle('webdav:push', async (_e) => {
    if (mc.hasRunningGame) throw new Error('Закройте Minecraft: мир нельзя паковать на ходу');
    return webdav.push();
  });
  ipcMain.handle('webdav:pull', async () => webdav.pull());
  ipcMain.handle('packs:exportDialog', async (_e, versionId: string) => {
    if (typeof versionId !== 'string' || versionId.length === 0 || versionId.length > 128) throw new Error('Invalid versionId');
    const res = await dialog.showSaveDialog(win, {
      title: 'Сохранить сборку',
      defaultPath: `${versionId}.trelpack`,
      filters: [{ name: 'Trel pack', extensions: ['trelpack'] }],
    });
    if (res.canceled || !res.filePath) return null;
    return snapshots.exportPack(versionId, res.filePath);
  });
  ipcMain.handle('packs:import', async (_e, archivePath: string, targetId: string) => {
    if (typeof archivePath !== 'string' || archivePath.length === 0 || archivePath.length > 1024) throw new Error('Invalid path');
    if (typeof targetId !== 'string' || targetId.length === 0 || targetId.length > 128) throw new Error('Invalid target');
    if (mc.hasRunningGame) throw new Error('Закройте Minecraft перед импортом сборки');
    return snapshots.importPack(archivePath, targetId);
  });
  ipcMain.handle('import:lastReport', () => {
    return launcherImport.readLastImportReport(store.loadSettings().gameDir);
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

  // ---- modpacks (Modrinth) ----
  ipcMain.handle('modpacks:search', (_e, query: string) => {
    if (typeof query !== 'string' || query.length > 200) throw new Error('Invalid query');
    return modpacks.search(query);
  });
  ipcMain.handle('modpacks:versions', (_e, projectId: string) => {
    if (typeof projectId !== 'string' || !/^[\w-]{1,64}$/.test(projectId)) throw new Error('Invalid projectId');
    return modpacks.versions(projectId);
  });
  ipcMain.handle('modpacks:install', async (_e, version: ModpackVersion) => {
    if (!version || typeof version.fileUrl !== 'string' || !/^https:\/\/(cdn\.modrinth\.com|.*\.modrinth\.com)\//.test(version.fileUrl)) {
      throw new Error('Недопустимый источник модпака');
    }
    return modpacks.install(version, win);
  });
  // Установка версии по профилю, распознанному при импорте (DetectedModpack).
  ipcMain.handle('modpacks:installFromProfile', async (_e, profile: { mc: string; loader: string; loaderVersion?: string; name?: string }) => {
    if (!profile || typeof profile !== 'object') throw new Error('Invalid profile');
    if (typeof profile.mc !== 'string' || profile.mc.length === 0 || profile.mc.length > 64) throw new Error('Invalid mc version');
    if (profile.loaderVersion !== undefined && (typeof profile.loaderVersion !== 'string' || profile.loaderVersion.length > 64)) throw new Error('Invalid loaderVersion');
    if (profile.name !== undefined && (typeof profile.name !== 'string' || profile.name.length > 120)) throw new Error('Invalid name');
    return modpacks.installFromProfile(profile, win);
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
    shutdownAll: async () => {
      await servers.shutdownAll();
      // TrelEmu — отдельный процесс (QEMU detached), Trel не держит ссылку
      // на child. Если юзер вышел из лаунчера — VM ему больше не нужна,
      // иначе она будет висеть в фоне жрёт CPU. Чистим при выходе.
      try { mc.trelEmu.stop(); } catch (e) { console.warn('[ipc] TrelEmu stop on shutdown:', e); }
    },
  };
}