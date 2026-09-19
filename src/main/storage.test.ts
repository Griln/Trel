import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { dirUsage, diskUsage, cleanTarget } from './storage';

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

function tmpDir(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

describe('storage', () => {
  it('measures folders and finds the biggest', () => {
    const game = tmpDir('trel-storage-');
    fs.mkdirSync(path.join(game, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(game, 'mods', 'a.jar'), 'x'.repeat(1000));
    fs.mkdirSync(path.join(game, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(game, 'logs', 'latest.log'), 'y'.repeat(100));
    const du = diskUsage(game);
    expect(du.entries[0].name).toBe('mods');
    expect(du.total).toBe(1100);
  });

  it('cleans logs and tmp leftovers only', () => {
    const game = tmpDir('trel-storage-');
    fs.mkdirSync(path.join(game, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(game, 'logs', 'a.log'), '12345');
    fs.mkdirSync(path.join(game, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(game, 'mods', 'keep.jar.trel_tmp'), '123');
    fs.writeFileSync(path.join(game, 'mods', 'keep.jar'), 'x');
    const l = cleanTarget(game, 'logs');
    expect(l.removedFiles).toBe(1);
    const t = cleanTarget(game, 'tmp');
    expect(t.removedFiles).toBe(1);
    expect(fs.existsSync(path.join(game, 'mods', 'keep.jar'))).toBe(true);
  });

  it('dirUsage caps runaway trees', () => {
    const dir = tmpDir('trel-storage-');
    for (let i = 0; i < 30; i++) fs.writeFileSync(path.join(dir, `f${i}`), '12345');
    const capped = dirUsage(dir);
    expect(capped.files).toBe(30);
  });
});
