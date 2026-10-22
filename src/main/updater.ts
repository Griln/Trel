import { BrowserWindow, app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error' | 'disabled';
  current: string;
  latest?: string;
  percent?: number;
  bytesPerSecond?: number;
  error?: string;
  /** If true — this is the portable fallback (no auto-install, only a link). */
  isPortableHint?: boolean;
  /** Where the update file was downloaded (portable). */
  downloadedPath?: string;
}

const GH_OWNER = 'Griln';
const GH_REPO = 'Trel';

export class LauncherUpdater {
  private state: UpdateState;
  private listeners = new Set<(s: UpdateState) => void>();
  private win?: BrowserWindow;
  private _isPortable = false;
  private releaseCache: { at: number; tag: string; assets: any[] } | null = null;
  private downloading = false;

  constructor() {
    // Portable: Windows NSIS-portable (.exe) or Linux AppImage.
    // They have no built-in auto-update — we send the user to GitHub Releases.
    this._isPortable =
      !!process.env.PORTABLE_EXECUTABLE_FILE ||
      !!process.env.APPIMAGE ||
      process.platform === 'linux' && app.getAppPath().includes('/tmp/.mount_');
    this.state = { status: 'idle', current: app.getVersion() };

    // We do not download automatically — we wait for the user's confirmation.
    // This respects limited traffic and gives control.
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

  /** For portable: compare with the latest GitHub release via the API. */
  private async checkPortableGitHub(): Promise<UpdateState> {
    try {
      this.push({ status: 'checking' });
      const rel = await this.fetchLatestRelease();
      const tag: string = rel.tag ?? '';
      const latest = tag.replace(/^v/, '');
      if (!latest) {
        this.push({ status: 'error', error: 'Cannot parse GitHub release version' });
        return this.state;
      }
      const current = app.getVersion();
      // semver compare: simply lexicographic with a split into parts.
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

  /** Fresh release from GitHub: the official API, and on failure — an HTML redirect
      /releases/latest (not subject to the rate limit). Three attempts with backoff
      and a 5 minute cache: repeated checks are instant and do not burn the limits. */
  private async fetchLatestRelease(force = false): Promise<{ tag: string; assets: any[] }> {
    if (!force && this.releaseCache && Date.now() - this.releaseCache.at < 5 * 60_000) {
      return this.releaseCache;
    }
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await axios.get(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/latest`, {
          timeout: 6000,
          headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'Trel-Launcher' },
        });
        const tag = String(res.data?.tag_name ?? '');
        if (tag) {
          const out = { tag, assets: Array.isArray(res.data?.assets) ? res.data.assets : [] };
          this.releaseCache = { at: Date.now(), tag, assets: out.assets };
          return out;
        }
      } catch (e) { lastErr = e; }
      try {
        const res = await axios.get(`https://github.com/${GH_OWNER}/${GH_REPO}/releases/latest`, {
          timeout: 6000,
          maxRedirects: 0,
          validateStatus: (s) => (s >= 200 && s < 400),
        });
        const loc = String(res.headers.location ?? '');
        const m = loc.match(/\/releases\/tag\/(v?[\w.-]+)/);
        if (m) {
          const out = { tag: m[1], assets: [] as any[] };
          this.releaseCache = { at: Date.now(), tag: out.tag, assets: [] };
          return out;
        }
      } catch (e) { lastErr = e; }
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
    throw lastErr instanceof Error ? lastErr : new Error('GitHub недоступен');
  }

  /** Pick the release asset for the current platform. */
  private pickAsset(assets: any[]): any {
    const name = (a: any) => String(a?.name ?? '');
    if (process.platform === 'win32') {
      return assets.find((a) => /-x64\.exe$/.test(name(a))) ?? assets.find((a) => name(a).endsWith('.exe'));
    }
    return assets.find((a) => name(a).endsWith('.AppImage'));
  }

  /** Fast and reliable download: 8 parallel chunks when Range is supported,
      otherwise a single stream; if the direct link fails — proxy mirrors. */
  private async downloadFast(url: string, dest: string, expectedSize: number, onProgress: (loaded: number, total: number) => void): Promise<void> {
    const mirrors = [url, 'https://mirror.ghproxy.com/' + url, 'https://gh-proxy.com/' + url];
    let lastErr: unknown = null;
    for (const u of mirrors) {
      try {
        await this.downloadFastFrom(u, dest, onProgress);
        const st = fs.statSync(dest);
        if (expectedSize > 0 && st.size !== expectedSize) {
          throw new Error(`Размер файла не совпадает: ${st.size} != ${expectedSize}`);
        }
        return;
      } catch (e) { lastErr = e; }
    }
    throw lastErr instanceof Error ? lastErr : new Error('Не удалось скачать обновление');
  }

  private async downloadFastFrom(url: string, dest: string, onProgress: (loaded: number, total: number) => void): Promise<void> {
    const tmp = dest + '.part';
    let total = 0;
    let ranges = false;
    try {
      const head = await axios.head(url, { timeout: 15000, maxRedirects: 5 });
      total = Number(head.headers['content-length']) || 0;
      ranges = String(head.headers['accept-ranges'] || '').toLowerCase().includes('bytes');
    } catch { /* single stream */ }

    if (total > 8 * 1024 * 1024 && ranges) {
      const CHUNKS = 8;
      const chunk = Math.ceil(total / CHUNKS);
      let done = 0;
      const fd = fs.openSync(tmp, 'w');
      try {
        fs.ftruncateSync(fd, total);
        const jobs: Promise<void>[] = [];
        for (let i = 0; i < CHUNKS; i++) {
          const start = i * chunk;
          const end = Math.min(total - 1, start + chunk - 1);
          if (start > end) continue;
          jobs.push((async () => {
            const resp = await axios.get(url, {
              responseType: 'stream',
              timeout: 120_000,
              headers: { Range: `bytes=${start}-${end}` },
              validateStatus: (st) => st === 206,
            });
            let pos = start;
            await new Promise<void>((res, rej) => {
              resp.data.on('data', (c: Buffer) => {
                // A server without 206 would send everything from scratch — we write only our range.
                const room = end - pos + 1;
                if (room <= 0) return;
                const slice = c.length > room ? c.subarray(0, room) : c;
                fs.writeSync(fd, slice, 0, slice.length, pos);
                pos += slice.length;
                done += slice.length;
                onProgress(done, total);
              });
              resp.data.on('end', () => {
                if (pos !== end + 1) rej(new Error(`Chunk incomplete: ${start}-${end}`));
                else res();
              });
              resp.data.on('error', rej);
            });
          })());
        }
        try { await Promise.all(jobs); } finally { fs.closeSync(fd); }
        fs.renameSync(tmp, dest);
      } catch (e) {
        try { fs.closeSync(fd); } catch {}
        try { fs.unlinkSync(tmp); } catch {}
        throw e;
      }
    } else {
      const resp = await axios.get(url, { responseType: 'stream', timeout: 300_000, maxRedirects: 5 });
      const t = Number(resp.headers['content-length']) || total || 0;
      const out = fs.createWriteStream(tmp);
      let loaded = 0;
      await new Promise<void>((res, rej) => {
        resp.data.on('data', (c: Buffer) => { loaded += c.length; onProgress(loaded, t); });
        resp.data.on('error', (e: Error) => { try { out.close(); } catch {} rej(e); });
        out.on('error', rej);
        out.on('finish', () => res());
        resp.data.pipe(out);
      });
      fs.renameSync(tmp, dest);
    }
  }

  /** In-app download of a release asset (portable): the progress shows up in the
      update card, the file goes to "Downloads", the install button reveals it. */
  private async downloadPortableAsset(): Promise<void> {
    if (this.downloading) return;
    this.downloading = true;
    try {
      let rel: { tag: string; assets: any[] } | null = this.releaseCache;
      if (!rel || !rel.assets.length) {
        this.push({ status: 'checking' });
        rel = await this.fetchLatestRelease(true);
      }
      const release = rel;
      const asset = release.assets.length ? this.pickAsset(release.assets) : null;
      if (!asset?.browser_download_url) {
        // We did not get the asset list (the API was unavailable) — send the user to the release page.
        this.openManualUpdate();
        return;
      }
      const latest = String(release.tag).replace(/^v/, '');
      const dest = path.join(app.getPath('downloads'), String(asset.name));
      this.push({ status: 'downloading', percent: 0, latest, isPortableHint: true });
      await this.downloadFast(String(asset.browser_download_url), dest, Number(asset.size) || 0, (loaded, total) => {
        const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
        this.push({ status: 'downloading', percent: pct, latest, isPortableHint: true });
      });
      this.push({ status: 'downloaded', latest, percent: 100, isPortableHint: true, downloadedPath: dest });
    } catch (e) {
      this.push({ status: 'error', error: (e as Error).message });
    } finally {
      this.downloading = false;
    }
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
    // In dev mode the updater is disabled — there are no release assets.
    if (!app.isPackaged) {
      this.push({ status: 'disabled' });
      return this.state;
    }

    // Portable: there is no NSIS installer for auto-update,
    // so we check the GitHub API and suggest that the user downloads manually.
    if (this._isPortable) {
      return this.checkPortableGitHub();
    }

    // NSIS installed version: the standard electron-updater via latest.yml on GitHub.
    // One retry after a second — the network at startup is often unstable.
    const attempt = async (): Promise<boolean> => {
      try {
        await autoUpdater.checkForUpdates();
        return true;
      } catch {
        return false;
      }
    };
    this.push({ status: 'checking' });
    const ok = await attempt();
    if (!ok) {
      await new Promise((r) => setTimeout(r, 1200));
      const retry = await attempt();
      if (!retry) {
        // The 'error' event from autoUpdater may have already arrived; if not — we set it ourselves.
        if (this.state.status === 'checking') this.push({ status: 'error', error: 'Не удалось проверить обновления' });
      }
    }
    // The status is updated via the update-available / update-not-available / error events.
    return this.state;
  }

  /** Start the download (after the user has seen 'available'). */
  async download(): Promise<void> {
    if (this._isPortable) {
      // Portable: we download the asset right in the app (fast, parallel, with mirrors).
      await this.downloadPortableAsset();
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
      // If the asset is already downloaded — show it in the folder, otherwise send the user to Releases.
      const p = this.state.downloadedPath;
      if (p && fs.existsSync(p)) shell.showItemInFolder(p);
      else this.openManualUpdate();
      return;
    }
    if (this.state.status === 'downloaded') autoUpdater.quitAndInstall();
  }
}