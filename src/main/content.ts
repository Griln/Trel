import * as fs from 'node:fs';
import * as path from 'node:path';
import AdmZip from 'adm-zip';
import { dirSize } from './util';
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
  for (const entry of zip.getEntries()) {
    const dest = path.resolve(targetDir, entry.entryName);
    if (!isInside(dest, targetDir)) throw new Error(`Unsafe zip entry: ${entry.entryName}`);
    if (entry.isDirectory) fs.mkdirSync(dest, { recursive: true });
    else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, entry.getData());
    }
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

function parseJavaModMeta(file: string): ContentItem['meta'] | undefined {
  try {
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
}
