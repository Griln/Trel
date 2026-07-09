import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as zlib from 'node:zlib';
import nbt from 'prismarine-nbt';
import { WorldService } from './worlds';

// Helper to create a minimal gzipped level.dat NBT buffer
function makeLevelDatNbt(data: Record<string, any>): Buffer {
  const nbtData: any = {
    type: 'compound',
    name: 'Data',
    value: {},
  };
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') {
      nbtData.value[k] = { type: 'string', value: v };
    } else if (typeof v === 'number' && Number.isInteger(v) && v >= -(2 ** 31) && v < 2 ** 31) {
      nbtData.value[k] = { type: 'int', value: v };
    } else if (typeof v === 'boolean' || (typeof v === 'number' && (v === 0 || v === 1))) {
      nbtData.value[k] = { type: 'byte', value: v ? 1 : 0 };
    } else if (typeof v === 'bigint' || (typeof v === 'number' && !Number.isInteger(v)) || (typeof v === 'number' && (v >= 2 ** 31 || v < -(2 ** 31)))) {
      nbtData.value[k] = { type: 'long', value: typeof v === 'bigint' ? v : BigInt(v) };
    }
  }
  const uncompressed = nbt.writeUncompressed(nbtData);
  return zlib.gzipSync(uncompressed);
}

describe('WorldService paths', () => {
  const svc = new WorldService('/game');

  it('savesDir returns correct path', () => {
    expect(svc.savesDir()).toBe(path.join('/game', 'saves'));
  });

  it('legacyRoots returns expected roots', () => {
    const roots = svc.legacyRoots();
    expect(roots).toContain(path.join('/game', 'saves'));
    expect(roots).toContain(path.join('/game', '.minecraft', 'saves'));
    expect(roots).toContain(path.join('/game', '.minecraft'));
  });

  it('looseLevelDatRoots returns expected roots', () => {
    const roots = (svc as any).looseLevelDatRoots();
    expect(roots).toContain('/game');
    expect(roots).toContain(path.join('/game', '.minecraft'));
  });
});

describe('WorldService syntheticLooseName', () => {
  const svc = new WorldService('/game');

  it('returns consistent synthetic names', () => {
    const name1 = (svc as any).syntheticLooseName('/game', 'level.dat');
    const name2 = (svc as any).syntheticLooseName('/game', 'level.dat');
    expect(name1).toBe(name2);
    expect(name1.startsWith('~legacy:')).toBe(true);
  });

  it('differentiates filename and root', () => {
    const name1 = (svc as any).syntheticLooseName('/game', 'level.dat');
    const name2 = (svc as any).syntheticLooseName('/game', 'mclevel.dat');
    const name3 = (svc as any).syntheticLooseName('/game/.minecraft', 'level.dat');
    expect(name1).not.toBe(name2);
    expect(name1).not.toBe(name3);
  });
});

