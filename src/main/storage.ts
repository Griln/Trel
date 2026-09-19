/**
 * Карта диска папки игры + безопасная чистка. Показывает, кто съел место,
 * и удаляет только заведомо мусорное (логи, краш-репорты, tmp-хвосты).
 * Миры/моды/версии — только руками пользователя, тут их не трогаем.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DiskEntry { name: string; bytes: number; files: number }
export interface DiskUsage { entries: DiskEntry[]; total: number; freeBytes: number | null }

const CAPPED_TOPS = [
  'versions', 'libraries', 'assets', 'saves', 'mods', 'backups', 'logs',
  'crash-reports', 'resourcepacks', 'shaderpacks', 'screenshots', 'config',
  'coremods', 'schematics',
];

function walk(dir: string, depth: number, acc: { bytes: number; files: number }, budget: { n: number }): void {
  if (depth <= 0 || budget.n <= 0) return;
  let names: string[] = [];
  try { names = fs.readdirSync(dir); } catch { return; }
  for (const n of names) {
    if (budget.n-- <= 0) return;
    const full = path.join(dir, n);
    let st: fs.Stats | null = null;
    try { st = fs.lstatSync(full); } catch { continue; }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) walk(full, depth - 1, acc, budget);
    else { acc.bytes += st.size; acc.files++; }
  }
}

/** Размер одной папки с капами (глубина 12, 300к файлов — дальше оценка). */
export function dirUsage(dir: string): { bytes: number; files: number; truncated: boolean } {
  const acc = { bytes: 0, files: 0 };
  const budget = { n: 300_000 };
  walk(dir, 12, acc, budget);
  return { bytes: acc.bytes, files: acc.files, truncated: budget.n <= 0 };
}

export function diskUsage(gameDir: string): DiskUsage {
  const entries: DiskEntry[] = [];
  for (const top of CAPPED_TOPS) {
    const dir = path.join(gameDir, top);
    try {
      if (!fs.statSync(dir).isDirectory()) continue;
    } catch { continue; }
    const { bytes, files } = dirUsage(dir);
    if (files > 0) entries.push({ name: top, bytes, files });
  }
  entries.sort((a, b) => b.bytes - a.bytes);
  let freeBytes: number | null = null;
  try {
    const st = (fs as unknown as { statfsSync?: (p: string) => { bsize: number; bavail: number } }).statfsSync?.(gameDir);
    if (st) freeBytes = st.bsize * st.bavail;
  } catch { /* unknown */ }
  return { entries, total: entries.reduce((a, e) => a + e.bytes, 0), freeBytes };
}

/** Безопасные цели чистки: ключ → что удаляем. */
export const CLEAN_TARGETS = {
  logs: ['logs', 'crash-reports'],
  tmp: [] as string[], // .trel_tmp по всему gameDir (глубина 4)
} as const;

export function cleanTarget(gameDir: string, target: 'logs' | 'tmp'): { removedFiles: number; freedBytes: number } {
  let removedFiles = 0;
  let freedBytes = 0;
  const rmFile = (f: string) => {
    try {
      const st = fs.statSync(f);
      if (!st.isFile()) return;
      freedBytes += st.size;
      fs.unlinkSync(f);
      removedFiles++;
    } catch { /* ignore */ }
  };
  if (target === 'logs') {
    for (const top of CLEAN_TARGETS.logs) {
      const dir = path.join(gameDir, top);
      let names: string[] = [];
      try { names = fs.readdirSync(dir); } catch { continue; }
      for (const n of names.slice(0, 5000)) rmFile(path.join(dir, n));
    }
  } else {
    // .trel_tmp хвосты после обрывов (корень + 4 уровня).
    const walkTmp = (dir: string, depth: number) => {
      if (depth < 0) return;
      let names: string[] = [];
      try { names = fs.readdirSync(dir); } catch { return; }
      for (const n of names.slice(0, 5000)) {
        const full = path.join(dir, n);
        let st: fs.Stats | null = null;
        try { st = fs.lstatSync(full); } catch { continue; }
        if (st.isSymbolicLink()) continue;
        if (st.isDirectory()) walkTmp(full, depth - 1);
        else if (n.endsWith('.trel_tmp')) rmFile(full);
      }
    };
    walkTmp(gameDir, 4);
  }
  return { removedFiles, freedBytes };
}
