import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SettingsStore } from './settings';

describe('SettingsStore', () => {
  it('returns defaults when no settings file exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-settings-'));
    const store = new SettingsStore(tmpDir);
    const s = store.loadSettings();
    expect(s.gameDir).toBe(path.join(tmpDir, 'minecraft'));
    expect(s.memoryMb).toBe(2048);
    expect(s.theme).toBeUndefined();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads valid settings from file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-settings-'));
    const store = new SettingsStore(tmpDir);
    store.saveSettings({ gameDir: '/custom/game', memoryMb: 4096, theme: 'eclipse', locale: 'en' });
    const s = store.loadSettings();
    expect(s.gameDir).toBe('/custom/game');
    expect(s.memoryMb).toBe(4096);
    expect(s.theme).toBe('eclipse');
    expect(s.locale).toBe('en');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ignores invalid memory values', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-settings-'));
    const store = new SettingsStore(tmpDir);
    store.saveSettings({ memoryMb: 100 } as any);
    expect(store.loadSettings().memoryMb).toBe(2048); // default
    store.saveSettings({ memoryMb: 64000 } as any);
    expect(store.loadSettings().memoryMb).toBe(2048); // default
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects dangerous JVM args', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-settings-'));
    const store = new SettingsStore(tmpDir);
    store.saveSettings({ jvmArgs: '-Xmx2G -XX:+FlightRecorder' } as any);
    expect(store.loadSettings().jvmArgs).toBeUndefined();
    store.saveSettings({ jvmArgs: '-Xmx2G -Dfile.encoding=UTF-8' } as any);
    expect(store.loadSettings().jvmArgs).toBe('-Xmx2G -Dfile.encoding=UTF-8');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects pre/post commands with shell metacharacters', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-settings-'));
    const store = new SettingsStore(tmpDir);
    store.saveSettings({ preCommand: 'echo hello; rm -rf /' } as any);
    expect(store.loadSettings().preCommand).toBeUndefined();
    store.saveSettings({ postCommand: 'echo hello' } as any);
    expect(store.loadSettings().postCommand).toBe('echo hello');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('limits pre/post command length', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-settings-'));
    const store = new SettingsStore(tmpDir);
    const longCmd = 'a'.repeat(1025);
    store.saveSettings({ preCommand: longCmd } as any);
    expect(store.loadSettings().preCommand).toBeUndefined();
    const okCmd = 'a'.repeat(1024);
    store.saveSettings({ preCommand: okCmd } as any);
    expect(store.loadSettings().preCommand).toBe(okCmd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ignores unknown locale values', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-settings-'));
    const store = new SettingsStore(tmpDir);
    store.saveSettings({ locale: 'fr' } as any);
    expect(store.loadSettings().locale).toBeUndefined();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('handles corrupted JSON gracefully', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-settings-'));
    fs.writeFileSync(path.join(tmpDir, 'settings.json'), 'not json {{{');
    const store = new SettingsStore(tmpDir);
    const s = store.loadSettings();
    expect(s.memoryMb).toBe(2048); // default
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saves and loads accounts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-settings-'));
    const store = new SettingsStore(tmpDir);
    const accounts = [
      { type: 'offline', name: 'Steve', uuid: 'abc-123' },
      { type: 'online', name: 'Alex', uuid: 'def-456', accessToken: 'secret' },
    ];
    store.saveAccounts(accounts as any);
    const loaded = store.loadAccounts();
    expect(loaded.length).toBe(2);
    expect(loaded[0].name).toBe('Steve');
    expect(loaded[1].accessToken).toBe('secret');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('handles missing accounts file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-settings-'));
    const store = new SettingsStore(tmpDir);
    expect(store.loadAccounts()).toEqual([]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('saves theme file alongside settings', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trel-test-settings-'));
    const store = new SettingsStore(tmpDir);
    store.saveSettings({ gameDir: '/tmp', memoryMb: 2048, theme: 'voxel' });
    const themeFile = path.join(tmpDir, '.theme');
    expect(fs.existsSync(themeFile)).toBe(true);
    expect(fs.readFileSync(themeFile, 'utf-8')).toBe('voxel');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
