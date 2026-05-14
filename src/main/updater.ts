import { BrowserWindow, app } from 'electron';
import { autoUpdater } from 'electron-updater';
import axios from 'axios';

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error' | 'disabled';
  current: string;
  latest?: string;
  percent?: number;
  bytesPerSecond?: number;
  error?: string;
}

export class LauncherUpdater {
  private state: UpdateState;
  private listeners = new Set<(s: UpdateState) => void>();
  private win?: BrowserWindow;

  constructor() {
    this.state = { status: 'idle', current: app.getVersion() };

    autoUpdater.autoDownload = true;
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

  /** Check for updates. Safe to call any time. Falls back to manual GitHub check if electron-updater is not configured. */
  async check(): Promise<UpdateState> {
    if (!app.isPackaged) {
      this.push({ status: 'disabled' });
      return this.state;
    }
    // electron-updater can't update a portable build — detect via env var and fall back gracefully.
    if (process.env.PORTABLE_EXECUTABLE_FILE) {
      this.push({ status: 'disabled' });
      return this.state;
    }
    try {
      this.push({ status: 'checking' });
      const result = await autoUpdater.checkForUpdates();
      if (!result) {
        this.push({ status: 'up-to-date' });
      }
    } catch (e) {
      // Fallback: electron-updater may fail if publish provider isn't configured. Try manual check.
      const manual = await this.manualCheck().catch(() => null);
      if (!manual) {
        this.push({ status: 'error', error: (e as Error).message });
      }
    }
    return this.state;
  }

  /** Manual GitHub releases check. Used as a fallback for environments without electron-updater config. */
  private async manualCheck(): Promise<UpdateState | null> {
    // This is a placeholder: if you don't have a GitHub repo, it'll just report up-to-date.
    // Edit `repoUrl` to point to your releases page.
    const repoUrl = '';
    if (!repoUrl) {
      this.push({ status: 'up-to-date' });
      return this.state;
    }
    try {
      const { data } = await axios.get(repoUrl, { timeout: 10000 });
      const latest = (data?.tag_name || '').replace(/^v/, '');
      if (latest && latest !== this.state.current) {
        this.push({ status: 'available', latest });
      } else {
        this.push({ status: 'up-to-date' });
      }
      return this.state;
    } catch {
      return null;
    }
  }

  quitAndInstall() {
    if (this.state.status === 'downloaded') autoUpdater.quitAndInstall();
  }
}
