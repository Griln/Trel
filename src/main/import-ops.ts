/**
 * Тяжёлые операции импорта, не влезающие в import.ts: журнал/откат, импорт из
 * zip/mrpack, карантин модов, дубли modid, verify, архив миров, переезд.
 */
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import AdmZip from 'adm-zip';

export interface ImportJournal {
  at: string;
  sourceId: string;
  /** Созданные пути по категориям — для отката и атомарности. */
  created: Record<string, string[]>;
  completedCategories: string[];
}

const JOURNAL_FILE = '.trel_import_journal.json';
const LOG_FILE = '.trel_import.log';

function nt(p: string): string {
  return process.platform === 'win32' && p.length > 240 ? '\\\\?\\' + path.resolve(p) : p;
}

export function journalPath(gameDir: string): string { return path.join(gameDir, JOURNAL_FILE); }

export function readJournal(gameDir: string): ImportJournal | null {
  try {
    const raw = JSON.parse(fs.readFileSync(nt(journalPath(gameDir)), 'utf-8')) as ImportJournal;
    if (raw && typeof raw === 'object' && raw.created) return raw;
    return null;
  } catch { return null; }
}

export async function journalAdd(gameDir: string, sourceId: string, category: string, files: string[]): Promise<void> {
  try {
    const j = readJournal(gameDir) ?? { at: new Date().toISOString(), sourceId, created: {}, completedCategories: [] };
    j.sourceId = sourceId;
    j.created[category] = [...(j.created[category] ?? []), ...files];
    await fsp.writeFile(nt(journalPath(gameDir)), JSON.stringify(j), 'utf-8');
  } catch { /* журнал необязателен */ }
}

export async function journalComplete(gameDir: string, category: string): Promise<void> {
  try {
    const j = readJournal(gameDir);
    if (!j) return;
    if (!j.completedCategories.includes(category)) j.completedCategories.push(category);
    await fsp.writeFile(nt(journalPath(gameDir)), JSON.stringify(j), 'utf-8');
  } catch { /* журнал необязателен */ }
}

/** Откат категории (атомарность) или всего импорта: удаляет созданное по журналу. */
export async function rollbackJournal(gameDir: string, category?: string): Promise<number> {
  const j = readJournal(gameDir);
  if (!j) return 0;
  let removed = 0;
  const cats = category ? [category] : Object.keys(j.created);
  const gameReal = (() => { try { return fs.realpathSync(nt(gameDir)); } catch { return path.resolve(gameDir); } })();
  for (const cat of cats) {
    // Сначала файлы, потом пустые папки (по длине пути — глубокие раньше).
    const files = [...(j.created[cat] ?? [])].sort((a, b) => b.length - a.length);
    for (const f of files) {
      // Журнал — обычный json в папке игры: правка даёт удаление любых файлов.
      // Удаляем только то, что реально внутри gameDir (через realpath).
      try {
        const real = fs.realpathSync(nt(f));
        if (real !== gameReal && !real.startsWith(gameReal + path.sep)) continue;
      } catch {
        // Нет файла — нечего удалять; но путь всё равно проверяем строкой.
        const norm = path.resolve(f);
        if (norm !== gameReal && !norm.startsWith(gameReal + path.sep)) continue;
      }
      try {
        const st = await fsp.stat(nt(f)).catch(() => null);
        if (!st) continue;
        if (st.isDirectory()) { await fsp.rmdir(nt(f)).catch(() => {}); }
        else { await fsp.unlink(nt(f)); removed++; }
        // Чистим опустевших родителей до gameDir (не выше).
        let dir = path.dirname(f);
        while (dir.startsWith(gameDir) && dir !== gameDir) {
          const empty = await fsp.readdir(nt(dir)).catch(() => null);
          if (!empty || empty.length > 0) break;
          await fsp.rmdir(nt(dir)).catch(() => {});
          dir = path.dirname(dir);
        }
      } catch { /* уже нет — и ладно */ }
    }
    delete j.created[cat];
    j.completedCategories = j.completedCategories.filter((c) => c !== cat);
  }
  try { await fsp.writeFile(nt(journalPath(gameDir)), JSON.stringify(j), 'utf-8'); } catch {}
  return removed;
}

