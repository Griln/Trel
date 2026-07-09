import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { TrelEmuDownloader } from './trelEmuDownloader';

describe('TrelEmuDownloader resume', () => {
  let tmpRoot: string;
  let dl: TrelEmuDownloader;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-emu-dl-'));
    // Подменяем targetDir, чтобы не мусорить в %APPDATA%.
    vi.spyOn(TrelEmuDownloader.prototype, 'resolveTargetDir').mockReturnValue(path.join(tmpRoot, 'trel-emu'));
    dl = new TrelEmuDownloader();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  it('writes .partial and .meta.json in <target>/downloads/', async () => {
    const partialPath = dl['getPartialPath'](dl.resolveTargetDir(), 'trel-emu-pack.zip');
    const metaPath = dl['getMetaPath'](dl.resolveTargetDir(), 'trel-emu-pack.zip');
    // Проверяем пути
    expect(partialPath).toContain('downloads');
    expect(partialPath.endsWith('.partial')).toBe(true);
    expect(metaPath.endsWith('.meta.json')).toBe(true);
  });

  it('getResumableBytes returns 0 when nothing is on disk', async () => {
    const n = await dl.getResumableBytes(dl.resolveTargetDir(), 'trel-emu-pack.zip', 'http://x');
    expect(n).toBe(0);
  });

  it('getResumableBytes returns size of valid .partial + .meta.json', async () => {
    const targetDir = dl.resolveTargetDir();
    const baseName = 'trel-emu-pack.zip';
    await fsp.mkdir(path.join(targetDir, 'downloads'), { recursive: true });
    const partialPath = dl['getPartialPath'](targetDir, baseName);
    const metaPath = dl['getMetaPath'](targetDir, baseName);
    await fsp.writeFile(partialPath, Buffer.alloc(1234, 0xAB));
    await fsp.writeFile(metaPath, JSON.stringify({
      url: 'http://x',
      expectedSha1: null,
      totalSize: 9999,
      etag: null,
      lastModified: null,
      acceptsRanges: true,
      startedAt: Date.now(),
    }));
    const n = await dl.getResumableBytes(targetDir, baseName, 'http://x');
    expect(n).toBe(1234);
  });

  it('getResumableBytes returns 0 if .partial is larger than meta.totalSize', async () => {
    const targetDir = dl.resolveTargetDir();
    const baseName = 'trel-emu-pack.zip';
    await fsp.mkdir(path.join(targetDir, 'downloads'), { recursive: true });
    const partialPath = dl['getPartialPath'](targetDir, baseName);
    const metaPath = dl['getMetaPath'](targetDir, baseName);
    await fsp.writeFile(partialPath, Buffer.alloc(2000, 0xAB));
    await fsp.writeFile(metaPath, JSON.stringify({
      url: 'http://x',
      expectedSha1: null,
      totalSize: 1000, // partial > total
      etag: null,
      lastModified: null,
      acceptsRanges: true,
      startedAt: Date.now(),
    }));
    const n = await dl.getResumableBytes(targetDir, baseName, 'http://x');
    expect(n).toBe(0);
  });

  it('getResumableBytes returns 0 if URLs do not match', async () => {
    const targetDir = dl.resolveTargetDir();
    const baseName = 'trel-emu-pack.zip';
    await fsp.mkdir(path.join(targetDir, 'downloads'), { recursive: true });
    const partialPath = dl['getPartialPath'](targetDir, baseName);
    const metaPath = dl['getMetaPath'](targetDir, baseName);
    await fsp.writeFile(partialPath, Buffer.alloc(100, 0xAB));
    await fsp.writeFile(metaPath, JSON.stringify({
      url: 'http://different',
      expectedSha1: null,
      totalSize: 1000,
      etag: null,
      lastModified: null,
      acceptsRanges: true,
      startedAt: Date.now(),
    }));
    const n = await dl.getResumableBytes(targetDir, baseName, 'http://x');
    expect(n).toBe(0);
  });

  it('getResumableBytes returns 0 if .meta.json is stale (>7 days)', async () => {
    const targetDir = dl.resolveTargetDir();
    const baseName = 'trel-emu-pack.zip';
    await fsp.mkdir(path.join(targetDir, 'downloads'), { recursive: true });
    const partialPath = dl['getPartialPath'](targetDir, baseName);
    const metaPath = dl['getMetaPath'](targetDir, baseName);
    await fsp.writeFile(partialPath, Buffer.alloc(100, 0xAB));
    await fsp.writeFile(metaPath, JSON.stringify({
      url: 'http://x',
      expectedSha1: null,
      totalSize: 1000,
      etag: null,
      lastModified: null,
      acceptsRanges: true,
      startedAt: Date.now() - 8 * 24 * 60 * 60_000, // 8 дней назад
    }));
    const n = await dl.getResumableBytes(targetDir, baseName, 'http://x');
    expect(n).toBe(0);
  });

  it('verifyPartialSha1 returns true when SHA1 matches', async () => {
    const targetDir = dl.resolveTargetDir();
    await fsp.mkdir(targetDir, { recursive: true });
    const data = Buffer.from('hello world');
    const sha1 = crypto.createHash('sha1').update(data).digest('hex');
    const p = path.join(targetDir, 'temp.partial');
    await fsp.writeFile(p, data);
    const ok = await dl['verifyPartialSha1'](p, sha1, 'http://x');
    expect(ok).toBe(true);
  });

  it('verifyPartialSha1 returns false on mismatch', async () => {
    const targetDir = dl.resolveTargetDir();
    await fsp.mkdir(targetDir, { recursive: true });
    const p = path.join(targetDir, 'temp.partial');
    await fsp.writeFile(p, Buffer.from('hello world'));
    // Берём SHA1 от других данных — он гарантированно не совпадёт.
    const wrongSha1 = crypto.createHash('sha1').update(Buffer.from('different content')).digest('hex');
    const ok = await dl['verifyPartialSha1'](p, wrongSha1, 'http://x');
    expect(ok).toBe(false);
  });

  it('verifyPartialSha1 returns true when no SHA1 override given', async () => {
    const targetDir = dl.resolveTargetDir();
    await fsp.mkdir(targetDir, { recursive: true });
    const p = path.join(targetDir, 'temp.partial');
    await fsp.writeFile(p, Buffer.from('hello'));
    const ok = await dl['verifyPartialSha1'](p, undefined, 'http://x');
    expect(ok).toBe(true);
  });
});
