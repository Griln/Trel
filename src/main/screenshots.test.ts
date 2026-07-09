import { describe, it, expect } from 'vitest';
import { collectShots } from './screenshots';

describe('collectShots', () => {
  it('filters non-images and sorts by mtime desc', () => {
    const read = (dir: string) => {
      if (dir === '/g/screenshots') return [
        { name: 'a.png', mtime: 100, size: 10 },
        { name: 'notes.txt', mtime: 999, size: 5 },
        { name: 'b.jpg', mtime: 300, size: 20 },
      ];
      if (dir === '/g/versions/1.20/screenshots') return [
        { name: 'c.jpeg', mtime: 200, size: 30 },
      ];
      throw new Error('nope');
    };
    const shots = collectShots([
      { dir: '/g/screenshots', source: 'global' },
      { dir: '/g/versions/1.20/screenshots', source: '1.20' },
      { dir: '/g/missing', source: 'x' },
    ], read);
    expect(shots.map((s) => s.name)).toEqual(['b.jpg', 'c.jpeg', 'a.png']);
    expect(shots[0].source).toBe('global');
    expect(shots[1].source).toBe('1.20');
  });

  it('returns empty when no roots have images', () => {
    const shots = collectShots([{ dir: '/x', source: 'global' }], () => [{ name: 'r.txt', mtime: 1, size: 1 }]);
    expect(shots).toEqual([]);
  });
});
