import React, { useEffect, useMemo, useState } from 'react';
import type { WorldEntry, BackupEntry } from '../../preload/preload';
import { IconTrash, IconArchive } from '../components/icons';
import { useDialog } from '../components/Dialog';
import { useT } from '../i18n';
export const WorldsPage: React.FC = () => {
  const t = useT();
  const dialog = useDialog();
  const [list, setList] = useState<WorldEntry[]>([]);
  const [allBackups, setAllBackups] = useState<BackupEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
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
  const worldBackups = (name: string) => allBackups.filter((b) => b.world.toLowerCase() === name.toLowerCase());
  const current = useMemo(() => list.find((w) => w.name === selected) ?? null, [list, selected]);

  // Общий флаг операций: даблклик бэкапа/рестора поверх себя = потеря мира.
  const [opBusy, setOpBusy] = React.useState<string | null>(null);
  const [pubVersion, setPubVersion] = React.useState('');
  const publishWorld = async (w: WorldEntry) => {
    let versions: Array<{ id: string }> = [];
    try {
      const det = await window.api.minecraft.installedDetailed();
      versions = det.filter((d) => d.edition === 'java').map((d) => ({ id: d.baseMc || d.id }));
      versions = [...new Map(versions.map((v) => [v.id, v])).values()];
    } catch { /* ignore */ }
    if (versions.length === 0) {
      await dialog.show({ title: t('worlds.publishTitle'), tone: 'warn',
        message: t('worlds.publishNoVersions'),
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' });
      return;
    }
    setPubVersion(versions[0].id);
    const choice = await dialog.show({
      title: t('worlds.publishTitle', { name: w.displayName }),
      tone: 'info',
      message: (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="hint">{t('worlds.publishMsg')}</div>
          <select className="input" value={pubVersion || versions[0].id} onChange={(e) => setPubVersion(e.target.value)}>
            {versions.map((v) => <option key={v.id} value={v.id}>{v.id}</option>)}
          </select>
        </div>
      ),
      buttons: [
        { label: t('worlds.deleteCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('worlds.publishAction'), value: 'ok', variant: 'primary' },
      ],
      defaultIndex: 1, cancelValue: 'cancel',
    });
    if (choice !== 'ok') return;
    setOpBusy('publish:' + w.name);
    try {
      const r = await window.api.servers.publishWorld(w.name, pubVersion || versions[0].id);
      const addrs = r.addresses.map((a) => `${a.host}:${a.port}`).join(', ') || t('worlds.publishNoAddr');
      await dialog.show({ title: t('worlds.publishDone', { name: r.instance.name }), tone: 'info',
        message: (<div style={{ display: 'grid', gap: 8 }}><div>{t('worlds.publishAddr')}</div><div className="mono" style={{ wordBreak: 'break-all' }}>{addrs}</div></div>),
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' });
    } catch (e) {
      await dialog.show({ title: t('worlds.publishTitle'), tone: 'warn', message: (e as Error).message,
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' });
    } finally { setOpBusy(null); }
  };
  // WebDAV-синк сейвов: конфиг + последний статус.
  const [syncInfo, setSyncInfo] = React.useState<{ configured: boolean; url?: string; login?: string; lastSyncAt?: number; lastDirection?: string } | null>(null);
  const [syncBusy, setSyncBusy] = React.useState(false);
  const [davUrl, setDavUrl] = React.useState('');
  const [davLogin, setDavLogin] = React.useState('');
  const [davPass, setDavPass] = React.useState('');
  const refreshSync = async () => {
    try {
      const st = await window.api.webdav.status();
      setSyncInfo(st);
      if (st.url) setDavUrl(st.url);
      if (st.login) setDavLogin(st.login);
    } catch { /* ignore */ }
  };
  React.useEffect(() => { refreshSync(); }, []);
  const openSyncConfig = async () => {
    const choice = await dialog.show({
      title: t('worlds.syncTitle'),
      tone: 'info',
      message: (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="hint">{t('worlds.syncHint')}</div>
          <input className="input mono" placeholder="https://…" value={davUrl} onChange={(e) => setDavUrl(e.target.value)} />
          <input className="input" placeholder={t('worlds.syncLoginPh')} value={davLogin} onChange={(e) => setDavLogin(e.target.value)} />
          <input className="input" type="password" placeholder={t('worlds.syncPassPh')} value={davPass} onChange={(e) => setDavPass(e.target.value)} />
          <div className="hint">{t('worlds.syncPassHint')}</div>
        </div>
      ),
      buttons: [
        { label: t('worlds.deleteCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('worlds.syncSave'), value: 'save', variant: 'default' },
      ],
      defaultIndex: 1, cancelValue: 'cancel',
    });
    if (choice !== 'save') return;
    try {
      await window.api.webdav.configure(davUrl.trim(), davLogin.trim(), davPass);
      setDavPass('');
      await refreshSync();
    } catch (e) {
      await dialog.show({ title: t('worlds.syncTitle'), tone: 'warn', message: (e as Error).message,
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' });
    }
  };
  const doSync = async (dir: 'push' | 'pull') => {
    setSyncBusy(true);
    try {
      if (dir === 'push') {
        const r = await window.api.webdav.push();
        await dialog.show({ title: t('worlds.syncTitle'), tone: 'info',
          message: t('worlds.syncPushed', { file: r.file }),
          buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' });
      } else {
        const r = await window.api.webdav.pull();
        await dialog.show({ title: t('worlds.syncTitle'), tone: 'info',
          message: t('worlds.syncPulled', { file: r.file, worlds: r.worlds }),
          buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' });
        refresh();
      }
      await refreshSync();
    } catch (e) {
      await dialog.show({ title: t('worlds.syncTitle'), tone: 'warn', message: (e as Error).message,
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' });
    } finally { setSyncBusy(false); }
  };
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
    if (opBusy) return;
    setOpBusy('delete:' + w.name);
    try {
      if (choice === 'all') {
        await window.api.worlds.deleteWithBackups(w.name);
      } else {
        await window.api.worlds.delete(w.name);
      }
      refresh();
    } catch (e) {
      await dialog.show({ title: t('worlds.deleteTitle', { name: w.displayName }), tone: 'warn',
        message: (e as Error).message, buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }],
        defaultIndex: 0, cancelValue: 'ok' });
    } finally { setOpBusy(null); }
  };

  const onBackup = async (w: WorldEntry) => {
    if (opBusy) return;
    setOpBusy('backup:' + w.name);
    try {
      await window.api.worlds.backup(w.name);
      try { setAllBackups(await window.api.worlds.listBackups()); } catch { /* list refresh is best-effort */ }
    } catch (e) {
      // Тихий несозданный бэкап хуже ошибки: юзер удалит мир в ложном спокойствии.
      await dialog.show({ title: t('worlds.backupFailedTitle'), tone: 'warn',
        message: (e as Error).message, buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }],
        defaultIndex: 0, cancelValue: 'ok' });
    } finally { setOpBusy(null); }
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
    if (opBusy) return;
    setOpBusy('restore:' + b.file);
    try {
      await window.api.worlds.restore(b.file);
      refresh();
    } catch (e) {
      await dialog.show({ title: t('worlds.restoreTitle', { name: b.world }), tone: 'warn',
        message: (e as Error).message, buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }],
        defaultIndex: 0, cancelValue: 'ok' });
    } finally { setOpBusy(null); }
  };

  const totalSize = list.reduce((acc, w) => acc + w.sizeBytes, 0);

  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">{t('worlds.eyebrow')}</span>
        <div className="page-head-row">
          <div>
            <h1 className="page-title">{t('worlds.heading')} <span className="count">{list.length}</span></h1>
            <p className="page-sub">{t('worlds.sub', { count: list.length, size: fmtSize(totalSize), worlds: t.plural(list.length, t('plural.world.one'), t('plural.world.few'), t('plural.world.many')) })}</p>
          </div>
          <button className="btn ghost sm" onClick={() => window.api.worlds.openFolder()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></svg>
            {t('worlds.openSaves')}
          </button>
          {syncInfo && !syncInfo.configured && (
            <button className="btn ghost sm" onClick={openSyncConfig} disabled={syncBusy}>
              {t('worlds.syncSetup')}
            </button>
          )}
          {syncInfo?.configured && (
            <>
              <button className="btn ghost sm" onClick={() => doSync('push')} disabled={syncBusy} title={syncInfo.url}>
                ↑ {t('worlds.syncPush')}
              </button>
              <button className="btn ghost sm" onClick={() => doSync('pull')} disabled={syncBusy}>
                ↓ {t('worlds.syncPull')}
              </button>
              <button className="btn ghost sm" onClick={openSyncConfig} disabled={syncBusy} title={t('worlds.syncSetup')}>
                ⚙
              </button>
            </>
          )}
        </div>
      </div>

      <div className="search-wrap" style={{ maxWidth: 380, marginBottom: 20 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input className="input" placeholder={t('worlds.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {loading ? <div className="hint">{t('worlds.refresh')}</div> : (query.trim() && filtered.length === 0) ? <div className="empty"><h2>{t('worlds.noMatch')}</h2><p>{t('worlds.searchEmpty')}</p></div> : list.length === 0 ? <div className="empty"><h2>{t('worlds.title')}</h2><p>{t('worlds.empty')}</p></div> : filtered.length === 0 ? <div className="empty"><h2>{t('worlds.noMatch')}</h2></div> : <div className="w-layout">
        <div className="w-grid">{filtered.map((w) => <div key={w.name} className={'wcard' + (selected === w.name ? ' sel' : '')} onClick={() => setSelected(w.name)}><span className="block grass" /><span className="wmeta"><span className="wname">{w.displayName}</span><span className="wsub">{modeLabel(w.gameMode, w.hardcore)} · {fmtSize(w.sizeBytes)} · {fmtDate(w.lastPlayed)}</span></span><span className="wtag chip green">{modeLabel(w.gameMode, w.hardcore)}</span></div>)}</div>
        {current && <div className="detail"><div className="detail-hero"><span className="block grass" /></div><div className="detail-body"><h3>{current.displayName}</h3><div className="d-rows"><div className="d-row"><span>{t('worlds.mode')}</span><b>{modeLabel(current.gameMode, current.hardcore)}</b></div><div className="d-row"><span>{t('worlds.version')}</span><b>{current.version ?? '—'}</b></div><div className="d-row"><span>{t('worlds.size')}</span><b>{fmtSize(current.sizeBytes)}</b></div></div><div className="d-actions"><button className="btn ghost sm" onClick={() => publishWorld(current)} disabled={!!opBusy} title={t('worlds.publishHint')}>🌐 {t('worlds.publishAction')}</button><button className="btn ghost sm" onClick={() => onBackup(current)} disabled={!!opBusy}><IconArchive />{t('worlds.backup')}</button><button className="btn danger sm" onClick={() => onDelete(current)} disabled={!!opBusy}><IconTrash />{t('worlds.deleteAction')}</button></div><div className="bk-list">{worldBackups(current.name).map((backup) => <div key={backup.file} className="bk-row"><span className="bt">{fmtDate(backup.mtime)} · {fmtSize(backup.size)}</span><button onClick={() => onRestore(backup)} disabled={!!opBusy}>{t('worlds.restoreAction')}</button></div>)}</div></div></div>}
      </div>}
      <p className="note">* удаление переспрашивает: «только мир» или «мир + все бэкапы». Восстановление отодвигает текущий мир в .bak, ничего не теряя.</p>
    </div>
  );
};
