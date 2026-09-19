import React, { useEffect, useState, useCallback } from 'react';
import type { PlaytimeStatsEntry } from '../../preload/preload';
import { IconRefresh, IconSpark } from '../components/icons';
import { useT } from '../i18n';

function fmtDuration(ms: number, t: ReturnType<typeof useT>): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return t('stats.minutes', { count: m });
  return t('stats.hoursMinutes', { hours: h, minutes: m });
}
const fmtDate = (ms: number, locale: string) => ms ? new Date(ms).toLocaleString(locale) : '—';

export const StatsPage: React.FC = () => {
  const t = useT();
  const [stats, setStats] = useState<PlaytimeStatsEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try { setStats(await window.api.stats.playtime()); }
    catch (e) { setStats(null); setLoadError((e as Error).message); }
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const maxDay = stats ? Math.max(1, ...stats.byDay.map((d) => d.ms)) : 1;
  const maxVer = stats && stats.byVersion.length ? Math.max(1, ...stats.byVersion.map((v) => v.totalMs)) : 1;
  const totalVerMs = stats ? Math.max(1, stats.byVersion.reduce((a, v) => a + v.totalMs, 0)) : 1;
  const donutColors = ['#5ecb6f', '#4aedd9', '#f5a83c', '#9b7ad4', '#6c8cff', '#d4738f', '#c87f5b', '#7fae54'];

  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">{t('stats.title')}</span>
        <div className="page-head-row">
          <div>
            <h1 className="page-title">{t('stats.playtimeTitle')}</h1>
            <p className="page-sub">{t('stats.subtitle')}</p>
          </div>
          <button className="btn ghost sm" onClick={refresh}><IconRefresh /> {t('stats.refresh')}</button>
        </div>
      </div>

      {loading ? (
        <div className="empty p-24">{t('app.loading')}</div>
      ) : loadError ? (
        <div className="empty p-24"><IconSpark /> {t('stats.loadError', { message: loadError })}</div>
      ) : !stats || stats.totalSessions === 0 ? (
        <div className="empty p-24"><IconSpark /> {t('stats.empty')}</div>
      ) : (
        <>
          <div className="st-cards">
            <div className="stc"><div className="num"><em>{fmtDuration(stats.totalMs, t)}</em></div><div className="lbl">{t('stats.totalTime')}</div><span className="bg-ico">⏱</span></div>
            <div className="stc"><div className="num">{stats.totalSessions}</div><div className="lbl">{t('stats.sessions')}</div><span className="bg-ico">🎮</span></div>
            <div className="stc"><div className="num">{stats.byVersion.length}</div><div className="lbl">{t('stats.versionsPlayed')}</div><span className="bg-ico">🧊</span></div>
            <div className="stc"><div className="num" style={{ fontSize: 19, paddingTop: 8 }}>{fmtDate(stats.lastPlayed, t.locale)}</div><div className="lbl">{t('stats.lastPlayed')}</div><span className="bg-ico">🕘</span></div>
          </div>

          <div className="chart-card">
            <h3>{t('stats.last14days')}</h3>
            <div className="day-chart">
              {stats.byDay.map((d) => (
                <div key={d.day} className="dcol">
                  <div className="dbar-wrap">
                    <div className="dbar" style={{ height: `${Math.round((d.ms / maxDay) * 100)}%` }} data-v={fmtDuration(d.ms, t)} />
                  </div>
                  <span className="dlbl">{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="split">
            <div className="chart-card" style={{ marginBottom: 0 }}>
              <h3>{t('stats.share')}</h3>
              <div className="donut-wrap">
                <svg className="donut" viewBox="0 0 140 140" width="190" height="190">
                  <circle cx="70" cy="70" r="54" fill="none" stroke="var(--surface-4)" strokeWidth="16" />
                  {stats.byVersion.map((v, i) => {
                    const frac = v.totalMs / totalVerMs;
                    const c = 2 * Math.PI * 54;
                    const seg = frac * c;
                    return <circle key={v.versionId} cx="70" cy="70" r="54" fill="none" stroke={donutColors[i % donutColors.length]} strokeWidth="16" strokeDasharray={`${seg} ${c}`} strokeDashoffset={`-${i * seg}`} transform="rotate(-90 70 70)" />;
                  })}
                  <text x="70" y="66" textAnchor="middle" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 26, fill: 'var(--fg-bright)' }}>{stats.byVersion.length}</text>
                  <text x="70" y="86" textAnchor="middle" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: 1.5, fill: 'var(--fg-subtle)' }}>{t('stats.versionsLabel')}</text>
                </svg>
              </div>
              <div className="legend">
                {stats.byVersion.map((v, i) => (
                  <div key={v.versionId} className="lrow"><i style={{ background: donutColors[i % donutColors.length] }} />
                    <span className="nm">{v.versionId}</span><span className="pc">{Math.round((v.totalMs / totalVerMs) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card" style={{ marginBottom: 0 }}>
              <h3>{t('stats.byVersion')}</h3>
              <div className="ver-rows">
                {stats.byVersion.map((v) => (
                  <div key={v.versionId} className="vrow3">
                    <span className="vn">{v.versionId}</span>
                    <div className="barw"><i style={{ width: `${Math.round((v.totalMs / maxVer) * 100)}%`, background: donutColors[stats.byVersion.indexOf(v) % donutColors.length] }} /></div>
                    <span className="tm">{fmtDuration(v.totalMs, t)} · {v.sessions}×</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};