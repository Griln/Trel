import axios from 'axios';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import { BrowserWindow } from 'electron';
import type { LoaderType } from './loaders';
import type { MinecraftService } from './minecraft';
import { isSafeVersionId } from './safeIds';

const MODRINTH = 'https://api.modrinth.com/v2';
const UA = 'TrelLauncher/0.5.0 (modpack-manager)';

export interface ModpackSummary {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  iconUrl: string | null;
  categories: string[];
}

export interface ModpackVersion {
  versionId: string;
  name: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: string[];
  datePublished: string;
  /** URL of the .mrpack file */
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number;
}

export interface ModpackPlan {
  name: string;
  mc: string;
  loader: LoaderType | 'vanilla';
  loaderVersion: string | null;
  files: ModpackFile[];
}

export interface ModpackFile {
  /** relative path inside the instance, e.g. "mods/sodium.jar" */
  path: string;
  downloads: string[];
  sha1?: string;
  sha512?: string;
  fileSize: number;
}

export interface ModpackInstallResult {
  versionId: string;
  name: string;
  mc: string;
  loader: string;
  modCount: number;
}

/**
 * Pure function: parses modrinth.index.json into an install plan.
 * Covered by unit tests.
 */
export function parseModpackIndex(index: any): ModpackPlan {
  if (!index || typeof index !== 'object') throw new Error('Пустой modrinth.index.json');
  if (index.game && index.game !== 'minecraft') throw new Error('Неподдерживаемая игра: ' + index.game);

  const deps = index.dependencies || {};
  const mc = deps['minecraft'];
  if (!mc || typeof mc !== 'string') throw new Error('В модпаке не указана версия Minecraft');

  let loader: LoaderType | 'vanilla' = 'vanilla';
  let loaderVersion: string | null = null;
  if (deps['fabric-loader']) { loader = 'fabric'; loaderVersion = String(deps['fabric-loader']); }
  else if (deps['quilt-loader']) { loader = 'quilt'; loaderVersion = String(deps['quilt-loader']); }
  else if (deps['neoforge']) { loader = 'neoforge'; loaderVersion = String(deps['neoforge']); }
  else if (deps['forge']) { loader = 'forge'; loaderVersion = mc + '-' + String(deps['forge']); }

  const rawFiles: any[] = Array.isArray(index.files) ? index.files : [];
  const files: ModpackFile[] = [];
  for (const f of rawFiles) {
    if (!f || typeof f.path !== 'string') continue;
    // skip server-only files
    const env = f.env;
    if (env && env.client === 'unsupported') continue;
    const downloads: string[] = Array.isArray(f.downloads) ? f.downloads.filter((u: any) => typeof u === 'string') : [];
    if (!downloads.length) continue;
    const norm = f.path.replace(/\\/g, '/');
    if (norm.includes('..') || path.isAbsolute(norm)) continue; // path traversal guard
    files.push({
      path: norm,
      downloads,
      sha1: f.hashes?.sha1,
      sha512: f.hashes?.sha512,
      fileSize: Number(f.fileSize) || 0,
    });
  }

  return { name: index.name || 'Модпак', mc, loader, loaderVersion, files };
}

/**
 * Brings the loader version into the format expected by LoaderService.install().
 *
 * Forge is the only one that needs the game version prefix: its maven artifact
 * is called `forge-1.20.1-47.2.0-installer.jar`. In build metadata this prefix
 * appears in different shapes: modrinth.index.json stores `forge: 47.2.0`,
 * CurseForge uses `modLoaders[0].id = "forge-47.2.0"`, while Prism/MultiMC
 * already use `1.20.1-47.2.0`. Without normalization the Forge build install
 * would fail with a 404.
 */
export function normalizeLoaderVersion(loader: string, mc: string, loaderVersion: string): string {
  if (loader !== 'forge') return loaderVersion;
  return loaderVersion.startsWith(mc + '-') ? loaderVersion : mc + '-' + loaderVersion;
}

