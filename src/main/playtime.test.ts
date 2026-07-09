import { describe, it, expect } from 'vitest';
import { aggregateStats, type PlaySession } from './playtime';

const H = 3600000;
const D = 86400000;

describe('aggregateStats', () => {
  it('returns zeros for empty input', () => {
    const s = aggregateStats([], Date.UTC(2026, 0, 15));
    expect(s.totalMs).toBe(0);
    expect(s.totalSessions).toBe(0);
    expect(s.lastPlayed).toBe(0);
    expect(s.byVersion).toEqual([]);
    expect(s.byDay).toHaveLength(14);
  });

  it('aggregates total and per-version, sorted by playtime desc', () => {
    const now = Date.UTC(2026, 0, 15);
    const sessions: PlaySession[] = [
      { versionId: '1.20.1', start: now - 2 * H, end: now - 1 * H, durationMs: 1 * H },
      { versionId: '1.20.1', start: now - 5 * H, end: now - 3 * H, durationMs: 2 * H },
      { versionId: '1.8.9', start: now - 10 * H, end: now - 9 * H, durationMs: 1 * H },
    ];
    const s = aggregateStats(sessions, now);
    expect(s.totalMs).toBe(4 * H);
    expect(s.totalSessions).toBe(3);
    expect(s.byVersion[0].versionId).toBe('1.20.1');
    expect(s.byVersion[0].totalMs).toBe(3 * H);
    expect(s.byVersion[0].sessions).toBe(2);
    expect(s.byVersion[1].versionId).toBe('1.8.9');
  });

  it('ignores invalid/zero-duration sessions', () => {
    const now = Date.UTC(2026, 0, 15);
    const sessions = [
      { versionId: 'x', start: 0, end: 0, durationMs: 0 },
      { versionId: 'x', start: now - H, end: now, durationMs: H },
    ] as PlaySession[];
    const s = aggregateStats(sessions, now);
    expect(s.totalSessions).toBe(1);
    expect(s.totalMs).toBe(H);
  });

  it('buckets sessions into the correct day of the 14-day window', () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0);
    const twoDaysAgo = Date.UTC(2026, 0, 13, 10, 0, 0);
    const sessions: PlaySession[] = [
      { versionId: 'a', start: twoDaysAgo - H, end: twoDaysAgo, durationMs: H },
    ];
    const s = aggregateStats(sessions, now);
    const bucket = s.byDay.find((d) => d.day === '2026-01-13');
    expect(bucket?.ms).toBe(H);
    // total across buckets equals the session
    expect(s.byDay.reduce((a, b) => a + b.ms, 0)).toBe(H);
  });

  it('tracks lastPlayed as the max end time', () => {
    const now = Date.UTC(2026, 0, 15);
    const sessions: PlaySession[] = [
      { versionId: 'a', start: now - 3 * D, end: now - 3 * D + H, durationMs: H },
      { versionId: 'b', start: now - 1 * D, end: now - 1 * D + H, durationMs: H },
    ];
    const s = aggregateStats(sessions, now);
    expect(s.lastPlayed).toBe(now - 1 * D + H);
  });
});
