import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { registerIpc } from './ipc';
import { LauncherUpdater } from './updater';

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
// Имя процесса — вместо "Electron" будет "Trel"
app.name = 'Trel';
process.title = 'Trel';

const isDev = !app.isPackaged;
const updater = new LauncherUpdater();

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
    icon: path.join(app.getAppPath(), 'build', 'icon.ico'),
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

  if (isDev) {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
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

app.whenReady().then(() => {
  const launcherDir = ensureLauncherDir();
  const win = createWindow();
  const ipc = registerIpc(win, launcherDir, updater);

  updater.attach(win);

  // Check for launcher updates shortly after start, then every hour.
  setTimeout(() => updater.check().catch(() => {}), 5000);
  setInterval(() => updater.check().catch(() => {}), 60 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Graceful shutdown: даём запущенным серверам ~8 секунд на завершение
  // перед тем как процесс выйдет. Предотвращаем мгновенный quit, ждём
  // shutdownAll, затем вызываем app.quit() повторно.
  let isQuitting = false;
  app.on('before-quit', async (event) => {
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
  if (process.platform !== 'darwin') app.quit();
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
