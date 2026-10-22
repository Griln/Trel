import { app, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Launching the launcher together with the system login.
 *
 * Linux:    XDG-compatible .desktop in ~/.config/autostart/trel.desktop
 * macOS:    app.setLoginItemSettings (native LoginItems)
 * Windows:  .lnk shortcut in %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
 *
 * The portable build of Trel (a single .exe without unpacking) does not
 * start automatically on Windows: PORTABLE_EXECUTABLE_FILE is a temporary
 * unpacked path that is deleted on exit. The real .exe lives wherever the
 * user saved it, and its path is not known to Electron. In this case
 * autostart cannot be enabled — the UI must report that to the user.
 *
 * The existence detection checks not only the presence of the file, but also the
 * validity of the target (on Windows — that the `.lnk` points to an existing
 * .exe; on Linux — that `Exec=` points to an existing binary). This protects
 * against the case where Trel was moved/deleted while the .desktop/.lnk stayed.
 */

const LINUX_DESKTOP_FILE = 'trel.desktop';

/** Contents of the .desktop file for autostart of Trel on Linux. */
function linuxAutostartDesktopContent(exePath: string, iconPath: string): string {
  return [
    '[Desktop Entry]',
    'Version=1.0',
    'Type=Application',
    'Name=Trel',
    'Comment=Trel — launcher for Minecraft',
    `Exec="${exePath.replace(/"/g, '')}"`,
    `Icon=${iconPath}`,
    'Terminal=false',
    'Categories=Game;',
    'StartupWMClass=Trel',
    'X-GNOME-Autostart-enabled=true',
    // The tray is delayed by 2s so that the DE has time to fully come up
    // (on some GNOME/Wayland sessions the panels appear later).
    'X-GNOME-Autostart-Delay=2',
    '',
  ].join('\n');
}

/** Finds the XDG autostart directory: ~/.config/autostart. */
function linuxAutostartDir(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  const config = xdgConfig && xdgConfig.length > 0
    ? xdgConfig
    : path.join(os.homedir(), '.config');
  return path.join(config, 'autostart');
}

/** On macOS we use the native LoginItems API. */
function isDarwin(): boolean { return process.platform === 'darwin'; }
function isLinux(): boolean { return process.platform === 'linux'; }
function isWin(): boolean { return process.platform === 'win32'; }

/** Path to the icon on Linux (shared logic with the desktop shortcut in ipc.ts). */
function linuxIconPath(): string {
  const exeDir = path.dirname(process.execPath);
  const candidates = [
    '/usr/share/pixmaps/trel.png',
    '/usr/share/icons/hicolor/256x256/apps/trel.png',
    path.join(exeDir, 'resources', 'build', 'icon.png'),
    path.join(exeDir, 'icon.png'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return '/usr/share/pixmaps/trel.png';
}

/** Path to the Startup folder on Windows. */
function windowsStartupDir(): string {
  // The classic Startup folder lives in %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
  const appData = process.env.APPDATA;
  return path.join(appData || path.join(os.homedir(), 'AppData', 'Roaming'),
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
}

function windowsStartupLink(): string {
  return path.join(windowsStartupDir(), 'Trel.lnk');
}

/** On Windows the portable build does not support auto-update/autostart. */
function isWindowsPortable(): boolean {
  return isWin() && !!process.env.PORTABLE_EXECUTABLE_FILE;
}

/** Real path to the binary for autostart (portable does not fit). */
function windowsStartupTarget(): string | null {
  // Portable: process.execPath is a temporary unpacked file that
  // disappears on exit. Autostart via it would be broken.
  if (isWindowsPortable()) return null;
  return process.execPath;
}

/** Get the current autostart state. */
export function getAutoLaunch(): { enabled: boolean; unavailable?: boolean; reason?: string } {
  // Linux is the hardest one because of pluggable DEs. We only check the file.
  if (isLinux()) {
    const file = path.join(linuxAutostartDir(), LINUX_DESKTOP_FILE);
    if (!fs.existsSync(file)) return { enabled: false };
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const execMatch = /^Exec="?([^"\n]+)"?/m.exec(content);
      // If the Exec line is missing/broken — we consider autostart disabled.
      if (!execMatch || !execMatch[1] || !fs.existsSync(execMatch[1].trim())) return { enabled: false };
      // A shortcut pointing to the old path after the launcher moved counts
      // as "disabled" too, otherwise the UI lies about autostart being ours.
      try {
        if (fs.realpathSync(execMatch[1].trim()) !== fs.realpathSync(process.execPath)) return { enabled: false };
      } catch { return { enabled: false }; }
      return { enabled: true };
    } catch { return { enabled: false }; }
  }

  if (isDarwin()) {
    try {
      const settings = app.getLoginItemSettings();
      return { enabled: !!settings.openAtLogin };
    } catch (e) {
      return { enabled: false, unavailable: true, reason: String((e as Error).message) };
    }
  }

  // Windows
  if (isWindowsPortable()) {
    // The real portable .exe is stored in PORTABLE_EXECUTABLE_FILE, but the
    // Startup shortcut must lead to a path that still exists after Trel
    // exits — that works. But it depends on where the user saves the .exe.
    // On some builds this is a working Portable path, we check that it is alive.
    const portableExe = process.env.PORTABLE_EXECUTABLE_FILE;
    if (!portableExe || !fs.existsSync(portableExe)) {
      return { enabled: false, unavailable: true, reason: 'Portable .exe path not known' };
    }
    const link = windowsStartupLink();
    if (!fs.existsSync(link)) return { enabled: false };
    try {
      const meta = shell.readShortcutLink(link);
      return { enabled: !!(meta.target && fs.existsSync(meta.target)) };
    } catch { return { enabled: false }; }
  }

  const link = windowsStartupLink();
  if (!fs.existsSync(link)) return { enabled: false };
  try {
    const meta = shell.readShortcutLink(link);
    return { enabled: !!(meta.target && fs.existsSync(meta.target)) };
  } catch { return { enabled: false }; }
}

/** Enable/disable autostart. */
export function setAutoLaunch(enabled: boolean): { ok: boolean; unavailable?: boolean; reason?: string } {
  // Linux
  if (isLinux()) {
    const dir = linuxAutostartDir();
    const file = path.join(dir, LINUX_DESKTOP_FILE);
    if (!enabled) {
      try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (e) { console.warn('[autostart] rm failed:', e); }
      return { ok: true };
    }
    const exePath = process.execPath;
    if (!fs.existsSync(exePath)) return { ok: false, reason: 'execPath does not exist' };
    try {
      fs.mkdirSync(dir, { recursive: true });
      const iconPath = linuxIconPath();
      fs.writeFileSync(file, linuxAutostartDesktopContent(exePath, iconPath), { mode: 0o644 });
      try { fs.chmodSync(file, 0o644); } catch {}
    } catch (e) {
      return { ok: false, reason: String((e as Error).message) };
    }
    return { ok: true };
  }

  if (isDarwin()) {
    try {
      app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String((e as Error).message) };
    }
  }

  // Windows
  if (isWindowsPortable() && enabled) {
    const portable = process.env.PORTABLE_EXECUTABLE_FILE;
    if (!portable || !fs.existsSync(portable)) {
      return { ok: false, unavailable: true, reason: 'Portable .exe path not known — autostart cannot be enabled' };
    }
    // For portable the Startup shortcut leads to the real .exe. That is valid.
    const link = windowsStartupLink();
    try {
      fs.mkdirSync(windowsStartupDir(), { recursive: true });
      shell.writeShortcutLink(link, 'create', {
        target: portable,
        cwd: path.dirname(portable),
        // icon — next to the .exe if there is one, otherwise the .exe itself.
        icon: portable,
        iconIndex: 0,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: String((e as Error).message) };
    }
  }

  const target = windowsStartupTarget();
  const link = windowsStartupLink();

  if (!enabled) {
    try { if (fs.existsSync(link)) fs.unlinkSync(link); } catch (e) { console.warn('[autostart] rm failed:', e); }
    return { ok: true };
  }

  if (!target) return { ok: false, reason: 'Cannot resolve executable for autostart' };
  try {
    fs.mkdirSync(windowsStartupDir(), { recursive: true });
    // If it already exists — update it correctly so we do not create a duplicate shortcut.
    if (fs.existsSync(link)) {
      try {
        const meta = shell.readShortcutLink(link);
        if (meta.target && fs.existsSync(meta.target)) {
          // Already valid — leave it alone.
          return { ok: true };
        }
        // Broken — create it from scratch.
        fs.unlinkSync(link);
      } catch {
        try { fs.unlinkSync(link); } catch {}
      }
    }
    shell.writeShortcutLink(link, 'create', {
      target,
      cwd: path.dirname(target),
      icon: target,
      iconIndex: 0,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String((e as Error).message) };
  }
}
