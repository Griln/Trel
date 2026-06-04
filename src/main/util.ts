import * as fs from 'node:fs';
import * as path from 'node:path';

/** Compute total size of a directory tree in bytes, skipping symlinks and avoiding loops. */
export function dirSize(dir: string): number {
  let total = 0;
  const seen = new Set<string>();
  const walk = (d: string): number => {
    let size = 0;
    try {
      const resolved = path.resolve(d);
      const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
      if (seen.has(key)) return 0;
      seen.add(key);
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(d, e.name);
        try {
          if (e.isSymbolicLink()) continue;
          if (e.isDirectory()) size += walk(p);
          else size += fs.statSync(p).size;
        } catch {}
      }
    } catch {}
    return size;
  };
  return walk(dir);
}
