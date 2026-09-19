import { describe, it, expect } from 'vitest';
import { normalizeLoaderVersion, parseModpackIndex } from './modpacks';

describe('parseModpackIndex', () => {
  it('parses fabric modpack with files', () => {
    const plan = parseModpackIndex({
      formatVersion: 1, game: 'minecraft', name: 'Test Pack',
      dependencies: { minecraft: '1.20.1', 'fabric-loader': '0.15.7' },
      files: [
        { path: 'mods/sodium.jar', downloads: ['https://cdn/sodium.jar'], hashes: { sha1: 'abc' }, fileSize: 100 },
        { path: 'config/sodium.json', downloads: ['https://cdn/cfg'], fileSize: 10 },
      ],
    });
    expect(plan.name).toBe('Test Pack');
    expect(plan.mc).toBe('1.20.1');
    expect(plan.loader).toBe('fabric');
    expect(plan.loaderVersion).toBe('0.15.7');
    expect(plan.files).toHaveLength(2);
    expect(plan.files[0].sha1).toBe('abc');
  });

  it('builds forge loaderVersion as mc-forgeVer', () => {
    const plan = parseModpackIndex({ name: 'F', dependencies: { minecraft: '1.20.1', forge: '47.2.0' }, files: [] });
    expect(plan.loader).toBe('forge');
    expect(plan.loaderVersion).toBe('1.20.1-47.2.0');
  });

  it('detects quilt and neoforge', () => {
    expect(parseModpackIndex({ name: 'Q', dependencies: { minecraft: '1.20.1', 'quilt-loader': '0.25' }, files: [] }).loader).toBe('quilt');
    expect(parseModpackIndex({ name: 'N', dependencies: { minecraft: '1.21', neoforge: '21.0.0' }, files: [] }).loader).toBe('neoforge');
  });

  it('falls back to vanilla when no loader', () => {
    const plan = parseModpackIndex({ name: 'V', dependencies: { minecraft: '1.20.1' }, files: [] });
    expect(plan.loader).toBe('vanilla');
    expect(plan.loaderVersion).toBeNull();
  });

  it('skips client-unsupported and pathless files', () => {
    const plan = parseModpackIndex({
      name: 'X', dependencies: { minecraft: '1.20.1' },
      files: [
        { path: 'mods/server-only.jar', downloads: ['u'], env: { client: 'unsupported', server: 'required' } },
        { path: 'mods/ok.jar', downloads: ['u2'] },
        { downloads: ['u3'] },
        { path: 'mods/nodl.jar', downloads: [] },
      ],
    });
    expect(plan.files.map((f) => f.path)).toEqual(['mods/ok.jar']);
  });

  it('blocks path traversal', () => {
    const plan = parseModpackIndex({
      name: 'T', dependencies: { minecraft: '1.20.1' },
      files: [
        { path: '../evil.jar', downloads: ['u'] },
        { path: 'mods/good.jar', downloads: ['u'] },
      ],
    });
    expect(plan.files.map((f) => f.path)).toEqual(['mods/good.jar']);
  });

  it('throws without minecraft version', () => {
    expect(() => parseModpackIndex({ name: 'B', dependencies: {}, files: [] })).toThrow();
  });

  it('throws on non-minecraft game', () => {
    expect(() => parseModpackIndex({ game: 'terraria', dependencies: { minecraft: '1' } })).toThrow();
  });
});

describe('normalizeLoaderVersion', () => {
  it('prefixes bare forge versions with the game version', () => {
    expect(normalizeLoaderVersion('forge', '1.20.1', '47.2.0')).toBe('1.20.1-47.2.0');
  });

  it('keeps already prefixed forge versions unchanged', () => {
    expect(normalizeLoaderVersion('forge', '1.20.1', '1.20.1-47.2.0')).toBe('1.20.1-47.2.0');
  });

  it('leaves other loaders untouched', () => {
    expect(normalizeLoaderVersion('neoforge', '1.21', '21.1.65')).toBe('21.1.65');
    expect(normalizeLoaderVersion('fabric', '1.20.1', '0.16.0')).toBe('0.16.0');
    expect(normalizeLoaderVersion('quilt', '1.20.1', '0.25.0')).toBe('0.25.0');
  });
});
