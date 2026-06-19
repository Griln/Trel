import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectFromDir, detectInstallableVersions, performImport } from './import';

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('launcher import', () => {
  it('detects inherited modded profiles as their base version and copies local folder instead of forcing Mojang download', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    const verDir = path.join(src, 'versions', '1.20.1-forge-47.2.0');
    fs.mkdirSync(verDir, { recursive: true });
    fs.writeFileSync(path.join(verDir, '1.20.1-forge-47.2.0.json'), JSON.stringify({
      id: '1.20.1-forge-47.2.0',
      inheritsFrom: '1.20.1',
      mainClass: 'cpw.mods.bootstraplauncher.BootstrapLauncher',
    }));

    expect(detectInstallableVersions(src)).toEqual(['1.20.1-forge-47.2.0']);
    const source = detectFromDir(src)!;
    expect(source.installableVersions).toEqual(['1.20.1-forge-47.2.0']);

    let downloadCalled = false;
    const report = await performImport(
      { sourceId: source.id, sourceRootDir: source.rootDir, categories: ['version-install'] },
      source,
      dst,
      () => false,
      async () => { downloadCalled = true; throw new Error('should not download copied local profile'); },
    );

    expect(downloadCalled).toBe(false);
    expect(report.errors).toEqual([]);
    expect(report.copied['version-install']).toBe(1);
    expect(fs.existsSync(path.join(dst, 'versions', '1.20.1-forge-47.2.0', '1.20.1-forge-47.2.0.json'))).toBe(true);
  });

  it('does not collapse several modded profiles that inherit from the same base version', () => {
    const src = tmpDir('trel-import-src-');
    for (const folder of ['1.20.1-forge-47.2.0', '1.20.1-fabric-0.16.0']) {
      const verDir = path.join(src, 'versions', folder);
      fs.mkdirSync(verDir, { recursive: true });
      fs.writeFileSync(path.join(verDir, `${folder}.json`), JSON.stringify({
        id: folder,
        inheritsFrom: '1.20.1',
        mainClass: 'net.minecraft.client.main.Main',
      }));
    }
    expect(detectInstallableVersions(src).sort()).toEqual(['1.20.1-fabric-0.16.0', '1.20.1-forge-47.2.0']);
  });

  it('imports offline account names from launcher_profiles.json', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.writeFileSync(path.join(src, 'launcher_profiles.json'), JSON.stringify({
      selectedUser: { profile: 'abc' },
      authenticationDatabase: {
        user1: { displayName: 'PlayerOne', profiles: { abc: { displayName: 'PlayerTwo' } } },
      },
    }));
    const source = { id: 'manual-accounts', label: 'Manual accounts source', rootDir: src, available: ['accounts'] as any, approxSize: 0, kind: 'java' as const };
    const added: string[] = [];
    const report = await performImport(
      { sourceId: source.id, sourceRootDir: source.rootDir, categories: ['accounts'] },
      source,
      dst,
      (name) => { added.push(name); return true; },
    );
    expect(report.errors).toEqual([]);
    expect(added.sort()).toEqual(['PlayerOne', 'PlayerTwo']);
    expect(report.newAccounts.sort()).toEqual(['PlayerOne', 'PlayerTwo']);
  });

  it('labels generic .minecraft data folders neutrally instead of always Mojang Launcher', () => {
    const src = tmpDir('trel-import-src-');
    fs.mkdirSync(path.join(src, 'saves', 'World'), { recursive: true });
    fs.writeFileSync(path.join(src, 'launcher_profiles.json'), JSON.stringify({ profiles: {} }));
    const source = detectFromDir(src)!;
    expect(source.label).toContain('Minecraft data folder');
  });

  it('does not offer Java import for account-only launcher folders without real Java content', () => {
    const src = tmpDir('trel-import-src-');
    fs.writeFileSync(path.join(src, 'launcher_profiles.json'), JSON.stringify({
      profiles: {},
      authenticationDatabase: { user: { displayName: 'PlayerOne' } },
    }));
    expect(detectFromDir(src)).toBeNull();
  });

  it('ignores non-Java 26.x launcher runtime versions when deciding Java import availability', () => {
    const src = tmpDir('trel-import-src-');
    const versions = path.join(src, 'versions');
    fs.mkdirSync(versions, { recursive: true });
    for (const id of ['26.1.2', '26.2-snapshot-6']) {
      const dir = path.join(versions, id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({
        id,
        type: id.includes('snapshot') ? 'snapshot' : 'release',
        mainClass: 'net.minecraft.client.main.Main',
        downloads: { client: { url: 'https://example.invalid/client.jar' } },
        assetIndex: { id, url: 'https://example.invalid/assets.json' },
        libraries: [],
      }));
    }
    fs.writeFileSync(path.join(src, 'launcher_profiles.json'), JSON.stringify({ profiles: {} }));
    expect(detectInstallableVersions(src)).toEqual([]);
    expect(detectFromDir(src)).toBeNull();
  });
});
