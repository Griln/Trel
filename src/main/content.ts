import * as fs from 'node:fs';
import * as path from 'node:path';
import AdmZip from 'adm-zip';
import axios from 'axios';
import { dirSize } from './util';
import { readModId } from './import-ops';
import { isUrlAllowed } from './download-security';
import { CONTENT_FOLDERS } from '../shared/types';
import type { ContentKind, ContentItem } from '../shared/types';

const FOLDER_BY_KIND: Record<ContentKind, string> = {
  mod: CONTENT_FOLDERS[0],
  shader: CONTENT_FOLDERS[1],
  resourcepack: CONTENT_FOLDERS[2],
  texturepack: CONTENT_FOLDERS[3],
};

const BEDROCK_FOLDER_BY_KIND: Record<ContentKind, string> = {
  // Bedrock has no Java-style .jar mods. Add-ons usually contain behavior packs
  // and can be imported as .mcaddon/.mcpack. We keep a per-version staging
  // folder next to the APK so users can manage packs without mixing editions.
  mod: 'behavior_packs',
  shader: 'resource_packs',
  resourcepack: 'resource_packs',
  texturepack: 'minecraftWorlds',
};

export type ContentEdition = 'java' | 'bedrock';

function resolveSafe(p: string): string | null {
  try { return fs.realpathSync(p); }
  catch {
    const r = path.resolve(p);
    let current = r;
    for (let i = 0; i < 32; i++) {
      try { return fs.realpathSync(current); } catch {}
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return r;
  }
}

function isInside(child: string, parent: string): boolean {
  const c = resolveSafe(child);
  const p = resolveSafe(parent);
  if (!c || !p) return false;
  const sep = path.sep;
  return c === p || c.startsWith(p + sep);
}


function safeExtractZip(zipPath: string, targetDir: string): void {
  const zip = new AdmZip(zipPath);
  fs.mkdirSync(targetDir, { recursive: true });
  let total = 0;
  for (const entry of zip.getEntries()) {
    const dest = path.resolve(targetDir, entry.entryName);
    if (!isInside(dest, targetDir)) throw new Error(`Unsafe zip entry: ${entry.entryName}`);
    if (entry.isDirectory) { fs.mkdirSync(dest, { recursive: true }); continue; }
    if (((entry.header.attr >>> 16) & 0o170000) === 0o120000) continue; // symlink
    total += entry.header.size;
    // Bedrock-пак в сотни МБ распакованного — ок; гигабайты = бомба.
    if (total > 1024 * 1024 * 1024) throw new Error('Zip bomb guard: pack too large');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, entry.getData());
  }
}

function readBedrockManifestName(dir: string): string | null {
  const stack = [dir];
  for (let depth = 0; stack.length && depth < 64; depth++) {
    const current = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) stack.push(full);
      if (e.isFile() && e.name.toLowerCase() === 'manifest.json') {
        try {
          const json = JSON.parse(fs.readFileSync(full, 'utf8'));
          return String(json?.header?.name || json?.metadata?.name || path.basename(dir));
        } catch { return path.basename(dir); }
      }
    }
  }
  return null;
}

function uniquePath(baseDir: string, desired: string): string {
  const safe = desired.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80) || 'pack';
  let dest = path.join(baseDir, safe);
  let i = 1;
  while (fs.existsSync(dest)) dest = path.join(baseDir, `${safe} (${i++})`);
  return dest;
}


function readZipText(zip: AdmZip, name: string): string | null {
  const entry = zip.getEntry(name);
  if (!entry || entry.isDirectory) return null;
  try { return entry.getData().toString('utf8'); } catch { return null; }
}

function parseModToml(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ['modId', 'version', 'displayName', 'authors', 'loaderVersion']) {
    const m = text.match(new RegExp(`${key}\\s*=\\s*\\"([^\\"]+)\\"`));
    if (m) out[key] = m[1];
  }
  const mc = text.match(/modLoader\s*=\s*\"([^\"]+)\"/);
  if (mc) out.modLoader = mc[1];
  return out;
}

// Метаданные читаем только из вменяемых по размеру jar: 2ГБ «мод»
 // иначе роняет main-процесс (AdmZip грузит всё в RAM).
