import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import AdmZip from 'adm-zip';
import { isSafeVersionId, isSafeWorldName } from './safeIds';
import { sanitizeServerInstance } from './servers';
import { scrubTokens } from './microsoft-auth';
import { mcRequiredJavaMajor } from './loaders';
import { splitAddress } from './serverping';
import { dirSize } from './util';
import { rollbackJournal, journalAdd } from './import-ops';
import { analyzeCrash } from './crashAnalyzer';
import { SHELL_WHITELIST } from '../shared/constants';

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

describe('hardening: safeIds', () => {
  it('rejects leading dashes/dots, reserved names and trailing dots', () => {
    expect(isSafeVersionId('-foo')).toBe(false);
    expect(isSafeVersionId('.hidden')).toBe(false);
    expect(isSafeVersionId('con')).toBe(false);
    expect(isSafeVersionId('NUL')).toBe(false);
    expect(isSafeVersionId('1.20.1.')).toBe(false);
    expect(isSafeVersionId('1.20.1 ')).toBe(false);
    expect(isSafeVersionId('1.20.1')).toBe(true);
    expect(isSafeWorldName('CON')).toBe(false);
    expect(isSafeWorldName('nul.txt')).toBe(false);
    expect(isSafeWorldName('My World.')).toBe(false);
    expect(isSafeWorldName('My World')).toBe(true);
  });
});

describe('hardening: server sanitize', () => {
  it('drops bad ids, clamps ports and strips CRLF', () => {
    expect(() => sanitizeServerInstance({ id: '../../x', properties: {} })).toThrow();
    const s = sanitizeServerInstance({
      id: 'srv1', name: 'My\r\nServer', memoryMb: 999999,
      properties: { serverPort: 70000, maxPlayers: 0, motd: 'hi\r\nthere' },
    });
    expect(s.id).toBe('srv1');
    expect(s.name).toBe('My  Server');
    expect(s.properties.serverPort).toBe(25565);
    expect(s.properties.maxPlayers).toBe(20);
    expect(s.properties.motd).toBe('hi  there');
    expect(s.memoryMb).toBe(65536);
  });
});

describe('hardening: token scrub', () => {
  it('redacts JWTs and token fields', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlN0ZXZlIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c';
    expect(scrubTokens('failed with ' + jwt)).not.toContain(jwt);
    expect(scrubTokens('failed with ' + jwt)).toContain('<jwt>');
    expect(scrubTokens('accessToken=secrettoken123')).toContain('<redacted>');
    expect(scrubTokens('XBL3.0 x=abcdef123;blah')).toContain('<redacted>');
  });
});

describe('hardening: java major', () => {
  it('picks 21 for modern and future versions', () => {
    expect(mcRequiredJavaMajor('1.21')).toBe(21);
    expect(mcRequiredJavaMajor('1.20.5')).toBe(21);
    expect(mcRequiredJavaMajor('26.1')).toBe(21);
    expect(mcRequiredJavaMajor('1.20.1')).toBe(17);
    expect(mcRequiredJavaMajor('1.12.2')).toBe(8);
  });
});

describe('hardening: splitAddress', () => {
  it('parses IPv6 brackets and validates ports', () => {
    expect(splitAddress('[::1]:25565')).toEqual({ host: '::1', port: 25565 });
    expect(splitAddress('mc.example.com:19132')).toEqual({ host: 'mc.example.com', port: 19132 });
    expect(splitAddress('::1')).toEqual({ host: '::1', port: 25565 });
    expect(() => splitAddress('')).toThrow();
    expect(() => splitAddress('host:99999')).toThrow();
    expect(() => splitAddress('host:0')).toThrow();
  });
});

describe('hardening: dirSize caps', () => {
  it('stops at maxFiles instead of walking forever', () => {
    const dir = tmpDir('trel-dirsize-');
    for (let i = 0; i < 50; i++) fs.writeFileSync(path.join(dir, `f${i}.txt`), '12345');
    const limited = dirSize(dir, 32, 10);
    expect(limited).toBe(10 * 5);
    expect(dirSize(dir)).toBe(50 * 5);
  });
});

describe('hardening: rollback jail', () => {
  it('refuses to delete outside the game dir', async () => {
    const game = tmpDir('trel-game-');
    const outside = tmpDir('trel-outside-');
    const victim = path.join(outside, 'victim.txt');
    fs.writeFileSync(victim, 'do not touch');
    await journalAdd(game, 'evil', 'mods', [victim]);
    const removed = await rollbackJournal(game);
    expect(removed).toBe(0);
    expect(fs.existsSync(victim)).toBe(true);
  });
});

describe('hardening: crash signatures', () => {
  it('detects forge missing deps and mixin failures', () => {
    const forge = analyzeCrash({ exitCode: 1, logTail: 'net.minecraftforge.fml.ModLoadingException: MissingModsException: Modmodul requires forge 99.0' });
    expect(forge?.id).toBe('forge-missing-mods');
    const mixin = analyzeCrash({ exitCode: 1, logTail: 'org.spongepowered.asm.mixin.transformer.throwables.MixinApplyError: boom' });
    expect(mixin?.id).toBe('mixin-apply-failed');
    const sigs = new Set<string>();
    void sigs;
  });
});

