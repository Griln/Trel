import React, { useEffect, useMemo, useState } from 'react';
import type { LauncherSettings, MinecraftAccount, VersionInfo } from '../../shared/types';
import type { InstalledVersionDetail, LoaderType } from '../../preload/preload';
import { IconTrash, IconArrow } from '../components/icons';
import { useDialog } from '../components/Dialog';
import { LoaderInstallDialog } from '../components/LoaderInstallDialog';
import { useT } from '../i18n';

interface Props {
  settings: LauncherSettings;
  account: MinecraftAccount | null;
  onSettingsChange: (s: LauncherSettings) => void;
  onGoToBrowse: () => void;
  gameRunning?: boolean;
}

const loaderLabel: Record<LoaderType, string> = {
  fabric: 'Fabric',
  quilt: 'Quilt',
  forge: 'Forge',
  neoforge: 'NeoForge',
};

export const InstalledPage: React.FC<Props> = ({ settings, account, onSettingsChange, onGoToBrowse, gameRunning = false }) => {
  const dialog = useDialog();
  const t = useT();

  const typeLabel: Record<string, string> = {
    release: t('installed.typeRelease'), snapshot: t('installed.typeSnapshot'), old_beta: 'beta', old_alpha: 'alpha', bedrock: 'Bedrock',
  };
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [details, setDetails] = useState<InstalledVersionDetail[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [loaderFor, setLoaderFor] = useState<string | null>(null);

  const cancelledRef = React.useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);
  const refresh = async () => {
    try {
      const list = await window.api.minecraft.installedDetailed();
      if (!cancelledRef.current) setDetails(list);
    } catch (e) {
      if (!cancelledRef.current) setStatus(t('installed.refreshError', { message: (e as Error).message }));
    }
  };

  useEffect(() => {
    let cancelled = false;
    window.api.minecraft.versions().then((v) => { if (!cancelled) setVersions(v); }).catch(() => {});
    refresh();
    return () => { cancelled = true; };
  }, []);

  // We hide the standalone vanilla version if at least one
  // loader is installed for the same base — it "absorbs" it under the name of the base MC version.
  const items = useMemo(() => {
    const moddedBases = new Set(details.filter((d) => d.edition === 'java' && d.loader).map((d) => d.baseMc));
    return details
      .filter((d) => d.edition === 'bedrock' || d.loader || !moddedBases.has(d.id))
      .map((d) => {
        const meta = d.edition === 'bedrock' ? undefined : versions.find((v) => v.id === d.baseMc);
        return {
          ...d,
          type: d.edition === 'bedrock' ? 'bedrock' : (meta?.type ?? 'unknown'),
          releaseTime: meta?.releaseTime,
          isLast: d.id === settings.lastVersionId && (settings.lastVersionEdition ? settings.lastVersionEdition === d.edition : true),
        };
      })
      .sort((a, b) => {
        const pa = (settings.pinnedVersions ?? []).includes(a.id) ? 0 : 1;
        const pb = (settings.pinnedVersions ?? []).includes(b.id) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        if (a.isLast && !b.isLast) return -1;
        if (!a.isLast && b.isLast) return 1;
        return (b.releaseTime || '').localeCompare(a.releaseTime || '');
      });
  }, [details, versions, settings.lastVersionId, settings.lastVersionEdition, settings.pinnedVersions]);

  const togglePin = (id: string) => {
    const pins = settings.pinnedVersions ?? [];
    onSettingsChange({ ...settings, pinnedVersions: pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id] });
  };

  const onPlay = async (it: InstalledVersionDetail) => {
    const id = it.id;
    if (!account) return;
    setBusyId(id);
    setStatus(t('installed.launchingStatus', { id }));
    try {
      onSettingsChange({ ...settings, lastVersionId: id, lastVersionEdition: it.edition });
      if (it.edition === 'bedrock') {
        await window.api.bedrock.launch(id, '');
      } else {
        await window.api.minecraft.launch({ versionId: id, account, memoryMb: settings.memoryMb });
      }
      setStatus(t('installed.runningStatus'));
    } catch (e) {
      setStatus(t('installed.errorStatus', { message: (e as Error).message }));
    } finally {
      // We clear busy right away: launch returns the PID on start, not when the game exits.
      setBusyId(null);
    }
  };

  const onUninstall = async (it: InstalledVersionDetail) => {
    const id = it.id;
    const choice = await dialog.show({
      title: t('installed.deleteTitle', { id }),
      tone: 'danger',
      message: t('installed.deleteMessage'),
      buttons: [
        { label: t('installed.deleteCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('installed.deleteVersionOnly'), value: 'shallow', variant: 'default' },
        { label: t('installed.deleteFull'), value: 'deep', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (choice === 'cancel') return;
    if (it.edition === 'bedrock') {
      await window.api.bedrock.uninstall(id);
    } else if (choice === 'deep') {
      await window.api.minecraft.uninstallDeep(id);
    } else {
      await window.api.minecraft.uninstall(id);
    }
    // If the currently “active” version was deleted — the home page must not show
    // it as the selected one. The backend has already reset it in settings.json, but the renderer
    // keeps a copy in memory — so we sync it explicitly.
    if (settings.lastVersionId === id) {
      onSettingsChange({ ...settings, lastVersionId: '', lastVersionEdition: undefined });
    }
    setStatus(t('installed.deletedStatus', { id }));
    refresh();
  };

  const onRevertToVanilla = async (baseMc: string) => {
    const choice = await dialog.show({
      title: t('installed.revertTitle', { baseMc }),
      tone: 'warn',
      message: t('installed.revertMessage', { loaders: baseMc }),
      buttons: [
        { label: t('installed.revertCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('installed.revertConfirm'), value: 'ok', variant: 'default' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (choice !== 'ok') return;
    const result = await window.api.minecraft.revertToVanilla(baseMc);
    setStatus(result.removed.length > 0
      ? t('installed.revertedLoaders', { list: result.removed.join(', ') })
      : t('installed.revertedNone'));
    // The backend updated lastVersionId on its own — we take it from the returned settings,
    // so that the UI and settings.json do not drift apart.
    if (result.settings) {
      onSettingsChange(result.settings);
    } else if (settings.lastVersionId && result.removed.includes(settings.lastVersionId)) {
      onSettingsChange({ ...settings, lastVersionId: baseMc, lastVersionEdition: 'java' });
    }
    refresh();
  };

  const onUninstallAll = async () => {
    if (details.length === 0) return;
    const choice = await dialog.show({
      title: t('installed.deleteAllTitle', { count: String(details.length) }),
      tone: 'danger',
      message: t('installed.deleteAllMessage'),
      buttons: [
        { label: t('installed.deleteAllCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('installed.deleteAllConfirm'), value: 'ok', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (choice !== 'ok') return;
    const ids = details.map((d) => d.id);
    const failed: string[] = [];
    for (const id of ids) {
      try { await window.api.minecraft.uninstall(id); } catch { failed.push(id); }
    }
    if (failed.length > 0) {
      await dialog.show({ title: t('installed.deleteAllTitle', { count: String(details.length) }), tone: 'warn',
        message: t('installed.deleteAllPartial', { count: failed.length, ids: failed.slice(0, 5).join(', ') }),
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' });
    }
    if (settings.lastVersionId && ids.includes(settings.lastVersionId)) {
      onSettingsChange({ ...settings, lastVersionId: '', lastVersionEdition: undefined });
    }
    setStatus(t('installed.deletedAllStatus', { count: String(ids.length) }));
    refresh();
  };

  // Version snapshots: a collapsible panel under the row.
  type Snap = { file: string; versionId: string; label: string; at: number; size: number };
  const [snapFor, setSnapFor] = useState<string | null>(null);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [snapBusy, setSnapBusy] = useState(false);
  const openSnaps = async (id: string) => {
    if (snapFor === id) { setSnapFor(null); return; }
    setSnapFor(id);
    try { setSnaps(await window.api.snapshots.list(id)); }
    catch { setSnaps([]); }
  };
  const makeSnap = async (id: string) => {
    setSnapBusy(true);
    try {
      await window.api.snapshots.create(id);
      setStatus(t('installed.snapCreated', { id }));
      if (snapFor === id) setSnaps(await window.api.snapshots.list(id));
    } catch (e) {
      setStatus(t('installed.snapFailed', { message: (e as Error).message }));
    } finally { setSnapBusy(false); }
  };
  const restoreSnap = async (id: string, file: string) => {
    const choice = await dialog.show({
      title: t('installed.snapRestoreTitle', { id }),
      tone: 'warn',
      message: t('installed.snapRestoreMsg'),
      buttons: [
        { label: t('installed.deleteCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('installed.snapRestoreAction'), value: 'ok', variant: 'default' },
      ],
      defaultIndex: 0, cancelValue: 'cancel',
    });
    if (choice !== 'ok') return;
    setSnapBusy(true);
    try {
      await window.api.snapshots.restore(file);
      setStatus(t('installed.snapRestored', { id }));
      refresh();
    } catch (e) {
      setStatus(t('installed.snapFailed', { message: (e as Error).message }));
    } finally { setSnapBusy(false); }
  };
  const deleteSnap = async (id: string, file: string) => {
    try {
      await window.api.snapshots.remove(file);
      setSnaps(await window.api.snapshots.list(id));
    } catch (e) {
      setStatus(t('installed.snapFailed', { message: (e as Error).message }));
    }
  };

  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">{t('installed.eyebrow')}</span>
        <h1 className="page-title">{t('installed.title')} <span className="count">{items.length}</span></h1>
        <p className="page-sub">{t('installed.subtitle')}</p>
      </div>

      {status && <div className="hint" style={{ marginBottom: 12 }}>{status}</div>}

      {items.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>{t('installed.emptyTitle')}</h2>
          <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
            {t('installed.emptyText')}
          </p>
          <button className="btn primary" onClick={onGoToBrowse}>
            {t('installed.openCatalog')} <IconArrow />
          </button>
        </div>
      ) : (
        <>
          <div className="sum-strip">
            <div className="sum-pill"><span className="num">{details.filter((d) => d.edition === 'java').length}</span><span className="lbl">Java</span></div>
            <div className="sum-pill"><span className="num">{details.filter((d) => d.edition === 'bedrock').length}</span><span className="lbl">Bedrock</span></div>
            <div className="sum-pill"><span className="num">{details.filter((d) => d.loader).length}</span><span className="lbl">{t('installed.withLoader')}</span></div>
            <div className="sum-pill" style={{ display: 'flex', alignItems: 'center' }}>
              <button className="btn ghost sm" onClick={onUninstallAll} disabled={busyId !== null}>
                <IconTrash /> {t('installed.deleteAll')}
              </button>
            </div>
          </div>

          <div className="ilist">
            {items.map((it) => {
              const showName = it.loader ? it.baseMc : it.id;
              return (
                <div key={it.id} className={'irow' + (it.isLast ? ' is-last' : '') + (it.loader ? ' modded' : '') + (it.edition === 'bedrock' ? ' bedrock' : '')}>
                  <div className="icube">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>
                  </div>
                  <div className="i-body">
                    <div className="i-top">
                      <span className="i-id">{showName}</span>
                      {(settings.pinnedVersions ?? []).includes(it.id) && <span className="chip">📌</span>}
                      {it.loader && <span className="chip amber">{loaderLabel[it.loader].toUpperCase()} {it.loaderVersion ?? ''}</span>}
                      <span className="chip green">{t('installed.releaseChip')}</span>
                    </div>
                    <div className="i-sub">
                      <span>{it.loader ? t('installed.withLoader') : typeLabel[it.type] ?? t('installed.typeRelease')}</span>
                      <span className="sep">·</span>
                      <span>{it.edition === 'bedrock' ? 'Bedrock' : 'Java'}</span>
                    </div>
                    {it.loader && (
                      <div className="revert-strip">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth={2}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
                        <span>{t('installed.revertHint', { baseMc: it.baseMc })}</span>
                        <button className="btn ghost sm" onClick={() => onRevertToVanilla(it.baseMc ?? it.id)}>{t('installed.revertToVanilla')}</button>
                      </div>
                    )}
                  </div>
                  <div className="i-actions">
                    <button className="btn primary" disabled={!account || busyId === it.id || !!(settings.lockOnLaunch && gameRunning)} onClick={() => onPlay(it)}>
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                      {busyId === it.id ? t('installed.btnLaunching') : t('installed.btnPlay')}
                    </button>
                    <button className="ibtn" title={(settings.pinnedVersions ?? []).includes(it.id) ? t('home.unpin') : t('home.pin')} onClick={() => togglePin(it.id)}>
                      {(settings.pinnedVersions ?? []).includes(it.id) ? '📌' : '📍'}
                    </button>
                    <button className="ibtn" title={t('installed.openFolder')} onClick={() => it.edition === 'bedrock' ? window.api.bedrock.openFolder(it.id) : window.api.minecraft.openFolder('version', it.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" /></svg>
                    </button>
                    <button className="ibtn" title={t('installed.exportPack')} onClick={async () => {
                      try {
                        const r = await window.api.snapshots.exportDialog(it.id);
                        if (r) setStatus(t('installed.exported', { file: r.file }));
                      } catch (e) { setStatus(t('installed.snapFailed', { message: (e as Error).message })); }
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                    </button>
                    <button className="ibtn" title={t('installed.snapshots')} onClick={() => openSnaps(it.id)} disabled={snapBusy}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                    </button>
                    <button className="ibtn del" title={t('installed.delete')} onClick={() => onUninstall(it)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
                    </button>
                  </div>
                  {snapFor === it.id && (
                    <div className="snap-panel">
                      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                        <button className="btn ghost sm" onClick={() => makeSnap(it.id)} disabled={snapBusy}>
                          {t('installed.snapCreate')}
                        </button>
                      </div>
                      {snaps.length === 0 && <div className="hint">{t('installed.snapEmpty')}</div>}
                      {snaps.map((sn) => (
                        <div key={sn.file} className="snap-row">
                          <span className="mono" style={{ fontSize: 12 }}>
                            {sn.label || new Date(sn.at).toLocaleString()} · {(sn.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                          <button className="btn ghost sm" onClick={() => restoreSnap(it.id, sn.file)} disabled={snapBusy}>
                            {t('installed.snapRestoreAction')}
                          </button>
                          <button className="btn ghost sm" onClick={() => deleteSnap(it.id, sn.file)} disabled={snapBusy}>
                            {t('installed.delete')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <LoaderInstallDialog
        mcVersion={loaderFor ?? ''}
        open={loaderFor !== null}
        onClose={() => setLoaderFor(null)}
        onInstalled={async (versionId) => {
          await refresh();
          setStatus(t('installed.installedStatus', { id: versionId }));
          onSettingsChange({ ...settings, lastVersionId: versionId, lastVersionEdition: 'java' });
        }}
      />
      <p className="note">* «Вернуть к ванили» удаляет мод-лоадер и оставляет чистую версию. Последняя запущенная версия отмечена зелёным.</p>
    </div>
  );
};

