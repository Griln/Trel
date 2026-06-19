import axios from 'axios';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import { BrowserWindow } from 'electron';
import { DownloadProgress, BedrockVersionInfo } from '../shared/types';
import { BEDROCK_SOURCE_HOST } from '../shared/constants';
import { isSafeVersionId } from './safeIds';
import { scanDownloadedFileAsync, verifyDownloadSource } from './download-security';

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const BEDROCK_EXPECTED_SIZE_MAX = 2 * 1024 * 1024 * 1024;
const BEDROCK_MIN_REASONABLE = 10 * 1024 * 1024; // 10 МБ — абсолютный минимум для APK
const BEDROCK_HUB_BASE = `https://${BEDROCK_SOURCE_HOST}`;

interface ResolvedBedrockDownload {
  url: string;
  referer: string;
  cookie?: string;
}

function mergeCookies(...headers: Array<any>): string | undefined {
  const jar = new Map<string, string>();
  for (const h of headers) {
    const raw = h?.['set-cookie'];
    if (!raw) continue;
    for (const c of raw as string[]) {
      const first = String(c).split(';')[0];
      const eq = first.indexOf('=');
      if (eq > 0) jar.set(first.slice(0, eq), first.slice(eq + 1));
    }
  }
  return jar.size ? Array.from(jar, ([k, v]) => `${k}=${v}`).join('; ') : undefined;
}

function bedrockBrowserHeaders(referer?: string, cookie?: string): Record<string, string> {
  return {
    'User-Agent': MOBILE_UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/vnd.android.package-archive,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': referer || `${BEDROCK_HUB_BASE}/download-mcpe/`,
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

function safeRm(p: string) {
  try { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); } catch {}
}

function safeRenameSync(src: string, dest: string): void {
  try { fs.renameSync(src, dest); return; }
  catch (e: any) {
    if (e?.code === 'EXDEV') { fs.copyFileSync(src, dest); fs.unlinkSync(src); return; }
    throw e;
  }
}

function sha1File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(file);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function ensureDir(p: string) { await fs.promises.mkdir(p, { recursive: true }); }

/**
 * Turn a raw mcpehub slug into a canonical version id, or null if the
 * entry isn't a real Bedrock release.
 *
 * Accepted shapes (after stripping the `minecraft[-pe|-pocket-edition]`
 * prefix and any trailing descriptor like `-wild`, `-caves`, `-free`,
 * `-besplatno`, `-for-android`, `-xbox`):
 *
 *   "1-26"        → "1.26"          (current scheme)
 *   "1-26-3"      → "1.26.3"        (with patch)
 *   "26-40-20"    → "26.40.20"      (2026 year-based scheme)
 *   "1-19"        → "1.19"          (suffix already stripped)
 *   "115"         → "1.15"          (legacy "1NN" = "1.NN")
 *   "14"          → "1.4"           (legacy "1N"  = "1.N")
 *
 * Defensive: any slug containing "java" (case-insensitive) is rejected
 * so a future page change can't leak Java Edition entries into the
 * Bedrock list.
 */
function parseBedrockSlug(slug: string): string | null {
  if (/java/i.test(slug)) return null;
  // Must start with "minecraft" (or "skachat-minecraft" etc.)
  if (!/^minecraft/i.test(slug)) return null;

  // Strip every known prefix variant
  let s = slug
    .replace(/^skachat-minecraft-/, '')
    .replace(/^minecraft-pocket-edition-/, '')
    .replace(/^minecraft-pe-/, '')
    .replace(/^minecraft-free-/, '')
    .replace(/^minecraft-/, '');

  // If we still have a non-numeric leading chunk, give up
  if (!/^[\d-]/.test(s)) return null;

  // Walk groups: keep leading digit groups (as strings, to preserve
  // leading zeros like "01"), stop at the first non-digit group (which
  // is a descriptive suffix like "wild", "caves", "free", "besplatno",
  // "for", "android", "xbox", etc.).
  const groups = s.split('-');
  const parts: string[] = [];
  for (const g of groups) {
    if (/^\d+$/.test(g)) {
      parts.push(g);
    } else {
      break;
    }
  }

  if (parts.length === 0) return null;

  // Legacy single-number versions: 2 or 3 digits starting with "1"
  if (parts.length === 1) {
    const s2 = parts[0];
    if ((s2.length === 2 || s2.length === 3) && s2.startsWith('1')) {
      return `1.${s2.slice(1)}`;
    }
    return null;
  }

  // Multi-part: every part must be a reasonable version component (0-99)
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (!Number.isFinite(n) || n < 0 || n > 99) return null;
  }
  if (parts.length > 4) return null;
  return parts.join('.');
}

