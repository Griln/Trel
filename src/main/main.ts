import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, protocol } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { registerIpc } from './ipc';
import { LauncherUpdater } from './updater';
import { pathToFileURL } from 'node:url';

// The app:// scheme is used by Electron as a "secure" custom protocol.
// We register it BEFORE app.ready (mandatory per the Electron docs).
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true } },
]);

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

// On Linux/macOS userData may turn out to be not writable —
// for example when ~/.config/Trel is a symlink to a read-only NTFS volume
// (a common scenario during a Windows/Linux dual-boot migration). Electron
// in that case crashes while creating the SingletonLock / GPU cache with
// EROFS even before the window is shown (grey screen for 3 sec → crash).
// We check the writability of the real path (via realpath — otherwise a symlink
// on a ro volume gives a false OK), and if it is not available — we switch to the fallback
// on a native writable FS. We don't touch Windows: there %APPDATA% is always rw.
function isWritableDir(dir: string): boolean {
  try {
    const real = fs.realpathSync(dir);
    // accessSync with W_OK only checks the permissions (mode), but on a read-only
    // mount even root with rw gets EROFS. We do an actual write probe.
    const probe = path.join(real, `.trel-writable-probe-${process.pid}`);
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

if (process.platform !== 'win32') {
  // On Linux/macOS Electron takes userData/appData from XDG. If the previous
  // user had the launcher under the name "Trel" (before we renamed
  // the package to "trel-launcher"), a symlink or a broken folder is left in ~/.config/Trel
  // pointing to a read-only volume (a typical Windows/Linux dual-boot
  // setup). In that case writing accounts.json/settings.json
  // gives EROFS, and the UI gets a cryptic error.
  //
  // Solution: check `~/.config/Trel` as a candidate path for the Trel-launcher
  // window, and if it is read-only or not resolvable — switch
  // userData/appData to ${XDG_CONFIG_HOME}/Trel-fallback, so that everything
  // is written to a reliable writable directory on the native FS.
  const dbg = (msg: string): void => {
    try { fs.appendFileSync('/tmp/trel-startup.log', `[${new Date().toISOString()}] ${msg}\n`); } catch {}
    try { process.stderr.write(`[main] ${msg}\n`); } catch {}
  };
  dbg(`userData init: ${((): unknown => { try { return app.getPath('userData'); } catch { return '?'; } })()}`);

  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const candidateTrel = path.join(xdg, 'Trel');
  const fallback = path.join(xdg, 'Trel-fallback');
  // Check that ~/.config/Trel is either: (a) not writable via realpath
  // → a symlink to a read-only volume, or (b) really does not exist/is not accessible.
  // If (a) — we migrate to the fallback.
  let mustFallback = false;
  try {
    const real = fs.realpathSync(candidateTrel);
    const probe = path.join(real, `.trel-writable-probe-${process.pid}`);
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
    dbg(`candidate ${candidateTrel} is writable (realpath=${real})`);
  } catch (e) {
    // EROFS / ENOENT / NotADir — all of them mean fallback
    mustFallback = true;
    dbg(`candidate ${candidateTrel} not writable: ${(e as NodeJS.ErrnoException)?.code ?? (e as Error).message}`);
  }

  if (mustFallback) {
    try { fs.mkdirSync(fallback, { recursive: true }); } catch {}
    try {
      app.setPath('userData', fallback);
      try { app.setPath('appData', fallback); } catch {}
      try { app.setPath('sessionData', path.join(fallback, 'session')); } catch {}
      dbg(`userData → fallback: ${fallback}`);
    } catch (e) {
      dbg(`setPath fallback failed: ${(e as Error).message}`);
    }
  }
}

// Global error interception
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
// Memory / performance
// ------------------------------------------------------------
// 1) We limit the V8 old-space. 256 MB is enough for the launcher UI.
//    (js-flags apply to all V8 processes. Heavy main-process operations
//    like a SHA-1 import are short-lived, GC copes with them.)
//    TODO: benchmark with --max-old-space-size=512 on large imports to see if 256 is too low.
// 2) We disable everything unnecessary in Chromium.
// 3) A single renderer process instead of several.
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
app.commandLine.appendSwitch(
  'disable-features',
  'Translate,MediaRouter,OptimizationHints,AutofillServerCommunication,InterestFeedContentSuggestions,CalculateNativeWinOcclusion,AudioServiceOutOfProcess,VizDisplayCompositor'
);
// On Linux AppImage we do not disable the GPU — SkinViewer3D renders via Three.js
// and needs WebGL. Without the GPU SkinPage hangs.
// BUT: on Linux (AppImage + NVIDIA) the GPU process may fail to start with
// error_code=1002 because of the sandbox → FATAL "GPU process isn't usable. Goodbye."
// and a crash of the whole app (including right in the middle of downloading a version/Java — hence
// "the folders are created, but the files are not"). disable-gpu-sandbox lifts the sandbox of the
// GPU process, keeping the GPU itself and WebGL working. Linux only.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('renderer-process-limit', '1');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-accelerated-video-encode');
// We increase protocolTimeout for CDP (Chrome DevTools Protocol).
// The default is 180 sec, but with heavy IPC calls (for example trelEmuStart
// with a cold QEMU start + waiting for ADB up to 3 min) Chromium may not
// manage to answer Runtime.callFunctionOn in time and throw a ProtocolError.
// 600 sec with a margin covers STARTUP_TIMEOUT_MS (180 sec) + overhead.
app.commandLine.appendSwitch('protocol-timeout', '600000');
// The process name — instead of "Electron" it will be "Trel"
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
  // On Windows we prioritize .ico (a multilayer icon, better in the tray/taskbar).
  // On Linux/macOS .ico is decoded by Electron as a png frame, but the native
  // tray managers (GNOME/KDE) prefer .png — otherwise the tray and the window icon
  // come out empty. Therefore on non-Windows the first candidate is .png.
  const isWin = process.platform === 'win32';
  const ext = isWin ? 'ico' : 'png';
  const fallbackExt = isWin ? 'png' : 'ico';
  const candidates = [
    path.join(app.getAppPath(), 'build', 'icon.' + ext),
    path.join(process.resourcesPath || '', 'build', 'icon.' + ext),
    path.join(process.cwd(), 'build', 'icon.' + ext),
    // Fallback format (cross-platform compatible): icon.png lies next to the project.
    path.join(app.getAppPath(), 'build', 'icon.' + fallbackExt),
    path.join(process.resourcesPath || '', 'build', 'icon.' + fallbackExt),
    path.join(process.cwd(), 'build', 'icon.' + fallbackExt),
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
  // The tray makes sense only on Windows and Linux. On macOS the Docklet uses
  // the standard dock + menu bar, and the Tray conflicts with the Lifecycle there.
  if (process.platform === 'darwin') return;
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
    // CSP comes from vite/meta in index.html and blocks inline <script>.
    // With a data: URL we have no own scripts, but inline `<style>` is under CSP too.
    // For AppImage there is one fix — disable CSP at the webRequest level or
    // remove <meta http-equiv="Content-Security-Policy"> when inlining.
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    },
  });

  // We remove the CSP from the loaded HTML, because we inline scripts in a
  // data: form, and the vite-built CSP forbids inline script-src.
  // NOTE: this works only for the renderer of our application, it has
  // no external scripts besides IPC + the already inlined Google Fonts/styles.
  win.webContents.session.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'content-security-policy': [''],
      },
    });
  });

  // Renderer diagnostics: we log the page load errors, JS exceptions
  // and console messages, so that a "black screen" can be investigated remotely.
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    const msg = `[renderer] did-fail-load code=${code} desc=${desc} url=${url}`;
    try { fs.appendFileSync('/tmp/trel-startup.log', `[${new Date().toISOString()}] ${msg}\n`); } catch {}
    try { process.stderr.write(msg + '\n'); } catch {}
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    const msg = `[renderer] render-process-gone reason=${details.reason} exit=${details.exitCode}`;
    try { fs.appendFileSync('/tmp/trel-startup.log', `[${new Date().toISOString()}] ${msg}\n`); } catch {}
    try { process.stderr.write(msg + '\n'); } catch {}
    // If the renderer crashes — we do NOT close the main process, we try to reload the page.
    // This lets the window come back to life (for example on a GPU crash).
    if (details.reason !== 'clean-exit') {
      setTimeout(() => {
        try { win.webContents.reload(); } catch {}
      }, 1000);
    }
  });
  win.webContents.on('console-message', (_e, level, message, line, source) => {
    const lvlMap = ['verbose', 'info', 'warning', 'error'] as const;
    const lvl = lvlMap[level] ?? `L${level}`;
    // Limit the length in the log: a long source/data:URL is not needed.
    const trimmed = message.length > 300 ? message.slice(0, 300) + '...' : message;
    const srcShort = source.length > 200 ? source.slice(0, 200) + '...' : source;
    const msg = `[renderer] console[${lvl}] ${srcShort}:${line} ${trimmed}`;
    try { fs.appendFileSync('/tmp/trel-startup.log', `[${new Date().toISOString()}] ${msg}\n`); } catch {}
  });
  win.webContents.on('did-finish-load', () => {
    try { fs.appendFileSync('/tmp/trel-startup.log', `[${new Date().toISOString()}] [renderer] did-finish-load\n`); } catch {}
  });

  win.setMenuBarVisibility(false);

  win.on('close', (event) => {
    if (process.platform !== 'darwin' && !isQuitting) {
      // Windows/Linux: minimize to the tray instead of closing. macOS keeps
      // the default behavior (closing the window does not close the app).
      event.preventDefault();
      win.hide();
      ensureTray();
    }
  });

  win.on('show', updateTrayMenu);
  win.on('hide', updateTrayMenu);

  // Renderer index.html. On Linux Electron 33 inside an AppImage blocks
  // file:// for the paths outside the sandbox (ERR_FAILED -2). dist is packed into asar
  // (Linux AppImage: <mount>/resources/app.asar/dist/). We read via app.getAppPath()
  // which points to the package root (asar root). The custom protocol
  // app://localhost/ with standard+secure privileges (registered at the
  // top of the module above via protocol.registerSchemesAsPrivileged) gets
  // the files via fs.readFileSync. fs.existsSync/fs.statSync do not work
  // correctly with asar paths, so the checks are removed and we read directly.
  const distDir = path.join(app.getAppPath(), 'dist');
  const dbg = (msg: string): void => {
    try { fs.appendFileSync('/tmp/trel-startup.log', `[${new Date().toISOString()}] ${msg}\n`); } catch {}
    try { process.stderr.write(`[main] ${msg}\n`); } catch {}
  };
  dbg(`loadBuilt: distDir=${distDir} exists=${fs.existsSync(distDir)}`);
  const mimeOf = (p: string): string => {
    const ext = path.extname(p).toLowerCase();
    if (ext === '.html') return 'text/html; charset=utf-8';
    if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
    if (ext === '.css') return 'text/css; charset=utf-8';
    if (ext === '.json') return 'application/json; charset=utf-8';
    if (ext === '.svg') return 'image/svg+xml';
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.ico') return 'image/x-icon';
    if (ext === '.woff') return 'font/woff';
    if (ext === '.woff2') return 'font/woff2';
    if (ext === '.map') return 'application/json; charset=utf-8';
    return 'application/octet-stream';
  };
  const registerTrelProtocol = (): void => {
    try {
      protocol.registerSchemesAsPrivileged([
        { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true } },
      ]);
    } catch { /* already registered at top */ }
    // Register the handler once
    if ((protocol as unknown as { _trelHandlerRegistered?: boolean })._trelHandlerRegistered) return;
    (protocol as unknown as { _trelHandlerRegistered: boolean })._trelHandlerRegistered = true;
    try {
      protocol.handle('app', async (req) => {
        try {
          const u = new URL(req.url);
          // host=localhost, pathname=/file.ext
          let p = decodeURIComponent(u.pathname);
          if (p === '/' || !p) p = '/index.html';
          const safe = path.normalize(p).replace(/^\/+/, '');
          const full = path.join(distDir, safe);
          dbg(`app://${u.host}${u.pathname} -> ${full}`);
          if (!full.startsWith(distDir)) {
            return new Response('', { status: 404, headers: { 'content-type': 'text/plain' } });
          }
          let buf: Buffer;
          try {
            buf = fs.readFileSync(full);
          } catch {
            return new Response('', { status: 404, headers: { 'content-type': 'text/plain' } });
          }
          return new Response(buf as unknown as BodyInit, { status: 200, headers: { 'content-type': mimeOf(full), 'cache-control': 'no-store' } });
        } catch (e) {
          return new Response('', { status: 500, headers: { 'content-type': 'text/plain' } });
        }
      });
    } catch (e) {
      dbg(`protocol.handle failed: ${(e as Error).message}`);
    }
  };
  registerTrelProtocol();
  const loadBuilt = (): Promise<void> => {
    // We load the HTML directly; the relative paths /assets/... resolve
    // as app://localhost/assets/... — our handler reads them from disk.
    // The main point: the vite-built HTML uses absolute paths (/assets/...),
    // which the browser resolves relative to the `app://localhost` origin.
    const fileUrl = 'app://localhost/index.html';
    dbg(`loadBuilt: fileUrl=${fileUrl}`);
    return win.loadURL(fileUrl).catch((e) => {
      dbg(`loadURL failed: ${e.message ?? e}`);
      return Promise.resolve();
    });
  };
  if (isDev) {
    win.loadURL('http://localhost:5173').catch(() => loadBuilt());
  } else {
    loadBuilt();
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url).catch((e) => console.warn('[main] openExternal failed:', e));
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isDev && url.startsWith('http://localhost:5173')) return;
    if (!isDev && url.startsWith('trel://')) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) shell.openExternal(url).catch((e) => console.warn('[main] openExternal failed:', e));
  });

  return win;
}

