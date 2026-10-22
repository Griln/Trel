import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import AdmZip from 'adm-zip';
import nbt from 'prismarine-nbt';
import { dirSize } from './util';

export interface WorldInfo {
  name: string;             // folder name
  displayName: string;      // from level.dat or fallback
  path: string;             // absolute path to world folder
  lastPlayed: number;       // epoch ms, 0 if unknown
  sizeBytes: number;
  gameMode?: number;        // 0 survival, 1 creative, 2 adventure, 3 spectator
  hardcore?: boolean;
  version?: string;         // version used to create/save world
  hasIcon: boolean;
}

function longToNumber(val: bigint | [number, number]): number {
  if (typeof val === 'bigint') return Number(val);
  const [hi, lo] = val;
  return Number((BigInt(hi >>> 0) << 32n) | BigInt(lo >>> 0));
}

/**
 * Parse level.dat NBT using prismarine-nbt.
 * Reads: LevelName, LastPlayed, GameType, hardcore, Version.Name.
 */
function parseLevelDat(file: string): { name?: string; lastPlayed?: number; gameMode?: number; hardcore?: boolean; version?: string } {
  try {
    // level.dat — kilobytes; megabytes = a foreign/corrupted file, we don't pull it into RAM.
    try {
      if (fs.statSync(file).size > 8 * 1024 * 1024) return {};
    } catch { return {}; }
    let raw: Buffer;
    try {
      raw = zlib.gunzipSync(fs.readFileSync(file));
      if (raw.length > 16 * 1024 * 1024) return {};
    } catch {
      raw = fs.readFileSync(file);
    }

    const parsed = nbt.parseUncompressed(raw);
    const data = nbt.simplify(parsed);
    const out: any = {};

    if (typeof data.LevelName === 'string') out.name = data.LevelName;
    if (data.LastPlayed !== undefined) out.lastPlayed = longToNumber(data.LastPlayed);
    if (typeof data.GameType === 'number') out.gameMode = data.GameType;
    if (typeof data.hardcore === 'number') out.hardcore = data.hardcore === 1;

    if (data.Version && typeof data.Version.Name === 'string') {
      const ver = data.Version.Name;
      if (/^\d/.test(ver) && ver.length < 40) out.version = ver;
    }

    return out;
  } catch {
    return {};
  }
}

export class WorldService {
  constructor(private gameDir: string) {}

  setGameDir(dir: string) { this.gameDir = dir; }

  /** saves/ is shared for the vanilla game directory. */
  savesDir(): string { return path.join(this.gameDir, 'saves'); }

  /**
   * Old versions (rd-*, c0.*, alpha-classic) write worlds depending on the OS:
   * Windows -> %APPDATA%\.minecraft (System.getenv("APPDATA"))
   * Mac     -> ~/Library/Application Support/minecraft
   * Linux   -> ~/.minecraft (user.home)
   *
   * We return all possible save locations INSIDE our gameDir
   * (gameDir/saves, gameDir/.minecraft/saves, gameDir/.minecraft).
   *
   * System paths (%APPDATA%\.minecraft) are NOT included: otherwise worlds of the
   * official Mojang launcher would pop up in the Trel UI — that is both visually
   * confusing and dangerous (you could accidentally delete someone else's world).
   *
   * Pre-Classic versions, with our `APPDATA=gameDir` substitution in place, write
   * `level.dat` right into gameDir, and not into the system `.minecraft` — for them
   * the `looseLevelDatRoots()` branch below is enough.
   */
  legacyRoots(): string[] {
    const out = [
      path.join(this.gameDir, 'saves'),
      path.join(this.gameDir, '.minecraft', 'saves'),
      path.join(this.gameDir, '.minecraft'),
    ];
    return out;
  }

