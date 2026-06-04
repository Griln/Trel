import { describe, it, expect } from 'vitest';
import { isUrlAllowed, getDynamicConcurrency, isLikelyValid } from './installer';

describe('isUrlAllowed', () => {
  it('allows Mojang and known hosts', () => {
    expect(isUrlAllowed('https://launchermeta.mojang.com/v1/version.json')).toBe(true);
    expect(isUrlAllowed('https://resources.download.minecraft.net/ab/cd1234.png')).toBe(true);
    expect(isUrlAllowed('https://s3.amazonaws.com/Minecraft.Download/launcher.jar')).toBe(true);
    expect(isUrlAllowed('https://bmclapi2.bangbang93.com/version/1.20.1')).toBe(true);
  });

  it('blocks unknown and http hosts', () => {
    expect(isUrlAllowed('http://evil.com/minecraft.jar')).toBe(false);
    expect(isUrlAllowed('https://unknown.example.com/file')).toBe(false);
    expect(isUrlAllowed('ftp://launchermeta.mojang.com/file')).toBe(false);
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
