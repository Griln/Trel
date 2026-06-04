/**
 * Хелперы для валидации идентификаторов, приходящих из renderer'а через IPC.
 *
 * Renderer не считается доверенным источником: любая компрометация (XSS в
 * data-URL, сторонний content и т.п.) может отправить через IPC `..` или
 * абсолютный путь и заставить нас зачистить произвольную папку. Поэтому
 * перед любой FS-операцией с id нужно проверить, что он состоит только
 * из символов которые мы сами генерим / получаем от Mojang.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Проверяет id версии Minecraft (rd-132211, 1.21.1, 1.21.1-forge-47.2.0,
 * fabric-loader-0.15.7-1.21.1, neoforge-21.1.10, snapshot-23w14a и т.п.).
 * Допускаем буквы, цифры, точки, минусы, подчёркивания.
 */
const WIN_RESERVED = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

export function isSafeVersionId(id: unknown): id is string {
  if (typeof id !== 'string' || id.length === 0 || id.length >= 128) return false;
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return false;
  if (id === '.' || id === '..') return false;
  if (/^\.+$/.test(id)) return false;
  if (process.platform === 'win32' && WIN_RESERVED.has(id.toLowerCase())) return false;
  return true;
}

/** Бросает Error если id невалидный — удобно в IPC-хендлерах. */
export function assertSafeVersionId(id: unknown, label = 'versionId'): asserts id is string {
  if (!isSafeVersionId(id)) {
    throw new Error(`Invalid ${label}: must be alnum + . _ -`);
  }
}

/**
 * Проверяет id сервера (`crypto.randomBytes(6).toString('hex')` = 12 hex-символов).
 */
export function isSafeServerId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-f0-9]{12}$/.test(id);
}

export function assertSafeServerId(id: unknown): asserts id is string {
  if (!isSafeServerId(id)) {
    throw new Error('Invalid serverId');
  }
}

/**
 * Проверяет имя мира. Принимает синтетические `~legacy:` (для loose-файлов)
 * и обычные имена папок миров (Minecraft разрешает довольно много, но мы
 * ограничиваем разумным набором).
 *
 * Главное — никаких `..`, `/`, `\` в обычной части. Синтетические `~legacy:`
 * отдельно валидируются в `WorldService.resolveWorld` через сравнение с
 * фактическими корнями.
 */
export function isSafeWorldName(name: unknown): name is string {
  if (typeof name !== 'string' || name.length === 0 || name.length > 200) return false;
  if (name.startsWith('~legacy:')) {
    // Синтетический id — содержит rootKey и optional fileName, оба
    // получаются через replace(/[\\/:]/g, '_'), значит сами не содержат
    // слешей и колонов. Допустимы буквы/цифры/точки/_/-/:.
    return /^~legacy:[A-Za-z0-9._:-]+$/.test(name);
  }
  // Обычные имена: запрещаем path-separator и `..`
  if (name.includes('/') || name.includes('\\')) return false;
  if (name === '.' || name === '..') return false;
  // Запрещаем NUL и control-chars
  if (/[\x00-\x1f]/.test(name)) return false;
  return true;
}

export function assertSafeWorldName(name: unknown): asserts name is string {
  if (!isSafeWorldName(name)) {
    throw new Error('Invalid world name');
  }
}

/**
 * Гарантирует, что разрешённый путь действительно лежит внутри `root`.
 * Возвращает true если безопасно. Использовать перед любым `fs.rmSync`/`fs.writeFile`
 * на путях, собранных с использованием user input.
 */
function resolveNearest(pathStr: string): string | null {
  let current = path.resolve(pathStr);
  for (let i = 0; i < 32; i++) {
    try { return fs.realpathSync(current); } catch {}
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

export function isInsideDir(child: string, root: string): boolean {
  const resolvedChild = resolveNearest(child);
  const resolvedRoot = resolveNearest(root);
  if (!resolvedChild || !resolvedRoot) return false;
  const sep = path.sep;
  return (
    resolvedChild === resolvedRoot ||
    resolvedChild.startsWith(resolvedRoot + sep)
  );
}