export class ModpackService {
  constructor(
    private gameDir: string,
    private mc: MinecraftService,
  ) {}

  setGameDir(dir: string) { this.gameDir = dir; }

  private report(win: BrowserWindow, stage: string, percent: number, extra?: Record<string, unknown>) {
    if (!win.isDestroyed()) win.webContents.send('modpacks:progress', { stage, percent, ...extra });
  }

  async search(query: string, limit = 30): Promise<ModpackSummary[]> {
    const facets = encodeURIComponent(JSON.stringify([['project_type:modpack']]));
    const url = MODRINTH + '/search?limit=' + limit + '&index=relevance&facets=' + facets +
      (query ? '&query=' + encodeURIComponent(query) : '');
    const { data } = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': UA } });
    const hits: any[] = data?.hits ?? [];
    return hits.map((h) => ({
      projectId: h.project_id,
      slug: h.slug,
      title: h.title,
      description: h.description,
      author: h.author,
      downloads: h.downloads || 0,
      iconUrl: h.icon_url || null,
      categories: h.categories || [],
    }));
  }

  async versions(projectId: string): Promise<ModpackVersion[]> {
    const url = MODRINTH + '/project/' + encodeURIComponent(projectId) + '/version';
    const { data } = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': UA } });
    const arr: any[] = Array.isArray(data) ? data : [];
    return arr.map((v) => {
      const primary = (v.files || []).find((f: any) => f.primary) || (v.files || [])[0];
      return {
        versionId: v.id,
        name: v.name,
        versionNumber: v.version_number,
        gameVersions: v.game_versions || [],
        loaders: v.loaders || [],
        datePublished: v.date_published,
        fileUrl: primary?.url || null,
        fileName: primary?.filename || null,
        fileSize: primary?.size || 0,
      };
    });
  }

