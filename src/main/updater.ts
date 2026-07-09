import { BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import axios from 'axios';

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error' | 'disabled';
  current: string;
  latest?: string;
  percent?: number;
  bytesPerSecond?: number;
  error?: string;
  /** Если true — это portable fallback (нет автоустановки, только ссылка). */
  isPortableHint?: boolean;
}

const GH_OWNER = 'mkrlord1000-sketch';
const GH_REPO = 'Trel';

export class LauncherUpdater {
  private state: UpdateState;
  private listeners = new Set<(s: UpdateState) => void>();
  private win?: BrowserWindow;
  private _isPortable = false;

  constructor() {
    this._isPortable = !!process.env.PORTABLE_EXECUTABLE_FILE;
    this.state = { status: 'idle', current: app.getVersion() };

    // Не качаем автоматически — ждём подтверждения пользователя.
    // Это уважает лимитный трафик и даёт контроль.
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.logger = {
      info: (m: any) => console.log('[updater]', m),
      warn: (m: any) => console.warn('[updater]', m),
      error: (m: any) => console.error('[updater]', m),
      debug: () => {},
    } as any;

    autoUpdater.on('checking-for-update', () => this.push({ status: 'checking' }));
    autoUpdater.on('update-available', (info) => this.push({ status: 'available', latest: info.version }));
    autoUpdater.on('update-not-available', () => this.push({ status: 'up-to-date' }));
    autoUpdater.on('error', (e) => this.push({ status: 'error', error: e.message }));
    autoUpdater.on('download-progress', (p) =>
      this.push({ status: 'downloading', percent: Math.round(p.percent), bytesPerSecond: Math.round(p.bytesPerSecond) }),
    );
    autoUpdater.on('update-downloaded', (info) => this.push({ status: 'downloaded', latest: info.version, percent: 100 }));
  }

  attach(win: BrowserWindow) {
    this.win = win;
    this.emit();
  }

  onChange(cb: (s: UpdateState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  getState(): UpdateState { return this.state; }

  private push(patch: Partial<UpdateState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private emit() {
    for (const l of this.listeners) {
      try { l(this.state); } catch {}
    }
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('updater:state', this.state);
    }
  }

  /** Для portable: сравниваем с GitHub latest release через API. */
  private async checkPortableGitHub(): Promise<UpdateState> {
    try {
      const res = await axios.get(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/latest`, {
        timeout: 8000,
        headers: { Accept: 'application/vnd.github.v3+json' },
      });
      const tag: string = res.data?.tag_name ?? '';
      const latest = tag.replace(/^v/, '');
      if (!latest) {
        this.push({ status: 'error', error: 'Cannot parse GitHub release version' });
        return this.state;
      }
      const current = app.getVersion();
      // semver compare: просто lexicographic с разбиением на части.
      if (this.isNewer(latest, current)) {
        this.push({ status: 'available', latest, isPortableHint: true });
      } else {
        this.push({ status: 'up-to-date' });
      }
    } catch (e) {
      this.push({ status: 'error', error: (e as Error).message });
    }
    return this.state;
  }

  private isNewer(a: string, b: string): boolean {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return true;
      if (na < nb) return false;
    }
    return false;
  }

  async check(): Promise<UpdateState> {
    // В dev-режиме updater отключён — нет релизных assets.
    if (!app.isPackaged) {
      this.push({ status: 'disabled' });
      return this.state;
    }

    // Portable: нет NSIS-установщика для автообновления,
    // поэтому проверяем GitHub API и подсказываем пользователю скачать вручную.
    if (this._isPortable) {
      return this.checkPortableGitHub();
    }

    // NSIS установленная версия: стандартный electron-updater через latest.yml на GitHub.
    try {
      this.push({ status: 'checking' });
      await autoUpdater.checkForUpdates();
      // Статус обновится через события update-available / update-not-available / error.
    } catch (e) {
      this.push({ status: 'error', error: (e as Error).message });
    }
    return this.state;
  }

  /** Запустить скачивание (после того как пользователь увидел 'available'). */
  async download(): Promise<void> {
    if (this._isPortable) {
      shell.openExternal(`https://github.com/${GH_OWNER}/${GH_REPO}/releases`);
      return;
    }
    try {
      await autoUpdater.downloadUpdate();
    } catch (e) {
      this.push({ status: 'error', error: (e as Error).message });
    }
  }

  openManualUpdate(): void {
    shell.openExternal(`https://github.com/${GH_OWNER}/${GH_REPO}/releases`);
  }

  quitAndInstall() {
    if (this._isPortable) {
      this.openManualUpdate();
      return;
    }
    if (this.state.status === 'downloaded') autoUpdater.quitAndInstall();
  }
}