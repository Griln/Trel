import * as fs from 'node:fs';
import * as path from 'node:path';
import { shell, clipboard, nativeImage } from 'electron';
export interface Shot {
  path: string;
  name: string;
  source: string;   // 'global' or version id
  mtime: number;
  size: number;
}

const IMG_RE = /\.(png|jpe?g)$/i;

/** Pure: turn a list of [dir,label] into Shot[] given a fs-like reader. Testable. */
export function collectShots(
  roots: { dir: string; source: string }[],
  read: (dir: string) => { name: string; mtime: number; size: number }[],
): Shot[] {
  const out: Shot[] = [];
  for (const r of roots) {
    let files: { name: string; mtime: number; size: number }[] = [];
    try { files = read(r.dir); } catch { continue; }
    for (const f of files) {
      if (!IMG_RE.test(f.name)) continue;
      out.push({ path: path.join(r.dir, f.name), name: f.name, source: r.source, mtime: f.mtime, size: f.size });
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

export class ScreenshotService {
  constructor(private gameDir: string) {}
  setGameDir(dir: string) { this.gameDir = dir; }

  private roots(): { dir: string; source: string }[] {
    const list: { dir: string; source: string }[] = [
      { dir: path.join(this.gameDir, 'screenshots'), source: 'global' },
    ];
    // per-version (isolated) screenshot folders
    const versionsDir = path.join(this.gameDir, 'versions');
    try {
      for (const v of fs.readdirSync(versionsDir, { withFileTypes: true })) {
        if (!v.isDirectory()) continue;
        const sd = path.join(versionsDir, v.name, 'screenshots');
        if (fs.existsSync(sd)) list.push({ dir: sd, source: v.name });
      }
    } catch { /* no versions dir */ }
    return list;
  }

  list(): Shot[] {
    return collectShots(this.roots(), (dir) =>
      fs.readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => {
          const st = fs.statSync(path.join(dir, e.name));
          return { name: e.name, mtime: st.mtimeMs, size: st.size };
        }),
    );
  }

  /** Guard: only allow operations on paths inside a known screenshots root. */
  private assertInside(p: string) {
    // realpath, not resolve: a symlink screenshots/evil -> / would otherwise
    // allow reading/deleting any file through the trusted prefix.
    let norm: string;
    try { norm = fs.realpathSync(p); } catch { norm = path.resolve(p); }
    const ok = this.roots().some((r) => {
      let rr: string;
      try { rr = fs.realpathSync(r.dir); } catch { rr = path.resolve(r.dir); }
      return norm === rr || norm.startsWith(rr + path.sep);
    });
    if (!ok) throw new Error('Path outside screenshots folder');
  }

  read(p: string): string {
    this.assertInside(p);
    const st = fs.statSync(p);
    // 25MB cap: a full-size PNG in base64 over IPC hung the renderer (OOM).
    if (!st.isFile() || st.size > 25 * 1024 * 1024) throw new Error('Screenshot too large');
    const buf = fs.readFileSync(p);
    const ext = path.extname(p).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  }

  delete(p: string): void {
    this.assertInside(p);
    fs.rmSync(p, { force: true });
  }

  reveal(p: string): void {
    this.assertInside(p);
    shell.showItemInFolder(path.resolve(p));
  }

  openFolder(): void {
    const dir = path.join(this.gameDir, 'screenshots');
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  }

  copy(p: string): void {
    this.assertInside(p);
    const img = nativeImage.createFromPath(p);
    clipboard.writeImage(img);
  }
}
