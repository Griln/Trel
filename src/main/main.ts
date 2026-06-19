import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { registerIpc } from './ipc';
import { LauncherUpdater } from './updater';
import { pathToFileURL } from 'node:url';

const userDataArg = process.argv.find((arg) => arg.startsWith('--trel-user-data-dir='));
const customUserDataDir = userDataArg
  ? userDataArg.slice('--trel-user-data-dir='.length)
  : process.env.TREL_USER_DATA_DIR;
if (customUserDataDir && customUserDataDir.trim().length > 0) {
  const resolvedUserDataDir = path.resolve(customUserDataDir);
  if (!resolvedUserDataDir.includes('\0')) {
    app.setPath('userData', resolvedUserDataDir);
    console.log('[main] Using custom userData dir:', resolvedUserDataDir);
  }
}

// Глобальный перехват ошибок
function writeCrashLog(kind: string, details: string): void {
  const line = `${new Date().toISOString()} [${kind}] ${details}
`;
  const candidates: string[] = [];
  try { candidates.push(path.join(app.getPath('userData'), 'crash.log')); } catch {}
  candidates.push(path.join(process.cwd(), 'crash.log'));
  for (const file of candidates) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, line, 'utf-8');
      return;
    } catch {}
  }
}

process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught Exception:', err);
  writeCrashLog('Exception', err?.stack || String(err));
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRASH] Unhandled Rejection at:', promise, 'reason:', reason);
  writeCrashLog('Rejection', reason instanceof Error ? (reason.stack || reason.message) : String(reason));
});

// ------------------------------------------------------------
// Память / производительность
// ------------------------------------------------------------
// 1) Ограничиваем V8 old-space. 256 МБ хватает для UI лаунчера.
//    (js-flags применяются ко всем V8-процессам. Тяжёлые операции main
//    вроде импорта с SHA-1 — кратковременные, GC справляется.)
//    TODO: benchmark with --max-old-space-size=512 on large imports to see if 256 is too low.
// 2) Выключаем всё лишнее в Chromium.
// 3) Один renderer-процесс вместо нескольких.
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
app.commandLine.appendSwitch(
  'disable-features',
  'Translate,MediaRouter,OptimizationHints,AutofillServerCommunication,InterestFeedContentSuggestions,CalculateNativeWinOcclusion,AudioServiceOutOfProcess'
);
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('renderer-process-limit', '1');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-accelerated-video-encode');
// Увеличиваем protocolTimeout для CDP (Chrome DevTools Protocol).
// По умолчанию 180 сек, но при тяжёлых IPC-вызовах (например trelEmuStart
// с холодным стартом QEMU + ожиданием ADB до 3 мин) Chromium может не
// успеть ответить на Runtime.callFunctionOn и выбросить ProtocolError.
// 600 сек с запасом покрывает STARTUP_TIMEOUT_MS (180 сек) + оверхед.
app.commandLine.appendSwitch('protocol-timeout', '600000');
// Имя процесса — вместо "Electron" будет "Trel"
app.name = 'Trel';
process.title = 'Trel';

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

const isDev = !app.isPackaged;
const updater = new LauncherUpdater();
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const APP_NAME = 'Trel';
const LEGACY_APP_NAME = 'AuroraLauncher';

/**
 * Resolve the preload script path. In dev: from project root via __dirname.
 * In asar: __dirname points inside app.asar (or unpacked app/ if asarUnpack).
 * We also try app.getAppPath() as a fallback for edge-cases.
 */
function resolvePreloadPath(): string {
  const candidates = [
    path.join(__dirname, '..', 'preload', 'preload.js'),
    path.join(app.getAppPath(), 'dist-electron', 'preload', 'preload.js'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  console.warn('[main] Preload not found at expected paths:', candidates);
  return candidates[0];
}

function resolveAppIconPath(): string {
  const candidates = [
    path.join(app.getAppPath(), 'build', 'icon.ico'),
    path.join(process.resourcesPath || '', 'build', 'icon.ico'),
    path.join(process.cwd(), 'build', 'icon.ico'),
  ];
  return candidates.find((x) => x && fs.existsSync(x)) ?? candidates[0];
}

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}


function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow();
    ensureTray();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function trayLabels() {
  const ru = app.getLocale().toLowerCase().startsWith('ru');
  return ru
    ? { open: 'Открыть Trel', hide: 'Скрыть в трей', quit: 'Выйти из Trel', tooltip: 'Trel работает в фоне' }
    : { open: 'Open Trel', hide: 'Hide to tray', quit: 'Quit Trel', tooltip: 'Trel is running in the background' };
}

function updateTrayMenu(): void {
  if (!tray) return;
  const l = trayLabels();
  tray.setToolTip(l.tooltip);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: l.open, click: showMainWindow },
    {
      label: l.hide,
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
      },
    },
    { type: 'separator' },
    {
      label: l.quit,
      click: () => {
        app.quit();
      },
    },
  ]));
}

