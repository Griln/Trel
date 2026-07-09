import { describe, it, expect } from 'vitest';
import { isSafeVersionId, assertSafeVersionId, assertSafeWorldName, isInsideDir } from './safeIds';

describe('safeIds', () => {
  describe('isSafeVersionId', () => {
    it('accepts valid version IDs', () => {
      expect(isSafeVersionId('1.20.1')).toBe(true);
      expect(isSafeVersionId('fabric-loader-0.16.0-1.20.1')).toBe(true);
      expect(isSafeVersionId('rd-131655')).toBe(true);
    });

    it('rejects path traversal', () => {
      expect(isSafeVersionId('../foo')).toBe(false);
      expect(isSafeVersionId('foo/../../bar')).toBe(false);
    });

    it('rejects null bytes', () => {
      expect(isSafeVersionId('foo\0bar')).toBe(false);
    });

    it('rejects absolute paths', () => {
      expect(isSafeVersionId('/etc/passwd')).toBe(false);
      expect(isSafeVersionId('C:\\Windows')).toBe(false);
    });
  });

  describe('assertSafeVersionId', () => {
    it('does not throw for safe IDs', () => {
      expect(() => assertSafeVersionId('1.20.1')).not.toThrow();
    });

    it('throws for unsafe IDs', () => {
      expect(() => assertSafeVersionId('../foo')).toThrow();
    });
  });

  describe('assertSafeWorldName', () => {
    it('accepts normal world names', () => {
      expect(() => assertSafeWorldName('MyWorld')).not.toThrow();
    });

    it('rejects traversal in world names', () => {
      expect(() => assertSafeWorldName('../../../etc')).toThrow();
    });
  });
});
