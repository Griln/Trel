import React, { useEffect, useState, useCallback } from 'react';
import type { PlaytimeStatsEntry } from '../../preload/preload';
import { IconRefresh, IconSpark } from '../components/icons';
import { useT } from '../i18n';

function fmtDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}
const fmtDate = (ms: number) => ms ? new Date(ms).toLocaleString() : '—';

export const StatsPage: React.FC = () => {
  const t = useT();
  const [stats, setStats] = useState<PlaytimeStatsEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setStats(await window.api.stats.playtime()); }
    catch { setStats(null); }
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const maxDay = stats ? Math.max(1, ...stats.byDay.map((d) => d.ms)) : 1;
  const maxVer = stats && stats.byVersion.length ? Math.max(1, ...stats.byVersion.map((v) => v.totalMs)) : 1;
  const totalVerMs = stats ? Math.max(1, stats.byVersion.reduce((a, v) => a + v.totalMs, 0)) : 1;
  const donutColors = ['#6c8cff', '#46c6a0', '#e0a64b', '#d4738f', '#9b7ad4', '#5bb6d4', '#c87f5b', '#7fae54'];

  return (
    <div className="page stats-page">
      <div className="page-head">
        <div>
          <h1>{t('stats.title')}</h1>
          <p className="page-subtitle">{t('stats.subtitle')}</p>
        </div>
        <button className="btn ghost sm" onClick={refresh}><IconRefresh /> {t('stats.refresh')}</button>
      </div>

      {loading ? (
        <div className="empty p-24">{t('app.loading')}</div>
      ) : !stats || stats.totalSessions === 0 ? (
        <div className="empty p-24"><IconSpark /> {t('stats.empty')}</div>
      ) : (
        <>
          <div className="stats-cards">
            <div className="stat-card">
              <div className="stat-value">{fmtDuration(stats.totalMs)}</div>
              <div className="stat-label">{t('stats.totalTime')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.totalSessions}</div>
              <div className="stat-label">{t('stats.sessions')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.byVersion.length}</div>
              <div className="stat-label">{t('stats.versionsPlayed')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value sm">{fmtDate(stats.lastPlayed)}</div>
              <div className="stat-label">{t('stats.lastPlayed')}</div>
            </div>
          </div>

          <div className="stats-section">
            <h2>{t('stats.last14days')}</h2>
            <div className="day-chart">
              {stats.byDay.map((d) => (
                <div key={d.day} className="day-col" title={`${d.day}: ${fmtDuration(d.ms)}`}>
                  <div className="day-bar-wrap">
                    <div className="day-bar" style={{ height: `${Math.round((d.ms / maxDay) * 100)}%` }} />
                  </div>
                  <div className="day-label">{d.day.slice(8)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="stats-section">
            <h2>{t('stats.share')}</h2>
            <div className="donut-wrap">
              <svg className="donut" viewBox="0 0 140 140" width="160" height="160">
                <circle cx="70" cy="70" r="54" fill="none" stroke="var(--surface-3)" strokeWidth="16" />
                {(() => {
                  const r = 54; const c = 2 * Math.PI * r; let offset = 0;
                  return stats.byVersion.map((v, i) => {
                    const frac = v.totalMs / totalVerMs;
                    const seg = (
                      <circle key={v.versionId} cx="70" cy="70" r={r} fill="none"
                        stroke={donutColors[i % donutColors.length]} strokeWidth="16" strokeLinecap="butt"
                        strokeDasharray={`${frac * c} ${c}`} strokeDashoffset={-offset * c}
                        transform="rotate(-90 70 70)" />
                    );
                    offset += frac;
                    return seg;
                  });
                })()}
                <text x="70" y="66" textAnchor="middle" className="donut-center-num">{stats.byVersion.length}</text>
                <text x="70" y="84" textAnchor="middle" className="donut-center-lbl">{t('stats.versionsPlayed')}</text>
              </svg>
              <div className="donut-legend">
                {stats.byVersion.map((v, i) => (
                  <div key={v.versionId} className="donut-legend-row">
                    <span className="donut-dot" style={{ background: donutColors[i % donutColors.length] }} />
                    <span className="donut-legend-name">{v.versionId}</span>
                    <span className="donut-legend-pct">{Math.round((v.totalMs / totalVerMs) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="stats-section">
            <h2>{t('stats.byVersion')}</h2>
            <div className="ver-list">
              {stats.byVersion.map((v) => (
                <div key={v.versionId} className="ver-row">
                  <div className="ver-name">{v.versionId}</div>
                  <div className="ver-bar-wrap">
                    <div className="ver-bar" style={{ width: `${Math.round((v.totalMs / maxVer) * 100)}%` }} />
                  </div>
                  <div className="ver-time">{fmtDuration(v.totalMs)} · {v.sessions}×</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};