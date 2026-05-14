import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { registerIpc } from './ipc';
import { LauncherUpdater } from './updater';

const isDev = !app.isPackaged;
const updater = new LauncherUpdater();

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0e1016',
    title: 'Aurora Launcher',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
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
  const dir = path.join(app.getPath('appData'), 'AuroraLauncher');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

app.whenReady().then(() => {
  const launcherDir = ensureLauncherDir();
  const win = createWindow();
  registerIpc(win, launcherDir, updater);

  updater.attach(win);

  // Check for launcher updates shortly after start, then every hour.
  setTimeout(() => updater.check().catch(() => {}), 5000);
  setInterval(() => updater.check().catch(() => {}), 60 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
