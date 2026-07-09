import React, { useEffect, useMemo, useState } from 'react';
import type { WorldEntry, BackupEntry } from '../../preload/preload';
import { IconFolder, IconTrash, IconRefresh, IconArchive } from '../components/icons';
import { useDialog } from '../components/Dialog';
import { useT } from '../i18n';
export const WorldsPage: React.FC = () => {
  const t = useT();
  const dialog = useDialog();
  const [list, setList] = useState<WorldEntry[]>([]);
  const [icons, setIcons] = useState<Record<string, string | null>>({});
  const [allBackups, setAllBackups] = useState<BackupEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

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
    switch (m) { case 1: return 'snapshot'; case 2: return 'neutral'; case 3: return 'neutral'; default: return 'release'; }
  };

  function fmtSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' ' + t('size.b');
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' ' + t('size.kb');
    if (bytes < 1024 ** 3) return (bytes / (1024 * 1024)).toFixed(1) + ' ' + t('size.mb');
    return (bytes / (1024 ** 3)).toFixed(2) + ' ' + t('size.gb');
  }
  function fmtDate(ms: number): string {
    if (!ms) return '—';
    const locale = t.locale === 'en' ? 'en-US' : 'ru-RU';
    return new Date(ms).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  }

  const refresh = async () => {
    setLoading(true);
    try {
      const worlds = await window.api.worlds.list();
      setList(worlds);
      const iconEntries = await Promise.all(
        worlds.filter((w) => w.hasIcon).map(async (w) => [w.name, await window.api.worlds.icon(w.name)] as const),
      );
      setIcons(Object.fromEntries(iconEntries));
      try { setAllBackups(await window.api.worlds.listBackups()); } catch { setAllBackups([]); }
      setSelected((cur) => cur && worlds.some((w) => w.name === cur) ? cur : (worlds[0]?.name ?? null));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); return () => {}; }, []);

  const filtered = list.filter((w) =>
    !query || w.displayName.toLowerCase().includes(query.toLowerCase()) || w.name.toLowerCase().includes(query.toLowerCase()),
  );
  const worldBackups = (name: string) => allBackups.filter((b) => b.world === name);
  const current = useMemo(() => list.find((w) => w.name === selected) ?? null, [list, selected]);

  const onDelete = async (w: WorldEntry) => {
    const choice = await dialog.show({
      title: t('worlds.deleteTitle', { name: w.displayName }),
      tone: 'danger',
      message: (<>{t('worlds.deleteIrreversible')}<br /><b>{t('worlds.deleteFullDesc')}</b><br /><b>{t('worlds.deleteWorldOnlyDesc')}</b></>),
      buttons: [
        { label: t('worlds.deleteCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('worlds.deleteWorldOnly'), value: 'world', variant: 'default' },
        { label: t('worlds.deleteFull'), value: 'all', variant: 'danger' },
      ],
      defaultIndex: 0, cancelValue: 'cancel',
    });
    if (choice === 'cancel') return;
    if (choice === 'all') {
      const r = await window.api.worlds.deleteWithBackups(w.name);
      setStatus(r.backupsRemoved
        ? t('worlds.statusDeletedFull', { name: w.displayName, backups: String(r.backupsRemoved) })
        : t('worlds.statusDeletedFullNoBackups', { name: w.displayName }));
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
      try { setAllBackups(await window.api.worlds.listBackups()); } catch { /* */ }
    } catch (e) { setStatus(t('worlds.statusBackupError', { error: (e as Error).message })); }
  };

  const onRestore = async (b: BackupEntry) => {
    const choice = await dialog.show({
      title: t('worlds.restoreTitle', { name: b.world }),
      tone: 'info',
      message: t('worlds.restoreConfirm', { name: b.world }),
      buttons: [
        { label: t('worlds.deleteCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('worlds.restoreAction'), value: 'ok', variant: 'default' },
      ],
      defaultIndex: 1, cancelValue: 'cancel',
    });
    if (choice !== 'ok') return;
    setStatus(t('worlds.restoreProgress', { name: b.world }));
    try {
      const restored = await window.api.worlds.restore(b.file);
      setStatus(t('worlds.restoreDone', { name: restored }));
      refresh();
    } catch (e) { setStatus(t('worlds.restoreError', { error: (e as Error).message })); }
  };

  const totalSize = list.reduce((acc, w) => acc + w.sizeBytes, 0);

  return (
    <div className="worlds-page">
      <div className="page-head">
        <div>
          <h1>{t('worlds.title')}</h1>
          <p className="page-subtitle">{t('worlds.subtitle', { count: String(list.length), size: fmtSize(totalSize) })}</p>
        </div>
        <div className="row-gap">
          <button className="btn ghost sm" onClick={() => window.api.worlds.openFolder()}>
            <IconFolder /> {t('worlds.openSavesFolder')}
          </button>
          <button className="btn ghost sm" onClick={refresh} disabled={loading}>
            <IconRefresh /> {t('worlds.refresh')}
          </button>
        </div>
      </div>

      <input
        className="shots-search"
        placeholder={t('worlds.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {status && <div className="hint" style={{ marginBottom: 10 }}>{status}</div>}

      {loading ? (
        <div className="empty p-24">{t('worlds.loading')}</div>
      ) : list.length === 0 ? (
        <div className="empty p-24">{t('worlds.emptyNone')}</div>
      ) : (
        <div className="worlds-md">
          <div className="worlds-md-list">
            {filtered.length === 0 ? (
              <div className="empty">{t('worlds.emptySearch')}</div>
            ) : filtered.map((w) => {
              const hasBak = worldBackups(w.name).length > 0;
              return (
                <button
                  key={w.name}
                  className={'world-row' + (selected === w.name ? ' is-selected' : '')}
                  onClick={() => setSelected(w.name)}
                >
                  <div className="world-row-icon">
                    {icons[w.name] ? <img src={icons[w.name]!} alt="" />
                      : <div className="world-icon-placeholder">{w.displayName.charAt(0).toUpperCase()}</div>}
                  </div>
                  <div className="world-row-body">
                    <div className="world-row-title" title={w.displayName}>{w.displayName}</div>
                    <div className="world-row-meta">
                      <span className={'tag ' + modeTag(w.gameMode, w.hardcore)}>{modeLabel(w.gameMode, w.hardcore)}</span>
                      <span className="world-row-size">{fmtSize(w.sizeBytes)}</span>
                    </div>
                  </div>
                  <div className="world-row-badges">
                    {w.hardcore && <span className="wbadge danger">☠</span>}
                    {hasBak && <span className="wbadge">{t('worlds.hasBackup')}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="worlds-md-detail">
            {!current ? (
              <div className="empty p-24">{t('worlds.selectPrompt')}</div>
            ) : (
              <>
                <div className="wd-hero">
                  <div className="wd-hero-icon">
                    {icons[current.name] ? <img src={icons[current.name]!} alt="" />
                      : <div className="world-icon-placeholder lg">{current.displayName.charAt(0).toUpperCase()}</div>}
                  </div>
                  <div className="wd-hero-info">
                    <div className="wd-hero-title">{current.displayName}</div>
                    <div className="world-row-meta">
                      <span className={'tag ' + modeTag(current.gameMode, current.hardcore)}>{modeLabel(current.gameMode, current.hardcore)}</span>
                      {current.version && <span className="chip">{current.version}</span>}
                    </div>
                  </div>
                </div>

                <dl className="wd-stats">
                  <div><dt>{t('worlds.detailSize')}</dt><dd>{fmtSize(current.sizeBytes)}</dd></div>
                  <div><dt>{t('worlds.detailLastPlayed')}</dt><dd>{fmtDate(current.lastPlayed)}</dd></div>
                  <div><dt>{t('worlds.detailFolder')}</dt><dd className="mono">{current.name}</dd></div>
                </dl>

                <div className="wd-actions">
                  <button className="btn ghost sm" onClick={() => window.api.worlds.openFolder(current.name)}><IconFolder /> {t('worlds.openFolder')}</button>
                  <button className="btn ghost sm" onClick={() => onBackup(current)}><IconArchive /> {t('worlds.createBackup')}</button>
                  <button className="btn danger sm" onClick={() => onDelete(current)}><IconTrash /> {t('worlds.deleteWorld')}</button>
                </div>

                <div className="wd-backups">
                  <div className="wd-backups-head">{t('worlds.backupsTitle', { count: String(worldBackups(current.name).length) })}</div>
                  {worldBackups(current.name).length === 0 ? (
                    <div className="empty">{t('worlds.noWorldBackups')}</div>
                  ) : (
                    <div className="backups-list">
                      {worldBackups(current.name).map((b) => (
                        <div key={b.file} className="backup-row">
                          <div className="backup-info">
                            <div className="backup-sub mono">{b.name}</div>
                            <div className="backup-sub">{fmtDate(b.mtime)} · {fmtSize(b.size)}</div>
                          </div>
                          <button className="btn sm" onClick={() => onRestore(b)}><IconRefresh /> {t('worlds.restoreAction')}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
