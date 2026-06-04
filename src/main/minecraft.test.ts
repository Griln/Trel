import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MinecraftService } from './minecraft';
import { JavaService } from './java';

// Access private helpers via module augmentation trick
const _isPreClassic = (id: string) => /^(rd-|c0\.|in-|inf-|a1\.0\.|a1\.1\.0)/.test(id);

function _detectLoaderFromId(
  id: string,
): { loader: string; baseMc: string; loaderVersion: string } | null {
  let m: RegExpExecArray | null;
  m = /^fabric-loader-(.+?)-(\d.+)$/.exec(id);
  if (m) return { loader: 'fabric', loaderVersion: m[1], baseMc: m[2] };
  m = /^quilt-loader-(.+?)-(\d.+)$/.exec(id);
  if (m) return { loader: 'quilt', loaderVersion: m[1], baseMc: m[2] };
  m = /^(\d+(?:\.\d+){0,2})-forge-(.+)$/i.exec(id);
  if (m) return { loader: 'forge', baseMc: m[1], loaderVersion: m[2] };
  m = /^forge-(\d+(?:\.\d+){0,2})-(.+)$/i.exec(id);
  if (m) return { loader: 'forge', baseMc: m[1], loaderVersion: m[2] };
  m = /^neoforge-(\d+\.\d+(?:\.\d+)?)$/i.exec(id);
  if (m) {
    const lv = m[1];
    const sm = /^(\d+)\.(\d+)(?:\.\d+)?/.exec(lv);
    if (sm) {
      const minor = parseInt(sm[2], 10);
      const baseMc = minor === 0 ? `1.${sm[1]}` : `1.${sm[1]}.${minor}`;
      return { loader: 'neoforge', baseMc, loaderVersion: lv };
    }
    return { loader: 'neoforge', baseMc: '?', loaderVersion: lv };
  }
  return null;
}

describe('isPreClassicVersionId', () => {
  it('matches rd- prefixes', () => {
    expect(_isPreClassic('rd-131655')).toBe(true);
    expect(_isPreClassic('rd-132211')).toBe(true);
  });

  it('matches c0. prefixes', () => {
    expect(_isPreClassic('c0.0.11a')).toBe(true);
    expect(_isPreClassic('c0.30_01c')).toBe(true);
  });

  it('matches in- prefixes (Indev)', () => {
    expect(_isPreClassic('in-20100223')).toBe(true);
  });

  it('matches inf- prefixes (Infdev)', () => {
    expect(_isPreClassic('inf-20100227')).toBe(true);
  });

  it('matches a1.0 and a1.1.0', () => {
    expect(_isPreClassic('a1.0.0')).toBe(true);
    expect(_isPreClassic('a1.1.0')).toBe(true);
    expect(_isPreClassic('a1.1.1')).toBe(false);
  });

  it('does not match modern versions', () => {
    expect(_isPreClassic('1.20.1')).toBe(false);
    expect(_isPreClassic('1.7.10')).toBe(false);
    expect(_isPreClassic('23w14a')).toBe(false);
    expect(_isPreClassic('b1.7.3')).toBe(false);
    expect(_isPreClassic('a1.2.0')).toBe(false);
  });
});

describe('detectLoaderFromId', () => {
  it('detects Fabric', () => {
    const r = _detectLoaderFromId('fabric-loader-0.15.6-1.20.4');
    expect(r).toEqual({ loader: 'fabric', baseMc: '1.20.4', loaderVersion: '0.15.6' });
  });

  it('detects Quilt', () => {
    const r = _detectLoaderFromId('quilt-loader-0.23.0-1.20.1');
    expect(r).toEqual({ loader: 'quilt', baseMc: '1.20.1', loaderVersion: '0.23.0' });
  });

  it('detects Forge (mc-forge-lv)', () => {
    const r = _detectLoaderFromId('1.20.1-forge-47.2.0');
    expect(r).toEqual({ loader: 'forge', baseMc: '1.20.1', loaderVersion: '47.2.0' });
  });

  it('detects Forge (forge-mc-lv)', () => {
    const r = _detectLoaderFromId('forge-1.20.1-47.2.0');
    expect(r).toEqual({ loader: 'forge', baseMc: '1.20.1', loaderVersion: '47.2.0' });
  });

  it('detects NeoForge', () => {
    const r = _detectLoaderFromId('neoforge-21.1.10');
    expect(r).toEqual({ loader: 'neoforge', baseMc: '1.21.1', loaderVersion: '21.1.10' });
  });

  it('detects NeoForge with .0 minor', () => {
    const r = _detectLoaderFromId('neoforge-20.0.5');
    expect(r).toEqual({ loader: 'neoforge', baseMc: '1.20', loaderVersion: '20.0.5' });
  });

  it('returns null for vanilla', () => {
    expect(_detectLoaderFromId('1.20.1')).toBeNull();
    expect(_detectLoaderFromId('1.7.10')).toBeNull();
    expect(_detectLoaderFromId('23w14a')).toBeNull();
  });
});

