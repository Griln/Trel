import { describe, it, expect } from 'vitest';
import { analyzeCrash, knownSignatureIds } from './crashAnalyzer';

describe('crashAnalyzer', () => {
  it('clean exit returns null', () => {
    expect(analyzeCrash({ exitCode: 0, logTail: 'Stopping! Game ended normally.' })).toBeNull();
  });

  it('detects OutOfMemoryError', () => {
    const d = analyzeCrash({ exitCode: 1, logTail: 'Exception: java.lang.OutOfMemoryError: Java heap space' });
    expect(d?.id).toBe('out-of-memory');
    expect(d?.actions.some((a) => a.type === 'increase-memory')).toBe(true);
  });

  it('detects unsupported Java version', () => {
    const d = analyzeCrash({
      exitCode: 1,
      logTail: 'java.lang.UnsupportedClassVersionError: net/minecraft/Main has been compiled by a more recent version',
    });
    expect(d?.id).toBe('unsupported-java');
    expect(d?.actions.some((a) => a.type === 'switch-java')).toBe(true);
  });

  it('detects Forge missing dependencies', () => {
    const d = analyzeCrash({
      exitCode: 1,
      crashReport: "Missing or unsupported mandatory dependencies:\n  Mod ID: 'jei', Requested by: 'somemod'",
    });
    expect(d?.id).toBe('forge-missing-deps');
    expect(d?.culprit).toBe('jei');
  });

  it('detects Mixin failure', () => {
    const d = analyzeCrash({
      exitCode: 1,
      logTail: 'org.spongepowered.asm.mixin.injection.throwables.InjectionError: Mixin apply failed mixins.sodium.json',
    });
    expect(d?.id).toBe('mixin-failure');
  });

  it('detects GPU/OpenGL failure', () => {
    const d = analyzeCrash({ exitCode: 1, logTail: 'Failed to create window. GLFW error: Pixel format not accelerated' });
    expect(d?.id).toBe('gpu-driver');
  });

  it('detects native bridge / UnsatisfiedLinkError', () => {
    const d = analyzeCrash({ exitCode: 1, logTail: 'java.lang.UnsatisfiedLinkError: no lwjgl in java.library.path' });
    expect(d?.id).toBe('native-bridge');
  });

  it('detects duplicate mods', () => {
    const d = analyzeCrash({ exitCode: 1, logTail: "Found a duplicate mod 'sodium' at ..." });
    expect(d?.id).toBe('duplicate-mods');
    expect(d?.culprit).toBe('sodium');
  });

  it('falls back to unknown for unrecognised non-zero exit', () => {
    const d = analyzeCrash({ exitCode: 134, logTail: 'some random output with no known signature' });
    expect(d?.id).toBe('unknown');
    expect(d?.severity).toBe('warning');
  });

  it('exposes known signature ids', () => {
    expect(knownSignatureIds()).toContain('out-of-memory');
    expect(knownSignatureIds().length).toBeGreaterThan(5);
  });
});