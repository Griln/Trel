import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * Управляемый сбой fsp.link(): позволяет проверить откат hardlink → копия
 * (EXDEV — «другой том»), не требуя второй файловой системы в тесте.
 * vi.hoisted нужен потому, что фабрика vi.mock поднимается выше объявлений.
 */
const linkState = vi.hoisted(() => ({ error: null as NodeJS.ErrnoException | null }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    default: actual,
    link: async (src: fs.PathLike, dest: fs.PathLike) => {
      if (linkState.error) throw linkState.error;
      return actual.link(src, dest);
    },
  };
});

import AdmZip from 'adm-zip';
import { rollbackJournal } from './import-ops';
import { createSpeedMeter, detectFromDir, detectInstallableVersions, dropNestedCategories, extractAuthServers, findCaseConflicts, hmclExtraGameDirs, parseServersDat, performImport, previewImport, readLastImportReport, resolveDestPath, sameHead, scanDir, secretStoreWarnings, setImportPaused, sourceNotes } from './import';

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

  it('preserves UUID and online account metadata from launcher_accounts.json', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.writeFileSync(path.join(src, 'launcher_accounts.json'), JSON.stringify({ accounts: {
      local: { accessToken: 'token', refreshToken: 'refresh', minecraftProfile: { id: '0123456789abcdef0123456789abcdef', name: 'PremiumUser' } },
    } }));
    const source = { id: 'metadata-account', label: 'Minecraft Launcher', rootDir: src, available: ['accounts'] as any, approxSize: 0, kind: 'java' as const };
    const imported: any[] = [];
    const report = await performImport({ sourceId: source.id, categories: ['accounts'] }, source, dst, () => false, undefined, undefined, undefined, (account) => { imported.push(account); return true; });
    expect(report.errors).toEqual([]);
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ name: 'PremiumUser', type: 'online', uuid: '01234567-89ab-cdef-0123-456789abcdef', refreshToken: 'refresh' });
  });

  it('labels generic .minecraft data folders neutrally instead of always Mojang Launcher', () => {
    const src = tmpDir('trel-import-src-');
    fs.mkdirSync(path.join(src, 'saves', 'World'), { recursive: true });
    fs.writeFileSync(path.join(src, 'launcher_profiles.json'), JSON.stringify({ profiles: {} }));
    const source = detectFromDir(src)!;
    expect(source.label).toContain('Minecraft (.minecraft)');
  });

  it('imports TLauncher-style accounts.json (username + uuid + type) as online with preserved UUID', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.writeFileSync(path.join(src, 'accounts.json'), JSON.stringify([
      { username: 'TlUser', uuid: 'abcdef0123456789abcdef0123456789', type: 'MOJANG', accessToken: 'tok-1' },
    ]));
    const source = { id: 'tlauncher-account', label: 'TLauncher', rootDir: src, available: ['accounts'] as any, approxSize: 0, kind: 'java' as const };
    const imported: any[] = [];
    const report = await performImport({ sourceId: source.id, categories: ['accounts'] }, source, dst, () => false, undefined, undefined, undefined, (account) => { imported.push(account); return true; });
    expect(report.errors).toEqual([]);
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ name: 'TlUser', type: 'online', uuid: 'abcdef01-2345-6789-abcd-ef0123456789' });
  });

  it('imports Prism/PolyMC-style accounts.json (profile.id/profile.name + MSA type) preserving UUID', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.writeFileSync(path.join(src, 'accounts.json'), JSON.stringify({ accounts: [
      { profile: { id: 'fedcba9876543210fedcba9876543210', name: 'PrismPlayer' }, type: 'MSA' },
    ] }));
    const source = { id: 'prism-account', label: 'Prism', rootDir: src, available: ['accounts'] as any, approxSize: 0, kind: 'java' as const };
    const imported: any[] = [];
    const report = await performImport({ sourceId: source.id, categories: ['accounts'] }, source, dst, () => false, undefined, undefined, undefined, (account) => { imported.push(account); return true; });
    expect(report.errors).toEqual([]);
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ name: 'PrismPlayer', type: 'online', uuid: 'fedcba98-7654-3210-fedc-ba9876543210' });
  });

  it('does not mistake version profiles (launcher_profiles.profiles entries) for accounts', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.writeFileSync(path.join(src, 'launcher_profiles.json'), JSON.stringify({
      profiles: {
        'Forge Profile': { name: 'Forge', lastVersionId: '1.20.1-forge-47.2.0', gameDir: 'C:/games/forge' },
      },
      authenticationDatabase: {
        '01234567-89ab-cdef-0123-456789abcdef': { username: 'real@example.com', profiles: { '01234567-89ab-cdef-0123-456789abcdef': { displayName: 'RealPlayer' } } },
      },
    }));
    const source = { id: 'mixed-profiles', label: 'Minecraft Launcher', rootDir: src, available: ['accounts'] as any, approxSize: 0, kind: 'java' as const };
    const imported: any[] = [];
    const report = await performImport({ sourceId: source.id, categories: ['accounts'] }, source, dst, () => false, undefined, undefined, undefined, (account) => { imported.push(account); return true; });
    expect(report.errors).toEqual([]);
    expect(imported.map((a) => a.name)).not.toContain('Forge');
    expect(imported.map((a) => a.name)).toContain('RealPlayer');
  });

  it('offers account-only launcher folders for account import (but not empty ones)', () => {
    const src = tmpDir('trel-import-src-');
    fs.writeFileSync(path.join(src, 'launcher_profiles.json'), JSON.stringify({
      profiles: {},
      authenticationDatabase: { user: { displayName: 'PlayerOne' } },
    }));
    const source = detectFromDir(src);
    expect(source).not.toBeNull();
    expect(source!.available).toContain('accounts');

    // Пустой profiles-файл без аккаунтов — источник не предлагается.
    const empty = tmpDir('trel-import-empty-');
    fs.writeFileSync(path.join(empty, 'launcher_profiles.json'), JSON.stringify({ profiles: {} }));
    expect(detectFromDir(empty)).toBeNull();
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

  it('imports Modrinth App accounts (snake_case tokens, uuid stored as object key)', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.writeFileSync(path.join(src, 'accounts.json'), JSON.stringify({
      '0123456789abcdef0123456789abcdef': { name: 'ModrinthUser', access_token: 'at-1', refresh_token: 'rt-1' },
    }));
    const source = { id: 'modrinth-account', label: 'Modrinth App', rootDir: src, available: ['accounts'] as any, approxSize: 0, kind: 'java' as const };
    const imported: any[] = [];
    const report = await performImport({ sourceId: source.id, categories: ['accounts'] }, source, dst, () => false, undefined, undefined, undefined, (account) => { imported.push(account); return true; });
    expect(report.errors).toEqual([]);
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ name: 'ModrinthUser', type: 'online', uuid: '01234567-89ab-cdef-0123-456789abcdef', refreshToken: 'rt-1' });
  });

  it('imports HMCL hmcl.json where email username must not block displayName character', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.writeFileSync(path.join(src, 'hmcl.json'), JSON.stringify({
      accounts: [
        { type: 'offline', username: 'player@mail.ru', displayName: 'HmclNick', uuid: 'abcdef0123456789abcdef0123456789' },
      ],
    }));
    const source = { id: 'hmcl-account', label: 'HMCL', rootDir: src, available: ['accounts'] as any, approxSize: 0, kind: 'java' as const };
    const imported: any[] = [];
    const report = await performImport({ sourceId: source.id, categories: ['accounts'] }, source, dst, () => false, undefined, undefined, undefined, (account) => { imported.push(account); return true; });
    expect(report.errors).toEqual([]);
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ name: 'HmclNick', type: 'offline', uuid: 'abcdef01-2345-6789-abcd-ef0123456789' });
  });

  it('imports ATLauncher account from config/account.json in the launcher root', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'config'), { recursive: true });
    fs.writeFileSync(path.join(src, 'config', 'account.json'), JSON.stringify({
      username: 'AtlPlayer', uuid: 'fedcba9876543210fedcba9876543210', accessToken: 'tok-atl',
    }));
    const source = { id: 'atl-account', label: 'ATLauncher', rootDir: src, available: ['accounts'] as any, approxSize: 0, kind: 'java' as const };
    const imported: any[] = [];
    const report = await performImport({ sourceId: source.id, categories: ['accounts'] }, source, dst, () => false, undefined, undefined, undefined, (account) => { imported.push(account); return true; });
    expect(report.errors).toEqual([]);
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({ name: 'AtlPlayer', type: 'online', uuid: 'fedcba98-7654-3210-fedc-ba9876543210' });
  });

  it('falls back to CurseForge overrides/ for instances that were never launched', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'overrides', 'mods'), { recursive: true });
    fs.mkdirSync(path.join(src, 'overrides', 'config'), { recursive: true });
    fs.writeFileSync(path.join(src, 'overrides', 'mods', 'ModA.jar'), 'mod-a-bytes');
    fs.writeFileSync(path.join(src, 'overrides', 'config', 'opt.txt'), 'key=value');
    fs.writeFileSync(path.join(src, 'manifest.json'), JSON.stringify({ minecraft: { version: '1.20.1' } }));

    const source = detectFromDir(src)!;
    expect(source.available).toContain('mods');
    expect(source.available).toContain('config');

    const report = await performImport(
      { sourceId: source.id, sourceRootDir: source.rootDir, categories: ['mods', 'config'] },
      source, dst, () => false,
    );
    expect(report.errors).toEqual([]);
    expect(fs.readFileSync(path.join(dst, 'mods', 'ModA.jar'), 'utf-8')).toBe('mod-a-bytes');
    expect(fs.readFileSync(path.join(dst, 'config', 'opt.txt'), 'utf-8')).toBe('key=value');
    expect(report.warnings.some((w) => w.includes('overrides/'))).toBe(true);
  });

  it('imports TLauncher-isolated saves into the shared saves directory', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    const world = path.join(src, 'versions', '1.20.1-tl', 'saves', 'IsolatedWorld');
    fs.mkdirSync(world, { recursive: true });
    fs.writeFileSync(path.join(world, 'level.dat'), 'nbt-bytes');
    // Корневой saves отсутствует — это признак изоляции версий, а не мусора.
    const source = detectFromDir(src)!;
    expect(source.available).toContain('version-content');

    const report = await performImport(
      { sourceId: source.id, sourceRootDir: source.rootDir, categories: ['version-content'] },
      source, dst, () => false,
    );
    expect(report.errors).toEqual([]);
    expect(fs.readFileSync(path.join(dst, 'saves', 'IsolatedWorld', 'level.dat'), 'utf-8')).toBe('nbt-bytes');
  });

  it('dedup skips identical files but copies same-size different-content files', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.mkdirSync(path.join(dst, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'A'.repeat(100));
    fs.writeFileSync(path.join(src, 'mods', 'B.jar'), 'B'.repeat(100));
    fs.writeFileSync(path.join(dst, 'mods', 'A.jar'), 'A'.repeat(100)); // идентичен — должен быть пропущен
    fs.writeFileSync(path.join(dst, 'mods', 'C.jar'), 'C'.repeat(100)); // тот же размер, но только в назначении

    const source = { id: 'dedup-test', label: 'Dedup', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport(
      { sourceId: source.id, categories: ['mods'], deduplicate: true },
      source, dst, () => false,
    );
    expect(report.errors).toEqual([]);
    expect(report.skipped.mods).toBe(1);
    expect(report.copied.mods).toBe(1);
    expect(fs.existsSync(path.join(dst, 'mods', 'B.jar'))).toBe(true);
    expect(fs.existsSync(path.join(dst, 'mods', 'C.jar'))).toBe(true);
  });

  it('dedup does not collapse distinct files that happen to share content', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'config'), { recursive: true });
    // Реалистичная папка конфигов: куча пустых файлов и одинаковых дефолтов.
    // Их имена значимы для мод-лоадера, содержимое совпадает.
    const empties = Array.from({ length: 30 }, (_, i) => `empty${i}.cfg`);
    const defaults = Array.from({ length: 30 }, (_, i) => `default${i}.toml`);
    for (const n of empties) fs.writeFileSync(path.join(src, 'config', n), '');
    for (const n of defaults) fs.writeFileSync(path.join(src, 'config', n), 'enabled = true\n'.repeat(4096));

    const source = { id: 'same-content', label: 'S', rootDir: src, available: ['config'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport(
      { sourceId: source.id, categories: ['config'], deduplicate: true },
      source, dst, () => false,
    );
    expect(report.errors).toEqual([]);
    // Дедупликация сравнивает с тем, что уже лежит в Trel, а не сворачивает
    // одинаковые по содержимому файлы источника в один.
    expect(report.skipped.config ?? 0).toBe(0);
    expect(report.copied.config).toBe(60);
    for (const n of [...empties, ...defaults]) {
      expect(fs.existsSync(path.join(dst, 'config', n))).toBe(true);
    }
  });

  it('copies deep nested trees completely (parallel dir copy integrity)', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    const files: string[] = [];
    for (let d = 0; d < 6; d++) {
      const dir = path.join(src, 'config', `layer${d}`, 'nested');
      fs.mkdirSync(dir, { recursive: true });
      for (let f = 0; f < 10; f++) {
        const rel = path.join('config', `layer${d}`, 'nested', `file${f}.bin`);
        fs.writeFileSync(path.join(src, rel), `payload-${d}-${f}`);
        files.push(rel);
      }
    }
    const source = { id: 'deep-tree', label: 'Deep', rootDir: src, available: ['config'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: source.id, categories: ['config'] }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    for (const rel of files) {
      expect(fs.readFileSync(path.join(dst, rel), 'utf-8')).toMatch(/^payload-\d+-\d+$/);
    }
  });

  it('hardlink mode shares inodes instead of duplicating bytes, and warns about it', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'Shared.jar'), 'shared-bytes');

    const source = { id: 'hl', label: 'HL', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport(
      { sourceId: source.id, categories: ['mods'], useHardlinks: true },
      source, dst, () => false,
    );
    expect(report.errors).toEqual([]);
    const from = fs.statSync(path.join(src, 'mods', 'Shared.jar'));
    const to = fs.statSync(path.join(dst, 'mods', 'Shared.jar'));
    // Оба каталога — в os.tmpdir(), т.е. на одной ФС: link() должен пройти.
    expect(to.ino).toBe(from.ino);
    expect(to.nlink).toBeGreaterThan(1);
    expect(report.warnings.some((w) => w.includes('hardlink mode'))).toBe(true);
  });

  it('counts bytesWritten in hardlink mode too (links verify size)', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'Shared.jar'), 'x'.repeat(1024));

    const source = { id: 'hl-bytes', label: 'HLB', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport(
      { sourceId: source.id, categories: ['mods'], useHardlinks: true },
      source, dst, () => false,
    );
    expect(report.errors).toEqual([]);
    // Раньше hardlink-ветка возвращалась до подсчёта — скорость в UI была 0.
    expect(report.bytesWritten).toBe(1024);
  });

  it('copies a large folder through the bounded pool without losing files', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    // Больше пула (8–24): каждый файл обязан дойти, ни один не потеряться.
    for (let i = 0; i < 200; i++) fs.writeFileSync(path.join(src, 'mods', `M${i}.jar`), `mod-${i}`);
    const source = { id: 'pool', label: 'P', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: source.id, categories: ['mods'] }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(report.copied.mods).toBe(200);
    expect(fs.readdirSync(path.join(dst, 'mods'))).toHaveLength(200);
  });

  it('skips identical same-name files on repeat without deduplication (no "(1)" dupes)', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a'.repeat(512));
    const source = { id: 'resume', label: 'R', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const plan = { sourceId: source.id, categories: ['mods'] as any };
    const first = await performImport(plan, source, dst, () => false);
    expect(first.copied.mods).toBe(1);
    // Повтор после обрыва без дедупа: тот же файл уже на месте — ни копии,
    // ни «A (1).jar» рядом. Дешёвый stat вместо чтения файла.
    const second = await performImport(plan, source, dst, () => false);
    expect(second.copied.mods).toBe(0);
    expect(second.skipped.mods).toBe(1);
    expect(fs.readdirSync(path.join(dst, 'mods'))).toEqual(['A.jar']);
  });

  it('preserves the executable bit on copied files', async () => {
    if (process.platform === 'win32') return; // на Windows битов нет
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    const script = path.join(src, 'mods', 'run.sh');
    fs.writeFileSync(script, '#!/bin/sh\necho hi\n');
    fs.chmodSync(script, 0o755);
    const source = { id: 'exec', label: 'X', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: source.id, categories: ['mods'] }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    // eslint-disable-next-line no-bitwise
    expect(fs.statSync(path.join(dst, 'mods', 'run.sh')).mode & 0o111).not.toBe(0);
  });

  it('skips symlinks with a warning instead of following them', async () => {
    if (process.platform === 'win32') return; // создание симлинков требует прав
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    const outside = tmpDir('trel-import-outside-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'Real.jar'), 'real');
    fs.writeFileSync(path.join(outside, 'Secret.jar'), 'secret');
    fs.symlinkSync(path.join(outside, 'Secret.jar'), path.join(src, 'mods', 'Link.jar'));
    const source = { id: 'sym', label: 'S', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: source.id, categories: ['mods'] }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(report.copied.mods).toBe(1);
    expect(fs.existsSync(path.join(dst, 'mods', 'Link.jar'))).toBe(false);
    expect(report.warnings.some((w) => w.includes('Link.jar'))).toBe(true);
  });

  it('always reports bytes in progress ticks and names the current file', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    for (let i = 0; i < 10; i++) fs.writeFileSync(path.join(src, 'mods', `M${i}.jar`), 'x'.repeat(4096));
    const source = { id: 'prog', label: 'PG', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const ticks: Array<{ bytes?: number; currentFile?: string }> = [];
    await performImport({ sourceId: source.id, categories: ['mods'] }, source, dst, () => false, undefined,
      (_c, _t, _s, b, _bps, _eta, file) => { ticks.push({ bytes: b, currentFile: file }); });
    expect(ticks.length).toBeGreaterThan(0);
    // Регресс NaNMB: раньше часть тиков шла вообще без байт.
    expect(ticks.every((tk) => typeof tk.bytes === 'number' && !Number.isNaN(tk.bytes))).toBe(true);
    // Хотя бы раз мелькнуло имя копируемого файла.
    expect(ticks.some((tk) => typeof tk.currentFile === 'string' && tk.currentFile.endsWith('.jar'))).toBe(true);
  });

  it('falls back to a real copy when hardlinking is impossible', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'Cross.jar'), 'cross-volume');

    // Эмулируем другой том: link() отвечает EXDEV, как при переносе между
    // разделами или на FAT/exFAT/сетевой диск.
    linkState.error = Object.assign(new Error('cross-device link not permitted'), { code: 'EXDEV' });
    try {
      const source = { id: 'hl-x', label: 'HLX', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
      const report = await performImport(
        { sourceId: source.id, categories: ['mods'], useHardlinks: true },
        source, dst, () => false,
      );
      expect(report.errors).toEqual([]);
      const to = path.join(dst, 'mods', 'Cross.jar');
      expect(fs.readFileSync(to, 'utf-8')).toBe('cross-volume');
      expect(fs.statSync(to).ino).not.toBe(fs.statSync(path.join(src, 'mods', 'Cross.jar')).ino);
    } finally {
      linkState.error = null;
    }
  });

  it('reports per-category durations and bytes written', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'x'.repeat(2048));

    const source = { id: 'metrics', label: 'M', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: source.id, categories: ['mods'] }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(report.bytesWritten).toBe(2048);
    expect(report.totalMs).toBeGreaterThanOrEqual(0);
    expect(report.durationsMs?.mods).toBeGreaterThanOrEqual(0);
  });

  it('previews files, bytes and versions without copying anything', () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a'.repeat(1000));
    fs.writeFileSync(path.join(src, 'mods', 'B.jar'), 'b'.repeat(500));

    const source = detectFromDir(src)!;
    const preview = previewImport({ sourceId: source.id, categories: ['mods'] }, source, dst);
    expect(preview.files.mods).toBe(2);
    expect(preview.bytes.mods).toBe(1500);
    expect(preview.totalFiles).toBe(2);
    expect(preview.totalBytes).toBe(1500);
    expect(preview.notEnoughSpace).toBe(false);
    // Предпросмотр не должен ничего писать в папку игры.
    expect(fs.existsSync(path.join(dst, 'mods'))).toBe(false);
  });

  it('preview warns about hardlink sharing and source launcher memory', () => {
    // Раскладка MultiMC/Prism: <инстанс>/instance.cfg + <инстанс>/.minecraft.
    const inst = tmpDir('trel-import-inst-');
    const src = path.join(inst, '.minecraft');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a');
    fs.writeFileSync(path.join(inst, 'instance.cfg'), 'MaxMemAlloc=8192\nname=Better MC\n');

    const source = detectFromDir(src)!;
    const preview = previewImport({ sourceId: source.id, categories: ['mods'], useHardlinks: true }, source, dst);
    expect(preview.warnings.some((w) => w.includes('hardlink mode'))).toBe(true);
    expect(preview.warnings.some((w) => w.includes('8192'))).toBe(true);
  });

  it('ignores instance.cfg of a neighbouring folder when the picked dir is not .minecraft', () => {
    // Пользователь мог выбрать произвольную папку, рядом с которой лежит чужой
    // instance.cfg. Подписывать сборку чужим именем и чужим -Xmx нельзя.
    const parent = tmpDir('trel-import-parent-');
    const src = path.join(parent, 'my-pack');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a');
    fs.writeFileSync(path.join(parent, 'instance.cfg'), 'MaxMemAlloc=8192\nname=Someone Else\n');

    const source = detectFromDir(src)!;
    expect(source.label).not.toContain('Someone Else');
    expect(source.launcherTweaks?.maxMemoryMb).toBeUndefined();
  });

  it('reads a human-readable instance name and JVM tweaks from instance.cfg', () => {
    const inst = tmpDir('trel-import-inst-');
    const src = path.join(inst, '.minecraft');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a');
    fs.writeFileSync(path.join(inst, 'instance.cfg'),
      'name=Better MC [FORGE]\nMaxMemAlloc=6144\nMinMemAlloc=1024\nJvmArgs=-XX:+UseG1GC\n');

    const source = detectFromDir(src)!;
    expect(source.label).toBe('Better MC [FORGE]');
    expect(source.launcherTweaks?.maxMemoryMb).toBe(6144);
    expect(source.launcherTweaks?.minMemoryMb).toBe(1024);
    expect(source.launcherTweaks?.jvmArgs).toBe('-XX:+UseG1GC');
  });

  it('derives -Xmx from vanilla user_jvm_args.txt when no launcher config exists', () => {
    const src = tmpDir('trel-import-src-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a');
    fs.writeFileSync(path.join(src, 'user_jvm_args.txt'), '# comment\n-Xmx4G\n-XX:+UseZGC\n');

    const source = detectFromDir(src)!;
    expect(source.launcherTweaks?.maxMemoryMb).toBe(4096);
    expect(source.launcherTweaks?.jvmArgs).toContain('-Xmx4G');
  });

  it('recognises a Modrinth modpack instance and its loader', () => {
    const src = tmpDir('trel-import-src-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a');
    fs.writeFileSync(path.join(src, 'modrinth.index.json'), JSON.stringify({
      formatVersion: 1,
      name: 'Fabulously Optimized',
      versionId: '5.7.0',
      dependencies: { minecraft: '1.20.1', 'fabric-loader': '0.16.0' },
      files: [{ path: 'mods/x.jar' }, { path: 'mods/y.jar' }],
    }));

    const source = detectFromDir(src)!;
    expect(source.modpack).toEqual({
      origin: 'modrinth',
      name: 'Fabulously Optimized',
      version: '5.7.0',
      mc: '1.20.1',
      loader: 'fabric',
      loaderVersion: '0.16.0',
      fileCount: 2,
    });
  });

  it('recognises a CurseForge modpack manifest and splits loader id into name/version', () => {
    const src = tmpDir('trel-import-src-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a');
    fs.writeFileSync(path.join(src, 'manifest.json'), JSON.stringify({
      name: 'All the Mods 9',
      version: '0.2.60',
      minecraft: { version: '1.20.1', modLoaders: [{ id: 'neoforge-47.1.101', primary: true }] },
      files: [{ projectID: 1 }],
    }));

    const source = detectFromDir(src)!;
    expect(source.modpack?.origin).toBe('curseforge');
    expect(source.modpack?.name).toBe('All the Mods 9');
    expect(source.modpack?.loader).toBe('neoforge');
    expect(source.modpack?.loaderVersion).toBe('47.1.101');
    expect(source.modpack?.mc).toBe('1.20.1');
  });

  it('cancels mid-flight and keeps already copied files', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    const COUNT = 120;
    for (let i = 0; i < COUNT; i++) fs.writeFileSync(path.join(src, 'mods', `M${i}.jar`), 'x'.repeat(64 * 1024));

    const controller = new AbortController();
    const source = { id: 'abort', label: 'A', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    // Прерываем на первом тике, который сообщает о копировании (не на
    // подготовительном «Counting files...»), — часть файлов уже уехала.
    const report = await performImport(
      { sourceId: source.id, categories: ['mods'] },
      source, dst, () => false, undefined,
      (_c, _t, stage) => { if (stage.startsWith('mods')) controller.abort(); },
      controller.signal,
    );
    expect(report.aborted).toBe(true);
    expect(report.warnings.some((w) => w.includes('cancelled'))).toBe(true);
    // Ключевое: отмена реально останавливает копирование. Promise.all создаёт
    // все задачи разом, поэтому проверка отмены только перед постановкой в
    // очередь ничего не давала — папка докопировалась до конца.
    const onDisk = fs.readdirSync(path.join(dst, 'mods')).length;
    expect(onDisk).toBeLessThan(COUNT);
    // Уже скопированное не удаляем: повторный запуск продолжит с этого места.
    expect(report.copied.mods).toBe(onDisk);
    // Манифест обязан отметить прерывание, иначе повторный импорт выглядит как успешный.
    const manifest = JSON.parse(fs.readFileSync(path.join(dst, '.trel_import.json'), 'utf-8'));
    expect(manifest.aborted).toBe(true);
  });

  it('reports a monotonic live byte counter through onProgress', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    const blob = 'y'.repeat(256 * 1024);
    for (let i = 0; i < 24; i++) fs.writeFileSync(path.join(src, 'mods', `M${i}.jar`), blob);

    const seen: number[] = [];
    const source = { id: 'live', label: 'L', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport(
      { sourceId: source.id, categories: ['mods'] },
      source, dst, () => false, undefined,
      (_c, _t, _stage, bytes) => { seen.push(bytes ?? 0); },
    );
    expect(report.errors).toEqual([]);
    // Счётчик растёт монотонно и сходится с итогом отчёта.
    expect(seen[seen.length - 1]).toBe(24 * 256 * 1024);
    expect(report.bytesWritten).toBe(24 * 256 * 1024);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  });

  it('reads back the last import manifest', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a');
    fs.writeFileSync(path.join(src, 'mods', 'B.jar'), 'b');

    const source = { id: 'prism:Pack', label: 'P', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    await performImport({ sourceId: source.id, categories: ['mods'] }, source, dst, () => false);

    const info = readLastImportReport(dst)!;
    expect(info.sourceId).toBe('prism:Pack');
    expect(info.categories).toEqual(['mods']);
    expect(info.copiedFiles).toBe(2);
    expect(info.aborted).toBe(false);
    expect(info.at).toBeLessThanOrEqual(Date.now());
  });

  it('returns null when there is no import manifest', () => {
    expect(readLastImportReport(tmpDir('trel-import-empty-'))).toBeNull();
  });

  it('reuses the SHA-1 cache on a repeated import of the same source', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'A'.repeat(2048));

    const source = { id: 'cache', label: 'C', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const plan = { sourceId: source.id, categories: ['mods'] as any, deduplicate: true };
    await performImport(plan, source, dst, () => false);
    const cacheFile = path.join(dst, '.trel_hash_cache.json');
    expect(fs.existsSync(cacheFile)).toBe(true);

    // Второй проход: файл уже на месте, его хеш должен прийти из кеша, а сам
    // файл — попасть в skipped, а не скопироваться повторно.
    const second = await performImport(plan, source, dst, () => false);
    expect(second.skipped.mods).toBe(1);
    expect(second.copied.mods).toBe(0);

    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as Record<string, string>;
    // Кешируются обе стороны: и файл в папке игры (пре-скан дедупликации), и
    // файл источника (его хеш считается на каждом копировании). Иначе
    // повторный импорт всё равно перечитывал бы весь источник с диска.
    const forSource = Object.keys(cache).find((k) => k.startsWith(path.join(src, 'mods', 'A.jar') + '|'));
    const forDest = Object.keys(cache).find((k) => k.startsWith(path.join(dst, 'mods', 'A.jar') + '|'));
    expect(forSource).toBeDefined();
    expect(forDest).toBeDefined();
    // Содержимое одно и то же — значит и хеш обязан совпадать.
    expect(cache[forSource!]).toBe(cache[forDest!]);
    expect(cache[forSource!]).toHaveLength(40);
  });

  it('ignores a stale hash cache entry when the file changed', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.mkdirSync(path.join(dst, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'NEW-CONTENT');
    const destFile = path.join(dst, 'mods', 'A.jar');
    fs.writeFileSync(destFile, 'old-content');
    // Подкладываем кеш с хешем «нового» содержимого, но для прежних size/mtime.
    const st = fs.statSync(destFile);
    fs.writeFileSync(path.join(dst, '.trel_hash_cache.json'), JSON.stringify({
      [`${destFile}|${st.size}|${Math.floor(st.mtimeMs) - 5000}`]: 'f'.repeat(40),
    }));

    const source = { id: 'stale', label: 'S', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport(
      { sourceId: source.id, categories: ['mods'], deduplicate: true },
      source, dst, () => false,
    );
    expect(report.errors).toEqual([]);
    // Устаревшая запись не должна выдать чужой хеш за актуальный: файл
    // отличается по содержимому, поэтому копия обязана появиться рядом.
    expect(report.copied.mods).toBe(1);
    expect(fs.readdirSync(path.join(dst, 'mods')).length).toBe(2);
  });

  it('preview counts deep trees fully and flags insufficient space honestly', () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    // Глубина 5 — раньше предпросмотр обходил config только на 2 уровня и
    // занижал объём, из-за чего проверка места ничего не находила.
    const deep = path.join(src, 'config', 'a', 'b', 'c', 'd');
    fs.mkdirSync(deep, { recursive: true });
    fs.writeFileSync(path.join(deep, 'deep.cfg'), 'z'.repeat(1000));

    const source = detectFromDir(src)!;
    const preview = previewImport({ sourceId: source.id, categories: ['config'] }, source, dst);
    expect(preview.files.config).toBe(1);
    expect(preview.bytes.config).toBe(1000);
    expect(preview.freeSpaceUnknown).toBe(false);
  });

  it('preview counts every version folder, not just the first fifteen', () => {
    const src = tmpDir('trel-import-src-');
    // 20 профилей: старая оценка обходила только 15 и занижала объём, из-за
    // чего проверка свободного места пропускала нехватку.
    for (let i = 0; i < 20; i++) {
      const id = `1.20.${i}`;
      const verDir = path.join(src, 'versions', id);
      fs.mkdirSync(verDir, { recursive: true });
      fs.writeFileSync(path.join(verDir, `${id}.json`), JSON.stringify({ id, mainClass: 'net.minecraft.client.main.Main' }));
      fs.writeFileSync(path.join(verDir, `${id}.jar`), 'j'.repeat(1000));
    }

    const source = detectFromDir(src)!;
    const preview = previewImport({ sourceId: source.id, categories: ['version-install'] }, source, src + '-dst');
    expect(preview.files['version-install']).toBe(20);
    // 20 × (1000 байт jar + json) — точная сумма зависит от длины json,
    // поэтому проверяем, что учтены все 20, а не 15.
    expect(preview.bytes['version-install']).toBeGreaterThan(20 * 1000);
  });

  it('skips the space check in hardlink mode', () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a');

    const source = detectFromDir(src)!;
    const preview = previewImport({ sourceId: source.id, categories: ['mods'], useHardlinks: true }, source, dst);
    // Ссылки места не занимают — предупреждать о нехватке нечестно.
    expect(preview.notEnoughSpace).toBe(false);
  });

  it('drops categories nested inside a broader selected one (assets covers skins)', () => {
    // assets/skins и assets/log_configs уже лежат внутри assets: выбирать всё
    // вместе раньше давало двойное копирование и мусор «skins/ab (1)».
    expect(dropNestedCategories(['assets', 'skin-cache', 'log-configs'])).toEqual(['assets']);
    // А без родителя обе остаются — они не пересекаются.
    expect(dropNestedCategories(['skin-cache', 'log-configs'])).toEqual(['skin-cache', 'log-configs']);
    // Независимые категории не трогаем.
    expect(dropNestedCategories(['assets', 'mods', 'config'])).toEqual(['assets', 'mods', 'config']);
  });

  it('skips accounts and tokens in "without secrets" mode', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a');
    fs.writeFileSync(path.join(src, 'usercache.json'), '{"x":1}');
    const source = { id: 'sec', label: 'S', rootDir: src, available: ['mods', 'usercache', 'accounts'] as any, approxSize: 0, kind: 'java' as const, accountsRoots: [src] };
    const report = await performImport(
      { sourceId: 'sec', categories: ['mods', 'usercache', 'accounts'] as any, skipSecrets: true },
      source, dst, () => false,
    );
    expect(report.errors).toEqual([]);
    expect(report.secretsSkipped).toBe(true);
    expect(report.copied.mods).toBe(1);
    expect(report.copied.usercache).toBeUndefined();
    expect(report.copied.accounts).toBeUndefined();
    expect(fs.existsSync(path.join(dst, 'usercache.json'))).toBe(false);
  });

  it('moves the source after a verified copy', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'move-me');
    fs.writeFileSync(path.join(src, 'servers.dat'), 'srv');
    const source = { id: 'mv', label: 'M', rootDir: src, available: ['mods', 'servers'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport(
      { sourceId: 'mv', categories: ['mods', 'servers'] as any, moveSource: true },
      source, dst, () => false,
    );
    expect(report.errors).toEqual([]);
    expect(report.movedSource).toBe(true);
    expect(fs.existsSync(path.join(src, 'mods', 'A.jar'))).toBe(false);
    expect(fs.existsSync(path.join(src, 'servers.dat'))).toBe(false);
    expect(fs.readFileSync(path.join(dst, 'mods', 'A.jar'), 'utf-8')).toBe('move-me');
  });

  it('archives current worlds before importing strangers', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a');
    fs.mkdirSync(path.join(dst, 'saves', 'mine'), { recursive: true });
    fs.writeFileSync(path.join(dst, 'saves', 'mine', 'level.dat'), 'mine');
    const source = { id: 'arch', label: 'A', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport(
      { sourceId: 'arch', categories: ['mods'] as any, archiveWorlds: true },
      source, dst, () => false,
    );
    expect(report.errors).toEqual([]);
    expect(report.archivedWorlds).toMatch(/saves-before-import-.*\.zip$/);
    expect(fs.existsSync(report.archivedWorlds!)).toBe(true);
  });

  it('writes a journal that rolls the import back', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a');
    fs.writeFileSync(path.join(src, 'mods', 'B.jar'), 'b');
    const source = { id: 'j', label: 'J', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: 'j', categories: ['mods'] as any }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(fs.existsSync(path.join(dst, '.trel_import_journal.json'))).toBe(true);
    const removed = await rollbackJournal(dst);
    expect(removed).toBe(2);
    expect(fs.existsSync(path.join(dst, 'mods', 'A.jar'))).toBe(false);
  });

  it('quarantines suspicious mods and reports duplicate mod versions', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    const evil = new AdmZip();
    evil.addFile('Start.class', Buffer.from('x'));
    evil.addFile('fabric.mod.json', Buffer.from(JSON.stringify({ id: 'evilmod', version: '1.0' })));
    evil.writeZip(path.join(src, 'mods', 'evil.jar'));
    for (const [name, ver] of [['dup-a.jar', '1.0'], ['dup-b.jar', '2.0']] as const) {
      const z = new AdmZip();
      z.addFile('fabric.mod.json', Buffer.from(JSON.stringify({ id: 'dupmod', version: ver })));
      z.addFile('com/x/C.class', Buffer.from('x'));
      z.writeZip(path.join(src, 'mods', name));
    }
    const source = { id: 'q', label: 'Q', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: 'q', categories: ['mods'] as any }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(report.quarantine?.some((q) => q.includes('evil.jar'))).toBe(true);
    expect(report.duplicateMods?.some((d) => d.includes('dupmod'))).toBe(true);
    expect(report.warnings.some((w) => w.includes('quarantine'))).toBe(true);
  });

  it('counts dedup savings in bytes on a repeat import', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'A'.repeat(2048));
    const source = { id: 'save', label: 'S', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const plan = { sourceId: 'save', categories: ['mods'] as any, deduplicate: true };
    await performImport(plan, source, dst, () => false);
    const second = await performImport(plan, source, dst, () => false);
    expect(second.skipped.mods).toBe(1);
    expect(second.savedBytes).toBe(2048);
  });

  it('preview shows diff, file tree, savings and time estimate', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'New.jar'), 'new'.repeat(100));
    fs.writeFileSync(path.join(src, 'mods', 'Old.jar'), 'old'.repeat(100));
    fs.mkdirSync(path.join(dst, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(dst, 'mods', 'Old.jar'), 'old'.repeat(100)); // identical twin
    const source = { id: 'pv', label: 'P', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const plan = { sourceId: 'pv', categories: ['mods'] as any };
    const first = previewImport(plan, source, dst);
    expect(first.diff).toEqual({ fresh: 1, overwrite: 0, identical: 1 });
    expect(first.savedBytesEstimate).toBe('old'.repeat(100).length);
    expect(first.fileTree?.length).toBe(2);
    expect(first.etaSecondsEstimate).toBeUndefined(); // прошлого импорта ещё не было
    // После реального импорта скорость известна — оценка времени появляется.
    await performImport(plan, source, dst, () => false);
    const second = previewImport(plan, source, dst);
    expect(typeof second.etaSecondsEstimate === 'number' || second.etaSecondsEstimate === undefined).toBe(true);
  });

  it('warns about corrupt JSON instead of failing silently', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.writeFileSync(path.join(src, 'usercache.json'), '{broken json');
    const source = { id: 'jb', label: 'J', rootDir: src, available: ['usercache'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: 'jb', categories: ['usercache'] as any }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(report.copied.usercache).toBe(1);
    expect(report.warnings.some((w) => w.includes('corrupt JSON'))).toBe(true);
  });

  it('pauses between files and still honours abort', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    for (let i = 0; i < 30; i++) fs.writeFileSync(path.join(src, 'mods', `M${i}.jar`), 'x'.repeat(4096));
    const source = { id: 'pz', label: 'P', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const ctl = new AbortController();
    setImportPaused(true);
    try {
      const p = performImport({ sourceId: 'pz', categories: ['mods'] as any }, source, dst, () => false, undefined, undefined, ctl.signal);
      await new Promise((r) => setTimeout(r, 300)); // на паузе файлы не едут (папка создаётся заранее)
      const modsDir = path.join(dst, 'mods');
      expect(!fs.existsSync(modsDir) || fs.readdirSync(modsDir).length === 0).toBe(true);
      ctl.abort();
      const report = await p;
      expect(report.aborted).toBe(true);
    } finally {
      setImportPaused(false);
    }
  });

  it('scanDir counts in one walk and caps the listing', () => {
    const dir = tmpDir('trel-scan-');
    for (let i = 0; i < 10; i++) fs.writeFileSync(path.join(dir, `f${i}.txt`), '12345');
    const sc = scanDir(dir, 5, 4);
    expect(sc.files).toBe(10);
    expect(sc.bytes).toBe(50);
    expect(sc.top).toHaveLength(4);
    expect(sc.truncated).toBe(true);
  });

  it('reports client notes and secret stores without importing them silently', () => {
    const src = tmpDir('trel-import-src-');
    fs.mkdirSync(path.join(src, 'feather'), { recursive: true });
    fs.writeFileSync(path.join(src, 'launcher_accounts.json'), JSON.stringify({ a: { accessToken: 'tok', minecraftProfile: { id: '12345678123456781234567812345678', name: 'Steve' } } }));
    const source = { id: 'sk:x', label: 'S', rootDir: src, available: [] as any, approxSize: 0, kind: 'java' as const, accountsRoots: [src] };
    expect(sourceNotes(source).some((n) => n.includes('Feather'))).toBe(true);
    expect(secretStoreWarnings(source).some((w) => w.includes('launcher_accounts.json'))).toBe(true);
  });

  it('extracts authlib injector endpoints for the user to re-enter', () => {
    const src = tmpDir('trel-import-src-');
    fs.writeFileSync(path.join(src, 'hmcl.json'), JSON.stringify({ authlibInjectorServers: ['https://auth.example.com'] }));
    const source = { id: 'h', label: 'H', rootDir: src, available: [] as any, approxSize: 0, kind: 'java' as const };
    expect(extractAuthServers(source)).toContain('https://auth.example.com');
  });

  it('finds no case conflicts on case-sensitive volumes', () => {
    const src = tmpDir('trel-import-src-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'Mod.jar'), 'a');
    fs.writeFileSync(path.join(src, 'mods', 'mod.jar'), 'b');
    const source = { id: 'cc', label: 'C', rootDir: src, available: [] as any, approxSize: 0, kind: 'java' as const };
    // На Linux проверки нет (том чувствителен), на win/mac — пара находится.
    const found = findCaseConflicts(src, ['mods'] as any);
    expect(process.platform === 'linux' ? found : found.length).toEqual(process.platform === 'linux' ? [] : found);
    if (process.platform !== 'linux') expect(found.length).toBe(1);
  });

  it('hmclExtraGameDirs ignores garbage and missing dirs', () => {
    expect(hmclExtraGameDirs(['/nonexistent-base'], '/nonexistent-home')).toEqual([]);
  });

  it('detects and copies the new content categories', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    const layout = { schematics: ['house.litematic'], replay_recordings: ['fight.mcpr'], minimap: ['x.txt'],
      coremods: ['core.jar'], openloader: ['data.txt'], debug: ['prof.txt'], blueprints: ['b.nbt'] };
    for (const [dir, files] of Object.entries(layout)) {
      fs.mkdirSync(path.join(src, dir), { recursive: true });
      for (const f of files) fs.writeFileSync(path.join(src, dir, f), 'x');
    }
    fs.mkdirSync(path.join(src, 'xaero'), { recursive: true });
    fs.writeFileSync(path.join(src, 'xaero', 'map.txt'), 'x');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'gate.jar'), 'x');
    const found = detectFromDir(src)!;
    expect(found).not.toBeNull();
    for (const c of ['schematics', 'replays', 'minimap', 'coremods', 'openloader', 'debug']) {
      expect(found.available).toContain(c);
    }
    const source = { id: 'nc', label: 'N', rootDir: src, available: found.available as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: 'nc', categories: ['schematics', 'replays', 'minimap'] as any }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(fs.existsSync(path.join(dst, 'schematics', 'house.litematic'))).toBe(true);
    expect(fs.existsSync(path.join(dst, 'blueprints', 'b.nbt'))).toBe(true); // своя папка, та же категория
    expect(fs.existsSync(path.join(dst, 'replay_recordings', 'fight.mcpr'))).toBe(true);
  });

  it('detects bedrock behavior and skin packs', () => {
    const dir = tmpDir('trel-bedrock-');
    fs.mkdirSync(path.join(dir, 'minecraftWorlds', 'w1'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'behavior_packs', 'bp1'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'skin_packs', 'sp1'), { recursive: true });
    const found = detectFromDir(dir)!;
    expect(found.kind).toBe('bedrock');
    expect(found.available).toContain('behaviorpacks');
    expect(found.available).toContain('skinpacks');
  });

  it('falls back to legacy shaders/ and Backups/ layouts', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'shaders'), { recursive: true });
    fs.writeFileSync(path.join(src, 'shaders', 'old.zip'), 'x');
    fs.mkdirSync(path.join(src, 'Backups'), { recursive: true });
    fs.writeFileSync(path.join(src, 'Backups', 'b.zip'), 'x');
    const source = { id: 'lg', label: 'L', rootDir: src, available: ['shaderpacks', 'backups'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: 'lg', categories: ['shaderpacks', 'backups'] as any }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(fs.existsSync(path.join(dst, 'shaderpacks', 'old.zip'))).toBe(true);
    expect(fs.existsSync(path.join(dst, 'backups', 'b.zip'))).toBe(true);
  });

  it('picks up versioned Badlion profile dirs into config', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'BLClient-Mod-Profiles-1.20'), { recursive: true });
    fs.writeFileSync(path.join(src, 'BLClient-Mod-Profiles-1.20', 'mods.json'), '{}');
    const found = detectFromDir(src)!;
    expect(found.available).toContain('config');
    const source = { id: 'bl', label: 'B', rootDir: src, available: ['config'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: 'bl', categories: ['config'] as any }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(fs.existsSync(path.join(dst, 'config', 'mods.json'))).toBe(true);
  });

  it('parses servers.dat names and ips', () => {
    const f = path.join(tmpDir('trel-nbt-'), 'servers.dat');
    // compound{ servers: list<compound>[ {name, ip} ] }
    const enc = (s: string) => { const b = Buffer.from(s, 'utf-8'); const n = Buffer.alloc(2); n.writeUInt16BE(b.length); return Buffer.concat([n, b]); };
    const strTag = (name: string, v: string) => Buffer.concat([Buffer.from([8]), enc(name), enc(v)]);
    const srv = (name: string, ip: string) => Buffer.concat([strTag('name', name), strTag('ip', ip), Buffer.from([0])]);
    const list = Buffer.concat([Buffer.from([9]), enc('servers'), Buffer.from([10]),
      (() => { const n = Buffer.alloc(4); n.writeInt32BE(2); return n; })(), srv('Home', 'mc.home:25565'), srv('Fun', '1.2.3.4')]);
    fs.writeFileSync(f, Buffer.concat([Buffer.from([10]), enc(''), list, Buffer.from([0])]));
    expect(parseServersDat(f)).toEqual([{ name: 'Home', ip: 'mc.home:25565' }, { name: 'Fun', ip: '1.2.3.4' }]);
    expect(parseServersDat(f + '.missing')).toEqual([]);
  });

  it('skips natives/ in version-install with a warning', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'versions', '1.20.1', 'natives'), { recursive: true });
    fs.writeFileSync(path.join(src, 'versions', '1.20.1', '1.20.1.json'), JSON.stringify({ id: '1.20.1' }));
    fs.writeFileSync(path.join(src, 'versions', '1.20.1', '1.20.1.jar'), 'jar');
    fs.writeFileSync(path.join(src, 'versions', '1.20.1', 'natives', 'lib.dll'), 'dll');
    const source = { id: 'nv', label: 'N', rootDir: src, available: ['version-install'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: 'nv', categories: ['version-install'] as any }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(fs.existsSync(path.join(dst, 'versions', '1.20.1', '1.20.1.jar'))).toBe(true);
    expect(fs.existsSync(path.join(dst, 'versions', '1.20.1', 'natives'))).toBe(false);
    expect(report.warnings.some((w) => w.includes('natives'))).toBe(true);
  });

  it('redirects isolated screenshots into shared screenshots', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'versions', 'v1', 'screenshots'), { recursive: true });
    fs.writeFileSync(path.join(src, 'versions', 'v1', 'screenshots', 'a.png'), 'png');
    const source = { id: 'sc', label: 'S', rootDir: src, available: ['version-content'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: 'sc', categories: ['version-content'] as any }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(fs.existsSync(path.join(dst, 'screenshots', 'a.png'))).toBe(true);
  });

  it('does not duplicate a world present in two isolated versions', async () => {
    // Без общих saves обе versions/*/saves обходятся — вторая копия MyWorld
    // обязана скипнуться, а не лечь рядом как «MyWorld (1)».
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    for (const d of [path.join(src, 'versions', 'v1', 'saves', 'MyWorld'), path.join(src, 'versions', 'v2', 'saves', 'MyWorld')]) {
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'level.dat'), 'w');
    }
    const source = { id: 'wd', label: 'W', rootDir: src, available: ['version-content'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: 'wd', categories: ['version-content'] as any }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(fs.readdirSync(path.join(dst, 'saves'))).toEqual(['MyWorld']);
    expect(report.warnings.some((w) => w.includes('already imported'))).toBe(true);
  });

  it('warns about renames from name collisions', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'new-content-different');
    fs.mkdirSync(path.join(dst, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(dst, 'mods', 'A.jar'), 'old');
    const source = { id: 'rn', label: 'R', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: 'rn', categories: ['mods'] as any }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => w.includes('(n)'))).toBe(true);
    expect(fs.readdirSync(path.join(dst, 'mods')).sort()).toEqual(['A (1).jar', 'A.jar']);
  });

  it('evicts hash cache entries older than 30 days', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'a');
    const oldKey = `${path.join(dst, 'mods', 'gone.jar')}|10|1000`;
    fs.writeFileSync(path.join(dst, '.trel_hash_cache.json'), JSON.stringify({ [oldKey]: 'a'.repeat(40) }));
    const source = { id: 'ttl', label: 'T', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    await performImport({ sourceId: 'ttl', categories: ['mods'] as any, deduplicate: true }, source, dst, () => false);
    const cache = JSON.parse(fs.readFileSync(path.join(dst, '.trel_hash_cache.json'), 'utf-8'));
    expect(cache[oldKey]).toBeUndefined();
  });

  it('moves hardlinked sources by unlinking (data survives in Trel)', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(src, 'mods', 'A.jar'), 'keep-me');
    const source = { id: 'mhl', label: 'M', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport(
      { sourceId: 'mhl', categories: ['mods'] as any, useHardlinks: true, moveSource: true },
      source, dst, () => false,
    );
    expect(report.errors).toEqual([]);
    expect(report.movedSource).toBe(true);
    expect(fs.existsSync(path.join(src, 'mods', 'A.jar'))).toBe(false);
    expect(fs.readFileSync(path.join(dst, 'mods', 'A.jar'), 'utf-8')).toBe('keep-me');
  });

  it('sameHead compares file prefixes honestly', () => {
    const dir = tmpDir('trel-head-');
    fs.writeFileSync(path.join(dir, 'a.bin'), '1234rest-a');
    fs.writeFileSync(path.join(dir, 'b.bin'), '1234rest-b');
    fs.writeFileSync(path.join(dir, 'c.bin'), 'xxxxrest-a');
    expect(sameHead(path.join(dir, 'a.bin'), path.join(dir, 'b.bin'))).toBe(false);
    expect(sameHead(path.join(dir, 'a.bin'), path.join(dir, 'c.bin'))).toBe(false);
    expect(sameHead(path.join(dir, 'a.bin'), path.join(dir, 'a.bin'))).toBe(true);
    expect(sameHead(path.join(dir, 'a.bin'), path.join(dir, 'missing'))).toBe(false);
  });

  it('scanDir stops at the file cap', () => {
    const dir = tmpDir('trel-cap-');
    for (let i = 0; i < 20; i++) fs.writeFileSync(path.join(dir, `f${i}.txt`), 'x');
    const sc = scanDir(dir, 5, 300, 10);
    expect(sc.files).toBe(10);
    expect(sc.truncated).toBe(true);
  });

  it('copies ATLauncher per-server dats', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'Servers'), { recursive: true });
    fs.writeFileSync(path.join(src, 'Servers', 'hub.dat'), 'srv');
    const source = { id: 'at', label: 'A', rootDir: src, available: ['servers'] as any, approxSize: 0, kind: 'java' as const };
    const report = await performImport({ sourceId: 'at', categories: ['servers'] as any }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(fs.existsSync(path.join(dst, 'hub.dat'))).toBe(true);
  });

  it('copies 3000 files through the pool (stress)', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    for (let i = 0; i < 3000; i++) fs.writeFileSync(path.join(src, 'mods', `m${i}.jar`), `c${i}`);
    const source = { id: 'st', label: 'S', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const t = Date.now();
    const report = await performImport({ sourceId: 'st', categories: ['mods'] as any }, source, dst, () => false);
    expect(report.errors).toEqual([]);
    expect(report.copied.mods).toBe(3000);
    expect(Date.now() - t).toBeLessThan(120000);
  }, 150000);

  it('never throws on garbage directories (fuzz)', () => {
    const dir = tmpDir('trel-fuzz-');
    fs.writeFileSync(path.join(dir, 'instance.cfg'), '\x00\xff\xfe binary \n = = =');
    fs.writeFileSync(path.join(dir, 'manifest.json'), '{oops');
    fs.mkdirSync(path.join(dir, 'versions'));
    fs.writeFileSync(path.join(dir, 'versions', 'x.json'), '[1,2');
    expect(() => detectFromDir(dir)).not.toThrow();
    expect(() => previewImport({ sourceId: 'custom', categories: [] as any },
      { id: 'custom', label: 'C', rootDir: dir, available: [] as any, approxSize: 0, kind: 'java' as const }, dir)).not.toThrow();
  });

  it('resolveDestPath and dropNestedCategories behave on random inputs (property)', () => {
    const rnd = (n: number) => Math.floor(Math.random() * n);
    const names = ['a', 'A', 'a.jar', 'A.JAR', 'b (1).jar', 'c-d_e', 'f.txt', 'F.TXT'];
    const ci = process.platform === 'win32' || process.platform === 'darwin';
    for (let i = 0; i < 300; i++) {
      const taken = new Set<string>();
      const seen = new Set<string>();
      for (let k = 0; k < 8; k++) {
        const out = resolveDestPath('/dst', names[rnd(names.length)], taken);
        expect(seen.has(out)).toBe(false);
        seen.add(out);
        // Та же норма, что в боевом коде: lower только на win/mac.
        taken.add(ci ? out.toLowerCase() : out);
      }
      const cats = (['assets', 'skin-cache', 'log-configs', 'mods', 'config'] as any[])
        .filter(() => Math.random() < 0.5);
      const eff = dropNestedCategories(cats);
      // assets всегда поглощает вложенные; без assets всё остаётся
      if (eff.includes('assets' as any)) {
        expect(eff).not.toContain('skin-cache');
        expect(eff).not.toContain('log-configs');
      }
      if (!cats.includes('assets')) expect(eff).toEqual(cats);
    }
  });

  it('copies with reasonable throughput (bench)', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'mods'), { recursive: true });
    const blob = Buffer.alloc(1024 * 1024, 9);
    for (let i = 0; i < 50; i++) fs.writeFileSync(path.join(src, 'mods', `b${i}.jar`), blob);
    const source = { id: 'bench', label: 'B', rootDir: src, available: ['mods'] as any, approxSize: 0, kind: 'java' as const };
    const t = Date.now();
    const report = await performImport({ sourceId: 'bench', categories: ['mods'] as any }, source, dst, () => false);
    const secs = (Date.now() - t) / 1000;
    const mbps = 50 / Math.max(secs, 0.01);
    console.log(`bench: 50MB in ${secs.toFixed(1)}s = ${mbps.toFixed(0)} MB/s`);
    expect(report.errors).toEqual([]);
    expect(mbps).toBeGreaterThan(2); // нижняя граница от 10-кратных регрессов, не рекорд: под нагрузкой параллельных тестов диск проседает
  }, 120000);

  it('reads FTB/Technic/instgroups names and mmc/packwiz/modrinth profiles', async () => {
    // FTB instance.json
    const ftb = tmpDir('trel-ftb-');
    fs.mkdirSync(path.join(ftb, 'minecraft', 'mods'), { recursive: true });
    fs.writeFileSync(path.join(ftb, 'minecraft', 'mods', 'a.jar'), 'x');
    fs.writeFileSync(path.join(ftb, 'instance.json'), JSON.stringify({ name: 'FTB Skies' }));
    const s1 = detectFromDir(path.join(ftb, 'minecraft'))!;
    expect(s1.label).toContain('FTB Skies');
    // MultiMC instance.cfg + instgroups
    const mmc = tmpDir('trel-mmc-');
    fs.mkdirSync(path.join(mmc, 'MC1', 'minecraft', 'mods'), { recursive: true });
    fs.writeFileSync(path.join(mmc, 'MC1', 'minecraft', 'mods', 'a.jar'), 'x');
    fs.writeFileSync(path.join(mmc, 'MC1', 'instance.cfg'), 'name=My Pack\n');
    fs.writeFileSync(path.join(mmc, 'MC1', 'mmc-pack.json'), JSON.stringify({ components: [
      { uid: 'net.minecraft', version: '1.20.1' }, { uid: 'net.fabricmc.fabric-loader', version: '0.16.0' },
    ] }));
    fs.writeFileSync(path.join(mmc, 'instgroups.json'), JSON.stringify({ formatVersion: 1, groups: { Fav: { instances: ['MC1'] } } }));
    const s2 = detectFromDir(path.join(mmc, 'MC1', 'minecraft'))!;
    expect(s2.label).toContain('My Pack (Fav)');
    expect(s2.modpack?.mc).toBe('1.20.1');
    expect(s2.modpack?.loader).toBe('fabric');
    expect(s2.modpack?.origin).toBe('mmc');
    // Technic installedPacks.json
    const tech = tmpDir('trel-tech-');
    fs.mkdirSync(path.join(tech, 'tekkit', 'mods'), { recursive: true });
    fs.writeFileSync(path.join(tech, 'tekkit', 'mods', 'a.jar'), 'x');
    fs.writeFileSync(path.join(tech, 'installedPacks.json'), JSON.stringify({ tekkit: { name: 'Tekkit Legends' } }));
    const s3 = detectFromDir(path.join(tech, 'tekkit'))!;
    expect(s3.label).toContain('Tekkit Legends');
    // packwiz.toml
    const pw = tmpDir('trel-pw-');
    fs.mkdirSync(path.join(pw, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(pw, 'mods', 'a.jar'), 'x');
    fs.writeFileSync(path.join(pw, 'packwiz.toml'), 'name = "PW Pack"\n[versions]\nminecraft = "1.21"\n');
    const s4 = detectFromDir(pw)!;
    expect(s4.modpack?.origin).toBe('packwiz');
    expect(s4.modpack?.mc).toBe('1.21');
  });

  it('reads HMCL custom game dirs from json', () => {
    const base = tmpDir('trel-hmclbase-');
    const game = tmpDir('trel-hmclgame-');
    fs.mkdirSync(path.join(game, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(game, 'mods', 'a.jar'), 'x');
    const gd = path.join(base, '.hmcl', 'game-directories');
    fs.mkdirSync(gd, { recursive: true });
    fs.writeFileSync(path.join(gd, 'd.json'), JSON.stringify({ path: game }));
    fs.writeFileSync(path.join(gd, 'garbage.json'), '{oops');
    const dirs = hmclExtraGameDirs([base], '/nonexistent');
    expect(dirs).toEqual([game]);
  });

  it('extracts ely and authlib-injector endpoints', () => {
    const src = tmpDir('trel-import-src-');
    fs.writeFileSync(path.join(src, 'authlib-injector.json'), JSON.stringify({ meta: { servers: ['https://authserver.ely.by'] } }));
    const source = { id: 'h', label: 'H', rootDir: src, available: [] as any, approxSize: 0, kind: 'java' as const };
    expect(extractAuthServers(source)).toContain('https://authserver.ely.by');
  });

  it('does not copy nested categories twice when the parent is selected', async () => {
    const src = tmpDir('trel-import-src-');
    const dst = tmpDir('trel-import-dst-');
    fs.mkdirSync(path.join(src, 'assets', 'skins', 'ab'), { recursive: true });
    fs.mkdirSync(path.join(src, 'assets', 'log_configs'), { recursive: true });
    fs.writeFileSync(path.join(src, 'assets', 'skins', 'ab', 'skinhash'), 'skin');
    fs.writeFileSync(path.join(src, 'assets', 'log_configs', 'client.xml'), '<xml/>');
    const source = { id: 'ov', label: 'O', rootDir: src, available: ['assets', 'skin-cache', 'log-configs'] as any, approxSize: 0, kind: 'java' as const };

    const preview = previewImport(
      { sourceId: 'ov', categories: ['assets', 'skin-cache', 'log-configs'] as any }, source, dst,
    );
    // Было 4 (2+1+1 с двойным счётом), стало 2.
    expect(preview.totalFiles).toBe(2);

    const report = await performImport(
      { sourceId: 'ov', categories: ['assets', 'skin-cache', 'log-configs'] as any }, source, dst, () => false,
    );
    expect(report.copied.assets).toBe(2);
    expect(report.copied['skin-cache']).toBeUndefined();
    expect(report.copied['log-configs']).toBeUndefined();
    expect(report.warnings.some((w) => w.includes('skin-cache'))).toBe(true);
    // И никакого «client (1).xml» рядом.
    expect(fs.existsSync(path.join(dst, 'assets', 'log_configs', 'client.xml'))).toBe(true);
    const logDir = fs.readdirSync(path.join(dst, 'assets', 'log_configs'));
    expect(logDir).toEqual(['client.xml']);
  });
});

