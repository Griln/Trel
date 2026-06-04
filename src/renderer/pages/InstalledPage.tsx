import React, { useEffect, useMemo, useState } from 'react';
import type { LauncherSettings, MinecraftAccount, VersionInfo } from '../../shared/types';
import type { InstalledVersionDetail, LoaderType } from '../../preload/preload';
import { IconPlay, IconTrash, IconFolder, IconCube, IconArrow, IconRefresh, IconSkinOff } from '../components/icons';
import { useDialog } from '../components/Dialog';
import { LoaderInstallDialog } from '../components/LoaderInstallDialog';
import { supportsCustomSkin } from '../../shared/skin-support';
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
    release: t('installed.typeRelease'), snapshot: t('installed.typeSnapshot'), old_beta: 'beta', old_alpha: 'alpha',
  };
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [details, setDetails] = useState<InstalledVersionDetail[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [loaderFor, setLoaderFor] = useState<string | null>(null);

  const refresh = async () => {
    const list = await window.api.minecraft.installedDetailed();
    setDetails(list);
  };

  useEffect(() => {
    let cancelled = false;
    window.api.minecraft.versions().then((v) => { if (!cancelled) setVersions(v); });
    refresh().then(() => {
      // refresh sets state internally
    });
    return () => { cancelled = true; };
  }, []);

  // Скрываем стандалон-ваниль, если для этой же базы установлен хотя бы
  // один лоадер — он "впитывает" её под именем базовой MC версии.
  const items = useMemo(() => {
    const moddedBases = new Set(details.filter((d) => d.loader).map((d) => d.baseMc));
    return details
      .filter((d) => d.loader || !moddedBases.has(d.id))
      .map((d) => {
        const meta = versions.find((v) => v.id === d.baseMc);
        return {
          ...d,
          type: meta?.type ?? 'unknown',
          releaseTime: meta?.releaseTime,
          isLast: d.id === settings.lastVersionId,
        };
      })
      .sort((a, b) => {
        if (a.isLast && !b.isLast) return -1;
        if (!a.isLast && b.isLast) return 1;
        return (b.releaseTime || '').localeCompare(a.releaseTime || '');
      });
  }, [details, versions, settings.lastVersionId]);

  const onPlay = async (id: string) => {
    if (!account) return;
    setBusyId(id);
    setStatus(t('installed.launchingStatus', { id }));
    try {
      onSettingsChange({ ...settings, lastVersionId: id });
      await window.api.minecraft.launch({ versionId: id, account, memoryMb: settings.memoryMb });
      setStatus(t('installed.runningStatus'));
    } catch (e) {
      setStatus(t('installed.errorStatus', { message: (e as Error).message }));
    } finally {
      // Снимаем busy сразу: launch отдаёт PID при старте, не при завершении игры.
      setBusyId(null);
    }
  };

  const onUninstall = async (id: string) => {
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
    if (choice === 'deep') {
      await window.api.minecraft.uninstallDeep(id);
    } else {
      await window.api.minecraft.uninstall(id);
    }
    // Если удалили текущую «активную» версию — главная не должна показывать
    // её как выбранную. Бэкенд уже сбросил это в settings.json, но рендерер
    // держит копию в памяти — синхронизируем явно.
    if (settings.lastVersionId === id) {
      onSettingsChange({ ...settings, lastVersionId: '' });
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
    // Backend сам обновил lastVersionId — берём из возвращённых settings,
    // чтобы UI и settings.json не разъезжались.
    if (result.settings) {
      onSettingsChange(result.settings);
    } else if (settings.lastVersionId && result.removed.includes(settings.lastVersionId)) {
      onSettingsChange({ ...settings, lastVersionId: baseMc });
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
    for (const id of ids) {
      try { await window.api.minecraft.uninstall(id); } catch {}
    }
    if (settings.lastVersionId && ids.includes(settings.lastVersionId)) {
      onSettingsChange({ ...settings, lastVersionId: '' });
    }
    setStatus(t('installed.deletedAllStatus', { count: String(ids.length) }));
    refresh();
  };

  return (
    <div>
      <div className="page-head">
        <h1>{t('installed.title')}</h1>
        <p>{t('installed.subtitle')}</p>
      </div>

      {status && (
        <div className="hint" style={{ marginBottom: 12 }}>{status}</div>
      )}

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
          <div className="installed-head">
            <span className="muted" style={{ fontSize: 13 }}>
              {items.length} {t.plural(items.length, t('plural.version.one'), t('plural.version.few'), t('plural.version.many'))}
            </span>
            <div className="row">
              <button className="btn ghost sm" onClick={onGoToBrowse}>{t('installed.add')}</button>
              <button className="btn ghost sm" onClick={onUninstallAll}>
                <IconTrash /> {t('installed.deleteAll')}
              </button>
            </div>
          </div>

          <div className="installed-grid">
            {items.map((it) => {
              // Имя карточки: baseMc, если есть лоадер — берём базу и приписываем бейдж.
              const showName = it.loader ? it.baseMc : it.id;
              return (
                <div key={it.id} className={'inst-card' + (it.isLast ? ' featured' : '')}>
                  <div className="inst-card-head">
                    <div className="inst-card-name">{showName}</div>
                    {it.isLast && <span className="pill">{t('installed.latest')}</span>}
                  </div>
                  <div className="inst-card-meta">
                    {it.type !== 'unknown' && (
                      <span className={'tag ' + it.type}>{typeLabel[it.type] ?? it.type}</span>
                    )}
                    {it.loader && (
                      <span className="chip accent" title={t('installed.loaderChipTitle', { loader: loaderLabel[it.loader], version: it.loaderVersion ?? '' })}>
                        + {loaderLabel[it.loader]}
                      </span>
                    )}
                    {it.releaseTime && (
                      <span className="chip">{new Date(it.releaseTime).toLocaleDateString(t.locale === 'en' ? 'en-US' : 'ru-RU')}</span>
                    )}
                    {!supportsCustomSkin(it.id, it.baseMc) && (
                      <span className="chip warn" title={t('installed.noSkinTitle')}>
                        <IconSkinOff /> {t('installed.noSkins')}
                      </span>
                    )}
                  </div>
                  <div className="inst-card-actions">
                    <button
                      className="btn primary block"
                      disabled={!account || busyId === it.id || !!(settings.lockOnLaunch && gameRunning)}
                      onClick={() => onPlay(it.id)}
                    >
                      <IconPlay />
                      {busyId === it.id ? t('installed.btnLaunching') : t('installed.btnPlay')}
                    </button>
                    <div className="row" style={{ gap: 4 }}>
                      {/* Установка лоадера доступна для чистых релизов без лоадера */}
                      {!it.loader && /^1\.\d+(\.\d+)?$/.test(it.id) && (
                        <button
                          className="icon-btn"
                          onClick={() => setLoaderFor(it.id)}
                          title={t('installed.loaderTitle')}
                        >
                          <IconCube />
                        </button>
                      )}
                      {/* Кнопка revert — только если это лоадер */}
                      {it.loader && (
                        <button
                          className="icon-btn"
                          onClick={() => onRevertToVanilla(it.baseMc)}
                          title={t('installed.revertBtn', { baseMc: it.baseMc })}
                        >
                          <IconRefresh />
                        </button>
                      )}
                      <button
                        className="icon-btn"
                        onClick={() => window.api.minecraft.openFolder('version', it.id)}
                        title={t('installed.openFolder')}
                      >
                        <IconFolder />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => onUninstall(it.id)}
                        title={t('installed.delete')}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
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
          onSettingsChange({ ...settings, lastVersionId: versionId });
        }}
      />
    </div>
  );
};

