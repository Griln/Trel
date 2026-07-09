import React, { useState, useEffect, useCallback } from 'react';
import type { ModpackSummary, ModpackVersion, ModpackProgress } from '../../preload/preload';

export const ModpacksPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ModpackSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ModpackSummary | null>(null);
  const [versions, setVersions] = useState<ModpackVersion[]>([]);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<ModpackProgress | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  useEffect(() => {
    const off = window.api.modpacks.onProgress((p) => setProgress(p));
    return () => { off(); };
  }, []);

  const search = useCallback(async () => {
    setLoading(true); setError(null); setSelected(null); setVersions([]); setDoneMsg(null);
    try {
      setResults(await window.api.modpacks.search(query.trim()));
    } catch (e) {
      setError('Не удалось загрузить модпаки: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { search(); /* первичная загрузка популярных */ }, []); // eslint-disable-line

  const openVersions = async (pack: ModpackSummary) => {
    setSelected(pack); setVersions([]); setError(null); setDoneMsg(null);
    try {
      const vs = await window.api.modpacks.versions(pack.projectId);
      setVersions(vs.filter((v) => v.fileUrl));
    } catch (e) {
      setError('Не удалось загрузить версии: ' + (e as Error).message);
    }
  };

  const install = async (v: ModpackVersion) => {
    setInstalling(true); setProgress(null); setDoneMsg(null); setError(null);
    try {
      const res = await window.api.modpacks.install(v);
      setDoneMsg('Установлено: ' + res.name + ' (' + res.mc + ', ' + res.loader + ', модов: ' + res.modCount + '). Версия «' + res.versionId + '» готова к запуску.');
    } catch (e) {
      setError('Ошибка установки: ' + (e as Error).message);
    } finally {
      setInstalling(false); setProgress(null);
    }
  };

  return (
    <div className="page modpacks-page">
      <div className="page-header">
        <h1>Модпаки</h1>
        <p className="page-subtitle">Поиск и установка сборок с Modrinth в один клик — лоадер и версия ставятся автоматически.</p>
      </div>

      <div className="modpacks-search">
        <input
          type="text"
          placeholder="Поиск модпаков (напр. Fabulously Optimized, All the Mods)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
        />
        <button className="btn-primary" onClick={search} disabled={loading}>{loading ? 'Поиск…' : 'Найти'}</button>
      </div>

      {error && <div className="modpacks-error">{error}</div>}
      {doneMsg && <div className="modpacks-done">{doneMsg}</div>}

      {installing && (
        <div className="modpacks-install-overlay">
          <div className="modpacks-install-card">
            <h3>Установка модпака…</h3>
            <div className="modpacks-progress-bar"><div style={{ width: (progress?.percent ?? 0) + '%' }} /></div>
            <p>{progress?.stage ?? 'Подготовка…'} {progress?.percent != null ? progress.percent + '%' : ''}</p>
          </div>
        </div>
      )}

      <div className="modpacks-grid">
        {results.map((p) => (
          <div key={p.projectId} className="modpack-card" onClick={() => openVersions(p)}>
            {p.iconUrl ? <img src={p.iconUrl} alt="" className="modpack-icon" /> : <div className="modpack-icon placeholder" />}
            <div className="modpack-info">
              <div className="modpack-title">{p.title}</div>
              <div className="modpack-author">от {p.author} · {p.downloads.toLocaleString()} загрузок</div>
              <div className="modpack-desc">{p.description}</div>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="modpacks-versions-overlay" onClick={() => setSelected(null)}>
          <div className="modpacks-versions-card" onClick={(e) => e.stopPropagation()}>
            <div className="modpacks-versions-head">
              <h2>{selected.title} — версии</h2>
              <button className="crash-doctor-close" onClick={() => setSelected(null)}>×</button>
            </div>
            {versions.length === 0 && <p>Загрузка версий…</p>}
            <div className="modpacks-versions-list">
              {versions.map((v) => (
                <div key={v.versionId} className="modpack-version-row">
                  <div>
                    <div className="mv-name">{v.name || v.versionNumber}</div>
                    <div className="mv-meta">MC {v.gameVersions.join(', ')} · {v.loaders.join(', ')}</div>
                  </div>
                  <button className="btn-primary" disabled={installing} onClick={() => install(v)}>Установить</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};