/** Portable mode: the data lies next to the binary, nothing in the system. */
export function portableDir(): string | null {
  // The portable.txt marker next to the exe (put it there — it becomes portable),
  // the --portable flag or the env TREL_PORTABLE=1.
  try {
    const exeDir = path.dirname(process.execPath);
    if (process.argv.includes('--portable') || process.env.TREL_PORTABLE === '1') {
      return path.join(exeDir, 'TrelData');
    }
    if (fs.existsSync(path.join(exeDir, 'portable.txt'))) {
      return path.join(exeDir, 'TrelData');
    }
  } catch { /* ignore */ }
  return null;
}

function ensureLauncherDir(): string {
  // The portable mode matters most: a flash drive must not litter ~/.config.
  const portable = portableDir();
  if (portable) {
    if (!fs.existsSync(portable)) fs.mkdirSync(portable, { recursive: true });
    return portable;
  }
  // app.getPath('userData') points directly to the Trel-launcher directory.
  // On Linux after the user fallback (see the block above) userData
  // has already been moved to the writable "Trel-fallback", and the Trel data must
  // live right here, and not as `<...>/Trel/` under it (otherwise we go
  // to ~/.config/Trel again — a symlink to a read-only NTFS).
  const newDir = app.getPath('userData');
  if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });

  // One-time migration: if userData is empty/fresh, and the data from the old path
  // already lies in ~/.config/Trel (a typical story: dual-boot, a symlink
  // to a read-only NTFS), we copy it to the fallback so that the user does not
  // lose their accounts. We copy only if the files do not exist in newDir yet.
  if (process.platform !== 'win32') {
    const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    const legacyTrel = path.join(xdg, 'Trel');
    try {
      const realLegacy = fs.realpathSync(legacyTrel);
      const realNew = fs.realpathSync(newDir);
      if (realLegacy !== realNew) {
        // Read-only symlink: the data is technically accessible via realpath,
        // but we do NOT want to write there. In that case we only copy to newDir,
        // leaving the original as is.
        const tryCopy = (name: string): void => {
          const srcFile = path.join(legacyTrel, name);
          const dstFile = path.join(newDir, name);
          if (fs.existsSync(srcFile) && !fs.existsSync(dstFile)) {
            try {
              fs.copyFileSync(srcFile, dstFile);
              const m = (s: string): void => { try { fs.appendFileSync('/tmp/trel-startup.log', `[${new Date().toISOString()}] [main] migrated ${s} ${srcFile} -> ${dstFile}\n`); } catch {} };
              m('copied');
            } catch (e) {
              // EROFS inside legacyTrel — skip silently.
            }
          }
        };
        for (const f of ['accounts.json', 'settings.json', 'playtime.json', 'java-cache.json', '.theme']) {
          tryCopy(f);
        }
      }
    } catch { /* realpath failed — safely ignored */ }
  }

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

  // Graceful shutdown: we give the running servers ~8 seconds to finish
  // before the process exits. We prevent the instant quit, wait for
  // shutdownAll, then call app.quit() again.
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
