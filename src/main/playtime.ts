import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PlaySession {
  versionId: string;
  start: number;   // epoch ms
  end: number;     // epoch ms
  durationMs: number;
}

export interface VersionStat {
  versionId: string;
  totalMs: number;
  sessions: number;
  lastPlayed: number; // epoch ms, 0 if none
}

export interface PlaytimeStats {
  totalMs: number;
  totalSessions: number;
  lastPlayed: number;
  byVersion: VersionStat[];
  byDay: { day: string; ms: number }[]; // last 14 days, oldest→newest
}

/**
 * Pure aggregation of raw sessions into stats. No I/O — fully unit-testable.
 * @param now epoch ms used as "today" anchor for the 14-day chart.
 */
export function aggregateStats(sessions: PlaySession[], now: number = Date.now()): PlaytimeStats {
  const byVerMap = new Map<string, VersionStat>();
  let totalMs = 0;
  let lastPlayed = 0;
  for (const s of sessions) {
    if (!s || typeof s.durationMs !== 'number' || s.durationMs <= 0) continue;
    totalMs += s.durationMs;
    if (s.end > lastPlayed) lastPlayed = s.end;
    const v = byVerMap.get(s.versionId) ?? { versionId: s.versionId, totalMs: 0, sessions: 0, lastPlayed: 0 };
    v.totalMs += s.durationMs;
    v.sessions += 1;
    if (s.end > v.lastPlayed) v.lastPlayed = s.end;
    byVerMap.set(s.versionId, v);
  }
  const byVersion = [...byVerMap.values()].sort((a, b) => b.totalMs - a.totalMs);

  // last 14 days buckets
  const DAY = 86400000;
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const days: { day: string; ms: number }[] = [];
  const dayIndex = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayMs - i * DAY);
    const key = d.toISOString().slice(0, 10);
    dayIndex.set(key, days.length);
    days.push({ day: key, ms: 0 });
  }
  for (const s of sessions) {
    if (!s || s.durationMs <= 0) continue;
    const key = new Date(s.end).toISOString().slice(0, 10);
    const idx = dayIndex.get(key);
    if (idx !== undefined) days[idx].ms += s.durationMs;
  }

  return {
    totalMs,
    totalSessions: sessions.filter((s) => s && s.durationMs > 0).length,
    lastPlayed,
    byVersion,
    byDay: days,
  };
}

/**
 * Persists play sessions to <launcherDir>/playtime.json and tracks open sessions
 * in memory. Hooked into MinecraftService launch/exit.
 */
export class PlaytimeService {
  private file: string;
  private open = new Map<string, number>(); // versionId → start ms
  private refs = new Map<string, number>(); // versionId → running instances
  // cap stored sessions to avoid unbounded growth
  private static MAX = 5000;

  constructor(launcherDir: string) {
    this.file = path.join(launcherDir, 'playtime.json');
  }

  private read(): PlaySession[] {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
      if (!Array.isArray(raw?.sessions)) return [];
      // Schema: broken records are dropped one by one, not the whole file at once.
      return raw.sessions.filter((x: unknown): x is PlaySession =>
        !!x && typeof x === 'object'
        && Number.isFinite((x as PlaySession).start) && Number.isFinite((x as PlaySession).end)
        && typeof (x as PlaySession).versionId === 'string');
    } catch {
      return [];
    }
  }

  private write(sessions: PlaySession[]) {
    try {
      const trimmed = sessions.slice(-PlaytimeService.MAX);
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      // Atomic: a crash in the middle of a write no longer leaves an empty json.
      const tmp = this.file + '.trel_tmp';
      fs.writeFileSync(tmp, JSON.stringify({ sessions: trimmed }));
      try { fs.renameSync(tmp, this.file); }
      catch { fs.copyFileSync(tmp, this.file); try { fs.unlinkSync(tmp); } catch {} }
    } catch (e) {
      console.warn('playtime write failed:', e);
    }
  }

  /** Record the moment a version starts running. */
  recordStart(versionId: string) {
    if (!versionId) return;
    // Instance counter: two windows of the same version give one shared session
    // from the first start to the last exit, not two fragmented ones.
    this.refs.set(versionId, (this.refs.get(versionId) ?? 0) + 1);
    if (!this.open.has(versionId)) this.open.set(versionId, Date.now());
  }

  /** Record exit; computes duration and appends a session. Ignores <30s noise. */
  recordEnd(versionId: string) {
    const start = this.open.get(versionId);
    if (!start) return;
    const left = (this.refs.get(versionId) ?? 1) - 1;
    if (left > 0) {
      this.refs.set(versionId, left);
      return; // there are still live windows — the session continues
    }
    this.refs.delete(versionId);
    this.open.delete(versionId);
    const end = Date.now();
    const durationMs = end - start;
    if (durationMs < 30_000) return; // ignore crashes / instant exits
    const sessions = this.read();
    sessions.push({ versionId, start, end, durationMs });
    this.write(sessions);
  }

  getStats(): PlaytimeStats {
    return aggregateStats(this.read());
  }
}
