import * as fs from 'node:fs';
import * as path from 'node:path';

/** Compute total size of a directory tree in bytes, skipping symlinks and avoiding loops. */
export function dirSize(dir: string, maxDepth = 32, maxFiles = 500_000): number {
  let total = 0;
  let files = 0;
  let stopped = false;
  const seen = new Set<string>();
  const walk = (d: string, depth: number): number => {
    let size = 0;
    if (depth <= 0 || stopped) return 0;
    try {
      const resolved = path.resolve(d);
      const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
      if (seen.has(key)) return 0;
      seen.add(key);
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        if (stopped) break;
        if (++files > maxFiles) { stopped = true; break; }
        const p = path.join(d, e.name);
        try {
          if (e.isSymbolicLink()) continue;
          if (e.isDirectory()) size += walk(p, depth - 1);
          else size += fs.statSync(p).size;
        } catch {}
      }
    } catch {}
    return size;
  };
  total = walk(dir, maxDepth);
  return total;
}