const MOD_META_MAX_BYTES = 512 * 1024 * 1024;
function parseJavaModMeta(file: string): ContentItem['meta'] | undefined {
  try {
    try {
      if (fs.statSync(file).size > MOD_META_MAX_BYTES) return undefined;
    } catch { return undefined; }
    const zip = new AdmZip(file);
    const fabric = readZipText(zip, 'fabric.mod.json');
    if (fabric) {
      const j = JSON.parse(fabric);
      const authors = Array.isArray(j.authors) ? j.authors.map((a: any) => typeof a === 'string' ? a : String(a?.name || '')).filter(Boolean) : [];
      const depends = j.depends && typeof j.depends === 'object' ? Object.keys(j.depends) : [];
      return { title: j.name || j.id, version: j.version, loader: 'fabric', authors, minecraft: j.depends?.minecraft, dependencies: depends };
    }
    const quilt = readZipText(zip, 'quilt.mod.json');
    if (quilt) {
      const j = JSON.parse(quilt);
      const q = j.quilt_loader || j;
      const depends = Array.isArray(q.depends) ? q.depends.map((d: any) => typeof d === 'string' ? d : String(d?.id || '')).filter(Boolean) : [];
      return { title: q.metadata?.name || q.id, version: q.version, loader: 'quilt', authors: Object.keys(q.metadata?.contributors || {}), dependencies: depends };
    }
    const toml = readZipText(zip, 'META-INF/mods.toml');
    if (toml) {
      const t = parseModToml(toml);
      const loader = /neo/i.test(t.modLoader || '') ? 'neoforge' : 'forge';
      return { title: t.displayName || t.modId, version: t.version, loader, authors: t.authors ? t.authors.split(/[,;]/).map((x) => x.trim()).filter(Boolean) : [] };
    }
    const mcmod = readZipText(zip, 'mcmod.info');
    if (mcmod) {
      const j = JSON.parse(mcmod);
      const first = Array.isArray(j) ? j[0] : j;
      return { title: first?.name || first?.modid, version: first?.version, loader: 'forge', authors: first?.authorList || [] };
    }
  } catch {}
  return undefined;
}

function modWarnings(meta: ContentItem['meta'], versionId?: string): string[] | undefined {
  const warnings: string[] = [];
  if (!meta || !versionId) return undefined;
  const id = versionId.toLowerCase();
  const expected = id.includes('fabric') ? 'fabric' : id.includes('quilt') ? 'quilt' : id.includes('neoforge') ? 'neoforge' : id.includes('forge') ? 'forge' : '';
  if (expected && meta.loader && meta.loader !== expected) warnings.push(`Мод для ${meta.loader}, а выбрана версия ${expected}`);
  if (!expected) warnings.push('Выбрана версия без загрузчика модов');
  if (meta.minecraft && typeof meta.minecraft === 'string') {
    const base = id.match(/\d+\.\d+(?:\.\d+)?/)?.[0];
    if (base && !meta.minecraft.includes(base) && !meta.minecraft.includes('*')) warnings.push(`Мод заявлен для Minecraft ${meta.minecraft}, выбрана ${base}`);
  }
  return warnings.length ? warnings : undefined;
}

export class ContentService {
  constructor(private gameDir: string) {}

  setGameDir(dir: string) { this.gameDir = dir; }

  /**
   * Per-version content directory.
   * Java: versions/<id>/<sub>. If versionId is omitted we fall back to the
   * legacy gameDir/<sub> location.
   * Bedrock: bedrock/<id>/<bedrockSub>. This is a staging/management area for
   * .mcpack/.mcaddon/.mcworld files and extracted packs, separate from Java.
   */
  dirFor(kind: ContentKind, versionId?: string, edition: ContentEdition = 'java'): string {
    const sub = edition === 'bedrock' ? BEDROCK_FOLDER_BY_KIND[kind] : FOLDER_BY_KIND[kind];
    if (edition === 'bedrock') {
      return versionId
        ? path.join(this.gameDir, 'bedrock', versionId, sub)
        : path.join(this.gameDir, 'bedrock', sub);
    }
    if (versionId) return path.join(this.gameDir, 'versions', versionId, sub);
    return path.join(this.gameDir, sub);
  }

