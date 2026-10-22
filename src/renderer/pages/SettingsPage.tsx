import React, { useEffect, useState } from 'react';
import type { LauncherSettings, ThemeId } from '../../shared/types';
import { PERF_PRESETS } from '../../shared/constants';
import type { JavaInstallInfo, UpdaterState } from '../../preload/preload';
import { IconRefresh, IconFolder } from '../components/icons';
import { useDialog } from '../components/Dialog';
import { useT } from '../i18n';

interface ThemeOption {
  id: ThemeId;
  name: string;
  descKey: string;
  swatches: string[];
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'mono',
    name: 'Mono',
    descKey: 'settings.monoDesc',
    swatches: ['#0a0a0a', '#131313', '#ffffff'],
  },
  {
    id: 'eclipse',
    name: 'Eclipse',
    descKey: 'settings.eclipseDesc',
    swatches: ['#f4f5f8', '#ffffff', '#1a1a1a'],
  },
  {
    id: 'voxel',
    name: 'Voxel',
    descKey: 'settings.voxelDesc',
    swatches: ['#0d1612', '#50c878', '#ffd93d'],
  },
];

const LOCALE_OPTIONS: { id: NonNullable<LauncherSettings['locale']>; label: string }[] = [
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
];

/** A settings row like in the preview: a heading + a caption on the left, a toggle on the right. */
const SetToggle: React.FC<{
  title: string;
  sub?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}> = ({ title, sub, checked, disabled, onChange }) => (
  <div className="set-row">
    <div className="info">
      <b>{title}</b>
      {sub ? <span>{sub}</span> : null}
    </div>
    <label className="toggle">
      <input type="checkbox" disabled={disabled} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  </div>
);

interface Props {
  settings: LauncherSettings;
  onChange: (s: LauncherSettings) => void;
}

