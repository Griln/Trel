import { describe, it, expect } from 'vitest';
import { isLegacyVersion, LEGACY_VERSIONS } from './legacy-versions';

describe('isLegacyVersion', () => {
  it('returns true for known legacy ids', () => {
    for (const v of LEGACY_VERSIONS) {
      expect(isLegacyVersion(v.id)).toBe(true);
    }
  });

  it('returns false for modern version ids', () => {
    expect(isLegacyVersion('1.20.1')).toBe(false);
    expect(isLegacyVersion('1.19.4-forge-45.0.1')).toBe(false);
    expect(isLegacyVersion('23w14a')).toBe(false);
  });

  it('returns false for empty or special strings', () => {
    expect(isLegacyVersion('')).toBe(false);
    expect(isLegacyVersion('latest')).toBe(false);
    expect(isLegacyVersion('release')).toBe(false);
  });
});
