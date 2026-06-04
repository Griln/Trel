import * as fs from 'node:fs';
import * as path from 'node:path';
import { LauncherSettings, MinecraftAccount, THEME_IDS, ThemeId } from '../shared/types';
import { DANGEROUS_JVM_ARGS } from '../shared/constants';

const SHELL_META = /[;&|`$><\n\r]/;

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
        // Защищаемся от мусора в полях — берём дефолты только если значение
        // правильного типа.
        const out: LauncherSettings = { ...defaults };
        if (typeof raw.gameDir === 'string' && raw.gameDir.length > 0) out.gameDir = raw.gameDir;
        if (typeof raw.memoryMb === 'number' && raw.memoryMb >= 256 && raw.memoryMb <= 32768) out.memoryMb = raw.memoryMb;
        if (typeof raw.javaPath === 'string') out.javaPath = raw.javaPath;
        if (typeof raw.lastVersionId === 'string') out.lastVersionId = raw.lastVersionId;
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
        if (typeof raw.locale === 'string' && ['ru', 'en', 'zh', 'es', 'de'].includes(raw.locale)) out.locale = raw.locale;
        if (typeof raw.showConsole === 'boolean') out.showConsole = raw.showConsole;
        if (typeof raw.preCommand === 'string' && raw.preCommand.length <= 1024 && !SHELL_META.test(raw.preCommand)) out.preCommand = raw.preCommand;
        if (typeof raw.postCommand === 'string' && raw.postCommand.length <= 1024 && !SHELL_META.test(raw.postCommand)) out.postCommand = raw.postCommand;
        if (typeof raw.prevGameDir === 'string' && raw.prevGameDir.length > 0) out.prevGameDir = raw.prevGameDir;
        saveThemeFile(this.launcherDir, out.theme);
        return out;
      }
    } catch {}
    return defaults;
  }

  saveSettings(s: LauncherSettings): void {
    const tmp = this.settingsFile + '.trel_tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(s, null, 2), 'utf-8');
      try { fs.renameSync(tmp, this.settingsFile); }
      catch { fs.copyFileSync(tmp, this.settingsFile); }
      saveThemeFile(this.launcherDir, s.theme);
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
      fs.writeFileSync(tmp, JSON.stringify(accounts, null, 2), 'utf-8');
      try { fs.renameSync(tmp, this.accountsFile); }
      catch { fs.copyFileSync(tmp, this.accountsFile); }
    } catch (e) {
      console.error('[settings] Failed to save accounts:', e);
      throw e;
    } finally {
      try { fs.unlinkSync(tmp); } catch {}
    }
  }
}
