import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, protocol } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { registerIpc } from './ipc';
import { LauncherUpdater } from './updater';
import { pathToFileURL } from 'node:url';

// Схема app:// используется Electron'ом как «секурная» custom protocol.
// Регистрируем ДО app.ready (обязательно по Electron docs).
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

// На Linux/macOS userData может оказаться недоступным для записи —
// например когда ~/.config/Trel это symlink на read-only NTFS-том
// (частый сценарий при dual-boot Windows/Linux миграции). Electron
// в таком случае падает при создании SingletonLock / GPU-кэша с
// EROFS ещё до показа окна (серый экран 3 сек → вылет).
// Проверяем writability реального пути (через realpath — иначе symlink
// на ro-том даст ложное OK), и если недоступен — переключаем на fallback
// на нативной writable FS. Не трогаем Windows: там %APPDATA% всегда rw.
function isWritableDir(dir: string): boolean {
  try {
    const real = fs.realpathSync(dir);
    // accessSync с W_OK проверяет только права (mode), но на read-only
    // mount даже root с rw получит EROFS. Делаем фактическую пробу записи.
    const probe = path.join(real, `.trel-writable-probe-${process.pid}`);
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

if (process.platform !== 'win32') {
  // На Linux/macOS Electron берёт userData/appData из XDG. Если прошлый
  // пользователь имел лаунчер под именем "Trel" (до того, как мы сменили
  // имя пакета на "trel-launcher"), в ~/.config/Trel остался симлинк или
  // битая папка, ссылающаяся на read-only том (типичный dual-boot
  // Windows/Linux). В этом случае запись accounts.json/settings.json
  // даёт EROFS, а UI получит cryptic-ошибку.
  //
  // Решение: проверить `~/.config/Trel` как кандидат-путь для окна
  // Trel-launcher, и если он read-only или не-resolvable — переключить
  // userData/appData на ${XDG_CONFIG_HOME}/Trel-fallback, чтобы всё
  // писалось в надёжную writable-директорию на нативном FS.
  const dbg = (msg: string): void => {
    try { fs.appendFileSync('/tmp/trel-startup.log', `[${new Date().toISOString()}] ${msg}\n`); } catch {}
    try { process.stderr.write(`[main] ${msg}\n`); } catch {}
  };
  dbg(`userData init: ${((): unknown => { try { return app.getPath('userData'); } catch { return '?'; } })()}`);

  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const candidateTrel = path.join(xdg, 'Trel');
  const fallback = path.join(xdg, 'Trel-fallback');
  // Проверяем, что ~/.config/Trel либо: (a) за-writable через realpath
  // → симлинк на read-only том, или (b) реально не существует/доступен.
  // Если (a) — мигрируем в fallback.
  let mustFallback = false;
  try {
    const real = fs.realpathSync(candidateTrel);
    const probe = path.join(real, `.trel-writable-probe-${process.pid}`);
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
    dbg(`candidate ${candidateTrel} is writable (realpath=${real})`);
  } catch (e) {
    // EROFS / ENOENT / NotADir — всё значит fallback
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
  'Translate,MediaRouter,OptimizationHints,AutofillServerCommunication,InterestFeedContentSuggestions,CalculateNativeWinOcclusion,AudioServiceOutOfProcess,VizDisplayCompositor'
);
// На Linux AppImage не отключаем GPU — SkinViewer3D рендерит через Three.js
// и ему нужен WebGL. Без GPU SkinPage падает с зависанием.
// НО: на Linux (AppImage + NVIDIA) GPU-процесс может не стартовать с
// error_code=1002 из-за песочницы → FATAL "GPU process isn't usable. Goodbye."
// и вылет всего аппа (в т.ч. прямо посреди скачивания версии/Java — отсюда
// «папки создаются, а файлы нет»). disable-gpu-sandbox снимает песочницу
// GPU-процесса, оставляя сам GPU и WebGL рабочими. Только для Linux.
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
  // На Windows приоритизируем .ico (многослойная иконка, лучше в трее/taskbar).
  // На Linux/macOS .ico Electron'ом декодируется как png-фрейм, но нативные
  // tray-менеджеры (GNOME/KDE) предпочитают .png — иначе tray и иконка окна
  // получаются пустыми. Поэтому на не-Windows первым кандидатом ставим .png.
  const isWin = process.platform === 'win32';
  const ext = isWin ? 'ico' : 'png';
  const fallbackExt = isWin ? 'png' : 'ico';
  const candidates = [
    path.join(app.getAppPath(), 'build', 'icon.' + ext),
    path.join(process.resourcesPath || '', 'build', 'icon.' + ext),
    path.join(process.cwd(), 'build', 'icon.' + ext),
    // Запасной формат (междуplatform-совместимый): icon.png лежит рядом с проектом.
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
  // Tray имеет смысл только на Windows и Linux. На macOSDocklet используются
  // стандартный dock + menu bar, а Tray там конфликтует с Lifecycle.
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
    // CSP встаёт из vite/meta в index.html и блокирует inline <script>.
    // С data: URL мы своих скриптов нет, но inline `<style>` тоже под CSP.
    // Для AppImage фикс один — отключить CSP на webRequest уровне либо
    // убрать <meta http-equiv="Content-Security-Policy"> при инлайне.
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
    },
  });

  // Удаляем CSP из загруженного HTML, потому что мы инлайним скрипты в
  // data:-форме, а CSP vite-built запрещает inline script-src.
  // ВНИМАНИЕ: работает только для renderer'а нашего приложения, в нём
  // нет внешних скриптов кроме IPC + Google Fonts/styles уже встроенные.
  win.webContents.session.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'content-security-policy': [''],
      },
    });
  });

  // Диагностика renderer: логируем ошибки загрузки страницы, JS-исключения
  // и console сообщения, чтобы «чёрный экран» можно было разобрать удалённо.
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    const msg = `[renderer] did-fail-load code=${code} desc=${desc} url=${url}`;
    try { fs.appendFileSync('/tmp/trel-startup.log', `[${new Date().toISOString()}] ${msg}\n`); } catch {}
    try { process.stderr.write(msg + '\n'); } catch {}
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    const msg = `[renderer] render-process-gone reason=${details.reason} exit=${details.exitCode}`;
    try { fs.appendFileSync('/tmp/trel-startup.log', `[${new Date().toISOString()}] ${msg}\n`); } catch {}
    try { process.stderr.write(msg + '\n'); } catch {}
    // Если renderer падает — НЕ закрываем main, пробуем перезагрузить страницу.
    // Это позволяет окну вернуться к лайфу (например при GPU crash).
    if (details.reason !== 'clean-exit') {
      setTimeout(() => {
        try { win.webContents.reload(); } catch {}
      }, 1000);
    }
  });
  win.webContents.on('console-message', (_e, level, message, line, source) => {
    const lvlMap = ['verbose', 'info', 'warning', 'error'] as const;
    const lvl = lvlMap[level] ?? `L${level}`;
    // Ограничим длину на лог: длинный source/data:URL не нужен.
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
      // Windows/Linux: сворачиваем в трей вместо закрытия. macOS оставляет
      // поведение по умолчанию (закрытие окна не закрывает приложение).
      event.preventDefault();
      win.hide();
      ensureTray();
    }
  });

  win.on('show', updateTrayMenu);
  win.on('hide', updateTrayMenu);

  // Renderer index.html. На Linux Electron 33 внутри AppImage блокирует
  // file:// для путей вне песочницы (ERR_FAILED -2). dist упакован в asar
  // (Linux AppImage: <mount>/resources/app.asar/dist/). Читаем через app.getAppPath()
  // который указывает на корень пакета (asar root). Custom protocol
  // app://localhost/ с привилегиями standard+secure (зарегистрирован на
  // top of module выше через protocol.registerSchemesAsPrivileged) достаёт
  // файлы через fs.readFileSync. fs.existsSync/fs.statSync не работают
  // корректно с asar-путями, поэтому убраны проверки и читаем напрямую.
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
    // Один раз регистрируем обработчик
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
    // HTML загружаем напрямую; относительные пути /assets/... резолвятся
    // как app://localhost/assets/... — наш handler их читает с диска.
    // Главное: vite-built HTML использует абсолютные пути (/assets/...),
    // которые браузер резолвит относительно origin `app://localhost`.
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