/** Дописывает строку в лог импорта (для диагностики «а что оно делало»). */
export async function appendImportLog(gameDir: string, line: string): Promise<string> {
  const p = path.join(gameDir, LOG_FILE);
  try { await fsp.appendFile(nt(p), `[${new Date().toISOString()}] ${line}\n`, 'utf-8'); } catch {}
  return p;
}

/**
 * Распаковка zip/mrpack/curseforge-пака во временную папку с защитой zip-slip.
 * Возвращает корень с игровыми данными (сам архив / подпапка overrides/ и т.п.).
 */
export async function extractPackArchive(archivePath: string, signal?: AbortSignal): Promise<{ tmpDir: string; rootDir: string; packName: string }> {
  const zip = new AdmZip(nt(archivePath));
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'trel-pack-'));
  const entries = zip.getEntries();
  let slipped = 0;
  const names: string[] = [];
  for (const e of entries) {
    if (signal?.aborted) break;
    const name = e.entryName.replace(/\\/g, '/');
    // Zip-slip: ../, абсолютные пути и виндовые диски наружу не выпускаем.
    const norm = path.posix.normalize(name);
    if (norm.startsWith('..') || path.isAbsolute(norm) || /^[a-zA-Z]:/.test(norm)) { slipped++; continue; }
    names.push(name);
  }
  if (slipped > 0) {
    // Не молчим: пак с .. внутри — либо битый, либо злой.
    await appendImportLog(tmpDir, `zip-slip blocked ${slipped} entries in ${path.basename(archivePath)}`);
  }
  // adm-zip без фильтра вывалит и slip-записи, поэтому распаковываем вручную.
  for (const name of names) {
    if (signal?.aborted) break;
    const dest = path.join(tmpDir, ...name.split('/'));
    if (name.endsWith('/')) { await fsp.mkdir(nt(dest), { recursive: true }); continue; }
    await fsp.mkdir(nt(path.dirname(dest)), { recursive: true });
    await fsp.writeFile(nt(dest), zip.readFile(name) ?? Buffer.alloc(0));
  }
  // Корень данных: сам tmp, overrides/ или minecraft/ внутри.
  let rootDir = tmpDir;
  for (const sub of ['overrides', 'minecraft']) {
    try {
      if ((await fsp.stat(nt(path.join(tmpDir, sub)))).isDirectory()) { rootDir = path.join(tmpDir, sub); break; }
    } catch {}
  }
  let packName = path.basename(archivePath).replace(/\.(zip|mrpack)$/i, '');
  try {
    for (const mf of ['modrinth.index.json', 'manifest.json']) {
      const raw = JSON.parse(await fsp.readFile(nt(path.join(tmpDir, mf)), 'utf-8').catch(() => 'null'));
      if (raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).name === 'string') {
        packName = (raw as Record<string, unknown>).name as string;
        break;
      }
    }
  } catch {}
  return { tmpDir, rootDir, packName };
}

