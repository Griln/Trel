import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SnapshotService } from './snapshots';
import { PERF_PRESETS } from '../shared/constants';
import { DANGEROUS_JVM_ARGS } from '../shared/constants';

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
function mkVersion(game: string, id: string): string {
  const d = path.join(game, 'versions', id);
  fs.mkdirSync(path.join(d, 'mods'), { recursive: true });
  fs.writeFileSync(path.join(d, id + '.json'), JSON.stringify({ id }));
  fs.writeFileSync(path.join(d, 'mods', 'a.jar'), 'mod-bytes');
  return d;
}

describe('features: snapshots', () => {
  it('creates, lists, restores and removes', () => {
    const launcher = tmpDir('trel-feat-launcher-');
    const game = tmpDir('trel-feat-game-');
    mkVersion(game, '1.20.1');
    const svc = new SnapshotService(launcher, game);
    const s = svc.create('1.20.1', 'before mods');
    expect(s.versionId).toBe('1.20.1');
    expect(svc.list('1.20.1')).toHaveLength(1);
    expect(svc.list('1.20.1')[0].label).toBe('before mods');
    // Break the version and roll back
    fs.writeFileSync(path.join(game, 'versions', '1.20.1', 'mods', 'evil.jar'), 'evil');
    expect(svc.restore(s.file)).toBe('1.20.1');
    expect(fs.existsSync(path.join(game, 'versions', '1.20.1', 'mods', 'a.jar'))).toBe(true);
    expect(fs.existsSync(path.join(game, 'versions', '1.20.1', 'mods', 'evil.jar'))).toBe(false);
    expect(svc.remove(s.file)).toBe(true);
    expect(svc.list()).toHaveLength(0);
  });

  it('rejects bad ids and traversal files', () => {
    const svc = new SnapshotService(tmpDir('a-'), tmpDir('b-'));
    expect(() => svc.create('../../x')).toThrow();
    expect(() => svc.restore('../evil.zip')).toThrow();
    expect(() => svc.remove('/etc/passwd')).toThrow();
  });

  it('exports and imports a .trelpack round-trip', async () => {
    const launcher = tmpDir('trel-feat-launcher-');
    const game = tmpDir('trel-feat-game-');
    mkVersion(game, '1.20.1');
    fs.writeFileSync(path.join(game, 'versions', '1.20.1', 'mods', 'b.jar'), 'b');
    const svc = new SnapshotService(launcher, game);
    const out = path.join(tmpDir('trel-feat-out-'), 'pack.trelpack');
    const exp = svc.exportPack('1.20.1', out);
    expect(exp.size).toBeGreaterThan(0);
    // Import into another version
    const r = await svc.importPack(out, '1.20.1-copy');
    expect(r.versionId).toBe('1.20.1-copy');
    expect(fs.existsSync(path.join(game, 'versions', '1.20.1-copy', 'mods', 'a.jar'))).toBe(true);
    await expect(svc.importPack(out, '../../evil')).rejects.toThrow();
  });
});

describe('features: mod profiles', () => {
  it('saves current set, applies and deletes', async () => {
    const { ContentService } = await import('./content');
    const game = tmpDir('trel-feat-game-');
    const mods = path.join(game, 'versions', 'v1', 'mods');
    fs.mkdirSync(mods, { recursive: true });
    fs.writeFileSync(path.join(mods, 'a.jar'), 'a');
    fs.writeFileSync(path.join(mods, 'b.jar'), 'b');
    const svc = new ContentService(game);
    expect(svc.saveModProfile('v1', 'survival')).toEqual(['a.jar', 'b.jar']);
    fs.unlinkSync(path.join(mods, 'b.jar'));
    fs.writeFileSync(path.join(mods, 'c.jar'), 'c');
    const r = svc.applyModProfile('v1', 'survival');
    expect(r.enabled).toBe(1);
    expect(fs.existsSync(path.join(mods, 'a.jar'))).toBe(true);
    expect(fs.existsSync(path.join(mods, 'c.jar.disabled'))).toBe(true);
    expect(svc.deleteModProfile('v1', 'survival')).toBe(true);
    expect(() => svc.applyModProfile('v1', 'survival')).toThrow();
    expect(() => svc.saveModProfile('v1', '../evil')).toThrow();
  });
});

describe('features: perf presets are filter-clean', () => {
  it('passes DANGEROUS and ipc extra blocks', () => {
    for (const p of Object.values(PERF_PRESETS)) {
      for (const flag of p.jvmArgs.split(/\s+/)) {
        expect(DANGEROUS_JVM_ARGS.test(flag)).toBe(false);
        expect(['-cp', '-classpath'].includes(flag)).toBe(false);
        expect(flag.startsWith('-Djava.security.') || flag.startsWith('-Djdk.')).toBe(false);
      }
      expect(p.memoryMb).toBeGreaterThanOrEqual(1024);
    }
  });
});

describe('features: webdav validation offline', () => {
  it('rejects bad config without network', async () => {
    const { WebdavSync } = await import('./webdav');
    const svc = new WebdavSync(tmpDir('a-'), tmpDir('b-'));
    expect(svc.status()).toEqual({ configured: false });
    await expect(svc.configure('ftp://x', 'u', 'p')).rejects.toThrow();
    await expect(svc.push()).rejects.toThrow();
    await expect(svc.pull()).rejects.toThrow();
  });
});



describe('features: publish validation', () => {
  it('rejects bad world names without touching disk', async () => {
    const { ServerService } = await import('./servers');
    const svc = new ServerService(tmpDir('t-'), tmpDir('g-'), null as never, null as never, null as never, null as never);
    await expect(svc.publishWorld('/etc', '../../x', '1.20.1', 2048)).rejects.toThrow();
  });
});