describe('MinecraftService paths', () => {
  it('versionFolder returns correct path', () => {
    const java = new JavaService('/launcher');
    const mc = new MinecraftService('/game', java);
    const folder = (mc as any).versionFolder('1.20.1');
    expect(folder).toBe(path.join('/game', 'versions', '1.20.1'));
  });
});

describe('MinecraftService installedVersionIds', () => {
  it('lists installed versions with jar files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-mc-'));
    const versionsDir = path.join(tmpDir, 'versions');
    fs.mkdirSync(versionsDir, { recursive: true });

    // Create two version dirs with jars
    fs.mkdirSync(path.join(versionsDir, '1.20.1'), { recursive: true });
    fs.writeFileSync(path.join(versionsDir, '1.20.1', '1.20.1.jar'), '');

    fs.mkdirSync(path.join(versionsDir, '1.19.4'), { recursive: true });
    fs.writeFileSync(path.join(versionsDir, '1.19.4', '1.19.4.jar'), '');

    // Create dir without jar - should not appear
    fs.mkdirSync(path.join(versionsDir, 'incomplete'), { recursive: true });

    const java = new JavaService(tmpDir);
    const mc = new MinecraftService(tmpDir, java);
    const ids = mc.installedVersionIds();
    expect(ids).toContain('1.20.1');
    expect(ids).toContain('1.19.4');
    expect(ids).not.toContain('incomplete');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when versions dir missing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-mc-'));
    const java = new JavaService(tmpDir);
    const mc = new MinecraftService(tmpDir, java);
    expect(mc.installedVersionIds()).toEqual([]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('MinecraftService supportsAuthlibInjector', () => {
  it('returns true for modern versions', () => {
    const java = new JavaService('/launcher');
    const mc = new MinecraftService('/game', java);
    expect((mc as any).supportsAuthlibInjector('1.20.1', '1.20.1')).toBe(true);
    expect((mc as any).supportsAuthlibInjector('1.19.4', '1.19.4')).toBe(true);
  });

  it('returns false for rd- versions', () => {
    const java = new JavaService('/launcher');
    const mc = new MinecraftService('/game', java);
    expect((mc as any).supportsAuthlibInjector('rd-131655', undefined)).toBe(false);
  });

  it('returns false for early alpha', () => {
    const java = new JavaService('/launcher');
    const mc = new MinecraftService('/game', java);
    expect((mc as any).supportsAuthlibInjector('a1.0.0', undefined)).toBe(false);
  });
});

describe('MinecraftService hasOtherPreClassicInstalled', () => {
  it('returns true when another pre-classic is present', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-mc-'));
    const versionsDir = path.join(tmpDir, 'versions');
    fs.mkdirSync(path.join(versionsDir, 'rd-131655'), { recursive: true });
    fs.writeFileSync(path.join(versionsDir, 'rd-131655', 'rd-131655.jar'), '');
    fs.mkdirSync(path.join(versionsDir, 'rd-132211'), { recursive: true });
    fs.writeFileSync(path.join(versionsDir, 'rd-132211', 'rd-132211.jar'), '');

    const java = new JavaService(tmpDir);
    const mc = new MinecraftService(tmpDir, java);
    expect((mc as any).hasOtherPreClassicInstalled('rd-131655')).toBe(true);
    expect((mc as any).hasOtherPreClassicInstalled('rd-132211')).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns false when only one pre-classic exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-mc-'));
    const versionsDir = path.join(tmpDir, 'versions');
    fs.mkdirSync(path.join(versionsDir, 'rd-131655'), { recursive: true });
    fs.writeFileSync(path.join(versionsDir, 'rd-131655', 'rd-131655.jar'), '');

    const java = new JavaService(tmpDir);
    const mc = new MinecraftService(tmpDir, java);
    expect((mc as any).hasOtherPreClassicInstalled('rd-131655')).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns false for modern versions', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-mc-'));
    const versionsDir = path.join(tmpDir, 'versions');
    fs.mkdirSync(path.join(versionsDir, '1.20.1'), { recursive: true });
    fs.writeFileSync(path.join(versionsDir, '1.20.1', '1.20.1.jar'), '');

    const java = new JavaService(tmpDir);
    const mc = new MinecraftService(tmpDir, java);
    expect((mc as any).hasOtherPreClassicInstalled('1.20.1')).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