/** Зависимости модпака (mc/loader) из индекса — для проверки совместимости. */
export async function readPackDependencies(rootDir: string): Promise<{ mc?: string; loader?: string; loaderVersion?: string; name?: string }> {
  // Индекс лежит в корне пака, а игровые файлы — в overrides//minecraft:
  // rootDir может указывать и туда, и туда, поэтому смотрим оба уровня.
  const idxDirs = [rootDir, path.dirname(rootDir)];
  const readIdx = async (name: string): Promise<Record<string, unknown> | null> => {
    for (const d of idxDirs) {
      try {
        const raw = JSON.parse(await fsp.readFile(nt(path.join(d, name)), 'utf-8')) as unknown;
        if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
      } catch { /* нет файла — смотрим дальше */ }
    }
    return null;
  };
  try {
    const idx = await readIdx('modrinth.index.json');
    if (idx && typeof idx === 'object') {
      const deps = (idx.dependencies ?? {}) as Record<string, string>;
      return { mc: deps.minecraft, loader: deps['fabric-loader'] ? 'fabric' : deps.forge ? 'forge' : deps.neoforge ? 'neoforge' : deps.quilt ? 'quilt' : undefined, loaderVersion: deps['fabric-loader'] ?? deps.forge ?? deps.neoforge ?? deps.quilt, name: typeof idx.name === 'string' ? idx.name : undefined };
    }
  } catch {}
  try {
    const man = await readIdx('manifest.json');
    if (man) {
      const mc = (man.minecraft as Record<string, unknown> | undefined);
      const loaders = (mc?.modLoaders ?? []) as Array<{ id?: string }>;
      const lid = loaders[0]?.id ?? '';
      return { mc: typeof mc?.version === 'string' ? mc.version as string : undefined, loader: lid.startsWith('forge') ? 'forge' : lid.startsWith('fabric') ? 'fabric' : undefined, loaderVersion: lid.split('-').pop(), name: typeof man.name === 'string' ? man.name : undefined };
    }
  } catch {}
  return {};
}

const EXPECTED_JAR_TOPS = new Set(['META-INF', 'assets', 'data', 'fabric.mod.json', 'mods.toml', 'neoforge.mods.toml', 'pack.mcmeta', 'LICENSE', 'NOTICE', 'module-info.class', 'fabric.mod.json5']);

/**
 * Карантин: эвристика по содержимому jar. Легитимный мод — классы + assets/data
 * + манифесты. Подозрительно: .exe/.dll/.so рядом, скрипты, запускные классы
 * в корне с именами вроде Start/Bootstrap/Installer.
 */
export function scanJarSuspicious(jarPath: string): string | null {
  let zip: AdmZip;
  try { zip = new AdmZip(nt(jarPath)); } catch { return 'unreadable jar'; }
  let names: string[];
  try { names = zip.getEntries().map((e) => e.entryName); } catch { return 'unreadable jar'; }
  if (names.length === 0) return 'empty jar';
  const tops = new Set(names.map((n) => n.split('/')[0]));
  const bad: string[] = [];
  for (const t of tops) {
    const low = t.toLowerCase();
    // Стартовые классы в корне (Start.class, Bootstrap.class) — классика
    // малвари в «модах»: проверяем раньше общего разрешения на .class.
    if (!t.includes('/') && /^(start|bootstrap|installer|launcher|update|patch)[.-]?/i.test(t)) { bad.push(t); continue; }
    if (EXPECTED_JAR_TOPS.has(t) || low.endsWith('.class') || low.endsWith('.json') || low.endsWith('.properties') || low.endsWith('.accesswidener') || low.endsWith('.mixins.json') || low.endsWith('.refmap.json')) continue;
    if (/\.(exe|dll|so|dylib|bat|ps1|vbs|js|py|sh)$/i.test(t)) bad.push(t);
    else if (/^(start|bootstrap|installer|launcher|update|patch)/i.test(t)) bad.push(t);
    else if (!t.includes('.') && !['assets', 'data', 'META-INF', 'net', 'com', 'org', 'io', 'me', 'dev', 'gg', 'xyz', 'club', 'moe', 'lol', 'rip', 'cn', 'ru', 'uk', 'de', 'fr', 'kotlin', 'javax', 'java', 'com', 'icons', 'textures', 'lang', 'coremods', 'META'].includes(t)) bad.push(t);
  }
  // Вложенные jar — норма для больших модов (jar-in-jar), но фиксируем.
  return bad.length > 0 ? `suspicious entries: ${bad.slice(0, 5).join(', ')}` : null;
}