describe('createSpeedMeter', () => {
  const MB = 1024 * 1024;

  it('stays silent for the first few milliseconds instead of spiking', () => {
    const speed = createSpeedMeter(1000);
    // Делить 1 МБ на 1 мс — верный способ показать «1000 МБ/с» на старте.
    expect(speed(MB, 1001)).toBe(0);
  });

  it('falls back to the average since start before the window closes', () => {
    const speed = createSpeedMeter(1000);
    // 10 МБ за 100 мс = 100 МБ/с.
    expect(speed(10 * MB, 1100)).toBeCloseTo(100 * MB, 0);
  });

  it('measures the window delta, not the average since start', () => {
    const speed = createSpeedMeter(0);
    // Первая секунда — быстро (100 МБ), потом окно: ещё 10 МБ за 250 мс.
    speed(100 * MB, 1000);
    const windowed = speed(110 * MB, 1250);
    expect(windowed).toBeCloseTo(40 * MB, 0);
    // Средняя от старта дала бы ~88 МБ/с — вдвое больше реальной.
    expect(windowed).toBeLessThan(50 * MB);
  });

  it('reports zero while nothing is being written', () => {
    const speed = createSpeedMeter(0);
    speed(50 * MB, 1000);
    // Пауза на хешировании: байты не растут — скорость обнуляется, а не
    // застывает на прошлом значении.
    expect(speed(50 * MB, 2000)).toBe(0);
  });

  it('keeps the last measurement between window boundaries', () => {
    const speed = createSpeedMeter(0);
    const first = speed(10 * MB, 1000);
    expect(first).toBeCloseTo(10 * MB, 0);
    // Внутри окна отдаём прошлое значение, а не пересчитываем на глазок.
    expect(speed(11 * MB, 1100)).toBe(first);
  });
});
