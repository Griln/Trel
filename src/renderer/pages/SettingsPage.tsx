import React, { useEffect, useState } from 'react';
import type { LauncherSettings, ThemeId } from '../../shared/types';
import type { JavaInstallInfo, UpdaterState } from '../../preload/preload';
import { IconRefresh, IconFolder, IconCheck, IconAlert, IconTrash } from '../components/icons';
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

interface Props {
  settings: LauncherSettings;
  onChange: (s: LauncherSettings) => void;
}

export const SettingsPage: React.FC<Props> = ({ settings, onChange }) => {
  const dlg = useDialog();
  const t = useT();
  type SettingsTab = 'general' | 'game' | 'danger';
  const [tab, setTab] = useState<SettingsTab>('general');
  const [local, setLocal] = useState<LauncherSettings>(settings);
  const [javaList, setJavaList] = useState<JavaInstallInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [updater, setUpdater] = useState<UpdaterState | null>(null);
  const [shortcutExists, setShortcutExists] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveStatus, setMoveStatus] = useState('');
  const [emuResetting, setEmuResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.api.java.list().then((v) => { if (!cancelled) setJavaList(v); }).catch((e) => console.warn('[settings] java list failed', e));
    window.api.updater.state().then((v) => { if (!cancelled) setUpdater(v); }).catch((e) => console.warn('[settings] updater state failed', e));
    window.api.settings.desktopShortcutExists().then((v) => { if (!cancelled) setShortcutExists(v); }).catch((e) => console.warn('[settings] shortcut check failed', e));
    const off = window.api.updater.onState((v) => { if (!cancelled) setUpdater(v); });
    return () => { cancelled = true; off(); };
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

  const gb = (local.memoryMb / 1024).toFixed(1);

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
      title: 'Сбросить TrelEmu / Bedrock',
      tone: 'danger',
      message: (
        <div style={{ display: 'grid', gap: 10 }}>
          <div>Это остановит TrelEmu и удалит скачанную папку эмулятора. После этого Bedrock заново скачает или пересоздаст TrelEmu.</div>
          <div className="hint">Сборочные ресурсы внутри установленного лаунчера не удаляются.</div>
        </div>
      ),
      buttons: [
        { label: t('settings.resetCancel'), value: 'cancel', variant: 'ghost' },
        { label: 'Сбросить эмулятор', value: 'reset', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (choice !== 'reset') return;
    setEmuResetting(true);
    try {
      const result = await window.api.emu.reset();
      await dlg.show({
        title: result.ok ? 'TrelEmu сброшен' : 'Сброс TrelEmu завершился с ошибками',
        tone: result.ok ? 'info' : 'warn',
        message: result.ok
          ? (result.removed.length > 0 ? `Удалено папок: ${result.removed.length}` : 'Папка TrelEmu не найдена, удалять было нечего.')
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
    <div>
      <div className="page-head">
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.subtitle')}</p>
      </div>

      <div className="content-tabs">
        {(['general', 'game', 'danger'] as const).map((id) => (
          <button
            key={id}
            className={`content-tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            {id === 'general' ? t('settings.tabGeneral') : id === 'game' ? t('settings.tabGame') : t('settings.tabDanger')}
          </button>
        ))}
      </div>

      {tab === 'general' && (<>
      {updater && (
      <div className="card">
        <div className="card-head">
          <h2>{t('settings.updateTitle')}</h2>
          <div className="row" style={{ gap: 8 }}>
            <span className="chip mono">v{updater.current}</span>
            <button
              className="btn ghost sm"
              onClick={() => window.api.updater.check()}
              disabled={updater.status === 'checking' || updater.status === 'downloading'}
            >
              <IconRefresh /> {t('settings.checkUpdate')}
            </button>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <div className="muted" style={{ fontSize: 13 }}>
            {updateLabel(updater)}
            {updater.isPortableHint && (
              <span className="chip warn" style={{ marginLeft: 8 }}>Portable</span>
            )}
          </div>
          {updater?.status === 'available' && (
            <button className="btn primary sm" onClick={() => window.api.updater.download()}>
              {t('settings.downloadUpdate')}
            </button>
          )}
          {updater?.status === 'downloaded' && (
            <button className="btn primary sm" onClick={() => window.api.updater.install()}>
              {t('settings.installRestart')}
            </button>
          )}
        </div>
        {updater?.status === 'downloading' && (
          <div className="progress" style={{ marginTop: 10 }}>
            <div className="progress-bar"><div className="fill" style={{ width: (updater.percent ?? 0) + '%' }} /></div>
          </div>
        )}
        <div className="hint" style={{ marginTop: 10 }}>
          {updater.isPortableHint ? t('settings.portableHint') : t('settings.updateHint')}
        </div>
      </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>{t('settings.themeTitle')}</h2>
        </div>
        <div className="theme-grid">
          {THEME_OPTIONS.map((theme) => {
            const active = (local.theme ?? 'mono') === theme.id;
            return (
              <button
                key={theme.id}
                className={'theme-card' + (active ? ' active' : '')}
                onClick={() => apply({ theme: theme.id })}
              >
                <div className="theme-swatches">
                  {theme.swatches.map((c, i) => (
                    <span
                      key={i}
                      className="theme-swatch"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="theme-card-info">
                  <div className="theme-card-name">
                    {theme.name}
                    {active && <IconCheck />}
                  </div>
                  <div className="theme-card-desc">{t(theme.descKey)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('settings.languageTitle')}</h2>
        </div>
        <div className="theme-grid">
          {(['ru', 'en'] as const).map((loc) => (
            <button
              key={loc}
              className={`theme-card${(local.locale ?? 'ru') === loc ? ' active' : ''}`}
              onClick={() => apply({ locale: loc })}
            >
              <span className="theme-label">{loc === 'ru' ? 'Русский' : 'English'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('settings.behaviorTitle')}</h2>
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={local.closeOnLaunch ?? false}
            onChange={(e) => apply({ closeOnLaunch: e.target.checked || undefined })}
          />
          <span>{t('settings.closeOnLaunch')}</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={local.lockOnLaunch ?? false}
            onChange={(e) => apply({ lockOnLaunch: e.target.checked || undefined })}
          />
          <span>{t('settings.lockOnLaunch')}</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={local.showIntro ?? true}
            onChange={(e) => apply({ showIntro: e.target.checked })}
          />
          <span>{t('settings.showIntro')}</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={local.showConsole ?? false}
            onChange={(e) => apply({ showConsole: e.target.checked || undefined })}
          />
          <span>{t('settings.showConsole')}</span>
        </label>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('settings.desktopShortcut')}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
          <span className="hint" style={{ fontSize: 12 }}>
            {shortcutExists ? t('settings.shortcutInstalled') : t('settings.shortcutNotInstalled')}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('settings.gameDirTitle')}</h2>
          <button className="btn ghost sm" onClick={() => window.api.minecraft.openFolder('game')}>
            <IconFolder /> {t('settings.open')}
          </button>
        </div>
        <div className="row">
          <input className="input mono" value={local.gameDir} readOnly />
          <button className="btn" onClick={pickDir} disabled={moving}>{t('settings.choose')}</button>
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
      </>)}

      {tab === 'game' && (<>
      <div className="card">
        <div className="card-head">
          <h2>{t('settings.memoryTitle')}</h2>
          <span className="chip mono">{gb} {t('size.gb')}</span>
        </div>
        <input
          type="range"
          min={1024}
          max={16384}
          step={256}
          value={local.memoryMb}
          onChange={(e) => apply({ memoryMb: parseInt(e.target.value) })}
        />
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--fg-subtle)' }}>
          <span>1 {t('size.gb')}</span><span>16 {t('size.gb')}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('settings.jvmArgsTitle')}</h2>
        </div>
        <p className="hint">{t('settings.jvmArgsHint')}</p>
        <input
          type="text"
          className="input"
          placeholder={t('settings.jvmArgsPlaceholder')}
          value={local.jvmArgs ?? ''}
          onChange={(e) => apply({ jvmArgs: e.target.value || undefined })}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('settings.windowTitle')}</h2>
        </div>
        <div className="theme-grid">
          {(['windowed', 'fullscreen'] as const).map((mode) => (
            <button
              key={mode}
              className={`theme-card${(local.fullscreen ? 'fullscreen' : 'windowed') === mode ? ' active' : ''}`}
              onClick={() => apply({
                fullscreen: mode === 'fullscreen' || undefined,
              })}
            >
              <span className="theme-label">
                {mode === 'windowed' ? t('settings.windowed') : t('settings.fullscreenMode')}
              </span>
              <span className="theme-desc">
                {mode === 'windowed' ? t('settings.windowedDesc') : t('settings.fullscreenDesc')}
              </span>
            </button>
          ))}
        </div>
        <p className="hint">{t('settings.windowHint')}</p>
        {!local.fullscreen && (
          <div className="field-row" style={{ marginTop: 12 }}>
            <label>{t('settings.windowWidth')}</label>
            <input
              type="number"
              className="input input-sm"
              min={1}
              placeholder="854"
              value={local.gameWidth ?? ''}
              onChange={(e) => apply({ gameWidth: e.target.value ? Number(e.target.value) : undefined })}
            />
            <label>{t('settings.windowHeight')}</label>
            <input
              type="number"
              className="input input-sm"
              min={1}
              placeholder="480"
              value={local.gameHeight ?? ''}
              onChange={(e) => apply({ gameHeight: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('settings.commandsTitle')}</h2>
        </div>
        <p className="hint">{t('settings.commandsHint')}</p>
        <div className="field-col">
          <label>{t('settings.preCommand')}</label>
          <input
            type="text"
            className="input"
            placeholder={t('settings.commandPlaceholder')}
            value={local.preCommand ?? ''}
            onChange={(e) => apply({ preCommand: e.target.value || undefined })}
          />
          <label>{t('settings.postCommand')}</label>
          <input
            type="text"
            className="input"
            placeholder={t('settings.commandPlaceholder')}
            value={local.postCommand ?? ''}
            onChange={(e) => apply({ postCommand: e.target.value || undefined })}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('settings.javaTitle')}</h2>
          <button className="btn ghost sm" onClick={rescan} disabled={scanning}>
            <IconRefresh /> {scanning ? t('settings.javaScanning') : t('settings.javaRefresh')}
          </button>
        </div>

        <div className="field">
          <label>{t('settings.javaAutoDetected')}</label>
          {javaList.length === 0 ? (
            <div className="empty" style={{ padding: 20 }}>
              {t('settings.javaEmpty')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflow: 'auto' }}>
              {javaList.map((j) => {
                const active = local.javaPath && local.javaPath.toLowerCase() === j.path.toLowerCase();
                return (
                  <div
                    key={j.path}
                    className={'java-row' + (active ? ' selected' : '')}
                    onClick={() => apply({ javaPath: j.path })}
                    title={j.path}
                  >
                    <div className="java-row-main">
                      <div className="java-row-head">
                        <span>Java {j.major}</span>
                        <span className="muted mono" style={{ fontSize: 12 }}>{j.version}</span>
                        {j.managed && <span className="chip success"><IconCheck /> {t('settings.javaManaged')}</span>}
                        {j.vendor && !j.managed && <span className="chip">{j.vendor}</span>}
                      </div>
                      <div className="java-row-path">{j.path}</div>
                    </div>
                    {active && <span className="chip accent"><IconCheck /> {t('settings.javaSelected')}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label>{t('settings.javaCustomPath')}</label>
          <div className="row">
            <input
              className="input mono"
              placeholder={t('settings.javaPathPlaceholder')}
              value={local.javaPath || ''}
              onChange={(e) => apply({ javaPath: e.target.value })}
            />
            <button className="btn ghost" onClick={() => apply({ javaPath: undefined })} disabled={!local.javaPath}>
              {t('settings.javaReset')}
            </button>
          </div>
          <div className="hint">
            {t('settings.javaPathHint')}
          </div>
        </div>
      </div>
      </>)}

      {tab === 'danger' && (<>
      <div className="card danger-zone">
        <div className="card-head">
          <h2>{t('settings.dangerTitle')}</h2>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{t('settings.resetLauncher')}</div>
            <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
              {t('settings.resetDesc')}
            </div>
          </div>
          <button className="btn danger" onClick={onResetLauncher}>
            <IconAlert /> {t('settings.resetLauncher')}
          </button>
        </div>

        <div className="row" style={{ justifyContent: 'space-between', gap: 12, paddingTop: 14, borderTop: '1px solid var(--border)', marginTop: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>TrelEmu / Bedrock</div>
            <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
              Сброс скачанного эмулятора, если Android зависает, ADB не отвечает или Bedrock больше не запускается.
            </div>
          </div>
          <button className="btn danger" onClick={onResetEmu} disabled={emuResetting}>
            <IconTrash /> {emuResetting ? 'Сбрасываем...' : 'Сбросить эмулятор'}
          </button>
        </div>

        <div className="row" style={{ justifyContent: 'space-between', gap: 12, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{t('settings.uninstall')}</div>
            <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
              {t('settings.uninstallDesc')}
            </div>
          </div>
          <button className="btn danger" onClick={onUninstallLauncher}>
            <IconTrash /> {t('settings.uninstall')}
          </button>
        </div>
      </div>
      </>)}
    </div>
  );
};
