import React, { useEffect, useState, useCallback } from 'react';
import type { SavedServerEntry, PingResultEntry } from '../../preload/preload';
import { IconRefresh, IconGlobe, IconServer } from '../components/icons';
import { useT } from '../i18n';

interface Row extends SavedServerEntry { result?: PingResultEntry; pinging?: boolean; }

export const ServerMonitorPage: React.FC = () => {
  const t = useT();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const pingAll = useCallback(async (servers: Row[]) => {
    await Promise.all(servers.map(async (srv, i) => {
      setRows((prev) => prev.map((r, j) => j === i ? { ...r, pinging: true } : r));
      try {
        const result = await window.api.serverPing.ping(srv.ip);
        setRows((prev) => prev.map((r, j) => j === i ? { ...r, result, pinging: false } : r));
      } catch {
        setRows((prev) => prev.map((r, j) => j === i ? { ...r, result: { online: false, error: 'error' }, pinging: false } : r));
      }
    }));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    let saved: SavedServerEntry[] = [];
    try { saved = await window.api.serverPing.saved(); } catch { saved = []; }
    const initial: Row[] = saved.map((s) => ({ ...s }));
    setRows(initial);
    setLoading(false);
    pingAll(initial);
  }, [pingAll]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="page monitor-page">
      <div className="page-head">
        <div>
          <h1>{t('monitor.title')}</h1>
          <p className="page-subtitle">{t('monitor.subtitle')}</p>
        </div>
        <button className="btn ghost sm" onClick={refresh}><IconRefresh /> {t('monitor.refresh')}</button>
      </div>

      {loading ? (
        <div className="empty p-24">{t('app.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="empty p-24"><IconServer /> {t('monitor.empty')}</div>
      ) : (
        <div className="monitor-list">
          {rows.map((r, i) => {
            const online = r.result?.online;
            const status = r.pinging ? 'pinging' : online ? 'online' : r.result ? 'offline' : 'pending';
            return (
              <div key={r.ip + i} className={`monitor-card status-${status}`}>
                {r.result?.favicon
                  ? <img className="monitor-icon" src={r.result.favicon} alt="" />
                  : <div className="monitor-icon placeholder"><IconGlobe /></div>}
                <div className="monitor-info">
                  <div className="monitor-name">{r.name}</div>
                  <div className="monitor-ip mono">{r.ip}</div>
                  {online && r.result?.motd && <div className="monitor-motd">{r.result.motd}</div>}
                </div>
                <div className="monitor-stat">
                  <span className={`dot dot-${status}`} />
                  {r.pinging ? (
                    <span className="monitor-sub">{t('monitor.pinging')}</span>
                  ) : online ? (
                    <>
                      <span className="monitor-players">{r.result?.players?.online ?? 0}/{r.result?.players?.max ?? 0}</span>
                      <span className="monitor-sub">{r.result?.version || ''} · {r.result?.latencyMs ?? '?'} ms</span>
                    </>
                  ) : (
                    <span className="monitor-sub">{t('monitor.offline')}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};