  /** Создать все стандартные папки контента для версии (idempotent). */
  ensureFolders(versionId?: string, edition: ContentEdition = 'java'): void {
    for (const kind of Object.keys(FOLDER_BY_KIND) as ContentKind[]) {
      try { fs.mkdirSync(this.dirFor(kind, versionId, edition), { recursive: true }); } catch {}
    }
  }

  list(kind: ContentKind, versionId?: string, edition: ContentEdition = 'java'): ContentItem[] {
    const dir = this.dirFor(kind, versionId, edition);
    if (!fs.existsSync(dir)) return [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { return []; }

    const out: ContentItem[] = [];
    for (const e of entries) {
      if (e.name.startsWith('.')) continue; // hidden / system

      const full = path.join(dir, e.name);
      const isFolder = e.isDirectory();
      let size = 0;
      try {
        size = isFolder ? dirSize(full) : fs.statSync(full).size;
      } catch {}

      const lowName = e.name.toLowerCase();
      const isDisabled = lowName.endsWith('.disabled');
      const displayName = isDisabled ? e.name.slice(0, -'.disabled'.length) : e.name;

      const baseLow = isDisabled ? lowName.slice(0, -'.disabled'.length) : lowName;
      if (edition === 'java') {
        // Для Java-модов фильтруем: оставляем только .jar (с/без .disabled).
        if (kind === 'mod' && !baseLow.endsWith('.jar')) continue;
      } else if (!isFolder) {
        // Bedrock packs are usually import archives or extracted folders.
        const allowed = kind === 'texturepack'
          ? ['.mcworld', '.mctemplate', '.zip']
          : ['.mcpack', '.mcaddon', '.zip'];
        if (!allowed.some((ext) => baseLow.endsWith(ext))) continue;
      }

      let meta: ContentItem['meta'] | undefined;
      if (edition === 'java' && kind === 'mod' && !isFolder && baseLow.endsWith('.jar')) {
        meta = parseJavaModMeta(full);
        const warnings = modWarnings(meta, versionId);
        if (meta || warnings) meta = { ...(meta || {}), ...(warnings ? { warnings } : {}) };
      }

      out.push({
        name: e.name,
        displayName,
        kind,
        path: full,
        size,
        enabled: !isDisabled,
        isFolder,
        meta,
      });
    }
    return out.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));
  }

  delete(kind: ContentKind, name: string, versionId?: string, edition: ContentEdition = 'java'): boolean {
    const dir = this.dirFor(kind, versionId, edition);
    const full = path.join(dir, name);
    if (!isInside(full, dir)) return false;
    if (!fs.existsSync(full)) return false;
    try {
      fs.rmSync(full, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  /** Включить/выключить элемент: добавляет/убирает .disabled расширение. */
  toggle(kind: ContentKind, name: string, versionId?: string, edition: ContentEdition = 'java'): boolean {
    const dir = this.dirFor(kind, versionId, edition);
    const full = path.join(dir, name);
    if (!isInside(full, dir)) return false;
    if (!fs.existsSync(full)) return false;
    const newPath = full.toLowerCase().endsWith('.disabled')
      ? full.slice(0, -'.disabled'.length)
      : full + '.disabled';
    try {
      fs.renameSync(full, newPath);
      return true;
    } catch {
      return false;
    }
  }

  /** Скопировать файлы в папку контента. Не перезаписывает — добавляет (1), (2)... */
  add(kind: ContentKind, sourcePaths: string[], versionId?: string, edition: ContentEdition = 'java'): { copied: number; errors: string[] } {
    const dir = this.dirFor(kind, versionId, edition);
    fs.mkdirSync(dir, { recursive: true });
    const errors: string[] = [];
    let copied = 0;
    for (const src of sourcePaths) {
      try {
        const baseName = path.basename(src);
        const ext = path.extname(baseName);
        const stem = baseName.slice(0, baseName.length - ext.length);
        let dest = path.join(dir, baseName);
        let i = 1;
        while (fs.existsSync(dest)) {
          dest = path.join(dir, `${stem} (${i})${ext}`);
          i++;
        }
        const stat = fs.statSync(src);
        const lower = baseName.toLowerCase();
        // Троянский .jar исполняется игрой при следующем запуске: файлы >512МБ
        // не принимаем молча — пользователь пусть положит руками и осознанно.
        if (!stat.isDirectory() && stat.size > 512 * 1024 * 1024) {
          throw new Error('File too large (>512MB), add it manually if you trust it: ' + baseName);
        }
        if (edition === 'bedrock' && stat.isFile() && ['.mcpack', '.mcaddon', '.mcworld', '.mctemplate', '.zip'].some((x) => lower.endsWith(x))) {
          const tmp = path.join(dir, `.import-${Date.now()}-${Math.random().toString(16).slice(2)}`);
          try {
            safeExtractZip(src, tmp);
            const manifestName = readBedrockManifestName(tmp) || stem;
            dest = uniquePath(dir, manifestName);
            fs.renameSync(tmp, dest);
          } catch (e) {
            try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
            throw e;
          }
        } else if (stat.isDirectory()) {
          fs.cpSync(src, dest, { recursive: true });
        } else {
          fs.copyFileSync(src, dest);
        }
        copied++;
      } catch (e) {
        errors.push(path.basename(src) + ': ' + (e as Error).message);
      }
    }
    return { copied, errors };
  }

  /**
   * Проверка обновлений модов через Modrinth API. Для каждого jar читаем
   * modid, ищем проект по slug=modid и сравниваем последнюю версию под эту
   * игру/лоадер с установленной. Совпадение slug≠modid отбраковываем по
   * файлам: ищем только если проект вообще отвечает.
   */
  async checkModUpdates(versionId: string, gameVersion: string, loaders: string[]): Promise<Array<{
    file: string; name: string; current?: string; latest?: string; url?: string; filename?: string;
  }>> {
    const dir = this.dirFor('mod', versionId, 'java');
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
    const jars = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.jar')).slice(0, 100);
    const out: Array<{ file: string; name: string; current?: string; latest?: string; url?: string; filename?: string }> = [];
    const UA = 'TrelLauncher/1.0 (mod-update-check)';
    // Пачками по 4: сотня модов иначе висит минуту.
    for (let i = 0; i < jars.length; i += 4) {
      const batch = await Promise.all(jars.slice(i, i + 4).map(async (e) => {
        try {
          const full = path.join(dir, e.name);
          const { id, version } = readModId(full);
          if (!id || !/^[a-z0-9\-_]+$/.test(id)) return null;
          const q = `https://api.modrinth.com/v2/project/${encodeURIComponent(id)}/version` +
            `?game_versions=${encodeURIComponent(JSON.stringify([gameVersion]))}` +
            (loaders.length > 0 ? `&loaders=${encodeURIComponent(JSON.stringify(loaders))}` : '') +
            `&limit=1`;
          const { data } = await axios.get(q, { timeout: 10000, headers: { 'User-Agent': UA } });
          const latest = Array.isArray(data) && data.length > 0 ? data[0] : null;
          if (!latest?.version_number) return null;
          if (version && latest.version_number === version) return null; // уже свежий
          const file = (latest.files ?? []).find((f: { primary?: boolean }) => f.primary) ?? (latest.files ?? [])[0];
          return { file: e.name, name: id, current: version, latest: latest.version_number as string,
            url: file?.url as string | undefined, filename: file?.filename as string | undefined };
        } catch { return null; } // нет на Modrinth / сеть легла — молча пропускаем
      }));
      for (const r of batch) if (r) out.push(r);
    }
    return out;
  }

  private profilesFile(versionId: string): string {
    return path.join(this.gameDir, 'versions', versionId, 'trel-modprofiles.json');
  }

  private readProfiles(versionId: string): Record<string, string[]> {
    try {
      const raw = JSON.parse(fs.readFileSync(this.profilesFile(versionId), 'utf-8'));
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const out: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          if (typeof k === 'string' && k.length > 0 && k.length <= 64 && Array.isArray(v)) {
            out[k] = (v as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 500);
          }
        }
        return out;
      }
    } catch { /* нет файла — нет профилей */ }
    return {};
  }

  /** Все профили версии: имя → список включённых jar. */
  listModProfiles(versionId: string): Record<string, string[]> {
    return this.readProfiles(versionId);
  }

  /** Сохраняет профиль из ТЕКУЩЕГО состояния папки (включённые jar). */
  saveModProfile(versionId: string, name: string): string[] {
    if (!/^[a-zA-Z0-9а-яА-Я_][a-zA-Z0-9а-яА-Я_. \-]{0,63}$/.test(name)) throw new Error('Bad profile name');
    const dir = this.dirFor('mod', versionId, 'java');
    let names: string[] = [];
    try {
      names = fs.readdirSync(dir)
        .filter((n) => n.toLowerCase().endsWith('.jar'))
        .filter((n) => {
          try { return fs.statSync(path.join(dir, n)).isFile(); } catch { return false; }
        });
    } catch { throw new Error('Mods folder not found'); }
    const all = this.readProfiles(versionId);
    all[name] = names;
    fs.mkdirSync(path.dirname(this.profilesFile(versionId)), { recursive: true });
    fs.writeFileSync(this.profilesFile(versionId), JSON.stringify(all, null, 2), 'utf-8');
    return names;
  }

  /** Удаляет профиль (файлы не трогает). */
  deleteModProfile(versionId: string, name: string): boolean {
    const all = this.readProfiles(versionId);
    if (!(name in all)) return false;
    delete all[name];
    fs.writeFileSync(this.profilesFile(versionId), JSON.stringify(all, null, 2), 'utf-8');
    return true;
  }

  /**
   * Применяет профиль: всё выключаем (.disabled), из списка — включаем.
   * Файлы не удаляются, только переименовываются туда-сюда.
   */
  applyModProfile(versionId: string, name: string): { enabled: number; disabled: number } {
    const all = this.readProfiles(versionId);
    const want = new Set(all[name] ?? []);
    if (!(name in all)) throw new Error('Profile not found: ' + name);
    const dir = this.dirFor('mod', versionId, 'java');
    let enabled = 0;
    let disabled = 0;
    let names: string[] = [];
    try { names = fs.readdirSync(dir); } catch { throw new Error('Mods folder not found'); }
    for (const n of names) {
      const low = n.toLowerCase();
      const full = path.join(dir, n);
      let st: fs.Stats | null = null;
      try { st = fs.lstatSync(full); } catch { continue; }
      if (!st.isFile() || st.isSymbolicLink()) continue;
      if (low.endsWith('.jar')) {
        if (!want.has(n)) {
          fs.renameSync(full, full + '.disabled');
          disabled++;
        } else enabled++;
      } else if (low.endsWith('.jar.disabled')) {
        const base = n.slice(0, -'.disabled'.length);
        if (want.has(base)) {
          fs.renameSync(full, path.join(dir, base));
          enabled++;
        } else disabled++;
      }
    }
    return { enabled, disabled };
  }

  /** Ставит обновление мода: качает jar, старый — в .bak, новый — на место. */
  async updateMod(versionId: string, fileName: string, url: string): Promise<{ file: string; backup: string }> {
    if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) throw new Error('Bad file name');
    if (!isUrlAllowed(url)) throw new Error('URL blocked by download policy');
    if (!/^https:\/\/cdn\.modrinth\.com\//.test(url) && !/^https:\/\/[^/]*modrinth\.com\//.test(url)) {
      throw new Error('Only Modrinth CDN urls are allowed');
    }
    const dir = this.dirFor('mod', versionId, 'java');
    const dest = path.join(dir, fileName);
    if (!fs.existsSync(dest)) throw new Error('Mod file not found: ' + fileName);
    const tmp = dest + '.trel_tmp';
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000, maxRedirects: 5 });
    const buf = Buffer.from(resp.data);
    if (buf.length < 1024) throw new Error('Downloaded file too small');
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error('Downloaded file is not a jar');
    fs.writeFileSync(tmp, buf);
    const backup = dest + '.bak';
    try { fs.renameSync(dest, backup); } catch { /* ignore */ }
    fs.renameSync(tmp, dest);
    return { file: fileName, backup: path.basename(backup) };
  }
}
