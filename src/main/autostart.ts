import { app, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Автозапуск лаунчера вместе с входом в систему.
 *
 * Linux:    XDG-совместимый .desktop в ~/.config/autostart/trel.desktop
 * macOS:    app.setLoginItemSettings (нативный LoginItems)
 * Windows:  .lnk-ярлык в %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
 *
 * Portable-сборка Trel (один .exe без распаковки) на Windows не стартует
 * автоматически: PORTABLE_EXECUTABLE_FILE — это временный распакованный
 * путь, удаляемый при выходе. Реальный .exe лежит там, где пользователь
 * его сохранил, и путь к нему из Electron не известен. В этом случае
 * автоматически включить нельзя — UI должен сообщить об этом пользователю.
 *
 * Detect-для-существования проверяет не только наличие файла, но и валидность
 * цели (на Windows — что `.lnk` указывает на существующий .exe; на Linux —
 * что `Exec=` указывает на существующий бинарь). Это защищает от случая,
 * когда Trel перенесли/удалили, а .desktop/.lnk остался.
 */

const LINUX_DESKTOP_FILE = 'trel.desktop';

/** Содержимое .desktop для автозапуска Trel на Linux. */
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
    // Tray задержан на 2с, чтобы DE успел полностью подняться
    // (на некоторых сессиях GNOME/Wayland панели появляются позже).
    'X-GNOME-Autostart-Delay=2',
    '',
  ].join('\n');
}

/** Находит каталог автозапуска XDG: ~/.config/autostart. */
function linuxAutostartDir(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  const config = xdgConfig && xdgConfig.length > 0
    ? xdgConfig
    : path.join(os.homedir(), '.config');
  return path.join(config, 'autostart');
}

/** На macOS используем нативный LoginItems API. */
function isDarwin(): boolean { return process.platform === 'darwin'; }
function isLinux(): boolean { return process.platform === 'linux'; }
function isWin(): boolean { return process.platform === 'win32'; }

/** Путь к иконке на Linux (общая логика с desktop-ярлыком в ipc.ts). */
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

/** Путь к Startup-папке на Windows. */
function windowsStartupDir(): string {
  // Классический Startup лежит в %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
  const appData = process.env.APPDATA;
  return path.join(appData || path.join(os.homedir(), 'AppData', 'Roaming'),
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
}

function windowsStartupLink(): string {
  return path.join(windowsStartupDir(), 'Trel.lnk');
}

/** На Windows portable-сборка не поддерживает автоапдейт/автозапуск. */
function isWindowsPortable(): boolean {
  return isWin() && !!process.env.PORTABLE_EXECUTABLE_FILE;
}

/** Реальный путь к бинарю для автозапуска (portable не подходит). */
function windowsStartupTarget(): string | null {
  // Portable: process.execPath — временный распакованный файл, который
  // исчезнет при выходе. Автозапуск по нему будет битым.
  if (isWindowsPortable()) return null;
  return process.execPath;
}

/** Получить текущее состояние автозапуска. */
export function getAutoLaunch(): { enabled: boolean; unavailable?: boolean; reason?: string } {
  // Linux — самое сложное из-за pluggable DE. Проверяем только файл.
  if (isLinux()) {
    const file = path.join(linuxAutostartDir(), LINUX_DESKTOP_FILE);
    if (!fs.existsSync(file)) return { enabled: false };
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const execMatch = /^Exec="?([^"\n]+)"?/m.exec(content);
      // Если Exec-пропал/битый — считаем автозапуск выключенным.
      if (!execMatch || !execMatch[1] || !fs.existsSync(execMatch[1].trim())) return { enabled: false };
      // Ярлык на старый путь после переезда лаунчера — тоже «выключен»,
      // иначе UI врёт что автозапуск наш.
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
    // Реальный .exe portable хранит в PORTABLE_EXECUTABLE_FILE, но Startup
    // ярлык должен вести на путь, который существует после выхода из Trel —
    // это работает. Но он зависит от того, где пользователь сохранит .exe.
    // На некоторых сборках это рабочий Portable-путь, проверяем что он жив.
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

/** Включить/выключить автозапуск. */
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
    // Для portable Startup-ярлык ведёт на реальный .exe. Это валидно.
    const link = windowsStartupLink();
    try {
      fs.mkdirSync(windowsStartupDir(), { recursive: true });
      shell.writeShortcutLink(link, 'create', {
        target: portable,
        cwd: path.dirname(portable),
        // icon — рядом с .exe если положили, иначе сам .exe.
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
    // Если уже есть — корректно обновляем, чтобы не создавать дублирующий ярлык.
    if (fs.existsSync(link)) {
      try {
        const meta = shell.readShortcutLink(link);
        if (meta.target && fs.existsSync(meta.target)) {
          // Уже валиден — не трогаем.
          return { ok: true };
        }
        // Битый — создаём заново.
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
