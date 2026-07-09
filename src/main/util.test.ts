import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { dirSize } from './util';

describe('dirSize', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-dirsize-'));
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'hello');
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'world!');
    const sub = path.join(tmpDir, 'sub');
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(sub, 'c.txt'), 'nested');
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('calculates total file sizes', () => {
    const size = dirSize(tmpDir);
    expect(size).toBe(5 + 6 + 6); // hello + world! + nested
  });

  it('returns 0 for empty dirs', () => {
    const empty = path.join(tmpDir, 'empty');
    fs.mkdirSync(empty);
    expect(dirSize(empty)).toBe(0);
  });

  it('handles nonexistent dirs gracefully', () => {
    expect(dirSize(path.join(tmpDir, 'does-not-exist'))).toBe(0);
  });
});