  /** Downloads a file into a buffer with sha verification (if provided). */
  private async downloadBuffer(urls: string[], sha1?: string, maxBytes = 1024 * 1024 * 1024): Promise<Buffer> {
    let lastErr: Error | null = null;
    for (const url of urls) {
      try {
        // URL from a foreign .mrpack manifest: only trusted hosts, otherwise
        // a malicious pack could pull malware from any server.
        const { isUrlAllowed } = await import('./download-security');
        if (!isUrlAllowed(url)) throw new Error('URL blocked by download policy: ' + url);
        const { data, headers } = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000, maxRedirects: 5, headers: { 'User-Agent': UA } });
        const declared = Number(headers?.['content-length']);
        if (Number.isFinite(declared) && declared > maxBytes) throw new Error('File too large: ' + url);
        const buf = Buffer.from(data);
        if (buf.length > maxBytes) throw new Error('File too large: ' + url);
        if (sha1) {
          const got = crypto.createHash('sha1').update(buf).digest('hex');
          if (got !== sha1) throw new Error('Хеш не совпал для ' + url);
        } else {
          console.warn(`[modpacks] no sha1 for ${url} — integrity not verified`);
        }
        return buf;
      } catch (e) {
        lastErr = e as Error;
      }
    }
    throw lastErr || new Error('Не удалось скачать файл');
  }

  async install(versionMeta: ModpackVersion, win: BrowserWindow): Promise<ModpackInstallResult> {
    if (!versionMeta.fileUrl) throw new Error('У версии модпака нет .mrpack-файла');

    this.report(win, 'Скачивание модпака', 5);
    const mrpack = await this.downloadBuffer([versionMeta.fileUrl]);

    this.report(win, 'Чтение содержимого модпака', 12);
    const zip = new AdmZip(mrpack);
    const indexEntry = zip.getEntry('modrinth.index.json');
    if (!indexEntry) throw new Error('В .mrpack нет modrinth.index.json');
    const plan = parseModpackIndex(JSON.parse(zip.readAsText(indexEntry)));

    // 1) Loader install (creates versions/<id>/ with the content folders)
    this.report(win, 'Установка ' + (plan.loader === 'vanilla' ? 'Minecraft' : plan.loader) + ' ' + plan.mc, 20);
    let versionId: string;
    if (plan.loader === 'vanilla') {
      await this.mc.install(plan.mc, win);
      versionId = plan.mc;
    } else {
      const res = await this.mc.loaders.install(plan.loader, plan.mc, plan.loaderVersion!, win);
      versionId = res.versionId;
    }
    if (!isSafeVersionId(versionId)) throw new Error('Небезопасный versionId: ' + versionId);

    const instDir = path.join(this.gameDir, 'versions', versionId);

    // 2) Unpacking overrides
    this.report(win, 'Применение конфигов модпака', 35);
    this.applyOverrides(zip, 'overrides/', instDir);
    this.applyOverrides(zip, 'client-overrides/', instDir);

    // 3) Downloading the modpack files
    const total = plan.files.length;
    let done = 0;
    for (const f of plan.files) {
      const dest = path.join(instDir, f.path);
      const real = path.resolve(dest);
      if (!real.startsWith(path.resolve(instDir) + path.sep)) { done++; continue; } // guard
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (!fs.existsSync(dest)) {
        const buf = await this.downloadBuffer(f.downloads, f.sha1);
        fs.writeFileSync(dest, buf);
      }
      done++;
      this.report(win, 'Скачивание модов (' + done + '/' + total + ')', 40 + Math.floor((done / Math.max(1, total)) * 55), { current: done, total });
    }

    this.report(win, 'Готово', 100);
    return { versionId, name: plan.name, mc: plan.mc, loader: plan.loader, modCount: total };
  }

  /**
   * Installs a version from a profile detected in an imported build
   * (DetectedModpack). The point: instead of blindly copying files from a
   * foreign launcher the user gets a clean version with the right loader —
   * Trel can update it on its own. Mods/configs still go through the
   * regular category import.
   */
  async installFromProfile(
    profile: { mc: string; loader: string; loaderVersion?: string; name?: string },
    win: BrowserWindow,
  ): Promise<ModpackInstallResult> {
    if (!profile || typeof profile.mc !== 'string' || !profile.mc) throw new Error('Некорректный профиль модпака');
    const loaders = new Set(['vanilla', 'fabric', 'quilt', 'forge', 'neoforge']);
    if (!loaders.has(profile.loader)) throw new Error('Неизвестный загрузчик: ' + profile.loader);

    this.report(win, 'Установка ' + (profile.loader === 'vanilla' ? 'Minecraft' : profile.loader) + ' ' + profile.mc, 10);
    let versionId: string;
    if (profile.loader === 'vanilla') {
      await this.mc.install(profile.mc, win);
      versionId = profile.mc;
    } else {
      if (!profile.loaderVersion) throw new Error('Не указана версия загрузчика');
      const res = await this.mc.loaders.install(
        profile.loader as LoaderType,
        profile.mc,
        normalizeLoaderVersion(profile.loader, profile.mc, profile.loaderVersion),
        win,
      );
      versionId = res.versionId;
    }
    if (!isSafeVersionId(versionId)) throw new Error('Небезопасный versionId: ' + versionId);
    this.report(win, 'Готово', 100);
    return { versionId, name: profile.name ?? versionId, mc: profile.mc, loader: profile.loader, modCount: 0 };
  }

  private applyOverrides(zip: any, prefix: string, instDir: string) {
    for (const entry of zip.getEntries()) {
      const name: string = entry.entryName;
      if (!name.startsWith(prefix) || entry.isDirectory) continue;
      const rel = name.slice(prefix.length);
      if (!rel || rel.includes('..')) continue;
      const dest = path.join(instDir, rel);
      const real = path.resolve(dest);
      if (!real.startsWith(path.resolve(instDir) + path.sep)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, entry.getData());
    }
  }
}