/** Портативный режим: данные рядом с бинарём, ничего в системе. */
export function portableDir(): string | null {
  // Маркер portable.txt рядом с exe (положил — стал портативным),
  // флаг --portable или env TREL_PORTABLE=1.
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
  // Портативка важнее всего: флешка не должна мусорить в ~/.config.
  const portable = portableDir();
  if (portable) {
    if (!fs.existsSync(portable)) fs.mkdirSync(portable, { recursive: true });
    return portable;
  }
  // app.getPath('userData') указывает прямо на каталог Trel-launcher.
  // На Linux после пользовательского fallback (см. блок выше) userData
  // уже переставлен на writable "Trel-fallback", и Trel-данные должны
  // жить прямо здесь, а не как `<...>/Trel/` под ним (иначе мы опять
  // идём в ~/.config/Trel — симлинк на read-only NTFS).
  const newDir = app.getPath('userData');
  if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });

  // Одноразовая миграция: если userData пустой/свежий, а в ~/.config/Trel
  // уже лежат данные со старого пути (типичная история: dual-boot, симлинк
  // на read-only NTFS), копируем их в fallback, чтобы пользователь не
  // потерял аккаунты. Копируем только если файлы ещё не существуют в newDir.
  if (process.platform !== 'win32') {
    const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    const legacyTrel = path.join(xdg, 'Trel');
    try {
      const realLegacy = fs.realpathSync(legacyTrel);
      const realNew = fs.realpathSync(newDir);
      if (realLegacy !== realNew) {
        // Read-only симлинк: данные технически доступны через realpath,
        // но мы НЕ хотим писать туда. В таком случае только копируем в newDir,
        // оставляя исходник как есть.
        const tryCopy = (name: string): void => {
          const srcFile = path.join(legacyTrel, name);
          const dstFile = path.join(newDir, name);
          if (fs.existsSync(srcFile) && !fs.existsSync(dstFile)) {
            try {
              fs.copyFileSync(srcFile, dstFile);
              const m = (s: string): void => { try { fs.appendFileSync('/tmp/trel-startup.log', `[${new Date().toISOString()}] [main] migrated ${s} ${srcFile} -> ${dstFile}\n`); } catch {} };
              m('copied');
            } catch (e) {
              // EROFS внутри legacyTrel — пропускаем молча.
            }
          }
        };
        for (const f of ['accounts.json', 'settings.json', 'playtime.json', 'java-cache.json', '.theme']) {
          tryCopy(f);
        }
      }
    } catch { /* realpath failed — безопасно игнорируем */ }
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
