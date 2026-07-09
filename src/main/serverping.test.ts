import { describe, it, expect } from 'vitest';
import { encodeVarInt, decodeVarInt, splitAddress, extractMotd } from './serverping';

describe('varint', () => {
  it('round-trips small and large values', () => {
    for (const n of [0, 1, 127, 128, 255, 300, 25565, 2097151, 123456789]) {
      const buf = encodeVarInt(n);
      const { value, size } = decodeVarInt(buf, 0);
      expect(value).toBe(n);
      expect(size).toBe(buf.length);
    }
  });
  it('encodes 300 as two bytes 0xAC 0x02', () => {
    expect([...encodeVarInt(300)]).toEqual([0xac, 0x02]);
  });
  it('throws on out-of-bounds decode', () => {
    expect(() => decodeVarInt(Buffer.from([0x80]), 0)).toThrow();
  });
});

describe('splitAddress', () => {
  it('defaults to port 25565', () => {
    expect(splitAddress('mc.example.com')).toEqual({ host: 'mc.example.com', port: 25565 });
  });
  it('parses explicit port', () => {
    expect(splitAddress('1.2.3.4:25577')).toEqual({ host: '1.2.3.4', port: 25577 });
  });
  it('trims whitespace', () => {
    expect(splitAddress('  play.hypixel.net  ')).toEqual({ host: 'play.hypixel.net', port: 25565 });
  });
});

describe('extractMotd', () => {
  it('reads plain string', () => {
    expect(extractMotd('Hello')).toBe('Hello');
  });
  it('reads text + extra and strips color codes', () => {
    const desc = { text: '\u00a7aWelcome ', extra: [{ text: 'to ' }, { text: '\u00a7bServer' }] };
    expect(extractMotd(desc)).toBe('Welcome to Server');
  });
  it('handles empty/invalid', () => {
    expect(extractMotd(null)).toBe('');
    expect(extractMotd(42 as unknown)).toBe('');
  });
});