describe('parseLevelDat (prismarine-nbt)', () => {
  it('reads string, long, int, byte fields from gzipped NBT', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-'));
    const worldDir = path.join(tmpDir, 'saves', 'TestWorld');
    fs.mkdirSync(worldDir, { recursive: true });

    const buf = makeLevelDatNbt({
      LevelName: 'MyWorld',
      LastPlayed: 1704067200n,
      GameType: 1,
      hardcore: true,
    });
    fs.writeFileSync(path.join(worldDir, 'level.dat'), buf);

    // create a small dummy file so dirSize doesn't return 0
    fs.writeFileSync(path.join(worldDir, 'dummy.txt'), 'x');

    const svc = new WorldService(tmpDir);
    const worlds = svc.list();
    expect(worlds.length).toBe(1);
    expect(worlds[0].displayName).toBe('MyWorld');
    expect(worlds[0].lastPlayed).toBe(1704067200);
    expect(worlds[0].gameMode).toBe(1);
    expect(worlds[0].hardcore).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads Version.Name compound', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-'));
    const worldDir = path.join(tmpDir, 'saves', 'VersionedWorld');
    fs.mkdirSync(worldDir, { recursive: true });

    const nbtData = {
      type: 'compound' as const,
      name: 'Data' as const,
      value: {
        LevelName: { type: 'string' as const, value: 'VersionedWorld' },
        LastPlayed: { type: 'long' as const, value: [0, 1234567890] as [number, number] },
        Version: {
          type: 'compound' as const,
          value: {
            Name: { type: 'string' as const, value: '1.20.1' },
            Id: { type: 'int' as const, value: 3465 },
          },
        },
      },
    };
    const buf = zlib.gzipSync(nbt.writeUncompressed(nbtData));
    fs.writeFileSync(path.join(worldDir, 'level.dat'), buf);
    fs.writeFileSync(path.join(worldDir, 'dummy.txt'), 'x');

    const svc = new WorldService(tmpDir);
    const worlds = svc.list();
    expect(worlds.length).toBe(1);
    expect(worlds[0].version).toBe('1.20.1');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('handles uncompressed level.dat', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-'));
    const worldDir = path.join(tmpDir, 'saves', 'RawWorld');
    fs.mkdirSync(worldDir, { recursive: true });

    const nbtData = {
      type: 'compound' as const,
      name: 'Data' as const,
      value: {
        LevelName: { type: 'string' as const, value: 'RawWorld' },
      },
    };
    const buf = nbt.writeUncompressed(nbtData); // NOT gzipped
    fs.writeFileSync(path.join(worldDir, 'level.dat'), buf);
    fs.writeFileSync(path.join(worldDir, 'dummy.txt'), 'x');

    const svc = new WorldService(tmpDir);
    const worlds = svc.list();
    expect(worlds.length).toBe(1);
    expect(worlds[0].displayName).toBe('RawWorld');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('handles missing/invalid level.dat gracefully', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-'));
    const worldDir = path.join(tmpDir, 'saves', 'BrokenWorld');
    fs.mkdirSync(worldDir, { recursive: true });
    fs.writeFileSync(path.join(worldDir, 'level.dat'), Buffer.from('not valid nbt'));
    fs.writeFileSync(path.join(worldDir, 'dummy.txt'), 'x');

    const svc = new WorldService(tmpDir);
    const worlds = svc.list();
    expect(worlds.length).toBe(1);
    expect(worlds[0].displayName).toBe('BrokenWorld'); // fallback to folder name

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('WorldService iconDataUrl', () => {
  it('returns base64 data URL for icon.png', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-'));
    const worldDir = path.join(tmpDir, 'saves', 'IconWorld');
    fs.mkdirSync(worldDir, { recursive: true });

    // Create a minimal gzipped level.dat
    fs.writeFileSync(path.join(worldDir, 'level.dat'), makeLevelDatNbt({ LevelName: 'IconWorld' }));
    fs.writeFileSync(path.join(worldDir, 'icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    fs.writeFileSync(path.join(worldDir, 'dummy.txt'), 'x');

    const svc = new WorldService(tmpDir);
    const url = svc.iconDataUrl('IconWorld');
    expect(url).toBe('data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when icon.png is missing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-'));
    const worldDir = path.join(tmpDir, 'saves', 'NoIconWorld');
    fs.mkdirSync(worldDir, { recursive: true });

    fs.writeFileSync(path.join(worldDir, 'level.dat'), makeLevelDatNbt({ LevelName: 'NoIconWorld' }));
    fs.writeFileSync(path.join(worldDir, 'dummy.txt'), 'x');

    const svc = new WorldService(tmpDir);
    expect(svc.iconDataUrl('NoIconWorld')).toBeNull();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('WorldService findWorldPath', () => {
  it('resolves folder world path', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-'));
    const worldDir = path.join(tmpDir, 'saves', 'FindableWorld');
    fs.mkdirSync(worldDir, { recursive: true });
    fs.writeFileSync(path.join(worldDir, 'level.dat'), makeLevelDatNbt({ LevelName: 'FindableWorld' }));
    fs.writeFileSync(path.join(worldDir, 'dummy.txt'), 'x');

    const svc = new WorldService(tmpDir);
    const found = svc.findWorldPath('FindableWorld');
    expect(found).toContain('FindableWorld');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for nonexistent world', () => {
    const svc = new WorldService('/nonexistent-path-12345');
    expect(svc.findWorldPath('GhostWorld')).toBeNull();
  });
});

describe('WorldService backup and delete', () => {
  it('creates zip backup of a world', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-'));
    const worldDir = path.join(tmpDir, 'saves', 'BackupWorld');
    fs.mkdirSync(worldDir, { recursive: true });
    fs.writeFileSync(path.join(worldDir, 'level.dat'), makeLevelDatNbt({ LevelName: 'BackupWorld' }));
    fs.writeFileSync(path.join(worldDir, 'dummy.txt'), 'x');

    const svc = new WorldService(tmpDir);
    const backupPath = svc.backup('BackupWorld');
    expect(fs.existsSync(backupPath)).toBe(true);
    expect(path.basename(backupPath).startsWith('BackupWorld-')).toBe(true);
    expect(backupPath.endsWith('.zip')).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('deletes a folder world', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-'));
    const worldDir = path.join(tmpDir, 'saves', 'DeleteWorld');
    fs.mkdirSync(worldDir, { recursive: true });
    fs.writeFileSync(path.join(worldDir, 'level.dat'), makeLevelDatNbt({ LevelName: 'DeleteWorld' }));
    fs.writeFileSync(path.join(worldDir, 'dummy.txt'), 'x');

    const svc = new WorldService(tmpDir);
    expect(svc.delete('DeleteWorld')).toBe(true);
    expect(fs.existsSync(worldDir)).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('delete returns false for unknown world', () => {
    const svc = new WorldService('/nonexistent-path-12345');
    expect(svc.delete('GhostWorld')).toBe(false);
  });
});