function ensureTray(): void {
  if (process.platform !== 'win32') return;
  if (tray && !(tray as any).isDestroyed?.()) return;
  const iconPath = resolveAppIconPath();
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image.isEmpty() ? iconPath : image);
  tray.on('click', showMainWindow);
  tray.on('double-click', showMainWindow);
  updateTrayMenu();
}

function createWindow(): BrowserWindow {
  const preloadPath = resolvePreloadPath();
  const win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0e1016',
    title: APP_NAME,
    icon: resolveAppIconPath(),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Когда окно скрыто (свёрнуто / на другом рабочем столе) — Chromium
      // притормаживает таймеры и rAF в renderer. Это режет CPU/память
      // во время игры, пока лаунчер фоном.
      backgroundThrottling: true,
    },
  });

  win.setMenuBarVisibility(false);

  win.on('close', (event) => {
    if (process.platform === 'win32' && !isQuitting) {
      event.preventDefault();
      win.hide();
      ensureTray();
    }
  });

  win.on('show', updateTrayMenu);
  win.on('hide', updateTrayMenu);

  const loadBuilt = () => win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  if (isDev) {
    win.loadURL('http://localhost:5173').catch(loadBuilt);
  } else {
    loadBuilt();
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url).catch((e) => console.warn('[main] openExternal failed:', e));
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isDev && url.startsWith('http://localhost:5173')) return;
    const builtUrl = pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).toString();
    if (!isDev && url === builtUrl) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) shell.openExternal(url).catch((e) => console.warn('[main] openExternal failed:', e));
  });

  return win;
}

function ensureLauncherDir(): string {
  const newDir = path.join(app.getPath('appData'), APP_NAME);
  const oldDir = path.join(app.getPath('appData'), LEGACY_APP_NAME);

  // Миграция данных пользователей со старого имени (AuroraLauncher → Trel).
  // Если новой папки ещё нет, а старая существует — переименовываем.
  if (!fs.existsSync(newDir) && fs.existsSync(oldDir)) {
    try {
      fs.renameSync(oldDir, newDir);
      // Внутри settings.json gameDir мог хранить полный путь со старым именем —
      // переписываем, чтобы лаунчер дальше работал с обновлённым путём.
      // Сравнение case-insensitive: на Windows пути `C:\Users\...` и
      // `c:\users\...` указывают на одно место, а простой includes
      // регистро-чувствителен и пропускал такие случаи.
      const settingsFile = path.join(newDir, 'settings.json');
      if (fs.existsSync(settingsFile)) {
        try {
          const raw = fs.readFileSync(settingsFile, 'utf-8');
          const parsed = JSON.parse(raw);
          if (typeof parsed.gameDir === 'string') {
            const lcDir = parsed.gameDir.toLowerCase();
            const lcOld = oldDir.toLowerCase();
            if (lcDir.includes(lcOld)) {
              const idx = lcDir.indexOf(lcOld);
              // Заменяем сохраняя регистр окружающих символов: берём префикс/суффикс из оригинала
              parsed.gameDir = parsed.gameDir.slice(0, idx) + newDir + parsed.gameDir.slice(idx + oldDir.length);
              fs.writeFileSync(settingsFile, JSON.stringify(parsed, null, 2), 'utf-8');
            }
          }
        } catch {}
      }
    } catch {
      // Если переименовать не удалось (файл занят и т.п.) — fallback: используем старую папку.
      if (fs.existsSync(oldDir)) return oldDir;
    }
  }

  if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
  return newDir;
}

app.on('second-instance', () => {
  showMainWindow();
});

app.whenReady().then(() => {
  const launcherDir = ensureLauncherDir();
  const win = createWindow();
  mainWindow = win;
  ensureTray();
  const ipc = registerIpc(win, launcherDir, updater);

  updater.attach(win);

  // Check for launcher updates shortly after start, then every hour.
  setTimeout(() => updater.check().catch(() => {}), 5000);
  setInterval(() => updater.check().catch(() => {}), 60 * 60 * 1000);

  app.on('activate', () => {
    showMainWindow();
  });

  // Graceful shutdown: даём запущенным серверам ~8 секунд на завершение
  // перед тем как процесс выйдет. Предотвращаем мгновенный quit, ждём
  // shutdownAll, затем вызываем app.quit() повторно.
  app.on('before-quit', async (event) => {
    if (tray) {
      tray.destroy();
      tray = null;
    }
    if (isQuitting || !ipc) return;
    isQuitting = true;
    event.preventDefault();
    try {
      await ipc.shutdownAll();
    } catch (e) {
      console.warn('[main] Graceful shutdown failed:', e);
    }
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) app.quit();
});

// Window controls
ipcMain.handle('window:minimize', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.minimize();
});
ipcMain.handle('window:maximize', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  if (w.isMaximized()) w.unmaximize();
  else w.maximize();
});
ipcMain.handle('window:close', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.close();
});
