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
    const norm = path.resolve(p);
    const ok = this.roots().some((r) => norm.startsWith(path.resolve(r.dir) + path.sep));
    if (!ok) throw new Error('Path outside screenshots folder');
  }

  read(p: string): string {
    this.assertInside(p);
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

  /** LWJGL2 numeric key codes (used by MC <=1.12.2 options.txt). */
  private static LWJGL: Record<string, number> = {
    F1:59,F2:60,F3:61,F4:62,F5:63,F6:64,F7:65,F8:66,F9:67,F10:68,F11:87,F12:88,
    A:30,B:48,C:46,D:32,E:18,F:33,G:34,H:35,I:23,J:36,K:37,L:38,M:50,N:49,O:24,
    P:25,Q:16,R:19,S:31,T:20,U:22,V:47,W:17,X:45,Y:21,Z:44,
    '0':11,'1':2,'2':3,'3':4,'4':5,'5':6,'6':7,'7':8,'8':9,'9':10,SPACE:57,
  };

  /** Translate a UI key label into the modern key.keyboard.* token. */
  private static modernToken(key: string): string {
    const k = key.toUpperCase();
    if (k === 'SPACE') return 'key.keyboard.space';
    if (/^F([1-9]|1[0-2])$/.test(k)) return 'key.keyboard.' + k.toLowerCase();
    if (/^[A-Z0-9]$/.test(k)) return 'key.keyboard.' + k.toLowerCase();
    return 'key.keyboard.' + k.toLowerCase();
  }

  /** Write the screenshot keybinding into options.txt of the game and every
   *  isolated per-version profile, matching each file's existing format. */
  setScreenshotKey(key: string): { updated: string[] } {
    const targets: string[] = [path.join(this.gameDir, 'options.txt')];
    const versionsDir = path.join(this.gameDir, 'versions');
    try {
      for (const v of fs.readdirSync(versionsDir, { withFileTypes: true })) {
        if (!v.isDirectory()) continue;
        const op = path.join(versionsDir, v.name, 'options.txt');
        if (fs.existsSync(op)) targets.push(op);
      }
    } catch { /* none */ }

    const updated: string[] = [];
    for (const file of targets) {
      let text = '';
      let exists = false;
      try { text = fs.readFileSync(file, 'utf-8'); exists = true; } catch { /* new */ }

      // decide format: legacy numeric if existing line looks numeric, else modern
      const m = text.match(/^key_key\.screenshot:(.+)$/m);
      const legacy = m ? /^\d+$/.test(m[1].trim()) : false;
      const value = legacy
        ? String(ScreenshotService.LWJGL[key.toUpperCase()] ?? ScreenshotService.LWJGL.F2)
        : ScreenshotService.modernToken(key);
      const line = 'key_key.screenshot:' + value;

      if (m) {
        text = text.replace(/^key_key\.screenshot:.*$/m, line);
      } else {
        if (text.length && !text.endsWith('\n')) text += '\n';
        text += line + '\n';
      }
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        // only create root options.txt automatically; per-version only if it existed
        if (exists || file === path.join(this.gameDir, 'options.txt')) {
          fs.writeFileSync(file, text, 'utf-8');
          updated.push(file);
        }
      } catch { /* ignore */ }
    }
    return { updated };
  }
}
