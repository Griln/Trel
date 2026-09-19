/**
 * Снапшоты сборок: точка восстановления папки versions/<id> перед тем,
 * как пользователь полезет в моды. Сломал — откатился в клик.
 * Формат: <launcherDir>/snapshots/<safeId>-<stamp>.zip + manifest.json внутри.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import AdmZip from 'adm-zip';
import { isSafeVersionId } from './safeIds';

export interface SnapshotInfo { file: string; versionId: string; label: string; at: number; size: number }

const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024 * 1024;

export class SnapshotService {
  constructor(private launcherDir: string, private gameDir: string) {}
  setGameDir(dir: string) { this.gameDir = dir; }

  private dir(): string {
    const d = path.join(this.launcherDir, 'snapshots');
    fs.mkdirSync(d, { recursive: true });
    return d;
  }

  /** Создаёт снапшот папки версии. Возвращает файл. */
  create(versionId: string, label?: string): SnapshotInfo {
    if (!isSafeVersionId(versionId)) throw new Error('Bad version id');
    const src = path.join(this.gameDir, 'versions', versionId);
    try {
      if (!fs.statSync(src).isDirectory()) throw new Error('Version folder not found');
    } catch {
      throw new Error('Version folder not found');
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeLabel = (label ?? '').replace(/[^a-zA-Z0-9а-яА-Я_.-]/g, '_').slice(0, 40);
    const file = path.join(this.dir(), `${versionId}--${stamp}${safeLabel ? '--' + safeLabel : ''}.zip`);
    const zip = new AdmZip();
    let count = 0;
    let bytes = 0;
    const walk = (dir: string, rel: string) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = fs.lstatSync(full);
        if (st.isSymbolicLink()) continue;
        if (st.isDirectory()) walk(full, rel ? `${rel}/${name}` : name);
        else if (st.isFile()) {
          bytes += st.size;
          if (bytes > MAX_SNAPSHOT_BYTES) throw new Error('Version too large for snapshot (>2GB)');
          if (++count > 100000) throw new Error('Too many files for snapshot');
          zip.addFile(`${versionId}/${rel ? rel + '/' : ''}${name}`, fs.readFileSync(full));
        }
      }
    };
    walk(src, '');
    zip.addFile('trel-snapshot.json', Buffer.from(JSON.stringify({ versionId, label: label ?? '', at: Date.now() }), 'utf-8'));
    zip.writeZip(file);
    const st = fs.statSync(file);
    return { file: path.basename(file), versionId, label: label ?? '', at: Date.now(), size: st.size };
  }

  /** Список снапшотов (новее — раньше), опционально фильтр по версии. */
  list(versionId?: string): SnapshotInfo[] {
    let names: string[] = [];
    try { names = fs.readdirSync(this.dir()); } catch { return []; }
    const out: SnapshotInfo[] = [];
    for (const n of names) {
      if (!n.endsWith('.zip')) continue;
      const full = path.join(this.dir(), n);
      let st: fs.Stats | null = null;
      try { st = fs.statSync(full); } catch { continue; }
      if (!st.isFile()) continue;
      // versionId — из манифеста (имя файла лишь подсказка: в id бывают
      // дефисы, сплит по '--' ненадёжен).
      let vid = n.split('--')[0];
      let label = '';
      let at = st.mtimeMs;
      try {
        const zip = new AdmZip(full);
        const entry = zip.getEntry('trel-snapshot.json');
        if (entry) {
          const man = JSON.parse(zip.readAsText(entry)) as { versionId?: string; label?: string; at?: number };
          if (typeof man.versionId === 'string' && isSafeVersionId(man.versionId)) vid = man.versionId;
          if (typeof man.label === 'string') label = man.label.slice(0, 40);
          if (typeof man.at === 'number') at = man.at;
        }
      } catch { /* ignore */ }
      if (versionId && vid !== versionId) continue;
      out.push({ file: n, versionId: vid, label, at, size: st.size });
    }
    return out.sort((a, b) => b.at - a.at);
  }

  /** Откат: текущую папку версии — в .bak-<ts>, из снапшота — на место. */
  restore(file: string): string {
    if (file.includes('/') || file.includes('\\') || file.includes('..') || !file.endsWith('.zip')) {
      throw new Error('Bad snapshot file');
    }
    const full = path.join(this.dir(), file);
    if (!fs.existsSync(full)) throw new Error('Snapshot not found');
    const zip = new AdmZip(full);
    const entries = zip.getEntries();
    if (entries.length === 0) throw new Error('Snapshot is empty');
    let versionId: string | null = null;
    try {
      const man = zip.getEntry('trel-snapshot.json');
      if (man) versionId = (JSON.parse(zip.readAsText(man)) as { versionId?: string }).versionId ?? null;
    } catch { /* ignore */ }
    if (!versionId || !isSafeVersionId(versionId)) throw new Error('Snapshot has no valid version');
    // Zip-slip по всем записям до распаковки.
    for (const e of entries) {
      const name = e.entryName.replace(/\\/g, '/');
      const norm = path.posix.normalize(name);
      if (norm.startsWith('..') || path.posix.isAbsolute(norm)) throw new Error(`Unsafe entry: ${name}`);
    }
    const dest = path.join(this.gameDir, 'versions', versionId);
    if (fs.existsSync(dest)) {
      fs.renameSync(dest, dest + '.bak-' + Date.now());
    }
    fs.mkdirSync(dest, { recursive: true });
    // Распаковываем вручную: записи лежат под префиксом <versionId>/.
    for (const e of entries) {
      if (e.isDirectory || e.entryName === 'trel-snapshot.json') continue;
      const rel = e.entryName.replace(/\\/g, '/');
      const inner = rel.startsWith(versionId + '/') ? rel.slice(versionId.length + 1) : rel;
      if (!inner) continue;
      const out = path.join(dest, ...inner.split('/'));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, e.getData());
    }
    return versionId;
  }

  /**
   * Экспорт сборки для друга: .trelpack (обычный zip) с раскладкой
   * overrides/ + trel-pack.json. Импорт — через fromArchive-флоу.
   */
  exportPack(versionId: string, destZip: string): { file: string; size: number } {
    if (!isSafeVersionId(versionId)) throw new Error('Bad version id');
    const vDir = path.join(this.gameDir, 'versions', versionId);
    try {
      if (!fs.statSync(vDir).isDirectory()) throw new Error('Version folder not found');
    } catch {
      throw new Error('Version folder not found');
    }
    if (!destZip.endsWith('.trelpack')) throw new Error('Destination must end with .trelpack');
    let mc = versionId;
    let loader = 'vanilla';
    try {
      const vj = JSON.parse(fs.readFileSync(path.join(vDir, `${versionId}.json`), 'utf-8')) as Record<string, unknown>;
      if (typeof vj.id === 'string') mc = vj.id;
      if (typeof vj.inheritsFrom === 'string' && vj.inheritsFrom) mc = vj.inheritsFrom;
    } catch { /* ignore */ }
    const zip = new AdmZip();
    let bytes = 0;
    const CONTENT_SUBS = ['mods', 'config', 'resourcepacks', 'shaderpacks', 'datapacks', 'scripts', 'saves', 'options.txt'];
    for (const sub of CONTENT_SUBS) {
      const full = path.join(vDir, sub);
      let st: fs.Stats | null = null;
      try { st = fs.lstatSync(full); } catch { continue; }
      if (st.isSymbolicLink()) continue;
      const put = (file: string, rel: string) => {
        const fst = fs.statSync(file);
        bytes += fst.size;
        if (bytes > MAX_SNAPSHOT_BYTES) throw new Error('Pack too large (>2GB)');
        zip.addFile(`overrides/${rel}`, fs.readFileSync(file));
      };
      if (st.isDirectory()) {
        const walk = (dir: string, rel: string) => {
          for (const name of fs.readdirSync(dir)) {
            const f = path.join(dir, name);
            const fst = fs.lstatSync(f);
            if (fst.isSymbolicLink()) continue;
            if (fst.isDirectory()) walk(f, `${rel}/${name}`);
            else if (fst.isFile()) put(f, `${rel}/${name}`);
          }
        };
        walk(full, sub);
      } else if (st.isFile()) {
        put(full, sub);
      }
    }
    zip.addFile('trel-pack.json', Buffer.from(JSON.stringify({
      format: 'trel-pack', formatVersion: 1, name: versionId, mc, loader, exportedAt: Date.now(),
    }), 'utf-8'));
    fs.mkdirSync(path.dirname(destZip), { recursive: true });
    zip.writeZip(destZip);
    return { file: destZip, size: fs.statSync(destZip).size };
  }

  /**
   * Импорт .trelpack в версию targetId: overrides/* → versions/<targetId>/.
   * Базовую игру (vanilla json/jar) друг докачивает сам — предупреждаем.
   */
  async importPack(archivePath: string, targetId: string): Promise<{ versionId: string; copied: number }> {
    if (!isSafeVersionId(targetId)) throw new Error('Bad target version id');
    const { extractPackArchive, readPackDependencies } = await import('./import-ops');
    const pack = await extractPackArchive(archivePath);
    try {
      const deps = await readPackDependencies(pack.tmpDir).catch(() => null);
      void deps;
      const dest = path.join(this.gameDir, 'versions', targetId);
      fs.mkdirSync(dest, { recursive: true });
      let copied = 0;
      const ovr = pack.rootDir;
      for (const name of fs.readdirSync(ovr)) {
        const from = path.join(ovr, name);
        const st = fs.lstatSync(from);
        if (st.isSymbolicLink()) continue;
        const to = path.join(dest, name);
        if (st.isDirectory()) {
          fs.cpSync(from, to, { recursive: true, force: true, errorOnExist: false });
          copied++;
        } else if (st.isFile() && name !== 'trel-pack.json') {
          fs.copyFileSync(from, to);
          copied++;
        }
      }
      return { versionId: targetId, copied };
    } finally {
      try { fs.rmSync(pack.tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  /** Удалить снапшот. */
  remove(file: string): boolean {
    if (file.includes('/') || file.includes('\\') || file.includes('..') || !file.endsWith('.zip')) {
      throw new Error('Bad snapshot file');
    }
    const full = path.join(this.dir(), file);
    if (!fs.existsSync(full)) return false;
    fs.unlinkSync(full);
    return true;
  }
}
