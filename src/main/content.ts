import * as fs from 'node:fs';
import * as path from 'node:path';
import { dirSize } from './util';
import { CONTENT_FOLDERS } from '../shared/types';
import type { ContentKind, ContentItem } from '../shared/types';

const FOLDER_BY_KIND: Record<ContentKind, string> = {
  mod: CONTENT_FOLDERS[0],
  shader: CONTENT_FOLDERS[1],
  resourcepack: CONTENT_FOLDERS[2],
  texturepack: CONTENT_FOLDERS[3],
};

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

export class ContentService {
  constructor(private gameDir: string) {}

  setGameDir(dir: string) { this.gameDir = dir; }

  /**
   * Per-version content directory: versions/<id>/<sub>. If versionId is
   * omitted we fall back to the legacy gameDir/<sub> location (so any data
   * placed there before per-version content was introduced still shows up).
   */
  dirFor(kind: ContentKind, versionId?: string): string {
    const sub = FOLDER_BY_KIND[kind];
    if (versionId) return path.join(this.gameDir, 'versions', versionId, sub);
    return path.join(this.gameDir, sub);
  }

  /** Создать все стандартные папки контента для версии (idempotent). */
  ensureFolders(versionId?: string): void {
    for (const kind of Object.keys(FOLDER_BY_KIND) as ContentKind[]) {
      try { fs.mkdirSync(this.dirFor(kind, versionId), { recursive: true }); } catch {}
    }
  }

  list(kind: ContentKind, versionId?: string): ContentItem[] {
    const dir = this.dirFor(kind, versionId);
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

      // Для модов фильтруем: оставляем только .jar (с/без .disabled)
      if (kind === 'mod') {
        const baseLow = isDisabled ? lowName.slice(0, -'.disabled'.length) : lowName;
        if (!baseLow.endsWith('.jar')) continue;
      }

      out.push({
        name: e.name,
        displayName,
        kind,
        path: full,
        size,
        enabled: !isDisabled,
        isFolder,
      });
    }
    return out.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));
  }

  delete(kind: ContentKind, name: string, versionId?: string): boolean {
    const dir = this.dirFor(kind, versionId);
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
  toggle(kind: ContentKind, name: string, versionId?: string): boolean {
    const dir = this.dirFor(kind, versionId);
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
  add(kind: ContentKind, sourcePaths: string[], versionId?: string): { copied: number; errors: string[] } {
    const dir = this.dirFor(kind, versionId);
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
        if (stat.isDirectory()) {
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
