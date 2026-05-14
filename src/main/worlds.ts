import * as fs from 'node:fs';
import * as path from 'node:path';
import AdmZip from 'adm-zip';

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

function dirSize(dir: string): number {
  let total = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      try {
        if (e.isDirectory()) total += dirSize(p);
        else total += fs.statSync(p).size;
      } catch {}
    }
  } catch {}
  return total;
}

/**
 * Parse very minimal data from level.dat NBT WITHOUT adding an NBT dependency.
 * We look for TAG_Long LastPlayed, TAG_String LevelName, TAG_Int GameType, TAG_Byte hardcore, TAG_String Version.name.
 * The binary format of NBT makes it possible to grep these values reliably since their key names are unique ASCII strings.
 */
function parseLevelDat(file: string): { name?: string; lastPlayed?: number; gameMode?: number; hardcore?: boolean; version?: string } {
  try {
    let raw: Buffer;
    try {
      // level.dat is gzipped NBT
      raw = require('node:zlib').gunzipSync(fs.readFileSync(file));
    } catch {
      raw = fs.readFileSync(file);
    }
    const out: any = {};

    // Helper: find tag by ASCII name, assume preceding 2 bytes are name length
    function findTag(tagId: number, name: string): number {
      const needle = Buffer.alloc(1 + 2 + name.length);
      needle[0] = tagId;
      needle.writeUInt16BE(name.length, 1);
      needle.write(name, 3, 'ascii');
      return raw.indexOf(needle);
    }

    const nameIdx = findTag(0x08, 'LevelName'); // TAG_String
    if (nameIdx >= 0) {
      const lenOff = nameIdx + 1 + 2 + 'LevelName'.length;
      const len = raw.readUInt16BE(lenOff);
      out.name = raw.slice(lenOff + 2, lenOff + 2 + len).toString('utf-8');
    }

    const lpIdx = findTag(0x04, 'LastPlayed'); // TAG_Long (ms)
    if (lpIdx >= 0) {
      const valOff = lpIdx + 1 + 2 + 'LastPlayed'.length;
      out.lastPlayed = Number(raw.readBigInt64BE(valOff));
    }

    const gmIdx = findTag(0x03, 'GameType'); // TAG_Int
    if (gmIdx >= 0) {
      const valOff = gmIdx + 1 + 2 + 'GameType'.length;
      out.gameMode = raw.readInt32BE(valOff);
    }

    const hcIdx = findTag(0x01, 'hardcore'); // TAG_Byte
    if (hcIdx >= 0) {
      const valOff = hcIdx + 1 + 2 + 'hardcore'.length;
      out.hardcore = raw[valOff] === 1;
    }

    // Version.Name inside a compound — find TAG_String "Name"
    const vIdx = findTag(0x08, 'Name');
    if (vIdx >= 0) {
      const valOff = vIdx + 1 + 2 + 'Name'.length;
      const len = raw.readUInt16BE(valOff);
      const val = raw.slice(valOff + 2, valOff + 2 + len).toString('utf-8');
      // Only accept if looks like a version string
      if (/^\d/.test(val) && val.length < 40) out.version = val;
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

  list(): WorldInfo[] {
    const root = this.savesDir();
    if (!fs.existsSync(root)) return [];
    const out: WorldInfo[] = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(root, entry.name);
      const levelDat = path.join(dir, 'level.dat');
      if (!fs.existsSync(levelDat)) continue;

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
    out.sort((a, b) => b.lastPlayed - a.lastPlayed);
    return out;
  }

  iconDataUrl(worldName: string): string | null {
    const p = path.join(this.savesDir(), worldName, 'icon.png');
    if (!fs.existsSync(p)) return null;
    try {
      const buf = fs.readFileSync(p);
      return 'data:image/png;base64,' + buf.toString('base64');
    } catch {
      return null;
    }
  }

  delete(worldName: string): boolean {
    const p = path.join(this.savesDir(), worldName);
    if (!fs.existsSync(p)) return false;
    fs.rmSync(p, { recursive: true, force: true });
    return true;
  }

  /** Zip the world folder to `<savesDir>/../backups/<worldName>-<timestamp>.zip` and return its path. */
  backup(worldName: string): string {
    const src = path.join(this.savesDir(), worldName);
    if (!fs.existsSync(src)) throw new Error('World not found');
    const backupsDir = path.join(this.gameDir, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const out = path.join(backupsDir, `${worldName}-${stamp}.zip`);
    const zip = new AdmZip();
    zip.addLocalFolder(src, worldName);
    zip.writeZip(out);
    return out;
  }
}