describe('hardening: shell whitelist', () => {
  it('blocks substitution and win expansion, allows plain commands', () => {
    for (const bad of ['a;rm', 'x|y', 'a$(b)', 'a`b`', '%PATH%', 'a^b', 'a>b']) {
      expect(SHELL_WHITELIST.test(bad)).toBe(false);
    }
    for (const good of ['notify-send Hi', '/usr/bin/notify-send done', 'python3 script.py']) {
      expect(SHELL_WHITELIST.test(good)).toBe(true);
    }
  });
});

describe('hardening: worlds restore zip-slip', () => {
  it('throws on traversal entries', async () => {
    const { WorldService } = await import('./worlds');
    const game = tmpDir('trel-worldsgame-');
    const saves = path.join(game, 'saves');
    const backups = path.join(game, 'backups');
    fs.mkdirSync(saves, { recursive: true });
    fs.mkdirSync(backups, { recursive: true });
    const evil = path.join(backups, 'evil.zip');
    // adm-zip чистит имена при записи — злой zip клепаем питоном (zipfile
    // пишет имена дословно, как любой сторонний архиватор).
    const mk = path.join(backups, 'mkzip.py');
    fs.writeFileSync(mk, "import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1],'w')\nz.writestr('GoodWorld/level.dat','x')\nz.writestr('../../pwned.txt','evil')\nz.close()\n");
    const { execFileSync } = await import('node:child_process');
    execFileSync('python3', [mk, evil]);
    try { fs.unlinkSync(mk); } catch { /* ignore */ }
    const svc = new WorldService(game);
    expect(() => svc.restore(evil)).toThrow(/Unsafe entry/);
    expect(fs.existsSync(path.join(game, 'pwned.txt'))).toBe(false);
  });
});

describe('hardening: proxy parse', () => {
  it('accepts http(s) host:port and rejects junk', async () => {
    const { parseProxyUrl, applyGlobalProxy, isProxyActive } = await import('./http-proxy');
    expect(parseProxyUrl('http://127.0.0.1:7890')).toEqual({ host: '127.0.0.1', port: 7890 });
    expect(parseProxyUrl('https://user:pass@proxy:8080')?.auth).toEqual({ username: 'user', password: 'pass' });
    expect(parseProxyUrl('socks5://x:1')).toBeNull();
    expect(parseProxyUrl('http://x:99999')).toBeNull();
    expect(parseProxyUrl('http://x/a/b')).toBeNull();
    expect(applyGlobalProxy('http://127.0.0.1:7890')).toBe(true);
    expect(isProxyActive()).toBe(true);
    expect(applyGlobalProxy('')).toBe(true);
    expect(isProxyActive()).toBe(false);
    expect(applyGlobalProxy('nonsense')).toBe(false);
  });
});

describe('features: java major for version', () => {
  it('reads local json chain and falls back to heuristic', async () => {
    const { requiredJavaMajorForVersion } = await import('./loaders');
    const dir = tmpDir('trel-javamajor-');
    fs.mkdirSync(path.join(dir, 'versions', 'my-pack'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'versions', 'my-pack', 'my-pack.json'),
      JSON.stringify({ id: 'my-pack', inheritsFrom: '1.20.1' }));
    fs.mkdirSync(path.join(dir, 'versions', '1.20.1'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'versions', '1.20.1', '1.20.1.json'),
      JSON.stringify({ id: '1.20.1', javaVersion: { majorVersion: 17 } }));
    expect(requiredJavaMajorForVersion(dir, 'my-pack')).toBe(17);
    expect(requiredJavaMajorForVersion(dir, '1.21')).toBe(21);
    expect(requiredJavaMajorForVersion(dir, 'nope')).toBe(17);
  });
});

describe('features: worlds pruneBackups', () => {
  it('keeps the newest N backups', async () => {
    const { WorldService } = await import('./worlds');
    const game = tmpDir('trel-prune-');
    const backups = path.join(game, 'backups');
    fs.mkdirSync(backups, { recursive: true });
    for (let i = 0; i < 5; i++) {
      const f = path.join(backups, `W-2024-01-0${i}T00-00-00.zip`);
      fs.writeFileSync(f, 'x');
      const t = new Date(2024, 0, i + 1).getTime();
      fs.utimesSync(f, t / 1000, t / 1000);
    }
    const svc = new WorldService(game);
    expect(svc.pruneBackups('W', 2)).toBe(3);
    expect(fs.readdirSync(backups)).toHaveLength(2);
    expect(svc.pruneBackups('Nobody', 2)).toBe(0);
  });
});

describe('features: content updateMod validation', () => {
  it('rejects bad names and non-modrinth urls offline', async () => {
    const { ContentService } = await import('./content');
    const game = tmpDir('trel-content-');
    const svc = new ContentService(game);
    await expect(svc.updateMod('1.20.1', '../evil.jar', 'https://cdn.modrinth.com/x')).rejects.toThrow();
    await expect(svc.updateMod('1.20.1', 'a.jar', 'https://evil.com/x.jar')).rejects.toThrow();
  });
});