  /**
   * Where Pre-Classic versions physically write the single `level.dat`.
   * Wider than `legacyRoots()`, because rd-* is launched with cwd=gameDir
   * and `-Duser.dir=gameDir`, and then writes `level.dat` right there —
   * neither in `gameDir/saves` nor in `gameDir/.minecraft`. If this root
   * is not taken into account, the file is not found and not deleted on
   * "delete completely".
   */
  private looseLevelDatRoots(): string[] {
    const out: string[] = [
      this.gameDir,                     // rd-* writes here because of cwd=gameDir
      ...this.legacyRoots(),
    ];
    // dedupe
    const seen = new Set<string>();
    return out.filter((p) => {
      const k = path.resolve(p).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  list(): WorldInfo[] {
    const seen = new Set<string>();
    const out: WorldInfo[] = [];

    const scanRoot = (root: string, _isLegacy: boolean) => {
      if (!fs.existsSync(root)) return;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(root, { withFileTypes: true });
      } catch { return; }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dir = path.join(root, entry.name);
        // Avoid recursing into nested .minecraft accidentally
        if (entry.name === '.minecraft') continue;

        const levelDat = path.join(dir, 'level.dat');
        if (!fs.existsSync(levelDat)) continue;

        // Avoid duplicates by canonical path
        const key = path.resolve(dir).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const parsed = parseLevelDat(levelDat);
        out.push({
          name: entry.name,
          displayName: parsed.name || entry.name,
          path: dir,
          lastPlayed: parsed.lastPlayed || 0,
          sizeBytes: dirSize(dir),
          gameMode: parsed.gameMode,
          hardcore: parsed.hardcore,
          version: parsed.version,
          hasIcon: fs.existsSync(path.join(dir, 'icon.png')),
        });
      }
    };

    for (const root of this.legacyRoots()) scanRoot(root, root !== this.savesDir());

    // Pre-Classic / Classic / rd-* versions save the world as a SINGLE file
    // <root>/level.dat (and not as a folder). Without this branch such worlds were
    // invisible in the UI — the user could not delete them, and they "resurrected"
    // on the next launch of an old version.
    //
    // Indev/Infdev (in-*, inf-*) additionally use the `mclevel.dat` format
    // in gameDir and `saves/<name>.mclevel` (single files, not folders).
    const gameDirResolved = path.resolve(this.gameDir).toLowerCase();
    const looseFiles = ['level.dat', 'mclevel.dat'];
    for (const root of this.looseLevelDatRoots()) {
      for (const fileName of looseFiles) {
        const looseFile = path.join(root, fileName);
        if (!fs.existsSync(looseFile)) continue;
        let stat: fs.Stats;
        try { stat = fs.statSync(looseFile); } catch { continue; }
        if (!stat.isFile()) continue;

        const key = path.resolve(looseFile).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const inGameDir = path.resolve(root).toLowerCase().startsWith(gameDirResolved);
        const isIndev = fileName === 'mclevel.dat';
        out.push({
          name: this.syntheticLooseName(root, fileName),
          displayName: isIndev
            ? (inGameDir ? 'Indev мир' : 'Indev мир (вне лаунчера)')
            : (inGameDir ? 'Pre-Classic мир' : 'Pre-Classic мир (вне лаунчера)'),
          path: root,
          lastPlayed: stat.mtimeMs,
          sizeBytes: stat.size,
          hasIcon: false,
          version: isIndev ? 'Indev/Infdev' : 'Pre-Classic',
        });
      }
    }

    // Infdev: worlds may live as `saves/<name>.mclevel` (single files).
    // We look for such files in all savesDirs. Their format differs from the
    // modern one — we just show them so that they can be deleted.
    for (const root of this.legacyRoots()) {
      if (!fs.existsSync(root)) continue;
      let entries: string[];
      try { entries = fs.readdirSync(root); } catch { continue; }
      for (const entry of entries) {
        if (!entry.toLowerCase().endsWith('.mclevel')) continue;
        const full = path.join(root, entry);
        let stat: fs.Stats;
        try { stat = fs.statSync(full); } catch { continue; }
        if (!stat.isFile()) continue;

        const key = path.resolve(full).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        out.push({
          name: this.syntheticLooseName(root, entry),
          displayName: `Infdev мир (${entry.replace(/\.mclevel$/i, '')})`,
          path: root,
          lastPlayed: stat.mtimeMs,
          sizeBytes: stat.size,
          hasIcon: false,
          version: 'Infdev',
        });
      }
    }

    out.sort((a, b) => b.lastPlayed - a.lastPlayed);
    return out;
  }

  /**
   * Synthetic name for a loose level/mclevel file (Pre-Classic / Indev / Infdev).
   * Encodes the parent dir path + filename, so that one root can contain
   * several different world files (for example `level.dat` from Pre-Classic
   * and `mclevel.dat` from Indev at the same time).
   */
  private syntheticLooseName(root: string, fileName: string = 'level.dat'): string {
    const rootKey = path.resolve(root).replace(/[\\/:]/g, '_');
    const fileKey = fileName.replace(/[\\/:]/g, '_');
    return '~legacy:' + rootKey + ':' + fileKey;
  }

  /** Resolve a world name (folder OR synthetic loose) to its filesystem location. */
  private resolveWorld(worldName: string): { kind: 'folder' | 'loose'; dir: string; levelDat: string } | null {
    if (worldName.startsWith('~legacy:')) {
      // New format: `~legacy:<rootKey>:<fileName>`. The old format
      // `~legacy:<rootKey>` is still supported for backward compatibility —
      // in that case `level.dat` is implied.
      const rest = worldName.slice('~legacy:'.length);
      // The file name comes after the last ':' (rootKey contains no ':' thanks to
      // the separator replacement in syntheticLooseName).
      const lastColon = rest.lastIndexOf(':');
      let fileName = 'level.dat';
      if (lastColon >= 0) {
        const tail = rest.slice(lastColon + 1);
        // Heuristic: legitimate world files are level.dat[.suffix] or *.mclevel
        if (/^level\.dat([._-].*)?$/i.test(tail) || /^mclevel\.dat$/i.test(tail) || /\.mclevel$/i.test(tail)) {
          fileName = tail;
        }
      }
      for (const root of this.looseLevelDatRoots()) {
        if (this.syntheticLooseName(root, fileName) !== worldName
            && this.syntheticLooseName(root) !== worldName) continue;
        const file = path.join(root, fileName);
        try {
          if (fs.existsSync(file) && fs.statSync(file).isFile()) {
            return { kind: 'loose', dir: root, levelDat: file };
          }
        } catch {}
      }
      // Fallback for legacyRoots (there may be Infdev files in saves/)
      for (const root of this.legacyRoots()) {
        if (this.syntheticLooseName(root, fileName) !== worldName) continue;
        const file = path.join(root, fileName);
        try {
          if (fs.existsSync(file) && fs.statSync(file).isFile()) {
            return { kind: 'loose', dir: root, levelDat: file };
          }
        } catch {}
      }
      return null;
    }
    // Regular world name — a saves/<name> folder. Protection against `../`: we make sure
    // that the real resolved path indeed lies INSIDE root.
    for (const root of this.legacyRoots()) {
      const dir = path.join(root, worldName);
      const resolvedRoot = path.resolve(root);
      const resolvedDir = path.resolve(dir);
      if (
        resolvedDir !== resolvedRoot &&
        !resolvedDir.startsWith(resolvedRoot + path.sep)
      ) {
        // worldName contained `..` or an absolute path — skip this root.
        continue;
      }
      const levelDat = path.join(dir, 'level.dat');
      if (fs.existsSync(levelDat)) {
        // A symlink folder inside saves/ would bypass the resolve check above:
        // we compare the REAL path (a symlink to /etc will not pass).
        try {
          const realDir = fs.realpathSync(dir);
          const realRoot = fs.realpathSync(root);
          if (realDir !== realRoot && !realDir.startsWith(realRoot + path.sep)) continue;
        } catch { continue; }
        return { kind: 'folder', dir, levelDat };
      }
    }
    return null;
  }

  /** Find absolute path of world by its folder name across all legacy roots. */
  findWorldPath(worldName: string): string | null {
    const r = this.resolveWorld(worldName);
    return r ? r.dir : null;
  }

  iconDataUrl(worldName: string): string | null {
    const r = this.resolveWorld(worldName);
    if (!r || r.kind !== 'folder') return null;
    const p = path.join(r.dir, 'icon.png');
    if (!fs.existsSync(p)) return null;
    try {
      // World icon — tens of KB; megabytes over IPC choke the renderer.
      const st = fs.statSync(p);
      if (!st.isFile() || st.size > 2 * 1024 * 1024) return null;
      const buf = fs.readFileSync(p);
      return 'data:image/png;base64,' + buf.toString('base64');
    } catch {
      return null;
    }
  }

  delete(worldName: string): boolean {
    const r = this.resolveWorld(worldName);
    if (!r) return false;
    if (r.kind === 'folder') {
      fs.rmSync(r.dir, { recursive: true, force: true });
      return true;
    }
    // Loose format: we delete the file itself and its sibling backups.
    // Pre-Classic: `level.dat`, `level.dat_old`, `level.dat.bak`
    // Indev:       `mclevel.dat`, `mclevel.dat_old`
    // Infdev:      `<name>.mclevel` — only the file itself, there are usually no backups
    try { fs.rmSync(r.levelDat, { force: true }); } catch {}
    const baseName = path.basename(r.levelDat).toLowerCase();
    try {
      for (const entry of fs.readdirSync(r.dir)) {

        // We delete backups only for level.dat / mclevel.dat
        if (baseName === 'level.dat' && /^level\.dat([._-].*)?$/i.test(entry)) {
          try { fs.rmSync(path.join(r.dir, entry), { force: true }); } catch {}
        } else if (baseName === 'mclevel.dat' && /^mclevel\.dat([._-].*)?$/i.test(entry)) {
          try { fs.rmSync(path.join(r.dir, entry), { force: true }); } catch {}
        }
      }
    } catch {}
    return true;
  }

  /** Delete world AND all its existing zip backups in <gameDir>/backups/<worldName>-*.zip */
  deleteWithBackups(worldName: string): { world: boolean; backupsRemoved: number } {
    const worldDeleted = this.delete(worldName);
    let backupsRemoved = 0;
    const backupsDir = path.join(this.gameDir, 'backups');
    if (fs.existsSync(backupsDir)) {
      const safeName = worldName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const prefixes = [worldName + '-', safeName + '-'];
      for (const file of fs.readdirSync(backupsDir)) {
        if (!file.endsWith('.zip')) continue;
        if (!prefixes.some((p) => file.startsWith(p))) continue;
        try {
          fs.unlinkSync(path.join(backupsDir, file));
          backupsRemoved++;
        } catch {}
      }
    }
    return { world: worldDeleted, backupsRemoved };
  }

  /**
   * Deletes ALL loose world files (level.dat*, mclevel.dat*, *.mclevel)
   * from every root where Pre-Classic / Classic / Indev /
   * Infdev / early Alpha could have written a world. Wider than `legacyRoots()` —
   * it includes gameDir itself, because rd-* and Indev are launched with
   * cwd=gameDir and write these files right there.
   *
   * Used on "delete completely" of a pre-classic version and on a full
   * launcher reset. Without this, after removing an old version the world survived
   * and "resurrected" on the next launch of any compatible old version.
   *
   * Only the world files themselves are deleted — folders and other files next to them
   * are not touched, so that data of the official launcher is not affected.
   */
  wipeAllLooseLevelDat(): string[] {
    const removed: string[] = [];
    const looseRe = /^(level\.dat|mclevel\.dat)([._-].*)?$|\.mclevel$/i;
    for (const root of this.looseLevelDatRoots()) {
      if (!fs.existsSync(root)) continue;
      let entries: string[];
      try { entries = fs.readdirSync(root); } catch { continue; }
      for (const entry of entries) {
        if (!looseRe.test(entry)) continue;
        const full = path.join(root, entry);
        try {
          // Only a file; if for some reason it is a directory with such
          // a name — we skip it, so as not to accidentally wipe a whole world.
          if (fs.statSync(full).isFile()) {
            fs.rmSync(full, { force: true });
            removed.push(full);
          }
        } catch {}
      }
    }
    // Additionally: Infdev worlds in saves folders (`saves/<name>.mclevel`).
    for (const root of this.legacyRoots()) {
      if (!fs.existsSync(root)) continue;
      let entries: string[];
      try { entries = fs.readdirSync(root); } catch { continue; }
      for (const entry of entries) {
        if (!/\.mclevel$/i.test(entry)) continue;
        const full = path.join(root, entry);
        try {
          if (fs.statSync(full).isFile()) {
            fs.rmSync(full, { force: true });
            removed.push(full);
          }
        } catch {}
      }
    }
    return removed;
  }

  /** Zip the world folder to `<gameDir>/backups/<worldName>-<timestamp>.zip` and return its path. */
  backup(worldName: string): string {
    const r = this.resolveWorld(worldName);
    if (!r) throw new Error('World not found');
    const backupsDir = path.join(this.gameDir, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = worldName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const out = path.join(backupsDir, `${safeName}-${stamp}.zip`);
    const zip = new AdmZip();
    if (r.kind === 'folder') {
      // Manually, and not with addLocalFolder: a symlink inside the world (even to ~/.ssh)
      // would otherwise end up in the backup and leak when sharing. Symlinks are skipped.
      const base = path.basename(r.dir);
      let count = 0;
      const walk = (dir: string, rel: string) => {
        for (const name of fs.readdirSync(dir)) {
          if (count > 50000) throw new Error('World has too many files');
          const full = path.join(dir, name);
          const st = fs.lstatSync(full);
          if (st.isSymbolicLink()) continue;
          if (st.isDirectory()) walk(full, `${rel}/${name}`);
          else if (st.isFile()) {
            zip.addFile(`${base}/${rel ? rel + '/' : ''}${name}`, fs.readFileSync(full));
            count++;
          }
        }
      };
      walk(r.dir, '');
    } else {
      zip.addLocalFile(r.levelDat);
    }
    zip.writeZip(out);
    // Rotation: we keep the last N backups of this world, the old ones go to the bin.
    // Otherwise the backups folder swells to gigabytes and nobody cleans it.
    this.pruneBackups(worldName, 10);
    return out;
  }

  /** Deletes the world's backups older than the last `keep` ones. Returns the number of deleted ones. */
  pruneBackups(worldName: string, keep = 10): number {
    if (keep < 0) keep = 0;
    const dir = this.backupsDir();
    let names: string[] = [];
    try { names = fs.readdirSync(dir); } catch { return 0; }
    const safeName = worldName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const mine = names
      .filter((n) => n.startsWith(safeName + '-') && n.endsWith('.zip'))
      .map((n) => ({ n, mtime: 0 as number }))
      .map((e) => {
        try { e.mtime = fs.statSync(path.join(dir, e.n)).mtimeMs; } catch { /* ignore */ }
        return e;
      })
      .sort((a, b) => b.mtime - a.mtime);
    let removed = 0;
    for (const e of mine.slice(keep)) {
      try { fs.unlinkSync(path.join(dir, e.n)); removed++; } catch { /* ignore */ }
    }
    return removed;
  }

  /** Path to the backups directory. */
  private backupsDir(): string {
    return path.join(this.gameDir, 'backups');
  }

  /** List existing backup zips, newest first. */
  listBackups(): { file: string; name: string; world: string; mtime: number; size: number }[] {
    const dir = this.backupsDir();
    let entries: string[] = [];
    try { entries = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.zip')); }
    catch { return []; }
    return entries.map((f) => {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      // file name pattern: <world>-<timestamp>.zip → derive world by stripping trailing -timestamp
      const base = f.replace(/\.zip$/i, '');
      const world = base.replace(/-\d{4}-\d{2}-\d{2}.*$/, '').replace(/-\d+$/, '') || base;
      return { file: full, name: f, world, mtime: st.mtimeMs, size: st.size };
    }).sort((a, b) => b.mtime - a.mtime);
  }

  /**
   * Restore a world from a backup zip. The existing world folder (if any) is
   * moved aside to <name>.bak-<ts> before extraction so nothing is lost.
   * Returns the restored world folder name.
   */
  restore(backupFile: string): string {
    const resolved = path.resolve(backupFile);
    // safety: only allow files inside our backups dir
    if (!resolved.startsWith(path.resolve(this.backupsDir()) + path.sep)) {
      throw new Error('Backup file is outside the backups folder');
    }
    if (!fs.existsSync(resolved)) throw new Error('Backup file not found');

    const zip = new AdmZip(resolved);
    const entries = zip.getEntries();
    if (entries.length === 0) throw new Error('Backup is empty');
    // Zip-slip: a foreign zip with ../../ would overwrite mods/.desktop and give RCE.
    // We check ALL entries before extraction, not only the first one.
    for (const e of entries) {
      const name = e.entryName.replace(/\\/g, '/');
      const norm = path.posix.normalize(name);
      if (norm.startsWith('..') || path.posix.isAbsolute(norm) || /^[a-zA-Z]:/.test(norm)) {
        throw new Error(`Unsafe entry in backup zip: ${name}`);
      }
    }
    if (entries.length > 20000) throw new Error('Backup zip has too many entries');

    const savesDir = path.join(this.gameDir, 'saves');
    fs.mkdirSync(savesDir, { recursive: true });

    // Determine top-level folder inside the zip (folder backup) vs bare level.dat
    const first = entries[0].entryName.replace(/\\/g, '/');
    const topFolder = first.includes('/') ? first.split('/')[0] : null;

    if (topFolder) {
      const target = path.join(savesDir, topFolder);
      if (fs.existsSync(target)) {
        const aside = target + '.bak-' + Date.now();
        fs.renameSync(target, aside);
      }
      zip.extractAllTo(savesDir, true);
      return topFolder;
    } else {
      // bare level.dat → restore into a folder named after the backup
      const worldName = path.basename(resolved).replace(/-\d.*$/, '').replace(/\.zip$/i, '') || 'restored';
      const target = path.join(savesDir, worldName);
      if (fs.existsSync(target)) fs.renameSync(target, target + '.bak-' + Date.now());
      fs.mkdirSync(target, { recursive: true });
      zip.extractAllTo(target, true);
      return worldName;
    }
  }
}