/** Читает modid из fabric.mod.json / mods.toml внутри jar (без распаковки). */
export function readModId(jarPath: string): { id?: string; version?: string } {
  try {
    const zip = new AdmZip(nt(jarPath));
    const fab = zip.readAsText('fabric.mod.json', 'utf-8');
    if (fab) {
      const j = JSON.parse(fab) as { id?: string; version?: string };
      if (typeof j.id === 'string') return { id: j.id, version: j.version };
    }
    for (const name of ['META-INF/mods.toml', 'META-INF/neoforge.mods.toml']) {
      const toml = zip.readAsText(name, 'utf-8');
      if (!toml) continue;
      const id = toml.match(/modId\s*=\s*"([^"]+)"/)?.[1];
      const ver = toml.match(/version\s*=\s*"([^"]+)"/)?.[1];
      if (id) return { id, version: ver };
    }
  } catch { /* битый jar — карантин разберётся */ }
  return {};
}

/** Группирует моды по modid: один id в разных версиях — показать пользователю. */
export function findDuplicateMods(modsDir: string): string[] {
  let files: string[] = [];
  try { files = fs.readdirSync(nt(modsDir)).filter((f) => f.endsWith('.jar')); } catch { return []; }
  const byId = new Map<string, string[]>();
  for (const f of files) {
    const { id, version } = readModId(path.join(modsDir, f));
    if (!id) continue;
    byId.set(id, [...(byId.get(id) ?? []), `${f}${version ? ` (${version})` : ''}`]);
  }
  const out: string[] = [];
  for (const [id, list] of byId) if (list.length > 1) out.push(`${id}: ${list.join(' vs ')}`);
  return out;
}

/**
 * Подметание после переезда: считает оставшиеся файлы источника (пропущенные
 * дедупом остаются!) и сносит опустевшие папки снизу вверх.
 */
export async function sweepMovedSource(roots: string[], cap = 5000): Promise<{ left: number; removedDirs: number }> {
  let left = 0;
  let removedDirs = 0;
  const walk = async (dir: string, depth: number): Promise<boolean> => {
    // true — папка пуста и её можно снести.
    if (depth <= 0 || left >= cap) return false;
    let names: string[] = [];
    try { names = await fsp.readdir(nt(dir)); } catch { return false; }
    let empty = true;
    for (const n of names) {
      const full = path.join(dir, n);
      const st = await fsp.stat(nt(full)).catch(() => null);
      if (!st) continue;
      if (st.isDirectory()) {
        if (await walk(full, depth - 1)) {
          await fsp.rmdir(nt(full)).catch(() => {});
          removedDirs++;
        } else empty = false;
      } else { left++; empty = false; }
    }
    return empty;
  };
  for (const r of roots) {
    try { if ((await fsp.stat(nt(r))).isDirectory()) await walk(r, 6); } catch {}
  }
  return { left, removedDirs };
}

/** Упаковывает папку (миры Trel) в zip с датой — страховка перед импортом чужих. */
export async function archiveDirToZip(srcDir: string, destZip: string): Promise<number> {
  const zip = new AdmZip();
  let count = 0;
  const walk = async (dir: string, rel: string) => {
    const names = await fsp.readdir(nt(dir)).catch(() => [] as string[]);
    for (const n of names) {
      const full = path.join(dir, n);
      const st = await fsp.stat(nt(full)).catch(() => null);
      if (!st) continue;
      if (st.isDirectory()) await walk(full, rel ? `${rel}/${n}` : n);
      else { zip.addFile(rel ? `${rel}/${n}` : n, await fsp.readFile(nt(full)).catch(() => Buffer.alloc(0))); count++; }
    }
  };
  await walk(srcDir, '');
  if (count > 0) {
    await fsp.mkdir(nt(path.dirname(destZip)), { recursive: true });
    zip.writeZip(nt(destZip));
  }
  return count;
}