export class BedrockInstaller {
  private gameDir: string;
  private lastReport = 0;
  private installing = new Map<string, Promise<any>>();

  constructor(gameDir: string) { this.gameDir = gameDir; }
  setGameDir(dir: string) { this.gameDir = dir; }

  bedrockDir(): string { return path.join(this.gameDir, 'bedrock'); }

  versionDir(versionId: string): string {
    return path.join(this.bedrockDir(), versionId);
  }

  apkPath(versionId: string): string {
    return path.join(this.versionDir(versionId), 'minecraft.apk');
  }

  isInstalled(versionId: string): boolean {
    const apk = this.apkPath(versionId);
    try {
      const stat = fs.statSync(apk);
      return stat.isFile() && stat.size > BEDROCK_MIN_REASONABLE;
    } catch { return false; }
  }

  installedVersionIds(): string[] {
    const dir = this.bedrockDir();
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir)) {
      const apk = path.join(dir, entry, 'minecraft.apk');
      try {
        const s = fs.statSync(apk);
        if (s.isFile() && s.size > BEDROCK_MIN_REASONABLE) out.push(entry);
      } catch {}
    }
    return out;
  }

  async fetchVersions(): Promise<BedrockVersionInfo[]> {
    // mcpehub.org is a DLE site. With a mobile UA, the version list and
    // each article page expose direct download links. Page 1 alone holds
    // ~26 versions across all eras; pages 2+ are pagination stubs that
    // repeat the top 3, so we only scrape page 1.
    const byId = new Map<string, BedrockVersionInfo>();
    const seenPosts = new Set<number>();
    const resp = await axios.get(`${BEDROCK_HUB_BASE}/download-mcpe/`, {
      headers: bedrockBrowserHeaders(`${BEDROCK_HUB_BASE}/`),
      timeout: 20000,
    });
    const html = typeof resp.data === 'string' ? resp.data : String(resp.data || '');
    // /download-mcpe/<DLE-post-id>-<version-slug>.html
    const re = /href="(?:https?:\/\/mcpehub\.org)?\/download-mcpe\/(\d+)-([^"]+)\.html"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const postId = parseInt(m[1], 10);
      const rawSlug = m[2];
      if (!Number.isFinite(postId) || seenPosts.has(postId)) continue;
      const id = parseBedrockSlug(rawSlug);
      if (!id) continue;
      seenPosts.add(postId);
      const entry = { id, type: 'bedrock' as const, releaseTime: new Date().toISOString(), postId, slug: rawSlug };
      const prev = byId.get(id);
      // mcpehub can expose several posts/links for the same Bedrock version.
      // Keep exactly one row per user-visible version, preferring the newest
      // DLE post ID because it is the most likely to contain a live APK link.
      if (!prev || postId > prev.postId) byId.set(id, entry);
    }
    // Higher DLE post ID = newer release. The site assigns IDs roughly
    // monotonically, so this is a good proxy for release order.
    return Array.from(byId.values()).sort((a, b) => b.postId - a.postId);
  }

  private async resolveDownloadUrl(slug: string, postId: number): Promise<ResolvedBedrockDownload> {
    // Article page on mcpehub shows a "Скачать" button that links to
    // /engine/dlfile.php?id=<file-id> (a countdown/ad page). The actual
    // APK URL is right there in the same page: /engine/getfile.php?id=<file-id>.
    const pageUrl = `${BEDROCK_HUB_BASE}/download-mcpe/${postId}-${slug}.html`;
    const pageResp = await axios.get(pageUrl, {
      headers: bedrockBrowserHeaders(`${BEDROCK_HUB_BASE}/download-mcpe/`),
      timeout: 30000,
      maxRedirects: 5,
    });
    const html = typeof pageResp.data === 'string' ? pageResp.data : String(pageResp.data || '');
    // Prefer getfile.php (direct APK) if the page already exposes it,
    // otherwise fall back to the first dlfile.php id.
    const getfileMatch = html.match(/\/engine\/getfile\.php\?id=(\d+)/);
    if (getfileMatch) return { url: `${BEDROCK_HUB_BASE}/engine/getfile.php?id=${getfileMatch[1]}`, referer: pageUrl, cookie: mergeCookies(pageResp.headers) };
    const dlMatch = html.match(/\/engine\/dlfile\.php\?id=(\d+)/);
    if (dlMatch) {
      const dlUrl = `${BEDROCK_HUB_BASE}/engine/dlfile.php?id=${dlMatch[1]}`;
      let cookie = mergeCookies(pageResp.headers);
      try {
        const dlResp = await axios.get(dlUrl, {
          headers: bedrockBrowserHeaders(pageUrl, cookie),
          timeout: 20000,
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 500,
        });
        cookie = mergeCookies(pageResp.headers, dlResp.headers) || cookie;
      } catch {}
      return { url: `${BEDROCK_HUB_BASE}/engine/getfile.php?id=${dlMatch[1]}`, referer: dlUrl, cookie };
    }
    throw new Error(`Download link not found on ${pageUrl}`);
  }

  private async downloadApk(url: string, dest: string, win?: BrowserWindow, signal?: AbortSignal, extraHeaders: Record<string, string> = {}): Promise<void> {
    await ensureDir(path.dirname(dest));
    const tmp = dest + '.part';

    // Resume support: keep the partial file between attempts. If it exists
    // and the server supports Range, ask for the rest with a Range header.
    let resumeFrom = 0;
    try {
      if (fs.existsSync(tmp)) {
        const stat = fs.statSync(tmp);
        // Only resume if the partial is reasonable (>= 1 KB and < 2 GB)
        if (stat.size >= 1024 && stat.size < BEDROCK_EXPECTED_SIZE_MAX) {
          resumeFrom = stat.size;
        } else {
          safeRm(tmp);
        }
      }
    } catch {}

    if (win && !win.isDestroyed()) {
      win.webContents.send('minecraft:log', `[bedrock] Downloading APK from: ${url}${resumeFrom ? ` (resuming from ${resumeFrom})` : ''}\n`);
    }

    let resp;
    try {
      resp = await axios.get(url, {
        responseType: 'stream',
        timeout: 300000,
        maxRedirects: 5,
        headers: {
          ...bedrockBrowserHeaders(extraHeaders.Referer, extraHeaders.Cookie),
          ...extraHeaders,
          ...(resumeFrom > 0 ? { Range: `bytes=${resumeFrom}-` } : {}),
        },
        validateStatus: (status) => status >= 200 && status < 400,
        signal,
      });
    } catch (e: any) {
      if (e.name === 'AbortError' || e.name === 'CanceledError') {
        if (win && !win.isDestroyed()) {
          win.webContents.send('minecraft:log', `[bedrock] Download cancelled by user\n`);
        }
        throw new Error('Download cancelled');
      }
      if (win && !win.isDestroyed()) {
        win.webContents.send('minecraft:log', `[bedrock] Download failed: ${e.message}\n`);
      }
      throw new Error(`Failed to start download: ${e.message}`);
    }

    // If we asked to resume but the server ignored Range and sent 200,
    // the file we have on disk is stale — start over.
    const dbgLog = (msg: string) => {
      try { fs.appendFileSync(path.join(os.tmpdir(), 'trel-bedrock.log'), `[${new Date().toISOString()}] ${msg}\n`); } catch {}
    };
    if (resumeFrom > 0 && resp.status === 200) {
      dbgLog('Server ignored Range, starting from scratch');
      safeRm(tmp);
      resumeFrom = 0;
    }
    if (resp.status !== 200 && resp.status !== 206) {
      throw new Error(`Unexpected HTTP status: ${resp.status}`);
    }

    if (win && !win.isDestroyed()) {
      win.webContents.send('minecraft:log', `[bedrock] Download started (${resp.status}), content-length: ${resp.headers['content-length'] || 'unknown'}\n`);
    }

    // For 206 Partial Content, Content-Range is "bytes <start>-<end>/<total>".
    // For 200 OK, total is just Content-Length.
    let total = 0;
    if (resp.status === 206) {
      const cr = String(resp.headers['content-range'] ?? '');
      const m = cr.match(/\/(\d+)/);
      if (m) total = parseInt(m[1], 10);
      if (!total) total = resumeFrom + (parseInt(String(resp.headers['content-length'] ?? ''), 10) || 0);
    } else {
      total = parseInt(String(resp.headers['content-length'] ?? ''), 10) || 0;
    }
    if (total > BEDROCK_EXPECTED_SIZE_MAX) {
      throw new Error(`APK too large: ${total} bytes (max 2 GB)`);
    }

    let downloaded = resumeFrom;
    let lastReport = 0;
    let firstByteReceived = false;
    let settled = false;
    let rejectOuter: ((e: Error) => void) | null = null;
    let lastProgressAt = Date.now();
    const startedAt = Date.now();
    dbgLog(`downloadApk start url=${url} total=${total} resumeFrom=${resumeFrom} status=${resp.status}`);

    // Hard safety timer — runs OUTSIDE the promise so it can always fire
    // and force-destroy the stream. Aborts the download if `downloaded`
    // hasn't grown for 8 seconds. Heartbeat every 2s so the UI shows it's alive.
    const STALL_MS = 8000;
    const safetyInterval = setInterval(() => {
      const idle = Date.now() - lastProgressAt;
      if (settled) return;
      dbgLog(`tick: settled=${settled} downloaded=${downloaded} idle=${idle}ms rejectOuter=${!!rejectOuter}`);
      if (win && !win.isDestroyed()) {
        win.webContents.send('bedrock:progress', {
          stage: idle >= STALL_MS
            ? `Нет данных ${Math.round(idle / 1000)}с — отмена...`
            : `Зависло ${Math.round(idle / 1000)}с — ожидание данных`,
          current: downloaded,
          total: total || 500 * 1024 * 1024,
          percent: total ? Math.min(99, Math.floor((downloaded / total) * 100)) : 0,
          bytesDownloaded: downloaded,
          bytesTotal: total || undefined,
        } as DownloadProgress);
      }
      if (idle >= STALL_MS) {
        dbgLog(`ABORT: idle=${idle}ms >= STALL_MS=${STALL_MS}`);
        settled = true; // prevent further aborts
        clearInterval(safetyInterval);
        try { resp.data.resume(); } catch {}
        try { resp.data.destroy(); } catch {}
        try { resp.data.unpipe?.(); } catch {}
        if (rejectOuter) rejectOuter(new Error(
          `Сервер перестал отдавать файл (${Math.round(idle / 1000)}с без данных, скачано ${(downloaded / 1024).toFixed(0)} КБ из ${(total / 1024 / 1024).toFixed(0)} МБ). Попробуйте ещё раз — загрузка продолжится с этого места.`
        ));
      }
    }, 2000);

    await new Promise<void>((resolve, reject) => {
      rejectOuter = reject;
      // 'a' = append (resume from existing .part), 'w' = truncate (fresh start)
      const out = fs.createWriteStream(tmp, { flags: resumeFrom > 0 ? 'a' : 'w' });
      try { resp.data.resume(); } catch {}
      dbgLog(`promise setup: resp.data type=${resp.data?.constructor?.name} readable=${resp.data?.readable} paused=${resp.data?.paused} flags=${resumeFrom > 0 ? 'a' : 'w'}`);
      resp.data.on('data', (chunk: Buffer) => {
        if (!firstByteReceived) {
          firstByteReceived = true;
          dbgLog(`first byte: chunk.length=${chunk.length}`);
          if (win && !win.isDestroyed()) {
            win.webContents.send('minecraft:log', `[bedrock] First bytes received, download active...\n`);
          }
        }
        if (chunk.length > 0) {
          downloaded += chunk.length;
          lastProgressAt = Date.now();
        }
        if (downloaded > BEDROCK_EXPECTED_SIZE_MAX) {
          settled = true;
          clearInterval(safetyInterval);
          try { resp.data.destroy(); } catch {}
          try { out.close(); } catch {}
          safeRm(tmp);
          return reject(new Error('APK too large — aborted'));
        }
        const now = Date.now();
        if (lastReport !== 0 && now - lastReport < 100) return;
        lastReport = now;
        if (win && !win.isDestroyed()) {
          const pct = total
            ? Math.min(99, Math.floor((downloaded / total) * 100))
            : Math.min(90, Math.floor(downloaded / (500 * 1024 * 1024) * 100));
          win.webContents.send('bedrock:progress', {
            stage: 'Скачивание Bedrock APK',
            current: downloaded,
            total: total || 500 * 1024 * 1024,
            percent: pct,
            bytesDownloaded: downloaded,
            bytesTotal: total || undefined,
          } as DownloadProgress);
        }
      });
      resp.data.on('end', () => { dbgLog(`resp.data end: downloaded=${downloaded}`); });
      resp.data.on('close', () => { dbgLog(`resp.data close: downloaded=${downloaded}`); });
      resp.data.on('error', (e: any) => {
        dbgLog(`resp.data error: name=${e?.name} msg=${e?.message}`);
        if (settled) return;
        settled = true;
        clearInterval(safetyInterval);
        try { out.close(); } catch {}
        if (e?.name === 'AbortError' || e?.name === 'CanceledError' || signal?.aborted) {
          if (win && !win.isDestroyed()) {
            win.webContents.send('minecraft:log', `[bedrock] Download cancelled by user\n`);
          }
          safeRm(tmp);
          return reject(new Error('Download cancelled'));
        }
        if (win && !win.isDestroyed()) {
          win.webContents.send('minecraft:log', `[bedrock] Stream error: ${e?.message ?? e}\n`);
        }
        reject(new Error(`Stream error: ${e?.message ?? e}`));
      });
      out.on('error', (e) => { dbgLog(`out error: ${e?.message}`); if (settled) return; settled = true; clearInterval(safetyInterval); reject(e); });
      out.on('finish', () => { dbgLog(`out finish: downloaded=${downloaded}`); if (settled) return; settled = true; clearInterval(safetyInterval); resolve(); });
      resp.data.pipe(out);
    });

    // Smart validation: check APK structure instead of hard size limits
    if (downloaded < BEDROCK_MIN_REASONABLE) {
      safeRm(tmp);
      throw new Error(`Downloaded APK too small (${downloaded} bytes) — corrupted or truncated`);
    }
    if (!this.isValidApk(tmp)) {
      safeRm(tmp);
      throw new Error('Downloaded file is not a valid APK (bad magic bytes or missing AndroidManifest)');
    }

    safeRm(dest);
    safeRenameSync(tmp, dest);
  }

  async install(versionId: string, win?: BrowserWindow): Promise<void> {
    if (!isSafeVersionId(versionId)) throw new Error(`Invalid versionId: ${versionId}`);
    const existing = this.installing.get(versionId);
    if (existing) return existing;
    const promise = this.doInstall(versionId, win);
    this.installing.set(versionId, promise);
    try { await promise; } finally { this.installing.delete(versionId); }
  }

  private currentAbortController: AbortController | null = null;

  cancelCurrentDownload(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  private async doInstall(versionId: string, win?: BrowserWindow): Promise<void> {
    const versions = await this.fetchVersions();
    const info = versions.find((v) => v.id === versionId);
    if (!info) throw new Error(`Bedrock version ${versionId} not found`);

    const dest = this.apkPath(versionId);
    // Already installed — skip
    if (this.isInstalled(versionId)) {
      this.report(win, { stage: 'Уже установлено', current: 1, total: 1, percent: 100, bytesDownloaded: 0, bytesTotal: 0 });
      return;
    }
    // Clean up final APK if it exists, but KEEP the .part file so
    // downloadApk can attempt to resume from where it left off.
    try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch {}

    // Resolve URL with retry
    let apk: ResolvedBedrockDownload | null = null;
    this.report(win, { stage: 'Поиск ссылки на APK', current: 0, total: 1, percent: 2, bytesDownloaded: 0, bytesTotal: 0 });
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        apk = await this.resolveDownloadUrl(info.slug, info.postId);
        break;
      } catch (e) {
        if (attempt === 2) throw new Error(`Не удалось найти APK для ${versionId}: ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }

    if (!apk) throw new Error(`Не удалось найти APK для ${versionId}`);

    const trust = verifyDownloadSource(apk.url);
    if (!trust.allowed) throw new Error(`${trust.reason}: ${apk.url}`);

    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    this.report(win, { stage: 'Скачивание Bedrock APK', current: 0, total: 1, percent: 5, bytesDownloaded: 0, bytesTotal: 0 });
    // Retry the download on stall. The .part file is preserved between
    // attempts, so each retry resumes from where the previous one stopped.
    // The CDN at mcpe-servers.ru is known to throttle/abort downloads, so
    // we keep trying with exponential backoff until the file completes.
    const tmpPart = dest + '.part';
    const MAX_RETRIES = 8;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (signal.aborted) throw new Error('Download cancelled');
        await this.downloadApk(apk.url, dest, win, signal, { Referer: apk.referer, ...(apk.cookie ? { Cookie: apk.cookie } : {}) });
        lastError = null;
        break;
      } catch (e: any) {
        if (e?.message === 'Download cancelled' || signal.aborted) {
          // User-cancelled: don't retry, propagate
          try { if (fs.existsSync(tmpPart)) fs.unlinkSync(tmpPart); } catch {}
          throw new Error('Download cancelled');
        }
        lastError = e;
        const got = fs.existsSync(tmpPart) ? fs.statSync(tmpPart).size : 0;
        // If we already have a complete-looking file, don't retry
        if (got >= BEDROCK_MIN_REASONABLE && this.isInstalled(versionId)) break;
        if (attempt >= MAX_RETRIES) break;
        // Backoff: 2s, 3s, 5s, 8s, 12s, 18s, 25s
        const delay = Math.min(2000 + attempt * 1500, 25000);
        this.report(win, {
          stage: `Сеть зависла (попытка ${attempt + 1}/${MAX_RETRIES + 1}), повтор через ${Math.round(delay / 1000)}с...`,
          current: got,
          total: Math.max(got, 500 * 1024 * 1024),
          percent: 5,
          bytesDownloaded: got,
          bytesTotal: undefined,
        });
        await new Promise<void>((r) => { const t = setTimeout(r, delay); signal.addEventListener('abort', () => { clearTimeout(t); r(); }); });
      }
    }
    this.currentAbortController = null;
    if (lastError) throw lastError;

    if (!this.isInstalled(versionId)) {
      throw new Error('APK загружен но файл повреждён — попробуйте ещё раз');
    }

    await scanDownloadedFileAsync(dest);

    this.report(win, { stage: 'Установка завершена', current: 1, total: 1, percent: 100, bytesDownloaded: 0, bytesTotal: 0 });
  }

  uninstall(versionId: string): boolean {
    const dir = this.versionDir(versionId);
    if (!fs.existsSync(dir)) return false;
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  }

  private report(win: BrowserWindow | undefined, p: DownloadProgress) {
    if (win && !win.isDestroyed()) win.webContents.send('bedrock:progress', p);
  }

  private isValidApk(file: string): boolean {
    try {
      // Check ZIP magic bytes (PK\003\004 or PK\005\006 or PK\007\008)
      const fd = fs.openSync(file, 'r');
      const header = Buffer.alloc(4);
      fs.readSync(fd, header, 0, 4, 0);
      fs.closeSync(fd);
      const magic = header.toString('hex');
      if (!['504b0304', '504b0506', '504b0708'].includes(magic)) return false;

      // Quick ZIP scan for AndroidManifest.xml and META-INF/
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(file);
      const entries = zip.getEntries();
      let hasManifest = false;
      let hasMetaInf = false;
      for (const e of entries) {
        if (e.entryName === 'AndroidManifest.xml') hasManifest = true;
        if (e.entryName.startsWith('META-INF/')) hasMetaInf = true;
        if (hasManifest && hasMetaInf) break;
      }
      return hasManifest && hasMetaInf;
    } catch {
      return false;
    }
  }
}
