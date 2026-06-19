import { describe, it, expect } from 'vitest';
import { isUrlAllowed, getDynamicConcurrency, isLikelyValid } from './installer';
import { verifyDownloadSource, shouldVirusScan } from './download-security';

describe('isUrlAllowed', () => {
  it('allows Mojang and known hosts', () => {
    expect(isUrlAllowed('https://launchermeta.mojang.com/v1/version.json')).toBe(true);
    expect(isUrlAllowed('https://resources.download.minecraft.net/ab/cd1234.png')).toBe(true);
    expect(isUrlAllowed('https://s3.amazonaws.com/Minecraft.Download/launcher.jar')).toBe(true);
    expect(isUrlAllowed('https://bmclapi2.bangbang93.com/version/1.20.1')).toBe(true);
    expect(isUrlAllowed('https://mcpehub.org/engine/getfile.php?id=123')).toBe(true);
  });

  it('blocks unknown and http hosts', () => {
    expect(isUrlAllowed('http://evil.com/minecraft.jar')).toBe(false);
    expect(isUrlAllowed('http://mcpehub.org/file.apk')).toBe(false);
    expect(isUrlAllowed('https://unknown.example.com/file')).toBe(false);
    expect(isUrlAllowed('ftp://launchermeta.mojang.com/file')).toBe(false);
  });

  it('reports auto-confirmed trusted sources and unconfirmed unknown sources', () => {
    expect(verifyDownloadSource('https://piston-data.mojang.com/v1/objects/x/client.jar').allowed).toBe(true);
    const unknown = verifyDownloadSource('https://unknown.example.com/file.jar');
    expect(unknown.allowed).toBe(false);
    expect(unknown.reason).toContain('Источник не подтверждён');
  });

  it('marks executable archives and packages for virus scanning', () => {
    expect(shouldVirusScan('minecraft.jar')).toBe(true);
    expect(shouldVirusScan('minecraft.apk')).toBe(true);
    expect(shouldVirusScan('readme.txt')).toBe(false);
  });
});

describe('getDynamicConcurrency', () => {
  it('returns a number between 4 and 16', () => {
    const c = getDynamicConcurrency();
    expect(c).toBeGreaterThanOrEqual(4);
    expect(c).toBeLessThanOrEqual(16);
    expect(Number.isInteger(c)).toBe(true);
  });
});

describe('isLikelyValid', () => {
  it('returns false for non-existent files', () => {
    expect(isLikelyValid('/nonexistent/file.txt')).toBe(false);
  });

  it('returns false for directories', () => {
    expect(isLikelyValid(__dirname)).toBe(false);
  });

  it('returns true for existing files without expected size', () => {
    expect(isLikelyValid(__filename)).toBe(true);
  });

  it('returns true only when size matches expected', () => {
    const stat = require('node:fs').statSync(__filename);
    expect(isLikelyValid(__filename, stat.size)).toBe(true);
    expect(isLikelyValid(__filename, stat.size - 1)).toBe(false);
  });
});
