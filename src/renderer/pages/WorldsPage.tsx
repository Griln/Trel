import React, { useEffect, useState } from 'react';
import type { WorldEntry } from '../../preload/preload';
import { IconFolder, IconTrash, IconRefresh, IconArchive } from '../components/icons';
import { useDialog } from '../components/Dialog';
import { useT } from '../i18n';

export const WorldsPage: React.FC = () => {
  const t = useT();
  const dialog = useDialog();
  const [list, setList] = useState<WorldEntry[]>([]);
  const [icons, setIcons] = useState<Record<string, string | null>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const modeLabel = (m: number | undefined, hardcore: boolean | undefined) => {
    if (hardcore) return t('worlds.modeHardcore');
    switch (m) {
      case 0: return t('worlds.modeSurvival');
      case 1: return t('worlds.modeCreative');
      case 2: return t('worlds.modeAdventure');
      case 3: return t('worlds.modeSpectator');
      default: return t('worlds.modeFallback');
    }
  };

  const modeTag = (m: number | undefined, hardcore: boolean | undefined) => {
    if (hardcore) return 'old_alpha';
    switch (m) {
      case 1: return 'snapshot';
      case 2: return 'neutral';
      case 3: return 'neutral';
      default: return 'release';
    }
  };

  function fmtSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' ' + t('size.b');
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' ' + t('size.kb');
    if (bytes < 1024 ** 3) return (bytes / (1024 * 1024)).toFixed(1) + ' ' + t('size.mb');
    return (bytes / (1024 ** 3)).toFixed(2) + ' ' + t('size.gb');
  }

  function fmtDate(ms: number): string {
    if (!ms) return '—';
    const d = new Date(ms);
    const locale = t.locale === 'en' ? 'en-US' : 'ru-RU';
    return d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  }

  const refresh = async () => {
    setLoading(true);
    try {
      const worlds = await window.api.worlds.list();
      setList(worlds);
      // fetch icons lazily
      const iconEntries = await Promise.all(
        worlds.filter((w) => w.hasIcon).map(async (w) => [w.name, await window.api.worlds.icon(w.name)] as const)
      );
      setIcons(Object.fromEntries(iconEntries));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    
    refresh().then(() => {
      // refresh sets state internally
    });
    return () => {};
  }, []);

  const filtered = list.filter((w) =>
    !query || w.displayName.toLowerCase().includes(query.toLowerCase()) || w.name.toLowerCase().includes(query.toLowerCase()),
  );

  const onDelete = async (w: WorldEntry) => {
    const choice = await dialog.show({
      title: t('worlds.deleteTitle', { name: w.displayName }),
      tone: 'danger',
      message: (
        <>
          {t('worlds.deleteIrreversible')}
          <br />
          <b>{t('worlds.deleteFullDesc')}</b>
          <br />
          <b>{t('worlds.deleteWorldOnlyDesc')}</b>
        </>
      ),
      buttons: [
        { label: t('worlds.deleteCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('worlds.deleteWorldOnly'), value: 'world', variant: 'default' },
        { label: t('worlds.deleteFull'), value: 'all', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });

    if (choice === 'cancel') return;

    if (choice === 'all') {
      const r = await window.api.worlds.deleteWithBackups(w.name);
      setStatus(
        r.backupsRemoved
          ? t('worlds.statusDeletedFull', { name: w.displayName, backups: String(r.backupsRemoved) })
          : t('worlds.statusDeletedFullNoBackups', { name: w.displayName }),
      );
    } else {
      const ok = await window.api.worlds.delete(w.name);
      if (ok) setStatus(t('worlds.statusDeletedWorld', { name: w.displayName }));
    }
    refresh();
  };

  const onBackup = async (w: WorldEntry) => {
    setStatus(t('worlds.statusBackupProgress', { name: w.displayName }));
    try {
      const out = await window.api.worlds.backup(w.name);
      setStatus(t('worlds.statusBackupDone', { path: out }));
    } catch (e) {
      setStatus(t('worlds.statusBackupError', { error: (e as Error).message }));
    }
  };

  const totalSize = list.reduce((acc, w) => acc + w.sizeBytes, 0);

  return (
    <div>
      <div className="page-head">
        <h1>{t('worlds.title')}</h1>
        <p>{t('worlds.subtitle', { count: String(list.length), size: fmtSize(totalSize) })}</p>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="row" style={{ flex: 1, gap: 8 }}>
            <input
              className="input"
              placeholder={t('worlds.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, maxWidth: 320 }}
            />
            <button className="btn ghost sm" onClick={refresh} disabled={loading}>
              <IconRefresh /> {t('worlds.refresh')}
            </button>
          </div>
          <button className="btn ghost sm" onClick={() => window.api.worlds.openFolder()}>
            <IconFolder /> {t('worlds.openSavesFolder')}
          </button>
        </div>

        {status && (
          <div className="hint" style={{ marginBottom: 10 }}>{status}</div>
        )}

        {loading ? (
          <div className="empty">{t('worlds.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            {list.length === 0
              ? t('worlds.emptyNone')
              : t('worlds.emptySearch')}
          </div>
        ) : (
          <div className="world-grid">
            {filtered.map((w) => (
              <div key={w.name} className="world-card">
                <div className="world-icon">
                  {icons[w.name] ? (
                    <img src={icons[w.name]!} alt="" />
                  ) : (
                    <div className="world-icon-placeholder">{w.displayName.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <div className="world-body">
                  <div className="world-title" title={w.displayName}>{w.displayName}</div>
                  <div className="world-meta">
                    <span className={'tag ' + modeTag(w.gameMode, w.hardcore)}>{modeLabel(w.gameMode, w.hardcore)}</span>
                    {w.version && <span className="chip">{w.version}</span>}
                    <span className="chip">{fmtSize(w.sizeBytes)}</span>
                  </div>
                  <div className="world-sub mono" title={w.name}>{w.name}</div>
                  <div className="world-sub">{t('worlds.lastPlayed', { date: fmtDate(w.lastPlayed) })}</div>
                </div>
                <div className="world-actions">
                  <button
                    className="icon-btn"
                    onClick={() => window.api.worlds.openFolder(w.name)}
                    title={t('worlds.openFolder')}
                  ><IconFolder /></button>
                  <button
                    className="icon-btn"
                    onClick={() => onBackup(w)}
                    title={t('worlds.createBackup')}
                  ><IconArchive /></button>
                  <button
                    className="icon-btn"
                    onClick={() => onDelete(w)}
                    title={t('worlds.deleteWorld')}
                  ><IconTrash /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
