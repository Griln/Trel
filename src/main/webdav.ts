/**
 * Синхронизация сейвов через WebDAV (Nextcloud/ownCloud/Yandex.Disk WebDAV).
 * Только saves/ — секреты и токены не ездят никуда.
 * Пароль — в keychain ОС (safeStorage), в файлах только шифртекст.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import axios from 'axios';
import AdmZip from 'adm-zip';

export interface WebdavStatus {
  configured: boolean;
  url?: string;
  login?: string;
  lastSyncAt?: number;
  lastDirection?: 'push' | 'pull';
}

interface WebdavMeta { url: string; login: string; enc: string; lastSyncAt?: number; lastDirection?: 'push' | 'pull' }

export class WebdavSync {
  constructor(private launcherDir: string, private gameDir: string) {}
  setGameDir(dir: string) { this.gameDir = dir; }

  private metaFile(): string { return path.join(this.launcherDir, 'webdav.json'); }

  private readMeta(): WebdavMeta | null {
    try {
      const raw = JSON.parse(fs.readFileSync(this.metaFile(), 'utf-8'));
      if (raw && typeof raw.url === 'string' && typeof raw.login === 'string' && typeof raw.enc === 'string') {
        return raw as WebdavMeta;
      }
    } catch { /* ignore */ }
    return null;
  }

  status(): WebdavStatus {
    const m = this.readMeta();
    if (!m) return { configured: false };
    return { configured: true, url: m.url, login: m.login, lastSyncAt: m.lastSyncAt, lastDirection: m.lastDirection };
  }

  /** Сохраняет конфиг; пароль шифруется keychain. Пустой пароль = удалить конфиг. */
  async configure(url: string, login: string, password: string): Promise<void> {
    if (!url || !login || !password) {
      try { fs.unlinkSync(this.metaFile()); } catch { /* ignore */ }
      return;
    }
    const norm = url.replace(/\/+$/, '');
    if (!/^https?:\/\/[^/\s]+(\/.*)?$/.test(norm) || norm.length > 512) throw new Error('Bad WebDAV URL');
    if (login.length > 256 || password.length > 1024) throw new Error('Bad credentials');
    const { safeStorage } = await import('electron');
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS keychain unavailable — password cannot be stored safely');
    }
    const enc = safeStorage.encryptString(password).toString('base64');
    fs.writeFileSync(this.metaFile(), JSON.stringify({ url: norm, login, enc }), { encoding: 'utf-8', mode: 0o600 });
  }

  private async creds(): Promise<{ url: string; login: string; password: string }> {
    const m = this.readMeta();
    if (!m) throw new Error('WebDAV not configured');
    const { safeStorage } = await import('electron');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS keychain unavailable');
    const password = safeStorage.decryptString(Buffer.from(m.enc, 'base64'));
    return { url: m.url, login: m.login, password };
  }

  private async request(method: string, url: string, login: string, password: string, data?: Buffer, headers?: Record<string, string>) {
    return axios({
      method, url, data, headers, timeout: 60000, maxRedirects: 0,
      auth: { username: login, password },
      maxBodyLength: 2 * 1024 * 1024 * 1024,
      validateStatus: (s) => s < 500,
    });
  }

  /** Список наших архивов на сервере (новее — раньше). */
  async remoteList(): Promise<Array<{ href: string; name: string; mtime: number; size: number }>> {
    const { url, login, password } = await this.creds();
    const res = await this.request('PROPFIND', url, login, password,
      Buffer.from('<?xml version="1.0"?><propfind xmlns:D="DAV:"><D:prop><D:getlastmodified/><D:getcontentlength/></D:prop></propfind>', 'utf-8'),
      { Depth: '1', 'Content-Type': 'application/xml' });
    if (res.status >= 400) throw new Error(`WebDAV list failed: HTTP ${res.status}`);
    const body = String(res.data ?? '');
    const out: Array<{ href: string; name: string; mtime: number; size: number }> = [];
    for (const m of body.matchAll(/<D:href>([^<]+)<\/D:href>[\s\S]*?<D:getlastmodified>([^<]*)<\/D:getlastmodified>[\s\S]*?<D:getcontentlength>([^<]*)<\/D:getcontentlength>/g)) {
      const href = decodeURIComponent(m[1]);
      const name = href.split('/').filter(Boolean).pop() ?? '';
      if (!/^trel-saves-.*\.zip$/.test(name)) continue;
      out.push({ href, name, mtime: Date.parse(m[2]) || 0, size: Number(m[3]) || 0 });
    }
    return out.sort((a, b) => b.mtime - a.mtime);
  }

  /** Push: упаковать saves/ и залить. Старые архивы сервера не трогаем. */
  async push(onProgress?: (stage: string) => void): Promise<{ file: string; size: number }> {
    const { url, login, password } = await this.creds();
    const savesDir = path.join(this.gameDir, 'saves');
    if (!fs.existsSync(savesDir)) {
      throw new Error('No saves to sync');
    }
    onProgress?.('packing');
    const zip = new AdmZip();
    let count = 0;
    const walk = (dir: string, rel: string) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = fs.lstatSync(full);
        if (st.isSymbolicLink()) continue;
        if (st.isDirectory()) walk(full, rel ? `${rel}/${name}` : name);
        else if (st.isFile()) {
          if (++count > 50000) throw new Error('Too many files');
          zip.addFile(rel ? `${rel}/${name}` : name, fs.readFileSync(full));
        }
      }
    };
    walk(savesDir, '');
    if (count === 0) throw new Error('No saves to sync');
    const buf = zip.toBuffer();
    if (buf.length > 2 * 1024 * 1024 * 1024) throw new Error('Saves too large (>2GB)');
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `trel-saves-${stamp}.zip`;
    onProgress?.('uploading');
    const res = await this.request('PUT', `${url}/${encodeURIComponent(name)}`, login, password, buf,
      { 'Content-Type': 'application/zip', 'Content-Length': String(buf.length) });
    if (res.status >= 400) throw new Error(`Upload failed: HTTP ${res.status}`);
    const meta = this.readMeta();
    if (meta) {
      meta.lastSyncAt = Date.now();
      meta.lastDirection = 'push';
      fs.writeFileSync(this.metaFile(), JSON.stringify(meta), { encoding: 'utf-8', mode: 0o600 });
    }
    return { file: name, size: buf.length };
  }

  /** Pull: скачать свежий архив и распаковать в saves/ (zip-slip проверен). */
  async pull(onProgress?: (stage: string) => void): Promise<{ file: string; worlds: number }> {
    const { url, login, password } = await this.creds();
    const list = await this.remoteList();
    if (list.length === 0) throw new Error('No cloud saves found');
    const top = list[0];
    if (top.size > 2 * 1024 * 1024 * 1024) throw new Error('Cloud archive too large');
    onProgress?.('downloading');
    const base = url.replace(/\/+$/, '');
    const fileUrl = top.href.startsWith('http') ? top.href : base + (top.href.startsWith('/') ? '' : '/') + top.href;
    const res = await axios.get(fileUrl, {
      timeout: 120000, maxRedirects: 3, responseType: 'arraybuffer',
      auth: { username: login, password },
    });
    const buf = Buffer.from(res.data);
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error('Downloaded file is not a zip');
    onProgress?.('extracting');
    const zip = new AdmZip(buf);
    const savesDir = path.join(this.gameDir, 'saves');
    fs.mkdirSync(savesDir, { recursive: true });
    let worlds = 0;
    for (const e of zip.getEntries()) {
      const name = e.entryName.replace(/\\/g, '/');
      const norm = path.posix.normalize(name);
      if (norm.startsWith('..') || path.posix.isAbsolute(norm)) throw new Error(`Unsafe entry: ${name}`);
      if (e.isDirectory) continue;
      const dest = path.join(savesDir, ...norm.split('/'));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      // Не затираем мир, который новее облачного: сначала в .bak.
      try {
        const dstSt = fs.statSync(dest);
        if (dstSt.isFile()) {
          const bak = dest + '.cloud-bak';
          fs.renameSync(dest, bak);
        }
      } catch { /* нет файла — пишем прямо */ }
      fs.writeFileSync(dest, e.getData());
      if (norm.endsWith('level.dat')) worlds++;
    }
    const meta = this.readMeta();
    if (meta) {
      meta.lastSyncAt = Date.now();
      meta.lastDirection = 'pull';
      fs.writeFileSync(this.metaFile(), JSON.stringify(meta), { encoding: 'utf-8', mode: 0o600 });
    }
    return { file: top.name, worlds };
  }
}
