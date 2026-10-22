import React, { useState, useEffect, useCallback } from 'react';
import type { ModpackSummary, ModpackVersion, ModpackProgress } from '../../preload/preload';
import { useT } from '../i18n';

export const ModpacksPage: React.FC = () => {
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ModpackSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ModpackSummary | null>(null);
  const [versions, setVersions] = useState<ModpackVersion[]>([]);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<ModpackProgress | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'versions' | 'install'>('list');

  useEffect(() => {
    const off = window.api.modpacks.onProgress((p) => setProgress(p));
    return () => { off(); };
  }, []);

  const search = useCallback(async () => {
    setLoading(true); setError(null); setSelected(null); setVersions([]); setDoneMsg(null); setView('list');
    try {
      setResults(await window.api.modpacks.search(query.trim()));
    } catch (e) {
      setError(t('modpacks.loadError', { message: (e as Error).message }));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { search(); /* initial load of the popular ones */ }, []); // eslint-disable-line

  const openVersions = async (pack: ModpackSummary) => {
    setSelected(pack); setVersions([]); setView('versions'); setError(null); setDoneMsg(null);
    try {
      const vs = await window.api.modpacks.versions(pack.projectId);
      setVersions(vs.filter((v) => v.fileUrl));
    } catch (e) {
      setError(t('modpacks.versionsError', { message: (e as Error).message }));
    }
  };

  const install = async (v: ModpackVersion) => {
    setInstalling(true); setView('install'); setProgress(null); setDoneMsg(null); setError(null);
    try {
      const res = await window.api.modpacks.install(v);
      setDoneMsg(t('modpacks.installed', { name: res.name, mc: res.mc, loader: res.loader, count: res.modCount, version: res.versionId }));
    } catch (e) {
      setError(t('modpacks.installError', { message: (e as Error).message }));
    } finally {
      setInstalling(false); setProgress(null); setView('versions');
    }
  };

  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">Modrinth</span>
        <h1 className="page-title">{t('modpacks.title')}</h1>
        <p className="page-sub">{t('modpacks.subtitle')}</p>
      </div>

      {view === 'list' && <section className="pane show" id="list">
        <div className="mp-search">
          <div className="search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input className="input" placeholder={t('modpacks.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} />
          </div>
          <button className="btn primary" onClick={search} disabled={loading}>{loading ? t('modpacks.searching') : t('modpacks.search')}</button>
        </div>

        {error && <div className="hint" style={{ color: 'var(--danger)' }}>{error}</div>}
        {doneMsg && <div className="hint" style={{ color: 'var(--green)' }}>{doneMsg}</div>}

        {installing && (
          <div className="imp-progress" style={{ maxWidth: 520, margin: '30px auto 0' }}>
            <div className="inst-ico">📦</div>
            <h3>{t('modpacks.installing')}</h3>
            <div className="inst-stage">{progress?.stage ?? t('modpacks.preparing')} {progress?.percent != null ? progress.percent + '%' : ''}</div>
            <div className="progress"><div style={{ width: `${Math.min(100, Math.max(0, progress?.percent ?? 0))}%` }} /></div>
          </div>
        )}

        <div className="mp-grid">
          {results.map((p) => (
            <div key={p.projectId} className="mpcard" onClick={() => openVersions(p)}>
              <div className="mp-ico">
                {p.iconUrl ? <img src={p.iconUrl} alt="" /> : '⚡'}
              </div>
              <div className="mp-body">
                <div className="mp-title">{p.title}</div>
                <div className="mp-meta">{t('modpacks.meta', { author: p.author, downloads: p.downloads.toLocaleString() })}</div>
                <div className="mp-desc">{p.description}</div>
                {p.categories.length > 0 && <div className="mp-tags">
                  {p.categories.slice(0, 3).map((category) => <span key={category} className="chip">{category}</span>)}
                </div>}
              </div>
            </div>
          ))}
        </div>
      </section>}

      {view === 'versions' && selected && (
        <section className="pane" id="versions">
          <div className="card" style={{ maxWidth: 640 }}>
            <div className="card-head">
              <h4>{t('modpacks.versionsTitle', { title: selected.title })}</h4>
              <button className="btn ghost sm" onClick={() => setView('list')}>← {t('modpacks.back')}</button>
            </div>
            <div className="vrows">
              {versions.map((v) => (
                <div key={v.versionId} className="vrow2">
                  <div className="vn"><b>{v.name || v.versionNumber}</b><span>MC {v.gameVersions.join(', ')} · {v.loaders.join(', ')}</span></div>
                  {v.versionId === versions[0]?.versionId && <span className="chip green">{t('modpacks.latest')}</span>}
                  <button className="btn primary sm" onClick={() => install(v)} disabled={installing}>{t('modpacks.install')}</button>
                </div>
              ))}
            </div>
            <div className="hint">{t('modpacks.installHint')}</div>
          </div>
        </section>
      )}
      {view === 'install' && <section className="pane show"><div className="imp-progress"><h3>{t('modpacks.installing')}</h3><div className="inst-stage">{progress?.stage ?? t('modpacks.preparing')}</div><div className="progress"><div style={{ width: `${Math.min(100, Math.max(0, progress?.percent ?? 0))}%` }} /></div></div></section>}
      <p className="note">{t('modpacks.note')}</p>
    </div>
  );
};