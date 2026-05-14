import * as fs from 'node:fs';
import * as path from 'node:path';
import { LauncherSettings, MinecraftAccount } from '../shared/types';

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
        return { ...defaults, ...raw };
      }
    } catch {}
    return defaults;
  }

  saveSettings(s: LauncherSettings): void {
    fs.writeFileSync(this.settingsFile, JSON.stringify(s, null, 2), 'utf-8');
  }

  loadAccounts(): MinecraftAccount[] {
    try {
      if (fs.existsSync(this.accountsFile)) {
        return JSON.parse(fs.readFileSync(this.accountsFile, 'utf-8'));
      }
    } catch {}
    return [];
  }

  saveAccounts(accounts: MinecraftAccount[]): void {
    fs.writeFileSync(this.accountsFile, JSON.stringify(accounts, null, 2), 'utf-8');
  }
}
