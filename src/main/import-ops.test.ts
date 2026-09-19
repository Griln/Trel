import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import AdmZip from 'adm-zip';
import {
  archiveDirToZip, appendImportLog, extractPackArchive, findDuplicateMods,
  journalAdd, journalComplete, readJournal, readModId, readPackDependencies,
  rollbackJournal, scanJarSuspicious,
} from './import-ops';

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

describe('import-ops journal', () => {
  it('records created files and rolls them back', async () => {
    const game = tmpDir('trel-ops-game-');
    const sub = path.join(game, 'mods');
    fs.mkdirSync(sub, { recursive: true });
    const f1 = path.join(sub, 'A.jar');
    const f2 = path.join(sub, 'B.jar');
    fs.writeFileSync(f1, 'a');
    fs.writeFileSync(f2, 'b');
    await journalAdd(game, 'src', 'mods', [f1, f2]);
    await journalComplete(game, 'mods');
    const j = readJournal(game)!;
    expect(j.completedCategories).toContain('mods');
    expect(j.created.mods).toHaveLength(2);
    const removed = await rollbackJournal(game, 'mods');
    expect(removed).toBe(2);
    expect(fs.existsSync(f1)).toBe(false);
    expect(fs.existsSync(f2)).toBe(false);
    // Повторный откат — ноль, а не ошибка.
    expect(await rollbackJournal(game, 'mods')).toBe(0);
  });

  it('appends to the import log', async () => {
    const game = tmpDir('trel-ops-log-');
    const p = await appendImportLog(game, 'hello');
    expect(p.endsWith('.trel_import.log')).toBe(true);
    expect(fs.readFileSync(p, 'utf-8')).toContain('hello');
  });
});

describe('import-ops pack archives', () => {
  function makeZip(files: Record<string, string>): string {
    const zip = new AdmZip();
    for (const [name, content] of Object.entries(files)) zip.addFile(name, Buffer.from(content));
    const p = path.join(tmpDir('trel-ops-zip-'), 'pack.zip');
    zip.writeZip(p);
    return p;
  }

  it('extracts a pack and finds its root + name', async () => {
    const archive = makeZip({
      'overrides/mods/A.jar': 'x',
      'modrinth.index.json': JSON.stringify({ name: 'Cool Pack', dependencies: { minecraft: '1.20.1' } }),
    });
    const pack = await extractPackArchive(archive);
    tmpDirs.push(pack.tmpDir);
    expect(pack.packName).toBe('Cool Pack');
    expect(fs.existsSync(path.join(pack.rootDir, 'mods', 'A.jar'))).toBe(true);
    const deps = await readPackDependencies(pack.rootDir);
    expect(deps.mc).toBe('1.20.1');
  });

  it('blocks zip-slip entries outside the tmp dir', async () => {
    const archive = makeZip({ '../evil.txt': 'x', 'mods/Ok.jar': 'ok' });
    const pack = await extractPackArchive(archive);
    tmpDirs.push(pack.tmpDir);
    expect(fs.existsSync(path.join(pack.tmpDir, 'mods', 'Ok.jar'))).toBe(true);
    expect(fs.existsSync(path.join(path.dirname(pack.tmpDir), 'evil.txt'))).toBe(false);
    expect(fs.existsSync('/tmp/evil.txt')).toBe(false);
  });

  it('reads curseforge manifest dependencies', async () => {
    const dir = tmpDir('trel-ops-curse-');
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
      name: 'Curse Pack', minecraft: { version: '1.19.2', modLoaders: [{ id: 'forge-43.2.0' }] },
    }));
    const deps = await readPackDependencies(dir);
    expect(deps.mc).toBe('1.19.2');
    expect(deps.loader).toBe('forge');
  });
});

describe('import-ops quarantine', () => {
  function makeJar(entries: Record<string, string>): string {
    const zip = new AdmZip();
    for (const [name, content] of Object.entries(entries)) zip.addFile(name, Buffer.from(content));
    const p = path.join(tmpDir('trel-ops-jar-'), 'mod.jar');
    zip.writeZip(p);
    return p;
  }

  it('passes a normal fabric mod', () => {
    const jar = makeJar({
      'fabric.mod.json': JSON.stringify({ id: 'coolmod', version: '1.0' }),
      'net/cool/Main.class': 'x',
      'assets/cool/lang/en.json': '{}',
      'META-INF/MANIFEST.MF': 'x',
    });
    expect(scanJarSuspicious(jar)).toBeNull();
  });

  it('flags jars with executables and starter classes', () => {
    const jar = makeJar({ 'Start.class': 'x', 'payload.exe': 'x', 'com/a/B.class': 'x' });
    const verdict = scanJarSuspicious(jar);
    expect(verdict).toContain('payload.exe');
    expect(verdict).toContain('Start.class');
  });

  it('reads modid from fabric metadata and forge toml', () => {
    const fab = makeJar({ 'fabric.mod.json': JSON.stringify({ id: 'fabmod', version: '2.0' }) });
    expect(readModId(fab)).toEqual({ id: 'fabmod', version: '2.0' });
    const forge = makeJar({ 'META-INF/mods.toml': 'modId="forgemod"\nversion="3.1"\n' });
    expect(readModId(forge)).toEqual({ id: 'forgemod', version: '3.1' });
  });

  it('groups same modid in different versions', () => {
    const dir = tmpDir('trel-ops-dups-');
    const fabrics = [['coolmod', '1.0'], ['coolmod', '2.0'], ['othermod', '1.0']];
    fabrics.forEach(([id, ver], i) => {
      const zip = new AdmZip();
      zip.addFile('fabric.mod.json', Buffer.from(JSON.stringify({ id, version: ver })));
      zip.writeZip(path.join(dir, `m${i}.jar`));
    });
    const dups = findDuplicateMods(dir);
    expect(dups).toHaveLength(1);
    expect(dups[0]).toContain('coolmod');
  });

  it('archives a directory and restores the file count', async () => {
    const src = tmpDir('trel-ops-arch-');
    fs.mkdirSync(path.join(src, 'world1'), { recursive: true });
    fs.writeFileSync(path.join(src, 'world1', 'level.dat'), 'data');
    fs.writeFileSync(path.join(src, 'notes.txt'), 'hi');
    const zipPath = path.join(tmpDir('trel-ops-archout-'), 'saves.zip');
    const n = await archiveDirToZip(src, zipPath);
    expect(n).toBe(2);
    const back = new AdmZip(zipPath);
    expect(back.getEntries().map((e) => e.entryName).sort()).toEqual(['notes.txt', 'world1/level.dat']);
  });
});
