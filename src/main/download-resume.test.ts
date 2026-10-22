/** Resume and pause over a local HTTP server — no external network needed. */
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

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

/** Local HTTP server with Range support and a throttle (for pause/resume without external network). */
async function startFileServer(data: Buffer, chunkDelayMs: number): Promise<{ url: string; close: () => void; log: string[] }> {
  const log: string[] = [];
  const srv = http.createServer((req, res) => {
    log.push(`${req.method} ${req.url} range=${req.headers.range ?? '-'}`);
    const range = /bytes=(\d+)-/.exec(req.headers.range ?? '');
    const start = range ? Number(range[1]) : 0;
    const slice = data.subarray(start);
    const headers: Record<string, string> = {
      'Content-Length': String(slice.length),
      'Accept-Ranges': 'bytes',
      'Content-Type': 'application/octet-stream',
    };
    if (range) {
      headers['Content-Range'] = `bytes ${start}-${data.length - 1}/${data.length}`;
      res.writeHead(206, headers);
    } else {
      res.writeHead(200, headers);
    }
    // In chunks with a delay, so that the pause triggers in the middle.
    let off = 0;
    const step = 256 * 1024;
    const tick = () => {
      if (off >= slice.length || res.destroyed) { res.end(); return; }
      res.write(slice.subarray(off, off + step));
      off += step;
      setTimeout(tick, chunkDelayMs);
    };
    tick();
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}/file.bin`, close: () => srv.close(), log };
}

describe('e2e-live: download resume + pause', () => {
  it('resumes .part and survives a mid-download pause', async () => {
    const { downloadWithRetry } = await import('./installer');
    const { setDownloadsPaused } = await import('./http-proxy');
    const data = Buffer.alloc(8 * 1024 * 1024, 0xab);
    const srv = await startFileServer(data, 30);
    try {
      const dir = tmpDir('trel-e2e-dl-');
      const dest = path.join(dir, 'file.bin');
      // Drop a .part chunk (the first 2MB) — a resume must follow.
      fs.writeFileSync(dest + '.part', data.subarray(0, 2 * 1024 * 1024));
      // Pause in the middle: hold, then resume — the file must come out identical.
      setTimeout(() => setDownloadsPaused(true), 400);
      setTimeout(() => setDownloadsPaused(false), 1400);
      await downloadWithRetry(srv.url, dest, undefined, 3, data.length);
      expect(fs.readFileSync(dest).equals(data)).toBe(true);
      expect(srv.log.some((l) => l.includes('range=bytes=2097152-'))).toBe(true);
    } finally {
      setDownloadsPaused(false);
      srv.close();
    }
  }, 60000);
});
