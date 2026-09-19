import * as fs from 'node:fs';
import * as path from 'node:path';
import { LauncherSettings, MinecraftAccount, THEME_IDS, ThemeId } from '../shared/types';
import { DANGEROUS_JVM_ARGS } from '../shared/constants';

const SHELL_META = /[;&|`$><\n\r]/;

/** Путь, принадлежащий другой ОС (Windows-путь на Linux/macOS и наоборот).
 *  Такое случается, когда settings.json переносят между системами (общий
 *  NTFS-том, бэкап). Использовать чужой путь нельзя: на Linux `D:\dannie`
 *  превращается в мусорную относительную папку. Сбрасываем на дефолт платформы. */
function isForeignPlatformPath(p: string): boolean {
  const looksWin = /^[A-Za-z]:[\\/]/.test(p) || p.includes('\\');
  const looksPosix = p.startsWith('/');
  return process.platform === 'win32' ? looksPosix : looksWin;
}

/** Сохраняет тему в файл для NSIS-аннисталлера. */
function saveThemeFile(launcherDir: string, theme?: string) {
  try {
    const p = path.join(launcherDir, '.theme');
    fs.writeFileSync(p, theme || 'mono', 'utf-8');
  } catch {}
}

export class SettingsStore {
  private settingsFile: string;
  private accountsFile: string;

  constructor(private launcherDir: string) {
    this.settingsFile = path.join(launcherDir, 'settings.json');
    this.accountsFile = path.join(launcherDir, 'accounts.json');
  }

  loadSettings(): LauncherSettings {
    const defaults: LauncherSettings = {
      gameDir: path.join(this.launcherDir, 'minecraft'),
      memoryMb: 2048,
    };
    try {
      if (fs.existsSync(this.settingsFile)) {
        const raw = JSON.parse(fs.readFileSync(this.settingsFile, 'utf-8'));
        if (!raw || typeof raw !== 'object') return defaults;
        const out = sanitizeSettings(raw, defaults.gameDir);
        saveThemeFile(this.launcherDir, out.theme);
        return out;
      }
    } catch {}
    return defaults;
  }

  saveSettings(s: LauncherSettings): void {
    // Defence in depth: IPC валидирует раньше, но прямой вызов с мусором
    // (или правленый объект в памяти) иначе уехал бы на диск как есть —
    // включая опасные jvmArgs и команды. Чистим тем же фильтром, что load.
    const clean = sanitizeSettings(s, path.join(this.launcherDir, 'minecraft'));
    const tmp = this.settingsFile + '.trel_tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(clean, null, 2), 'utf-8');
      try { fs.renameSync(tmp, this.settingsFile); }
      catch { fs.copyFileSync(tmp, this.settingsFile); }
      saveThemeFile(this.launcherDir, clean.theme);
    } catch (e) {
      console.error('[settings] Failed to save settings:', e);
      throw e;
    } finally {
      try { fs.unlinkSync(tmp); } catch {}
    }
  }

  loadAccounts(): MinecraftAccount[] {
    try {
      if (fs.existsSync(this.accountsFile)) {
        const raw = JSON.parse(fs.readFileSync(this.accountsFile, 'utf-8'));
        if (!Array.isArray(raw)) return [];
        // Фильтруем мусорные записи: должны быть string uuid и string name.
        return raw.filter((a): a is MinecraftAccount =>
          a && typeof a === 'object'
          && typeof a.uuid === 'string' && a.uuid.length > 0
          && typeof a.name === 'string' && a.name.length > 0
          && (a.type === 'offline' || a.type === 'online' || a.type === undefined),
        );
      }
    } catch {}
    return [];
  }

  saveAccounts(accounts: MinecraftAccount[]): void {
    const tmp = this.accountsFile + '.trel_tmp';
    try {
      // 0600: внутри refresh/access-токены Microsoft — другим юзерам системы
      // их читать незачем. rename сохраняет биты tmp-файла.
      fs.writeFileSync(tmp, JSON.stringify(accounts, null, 2), { encoding: 'utf-8', mode: 0o600 });
      try { fs.renameSync(tmp, this.accountsFile); }
      catch { fs.copyFileSync(tmp, this.accountsFile); }
      try { fs.chmodSync(this.accountsFile, 0o600); } catch {}
      // Старые установки могли оставить 0644: подтягиваем при каждой записи.
      try {
        if ((fs.statSync(this.accountsFile).mode & 0o777) !== 0o600) fs.chmodSync(this.accountsFile, 0o600);
      } catch {}
    } catch (e) {
      console.error('[settings] Failed to save accounts:', e);
      throw e;
    } finally {
      try { fs.unlinkSync(tmp); } catch {}
    }
  }
}

function sanitizeSettings(raw: Record<string, unknown> | LauncherSettings, defaultGameDir: string): LauncherSettings {
  const defaults: LauncherSettings = { gameDir: defaultGameDir, memoryMb: 2048 };
  // Защищаемся от мусора в полях — берём дефолты только если значение
  // правильного типа.
  const out: LauncherSettings = { ...defaults };
  if (typeof raw.gameDir === 'string' && raw.gameDir.length > 0 && !isForeignPlatformPath(raw.gameDir)) out.gameDir = raw.gameDir;
  if (typeof raw.memoryMb === 'number' && raw.memoryMb >= 256 && raw.memoryMb <= 32768) out.memoryMb = raw.memoryMb;
  if (typeof raw.javaPath === 'string' && !isForeignPlatformPath(raw.javaPath)) out.javaPath = raw.javaPath;
  if (typeof raw.lastVersionId === 'string') out.lastVersionId = raw.lastVersionId;
  if (raw.lastVersionEdition === 'java' || raw.lastVersionEdition === 'bedrock') out.lastVersionEdition = raw.lastVersionEdition;
  if (typeof raw.theme === 'string' && (THEME_IDS as string[]).includes(raw.theme)) {
          out.theme = raw.theme as ThemeId;
  }
  if (typeof raw.jvmArgs === 'string') {
          const parts = (raw.jvmArgs as string).split(/\s+/).filter(Boolean);
          if (parts.every((p: string) => !DANGEROUS_JVM_ARGS.test(p))) out.jvmArgs = raw.jvmArgs;
  }
  if (typeof raw.gameWidth === 'number' && raw.gameWidth >= 1) out.gameWidth = raw.gameWidth;
  if (typeof raw.gameHeight === 'number' && raw.gameHeight >= 1) out.gameHeight = raw.gameHeight;
  if (typeof raw.fullscreen === 'boolean') out.fullscreen = raw.fullscreen;
  if (typeof raw.showSnapshots === 'boolean') out.showSnapshots = raw.showSnapshots;
  if (typeof raw.closeOnLaunch === 'boolean') out.closeOnLaunch = raw.closeOnLaunch;
  if (typeof raw.lockOnLaunch === 'boolean') out.lockOnLaunch = raw.lockOnLaunch;
  if (typeof raw.showIntro === 'boolean') out.showIntro = raw.showIntro;
  if (typeof raw.autoHideSidebar === 'boolean') out.autoHideSidebar = raw.autoHideSidebar;
  if (typeof raw.locale === 'string' && (['ru', 'en'] as string[]).includes(raw.locale)) out.locale = raw.locale as LauncherSettings['locale'];
  if (typeof raw.showConsole === 'boolean') out.showConsole = raw.showConsole;
  if (typeof raw.preCommand === 'string' && raw.preCommand.length <= 1024 && !SHELL_META.test(raw.preCommand)) out.preCommand = raw.preCommand;
  if (typeof raw.postCommand === 'string' && raw.postCommand.length <= 1024 && !SHELL_META.test(raw.postCommand)) out.postCommand = raw.postCommand;
  if (typeof raw.prevGameDir === 'string' && raw.prevGameDir.length > 0) out.prevGameDir = raw.prevGameDir;
  if (typeof raw.autoBackup === 'boolean') out.autoBackup = raw.autoBackup;
  if (Array.isArray(raw.pinnedVersions)) {
    const pins = (raw.pinnedVersions as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 128).slice(0, 50);
    if (pins.length > 0) out.pinnedVersions = pins;
  }
  if (raw.perfPreset === 'potato' || raw.perfPreset === 'balanced' || raw.perfPreset === 'ultra') out.perfPreset = raw.perfPreset;
  if (typeof raw.proxyUrl === 'string' && raw.proxyUrl.length > 0 && raw.proxyUrl.length <= 512) {
    // Грубая форма; точную проверку делает validateSettings/IPC.
    if (/^https?:\/\/[^\s/]+(:\d+)?\/?$/.test(raw.proxyUrl.trim())) out.proxyUrl = raw.proxyUrl.trim();
  }
  return out;
}