export const SettingsPage: React.FC<Props> = ({ settings, onChange }) => {
  const dlg = useDialog();
  const t = useT();

  const updaterDot = (status: UpdaterState['status']): string => {
    switch (status) {
      case 'up-to-date':
      case 'downloaded': return 'ok';
      case 'error': return 'err';
      case 'disabled': return 'off';
      default: return 'warn';
    }
  };

  const onPresetInfo = () => {
    dlg.show({
      title: t('settings.presetInfoTitle'),
      tone: 'info',
      message: t('settings.presetInfoBody'),
      buttons: [{ label: t('settings.presetInfoOk'), value: 'ok', variant: 'default' }],
      defaultIndex: 0,
      cancelValue: 'ok',
    });
  };
  // TrelEmu pack — Windows-only, on Linux/macOS we hide the “Reset TrelEmu” section.
  const isWin = window.api.platform === 'win32';
  type DiskEntry = { name: string; bytes: number; files: number };
  const fmtSize = (b: number): string => {
    const dec = (v: number, frac: number) => v.toFixed(frac).replace('.', t.locale === 'ru' ? ',' : '.');
    if (b < 1024) return b + ' ' + t('size.b');
    if (b < 1024 * 1024) return dec(b / 1024, 1) + ' ' + t('size.kb');
    if (b < 1024 ** 3) return dec(b / (1024 * 1024), 1) + ' ' + t('size.mb');
    return dec(b / (1024 ** 3), 2) + ' ' + t('size.gb');
  };
  const StorageTab: React.FC<{ t: (k: string, p?: Record<string, string | number>) => string }> = ({ t }) => {
    const [usage, setUsage] = React.useState<{ entries: DiskEntry[]; total: number; freeBytes: number | null } | null>(null);
    const [cleaning, setCleaning] = React.useState<string | null>(null);
    const [lastClean, setLastClean] = React.useState<string | null>(null);
    const load = async () => {
      try { setUsage(await window.api.importer.diskUsage()); } catch { /* ignore */ }
    };
    React.useEffect(() => { load(); }, []);
    const clean = async (target: 'logs' | 'tmp') => {
      setCleaning(target);
      try {
        const r = await window.api.importer.clean(target);
        setLastClean(t('settings.cleaned', { files: r.removedFiles, size: fmtSize(r.freedBytes) }));
        await load();
      } catch (e) { setLastClean((e as Error).message); }
      finally { setCleaning(null); }
    };
    const max = Math.max(1, ...(usage?.entries.map((e) => e.bytes) ?? [1]));
    return (
      <div className="sets-grid settings-grid stagger">
        <div className="card">
          <div className="card-head"><h4>{t('settings.storageTitle')}</h4>
            <button className="btn ghost sm" onClick={load}><IconRefresh />{t('settings.storageRefresh')}</button>
          </div>
          {!usage ? <p className="hint">{t('app.loading')}</p> : (
            <>
              <div className="hint" style={{ margin: '0 0 12px' }}>{t('settings.storageTotal', { size: fmtSize(usage.total) })}{usage.freeBytes != null && ` · ${t('settings.storageFree', { size: fmtSize(usage.freeBytes) })}`}</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {usage.entries.map((e) => (
                  <div key={e.name} className="disk-row">
                    <span className="mono">{e.name}</span>
                    <div className="disk-bar"><i style={{ width: `${Math.min(100, (e.bytes / max) * 100)}%` }} /></div>
                    <span className="hint" style={{ margin: 0 }}>{fmtSize(e.bytes)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h4>{t('settings.cleanTitle')}</h4></div>
          <div className="grow">
            <ul className="clean-list">
              <li className="safe">{t('settings.cleanSafeLogs')}</li>
              <li className="safe">{t('settings.cleanSafeTmp')}</li>
              <li className="keep">{t('settings.cleanKeep')}</li>
            </ul>
          </div>
          <div className="actions">
            <button className="btn ghost sm" onClick={() => clean('logs')} disabled={!!cleaning}>{cleaning === 'logs' ? t('settings.cleaning') : t('settings.cleanLogs')}</button>
            <button className="btn ghost sm" onClick={() => clean('tmp')} disabled={!!cleaning}>{cleaning === 'tmp' ? t('settings.cleaning') : t('settings.cleanTmp')}</button>
          </div>
          {lastClean && <p className="hint" style={{ marginTop: 8 }}>{lastClean}</p>}
        </div>
      </div>
    );
  };
  type SettingsTab = 'general' | 'game' | 'storage' | 'danger';
  const [tab, setTab] = useState<SettingsTab>('general');
  const [local, setLocal] = useState<LauncherSettings>(settings);
  const [proxyMsg, setProxyMsg] = useState<string | null>(null);
  const [javaList, setJavaList] = useState<JavaInstallInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [updater, setUpdater] = useState<UpdaterState | null>(null);
  const [shortcutExists, setShortcutExists] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveStatus, setMoveStatus] = useState('');
  const [emuResetting, setEmuResetting] = useState(false);
  const [autolaunchEnabled, setAutolaunchEnabled] = useState(false);
  const [autolaunchUnavailable, setAutolaunchUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.api.java.list().then((v) => { if (!cancelled) setJavaList(v); }).catch((e) => console.warn('[settings] java list failed', e));
    window.api.updater.state().then((v) => { if (!cancelled) setUpdater(v); }).catch((e) => console.warn('[settings] updater state failed', e));
    window.api.settings.desktopShortcutExists().then((v) => { if (!cancelled) setShortcutExists(v); }).catch((e) => console.warn('[settings] shortcut check failed', e));
    // Autostart: we pull the state from the OS (file/shortcut/LoginItems).
    window.api.settings.autoLaunchGet().then((v) => {
      if (cancelled) return;
      setAutolaunchEnabled(!!v.enabled);
      setAutolaunchUnavailable(!!v.unavailable);
    }).catch((e) => console.warn('[settings] autoLaunchGet failed', e));
    const off = window.api.updater.onState((v) => { if (!cancelled) setUpdater(v); });
    return () => { cancelled = true; off(); };
  }, []);

  // The onboarding tour may ask for a specific tab (the “Themes” step always
  // works on “General”), so that the highlight does not land off target.
  useEffect(() => {
    const onSetTab = (e: Event) => {
      const next = (e as CustomEvent<unknown>).detail;
      if (next === 'general' || next === 'game' || next === 'storage' || next === 'danger') setTab(next);
    };
    window.addEventListener('trel:set-settings-tab', onSetTab);
    return () => window.removeEventListener('trel:set-settings-tab', onSetTab);
  }, []);

  const apply = (next: Partial<LauncherSettings>) => {
    const merged: LauncherSettings = { ...local, ...next };
    if (merged.javaPath === '' || merged.javaPath === undefined) {
      delete (merged as any).javaPath;
    }
    setLocal(merged);
    onChange(merged);
  };

  const pickDir = async () => {
    const dir = await window.api.settings.pickDir();
    if (!dir || dir === local.gameDir) return;
    const choice = await dlg.show({
      title: t('settings.moveGameDirTitle'),
      tone: 'info',
      message: (
        <div style={{ display: 'grid', gap: 10 }}>
          <div>{t('settings.moveGameDirMsg')}</div>
          <div className="mono text-xs opacity-75">
            <div>{local.gameDir}</div>
            <div style={{ margin: '4px 0' }}>→</div>
            <div>{dir}</div>
          </div>
        </div>
      ),
      buttons: [
        { label: t('settings.importCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('settings.moveConfirm'), value: 'move', variant: 'primary' },
      ],
      defaultIndex: 1,
      cancelValue: 'cancel',
    });
    if (choice !== 'move') return;
    setMoving(true);
    setMoveStatus(t('settings.moving'));
    try {
      const result = await window.api.settings.moveGameDir(local.gameDir, dir);
      if (result.errors.length > 0) {
        setMoveStatus(t('settings.moveErrors', { count: result.errors.length }));
        await new Promise(r => setTimeout(r, 2000));
      }
      apply({ gameDir: dir });
    } catch (e) {
      setMoveStatus(t('settings.moveFailed'));
      await new Promise(r => setTimeout(r, 2000));
    } finally {
      setMoving(false);
      setMoveStatus('');
    }
  };

  const rescan = async () => {
    setScanning(true);
    try {
      const list = await window.api.java.scan();
      setJavaList(list);
    } finally {
      setScanning(false);
    }
  };

  const gbRaw = (local.memoryMb / 1024).toFixed(1);
  const gb = gbRaw.replace('.', t.locale === 'ru' ? ',' : '.');

  const updateLabel = (s: UpdaterState): string => {
    switch (s.status) {
      case 'checking': return t('settings.checking');
      case 'available': return t('settings.available', { version: s.latest! });
      case 'downloading': return t('settings.downloading', { percent: s.percent ?? 0 });
      case 'downloaded': return t('settings.downloaded') + `: v${s.latest}`;
      case 'up-to-date': return t('settings.upToDate');
      case 'error': return t('settings.updateError') + ': ' + (s.error ?? '');
      case 'disabled': return '';
      default: return '—';
    }
  };


  const onResetLauncher = async () => {
    // Step 1: choice between cleanup options
    const step1 = await dlg.show({
      title: t('settings.resetTitle'),
      tone: 'danger',
      message: t('settings.resetMessage'),
      buttons: [
        { label: t('settings.resetCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('settings.resetKeep'), value: 'keep', variant: 'default' },
        { label: t('settings.resetWipe'), value: 'wipe', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (step1 === 'cancel') return;

    // Step 2: final confirmation
    const step2 = await dlg.show({
      title: step1 === 'wipe' ? t('settings.resetConfirmWipeTitle') : t('settings.resetConfirmTitle'),
      tone: 'danger',
      message: step1 === 'wipe'
        ? t('settings.resetConfirmWipeMsg')
        : t('settings.resetConfirmKeepMsg'),
      buttons: [
        { label: t('settings.resetCancel'), value: 'cancel', variant: 'ghost' },
        { label: step1 === 'wipe' ? t('settings.resetConfirmWipeBtn') : t('settings.resetConfirmKeepBtn'),
          value: 'go', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (step2 !== 'go') return;

    await window.api.reset.perform({ keepUserData: step1 === 'keep' });
    window.api.reset.restart();
  };

  const onResetEmu = async () => {
    const choice = await dlg.show({
      title: t('settings.emuResetTitle'),
      tone: 'danger',
      message: (
        <div style={{ display: 'grid', gap: 10 }}>
          <div>{t('settings.emuResetMsg')}</div>
          <div className="hint">{t('settings.emuResetHint')}</div>
        </div>
      ),
      buttons: [
        { label: t('settings.resetCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('settings.emuResetAction'), value: 'reset', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (choice !== 'reset') return;
    setEmuResetting(true);
    try {
      const result = await window.api.emu.reset();
      await dlg.show({
        title: result.ok ? t('settings.emuResetDone') : t('settings.emuResetFailed'),
        tone: result.ok ? 'info' : 'warn',
        message: result.ok
          ? (result.removed.length > 0 ? t('settings.emuRemoved', { count: result.removed.length }) : t('settings.emuNothing'))
          : result.errors.join(', '),
        buttons: [{ label: 'OK', value: 'ok', variant: 'default' }],
        defaultIndex: 0,
        cancelValue: 'ok',
      });
    } catch (e) {
      await dlg.show({
        title: 'Не удалось сбросить TrelEmu',
        tone: 'warn',
        message: (e as Error).message,
        buttons: [{ label: 'OK', value: 'ok', variant: 'default' }],
        defaultIndex: 0,
        cancelValue: 'ok',
      });
    } finally {
      setEmuResetting(false);
    }
  };

  const onUninstallLauncher = async () => {
    const step1 = await dlg.show({
      title: t('settings.uninstallTitle'),
      tone: 'danger',
      message: t('settings.uninstallMessage'),
      buttons: [
        { label: t('settings.uninstallCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('settings.uninstallKeep'), value: 'keep', variant: 'default' },
        { label: t('settings.uninstallWipe'), value: 'wipe', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (step1 === 'cancel') return;

    const step2 = await dlg.show({
      title: t('settings.uninstallConfirmTitle'),
      tone: 'danger',
      message: step1 === 'wipe'
        ? t('settings.uninstallConfirmWipeMsg')
        : t('settings.uninstallConfirmKeepMsg'),
      buttons: [
        { label: t('settings.uninstallCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('settings.uninstallConfirmBtn'), value: 'go', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (step2 !== 'go') return;

    const result = await window.api.reset.uninstallLauncher(step1 === 'keep');
    if (!result.ok) {
      await dlg.show({
        title: t('settings.uninstallErrorTitle'),
        tone: 'warn',
        message: result.reason || t('settings.uninstallErrorMsg'),
        buttons: [{ label: 'OK', value: 'ok', variant: 'default' }],
        defaultIndex: 0,
        cancelValue: 'ok',
      });
    }
  };

  return (
    <div className="page-frame">
      <div className="page-head">
        <span className="eyebrow">{t('settings.title')}</span>
        <div className="page-head-row">
          <div>
            <h1 className="page-title">{t('settings.title')}</h1>
            <p className="page-sub">{t('settings.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="tabs" data-tabs style={{ marginBottom: 24 }}>
        {(['general', 'game', 'storage', 'danger'] as const).map((id) => (
          <button
            key={id}
            className={`tab${tab === id ? ' on' : ''}`}
            data-target={id}
            onClick={() => setTab(id)}
          >
            {id === 'general' ? t('settings.tabGeneral') : id === 'game' ? t('settings.tabGame') : id === 'storage' ? t('settings.tabStorage') : t('settings.tabDanger')}
          </button>
        ))}
      </div>

      {tab === 'general' && (<div className="sets-grid settings-grid stagger">
      <div className="card span2">
        <div className="card-head">
          <h4>{t('settings.themeTitle')}</h4>
        </div>
        <div className="themes">
          {THEME_OPTIONS.map((theme) => {
            const active = (local.theme ?? 'mono') === theme.id;
            return (
              <button
                key={theme.id}
                className={'theme-card' + (active ? ' on active' : '')}
                onClick={() => apply({ theme: theme.id })}
              >
                <div className="swatches">
                  {theme.swatches.map((c, i) => (
                    <i
                      key={i}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <b>{theme.name}</b>
                <span>{t(theme.descKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h4>{t('settings.languageTitle')}</h4>
        </div>
        <div className="lang-grid">
          {LOCALE_OPTIONS.map((o) => (
            <button
              key={o.id}
              className={`btn ghost sm${(local.locale ?? 'ru') === o.id ? ' on' : ''}`}
              onClick={() => apply({ locale: o.id })}
            >
              {o.label}
            </button>
          ))}
        </div>
        <SetToggle
          title={t('settings.showIntro')}
          sub={t('settings.showIntroSub')}
          checked={local.showIntro ?? true}
          onChange={(v) => apply({ showIntro: v })}
        />
        <SetToggle
          title={t('settings.autoHideSidebar')}
          sub={t('settings.autoHideSidebarSub')}
          checked={local.autoHideSidebar !== false}
          onChange={(v) => apply({ autoHideSidebar: v })}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h4>{t('settings.systemTitle')}</h4>
        </div>
        <SetToggle
          title={t('settings.autoLaunchTitle')}
          sub={autolaunchUnavailable
            ? t('settings.autoLaunchUnavailable')
            : (autolaunchEnabled ? t('settings.autoLaunchOn') : t('settings.autoLaunchOff'))}
          disabled={autolaunchUnavailable}
          checked={autolaunchEnabled}
          onChange={async (target) => {
            const r = await window.api.settings.autoLaunchSet(target);
            if (r.ok) { setAutolaunchEnabled(target); setAutolaunchUnavailable(!!r.unavailable); }
            else { setAutolaunchUnavailable(!!r.unavailable); }
          }}
        />
        <div className="set-row">
          <div className="info">
            <b>{t('settings.desktopShortcut')}</b>
            <span>{shortcutExists ? t('settings.shortcutInstalled') : t('settings.shortcutNotInstalled')}</span>
          </div>
          <button className="btn ghost sm" onClick={async () => {
            const exists = await window.api.settings.desktopShortcutExists();
            if (exists) {
              await window.api.settings.removeDesktopShortcut();
              setShortcutExists(false);
            } else {
              await window.api.settings.createDesktopShortcut();
              setShortcutExists(true);
            }
          }}>
            {shortcutExists ? t('settings.shortcutRemove') : t('settings.shortcutAdd')}
          </button>
        </div>
      </div>

      {updater && (
      <div className="card">
        <div className="card-head">
          <h4>{t('settings.updateTitle')}</h4>
          <span className="chip mono">v{updater.current}</span>
        </div>
        <div className="grow">
          <div className="status-line">
            <span className={`sdot ${updaterDot(updater.status)}`} />
            <span className="hint" style={{ margin: 0 }}>
              {updateLabel(updater)}
              {updater.isPortableHint && (
                <span className="chip warn" style={{ marginLeft: 8 }}>Portable</span>
              )}
            </span>
          </div>
          <div className="hint">{updater.isPortableHint ? t('settings.portableHint') : t('settings.updateHint')}</div>
        </div>
        <div className="actions">
          <button
            className="btn ghost sm"
            onClick={() => window.api.updater.check()}
            disabled={updater.status === 'checking' || updater.status === 'downloading'}
          >
            <IconRefresh /> {t('settings.checkUpdate')}
          </button>
          {updater?.status === 'available' && (
            <button className="btn primary sm" onClick={() => window.api.updater.download()}>
              {t('settings.downloadUpdate')}
            </button>
          )}
          {updater?.status === 'downloaded' && (
            <button className="btn primary sm" onClick={() => window.api.updater.install()}>
              {updater.isPortableHint ? t('settings.showInFolder') : t('settings.installRestart')}
            </button>
          )}
        </div>
        {updater?.status === 'downloading' && (
          <div className="progress" style={{ marginTop: 10 }}>
            <div className="progress-bar"><div className="fill" style={{ width: `${Math.min(100, Math.max(0, updater.percent ?? 0))}%` }} /></div>
          </div>
        )}
      </div>
      )}

      <div className="card">
        <div className="card-head">
          <h4>{t('settings.gameDirTitle')}</h4>
        </div>
        <div className="grow">
          <div className="path-box" title={local.gameDir}>{local.gameDir}</div>
          <div className="hint">{t('settings.gameDirSub')} {t('settings.gameDirMoveHint')}</div>
        </div>
        <div className="actions">
          <button className="btn ghost sm" onClick={() => window.api.minecraft.openFolder('game')}>
            <IconFolder /> {t('settings.open')}
          </button>
          <button className="btn ghost sm" onClick={pickDir} disabled={moving}>{t('settings.choose')}</button>
        </div>
        {moving && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="progress-bar" style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
              <div className="progress-fill" style={{ width: '100%', height: '100%', background: 'var(--accent)', animation: 'shimmer 2s linear infinite' }} />
            </div>
            <span className="hint" style={{ fontSize: 12 }}>{moveStatus}</span>
          </div>
        )}
      </div>
      </div>)}

      {tab === 'game' && (<div className="sets-grid settings-grid stagger">
      <div className="card span2">
        <div className="card-head">
          <h4>{t('settings.memoryTitle')}</h4>
          <span className="mem-readout">{gb} <small>{t('size.gb')}</small></span>
        </div>
        <input
          type="range"
          className="slider"
          min={1024}
          max={16384}
          step={256}
          value={local.memoryMb}
          onChange={(e) => apply({ memoryMb: parseInt(e.target.value), perfPreset: undefined })}
        />
        <div className="mem-scale"><span>1 {t('size.gb')}</span><span>{t('settings.memoryLow')}</span><span>{t('settings.memoryOptimal')}</span><span>16 {t('size.gb')}</span></div>
        <div className="hint">{t('settings.memoryHint')}</div>
      </div>

      <div className="card span2">
        <div className="card-head">
          <h4>{t('settings.javaTitle')}</h4>
          <button className="btn ghost sm" onClick={rescan} disabled={scanning}>
            <IconRefresh /> {scanning ? t('settings.javaScanning') : t('settings.javaRefresh')}
          </button>
        </div>

        <div className="field">
          <div className="hint" style={{ marginBottom: 8 }}>{t('settings.javaAutoDetected')}</div>
          {javaList.length === 0 ? (
            <div className="empty" style={{ padding: 20 }}>
              {t('settings.javaEmpty')}
            </div>
          ) : (
            <div className="settings-java-list">
              {javaList.map((j) => {
                const active = local.javaPath && local.javaPath.toLowerCase() === j.path.toLowerCase();
                return (
                  <div
                    key={j.path}
                    className={'java-row' + (active ? ' active' : '')}
                    onClick={() => apply({ javaPath: j.path })}
                    title={`${j.version} · ${j.path}`}
                  >
                    <span className="jv">Java {j.major}</span>
                    <span className="jp">{j.path}</span>
                    {active && <span className="chip green">{t('settings.javaSelected')}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label" style={{ margin: '10px 0 6px' }}>{t('settings.javaCustomPath')}</label>
          <div className="row">
            <input
              className="input mono"
              placeholder={t('settings.javaPathPlaceholder')}
              value={local.javaPath || ''}
              onChange={(e) => apply({ javaPath: e.target.value })}
            />
            <button className="btn ghost sm" onClick={() => apply({ javaPath: undefined })} disabled={!local.javaPath}>
              {t('settings.javaReset')}
            </button>
          </div>
          <div className="hint">
            {t('settings.javaPathHint')}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h4>{t('settings.windowTitle')}</h4>
        </div>
        <div className="mode-list">
          {(['windowed', 'fullscreen'] as const).map((mode) => (
            <button
              key={mode}
              className={`mode-card${(local.fullscreen ? 'fullscreen' : 'windowed') === mode ? ' on' : ''}`}
              onClick={() => apply({
                fullscreen: mode === 'fullscreen' || undefined,
              })}
            >
              <span className="info">
                <b>{mode === 'windowed' ? t('settings.windowed') : t('settings.fullscreenMode')}</b>
                <span>{mode === 'windowed' ? t('settings.windowedDesc') : t('settings.fullscreenDesc')}</span>
              </span>
              <i className="radio" />
            </button>
          ))}
        </div>
        <p className="hint">{t('settings.windowHint')}</p>
        {!local.fullscreen && (
          <div className="dim-grid">
            <div>
              <label className="field-label">{t('settings.windowWidth')}</label>
              <input
                type="number"
                className="input input-sm"
                min={1}
                placeholder="854"
                value={local.gameWidth ?? ''}
                onChange={(e) => apply({ gameWidth: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div>
              <label className="field-label">{t('settings.windowHeight')}</label>
              <input
                type="number"
                className="input input-sm"
                min={1}
                placeholder="480"
                value={local.gameHeight ?? ''}
                onChange={(e) => apply({ gameHeight: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h4>{t('settings.behaviorTitle')}</h4>
        </div>
        <div>
          <SetToggle
            title={t('settings.closeOnLaunch')}
            sub={t('settings.closeOnLaunchSub')}
            checked={local.closeOnLaunch ?? false}
            onChange={(v) => apply({ closeOnLaunch: v || undefined })}
          />
          <SetToggle
            title={t('settings.lockOnLaunch')}
            sub={t('settings.lockOnLaunchSub')}
            checked={local.lockOnLaunch ?? false}
            onChange={(v) => apply({ lockOnLaunch: v || undefined })}
          />
          <SetToggle
            title={t('settings.showConsole')}
            sub={t('settings.showConsoleSub')}
            checked={local.showConsole ?? false}
            onChange={(v) => apply({ showConsole: v || undefined })}
          />
          <SetToggle
            title={t('settings.autoBackup')}
            sub={t('settings.autoBackupSub')}
            checked={local.autoBackup ?? false}
            onChange={(v) => apply({ autoBackup: v || undefined })}
          />
        </div>
      </div>

      <div className="card span2">
        <div className="card-head">
          <h4>{t('settings.jvmArgsTitle')}</h4>
          <span className="chip">{t('settings.advancedTag')}</span>
        </div>
        <label className="field-label">{t('settings.jvmArgsHint')}</label>
        <input
          type="text"
          className="input mono"
          placeholder={t('settings.jvmArgsPlaceholder')}
          value={local.jvmArgs ?? ''}
          onChange={(e) => apply({ jvmArgs: e.target.value || undefined, perfPreset: undefined })}
        />
        <div className="row" style={{ gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="hint" style={{ margin: 0 }}>{t('settings.perfPreset')}:</span>
          {(['potato', 'balanced', 'ultra'] as const).map((p) => (
            <button
              key={p}
              className={'btn ghost sm' + (local.perfPreset === p ? ' on' : '')}
              onClick={() => {
                const preset = PERF_PRESETS[p];
                apply({ jvmArgs: preset.jvmArgs, perfPreset: p });
              }}
            >
              {t('settings.perf_' + p)}
            </button>
          ))}
          <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={onPresetInfo}>{t('settings.presetInfoBtn')}</button>
        </div>
        <div className="hint">{local.perfPreset ? t('settings.presetDesc_' + local.perfPreset) : t('settings.presetFlagsHint')}</div>
      </div>

      <div className="card">
        <div className="card-head">
          <h4>{t('settings.commandsTitle')}</h4>
        </div>
        <div className="grow">
          <label className="field-label">{t('settings.preCommand')}</label>
          <input
            type="text"
            className="input mono"
            placeholder={t('settings.commandPlaceholder')}
            value={local.preCommand ?? ''}
            onChange={(e) => apply({ preCommand: e.target.value || undefined })}
          />
          <label className="field-label" style={{ marginTop: 12 }}>{t('settings.postCommand')}</label>
          <input
            type="text"
            className="input mono"
            placeholder={t('settings.commandPlaceholder')}
            value={local.postCommand ?? ''}
            onChange={(e) => apply({ postCommand: e.target.value || undefined })}
          />
        </div>
        <p className="hint" style={{ marginTop: 8 }}>{t('settings.commandsHint')}</p>
      </div>

      <div className="card">
        <div className="card-head">
          <h4>{t('settings.proxyTitle')}</h4>
        </div>
        <label className="field-label">{t('settings.proxyLabel')}</label>
        <div className="row" style={{ gap: 8 }}>
          <input
            type="text"
            className="input mono"
            style={{ flex: 1 }}
            placeholder="http://127.0.0.1:7890"
            value={local.proxyUrl ?? ''}
            onChange={(e) => apply({ proxyUrl: e.target.value.trim() || undefined })}
          />
          <button className="btn ghost sm" onClick={async () => {
            const url = (local.proxyUrl ?? '').trim();
            if (!url) return;
            setProxyMsg(t('settings.proxyTesting'));
            try {
              const r = await window.api.importer.proxyTest(url);
              setProxyMsg(r.ok ? t('settings.proxyOk', { ms: r.latencyMs ?? 0 }) : t('settings.proxyFail', { message: r.error ?? '' }));
            } catch (e) { setProxyMsg((e as Error).message); }
          }}>{t('settings.proxyTest')}</button>
        </div>
        {proxyMsg && <p className="hint" style={{ marginTop: 6 }}>{proxyMsg}</p>}
        <p className="hint" style={{ marginTop: 6 }}>{t('settings.proxyHint')}</p>
      </div>
      </div>)}

      {tab === 'storage' && (<StorageTab t={t} />)}

      {tab === 'danger' && (<div className="sets-grid settings-grid cols3 stagger">
      {isWin && (
        <div className="card danger-card">
          <div className="card-head">
            <h4>Сбросить TrelEmu</h4>
            <span className="chip red">Windows</span>
          </div>
          <p className="grow">Остановит эмулятор и удалит скачанную папку. Bedrock скачает TrelEmu заново. Сборочные ресурсы лаунчера не трогаем.</p>
          <div className="actions">
            <button className="btn danger sm" onClick={onResetEmu} disabled={emuResetting}>
              {emuResetting ? 'Сбрасываем...' : 'Сбросить эмулятор'}
            </button>
          </div>
        </div>
      )}

      <div className="card danger-card">
        <div className="card-head">
          <h4>{t('settings.resetLauncher')}</h4>
        </div>
        <p className="grow">{t('settings.resetDesc')}</p>
        <div className="actions">
          <button className="btn danger sm" onClick={onResetLauncher}>
            {t('settings.resetLauncher')}
          </button>
        </div>
      </div>

      <div className="card danger-card">
        <div className="card-head">
          <h4>{t('settings.uninstall')}</h4>
        </div>
        <p className="grow">{t('settings.uninstallDesc')}</p>
        <div className="actions">
          <button className="btn danger sm" onClick={onUninstallLauncher}>
            {t('settings.uninstall')}
          </button>
        </div>
      </div>
      </div>)}
      <p className="note">{t('settings.note')}</p>
    </div>
  );
};
