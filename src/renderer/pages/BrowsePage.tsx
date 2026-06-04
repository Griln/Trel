import React, { useEffect, useMemo, useState, memo } from "react";
import type {
  DownloadProgress,
  LauncherSettings,
  MinecraftAccount,
  VersionInfo,
} from "../../shared/types";
import type {
  JavaPlan,
  InstalledVersionDetail,
  LoaderType,
} from "../../preload/preload";
import {
  IconPlay,
  IconInfo,
  IconAlert,
  IconCheck,
  IconSearch,
  IconFolder,
  IconRefresh,
  IconCube,
  IconSkinOff,
} from "../components/icons";
import { describeVersion } from "../data/versions";
import { LoaderInstallDialog } from "../components/LoaderInstallDialog";
import { useDialog } from "../components/Dialog";
import { supportsCustomSkin } from "../../shared/skin-support";
import { effectiveInstalledCount } from "../../shared/installed";
import { formatProgressBytes } from '../util/format';
import { useT } from '../i18n';

const loaderLabel: Record<LoaderType, string> = {
  fabric: "Fabric",
  quilt: "Quilt",
  forge: "Forge",
  neoforge: "NeoForge",
};

interface RowProps {
  v: VersionInfo;
  selected: boolean;
  isInstalled: boolean;
  isLastPlayed: boolean;
  noSkin: boolean;
  loaders: InstalledVersionDetail[];
  typeLabel: Record<string, string>;
  locale: string;
  installedTitle: string;
  notInstalledTitle: string;
  playedLabel: string;
  noSkinTitle: string;
  onSelect: (id: string) => void;
}

const VersionRow = memo(function VersionRow({
  v,
  selected,
  isInstalled,
  isLastPlayed,
  noSkin,
  loaders,
  typeLabel,
  locale,
  installedTitle,
  notInstalledTitle,
  playedLabel,
  noSkinTitle,
  onSelect,
}: RowProps) {
  return (
    <div
      className={"version-row" + (selected ? " selected" : "")}
      onClick={() => onSelect(v.id)}
    >
      <span
        className={
          "version-dot " + (isInstalled ? "installed" : "not-installed")
        }
        title={isInstalled ? installedTitle : notInstalledTitle}
      />
      <div className="version-main">
        <div className="version-name">
          {v.id}
          {isLastPlayed && <span className="pill">{playedLabel}</span>}
        </div>
        <div className="version-meta">
          {new Date(v.releaseTime).toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU')}
          {loaders.map((l) => (
            <span
              key={l.id}
              className="chip accent"
              style={{ marginLeft: 6 }}
              title={`${loaderLabel[l.loader!]} ${l.loaderVersion ?? ""}`}
            >
              + {loaderLabel[l.loader!]}
            </span>
          ))}
        </div>
      </div>
      {noSkin && (
        <span
          className="row-noskin"
          title={noSkinTitle}
        >
          <IconSkinOff />
        </span>
      )}
      <span className={"tag " + v.type}>
        {typeLabel[v.type] ?? v.type}
      </span>
    </div>
  );
});

interface Props {
  settings: LauncherSettings;
  account: MinecraftAccount | null;
  onGoToAccounts: () => void;
  onSettingsChange: (s: LauncherSettings) => void;
  gameRunning?: boolean;
}

type Filter = "all" | "release" | "snapshot" | "old_beta" | "old_alpha";

export const BrowsePage: React.FC<Props> = ({
  settings,
  account,
  onGoToAccounts,
  onSettingsChange,
  gameRunning = false,
}) => {
  const dialog = useDialog();
  const t = useT();

  const typeLabel: Record<string, string> = {
    release: t('browse.typeRelease'),
    snapshot: t('browse.typeSnapshot'),
    old_beta: "beta",
    old_alpha: "alpha",
  };
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<InstalledVersionDetail[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("release");
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"neutral" | "success" | "error">(
    "neutral",
  );
  const [busy, setBusy] = useState(false);
  const [javaPlan, setJavaPlan] = useState<JavaPlan | null>(null);
  const [loaderDialogOpen, setLoaderDialogOpen] = useState(false);

  const refreshInstalled = async () => {
    const [ids, det] = await Promise.all([
      window.api.minecraft.installed(),
      window.api.minecraft.installedDetailed(),
    ]);
    setInstalled(new Set(ids));
    setDetails(det);
  };

  useEffect(() => {
    let cancelled = false;
    window.api.minecraft
      .versions()
      .then((list) => {
        if (cancelled) return;
        setVersions(list);
        if (!selected && list.length) {
          const first = list.find((v) => v.type === "release") || list[0];
          setSelected(first.id);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        // Без интернета или при недоступности Mojang — пустой каталог + сообщение
        setStatus(
          t('browse.loadError', { message: (e as Error).message }),
        );
        setStatusType("error");
      });
    refreshInstalled();

    const offProgress = window.api.minecraft.onProgress(setProgress);
    const offExit = window.api.minecraft.onExit((code) => {
      setStatus(t('browse.exitStatus', { code: String(code) }));
      setStatusType(code === 0 ? "success" : "error");
      setBusy(false);
    });
    const offLaunchStart = window.api.minecraft.onLaunchStart(() => {
      // Игра spawn'нулась, но окно ещё не открылось — держим кнопку
      // «Запуск...» ещё ~3 секунды, пока Java не инициализирует окно.
      const hold = setTimeout(() => setBusy(false), 3000);
      const offExitLocal = window.api.minecraft.onExit(() => clearTimeout(hold));
      return () => offExitLocal();
    });
    const offManifest = window.api.minecraft.onManifestUpdated((details) => {
      setDetails(details);
      const ids = details.map((d) => d.id);
      setInstalled(new Set(ids));
    });
    return () => {
      offProgress();
      offExit();
      offLaunchStart();
      offManifest();
    };
  }, []);

  // Базы, для которых установлен хотя бы один лоадер.
  const loadersByBase = useMemo(() => {
    const map = new Map<string, InstalledVersionDetail[]>();
    for (const d of details) {
      if (!d.loader) continue;
      const arr = map.get(d.baseMc) ?? [];
      arr.push(d);
      map.set(d.baseMc, arr);
    }
    return map;
  }, [details]);

  useEffect(() => {
    if (!selected) {
      setJavaPlan(null);
      return;
    }
    let cancelled = false;
    setJavaPlan(null);
    window.api.java
      .planFor(selected)
      .then((p) => {
        if (!cancelled) setJavaPlan(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selected]);



  const filtered = useMemo(() => {
    return versions.filter((v) => {
      if (query && !v.id.toLowerCase().includes(query.toLowerCase()))
        return false;
      if (filter === "all") return true;
      return v.type === filter;
    });
  }, [versions, query, filter]);

  const selectedVersion = versions.find((v) => v.id === selected);
  // Лоадеры, установленные для выбранной MC версии
  const loadersForSel = selected ? (loadersByBase.get(selected) ?? []) : [];
  const primaryLoader = loadersForSel[0] ?? null;
  // То, что мы реально запустим, если нажать "Играть":
  // если стоит лоадер — лоадер впитывает ваниль; иначе — голая версия.
  const launchId = primaryLoader ? primaryLoader.id : selected;
  const isInstalled = !!(
    selected &&
    (installed.has(selected) || primaryLoader)
  );
  const canAct = !!account && !!selected && !busy && !(settings.lockOnLaunch && gameRunning);

  const counts = useMemo(() => {
    const c = {
      all: versions.length,
      release: 0,
      snapshot: 0,
      old_beta: 0,
      old_alpha: 0,
    };
    for (const v of versions) (c as any)[v.type]++;
    return c;
  }, [versions]);

  const onInstallAndPlay = async () => {
    if (!account || !selected) return;
    setBusy(true);
    setStatusType("neutral");
    try {
      if (!isInstalled) {
        setStatus(t('browse.downloadingStatus', { id: selected }));
        await window.api.minecraft.install(selected);
        await refreshInstalled();
        setStatus(t('browse.installedStatus', { id: selected }));
        setStatusType("success");
        onSettingsChange({ ...settings, lastVersionId: selected });
        return;
      }
      setStatus(t('browse.launchingStatus'));
      onSettingsChange({ ...settings, lastVersionId: launchId });
      await window.api.minecraft.launch({
        versionId: launchId,
        account,
        memoryMb: settings.memoryMb,
      });
      setStatus(t('browse.runningStatus'));
      setStatusType("success");
    } catch (e) {
      setStatus(t('browse.errorStatus', { message: (e as Error).message }));
      setStatusType("error");
      setBusy(false);
    }
  };

  const onRevertToVanilla = async () => {
    if (!selected) return;
    const loaders = loadersForSel.map(l => loaderLabel[l.loader!]).join(', ');
    const choice = await dialog.show({
      title: t('browse.revertTitle', { id: selected }),
      tone: "warn",
      message: t('browse.revertMessage', { loaders }),
      buttons: [
        { label: t('browse.revertCancel'), value: "cancel", variant: "ghost" },
        { label: t('browse.revertConfirm'), value: "ok", variant: "default" },
      ],
      defaultIndex: 0,
      cancelValue: "cancel",
    });
    if (choice !== "ok") return;
    const result = await window.api.minecraft.revertToVanilla(selected);
    await refreshInstalled();
    // Backend сам обновил lastVersionId если нужно — синхронизируем UI
    // через возвращённый settings, чтобы не было гонки между слоями.
    if (result.settings) {
      onSettingsChange(result.settings);
    } else if (
      settings.lastVersionId &&
      result.removed.includes(settings.lastVersionId)
    ) {
      // Совместимость со старым форматом ответа
      onSettingsChange({ ...settings, lastVersionId: selected });
    }
    setStatus(
      result.removed.length > 0
        ? t('browse.revertedLoaders', { list: result.removed.join(", ") })
        : t('browse.revertedNone'),
    );
    setStatusType("success");
  };

  const onInstallOnly = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus(t('browse.downloadingStatus', { id: selected }));
    setStatusType("neutral");
    try {
      await window.api.minecraft.install(selected);
      await refreshInstalled();
      setStatus(t('browse.installedStatus', { id: selected }));
      setStatusType("success");
    } catch (e) {
      setStatus(t('browse.errorStatus', { message: (e as Error).message }));
      setStatusType("error");
    } finally {
      setBusy(false);
    }
  };

  const filterTabs: { id: Filter; label: string; accent: string; c: number }[] = [
    { id: "release", label: t('browse.filterRelease'), accent: "release", c: counts.release },
    { id: "snapshot", label: t('browse.filterSnapshot'), accent: "snapshot", c: counts.snapshot },
    { id: "old_beta", label: t('browse.filterBeta'), accent: "beta", c: counts.old_beta },
    { id: "old_alpha", label: t('browse.filterAlpha'), accent: "alpha", c: counts.old_alpha },
    { id: "all", label: t('browse.filterAll'), accent: "all", c: counts.all },
  ];

  const playLabel = busy
    ? isInstalled
      ? t('browse.btnLaunching')
      : t('browse.btnDownloading')
    : isInstalled
      ? t('browse.btnPlay')
      : t('browse.btnDownloadPlay');

  const isLoaderVersion = !!selected && /^1\.\d+(\.\d+)?$/.test(selected);

  return (
    <div className="catalog">
      <header className="catalog-head">
        <div>
          <h1>{t('browse.title')}</h1>
          <p>{t('browse.subtitle')}</p>
        </div>
        <div className="catalog-head-stats">
          <span className="chip">
            <b>{versions.length}</b> {t('browse.available')}
          </span>
          <span className="chip success">
            <b>{effectiveInstalledCount(details)}</b> {t('browse.installed')}
          </span>
        </div>
      </header>

      <div className="catalog-grid">
        <aside className="catalog-list">
          <div className="catalog-search">
            <IconSearch className="search-icon" />
            <input
              className="input"
              placeholder={t('browse.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="lib-side-tabs">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                className={
                  "side-tab tab-" +
                  tab.accent +
                  (filter === tab.id ? " active" : "")
                }
                onClick={() => setFilter(tab.id)}
              >
                <span className="side-tab-dot" />
                <span className="side-tab-label">{tab.label}</span>
                <span className="count">{tab.c}</span>
              </button>
            ))}
          </div>

          <div className="catalog-list-scroll">
            {filtered.length === 0 ? (
              <div className="empty">{t('browse.nothingFound')}</div>
            ) : (
              filtered.map((v) => {
                const rowLoaders = loadersByBase.get(v.id) ?? [];
                const isInst = installed.has(v.id) || rowLoaders.length > 0;
                const isSel = selected === v.id;
                const lastId = settings.lastVersionId;
                const isLastPlayed =
                  v.id === lastId || rowLoaders.some((l) => l.id === lastId);
                const noSkin = !supportsCustomSkin(v.id);
                return (
                  <VersionRow
                    key={v.id}
                    v={v}
                    selected={isSel}
                    isInstalled={isInst}
                    isLastPlayed={isLastPlayed}
                    noSkin={noSkin}
                    loaders={rowLoaders}
                    typeLabel={typeLabel}
                    locale={t.locale}
                    installedTitle={t('browse.isInstalled')}
                    notInstalledTitle={t('browse.notInstalled')}
                    playedLabel={t('browse.played')}
                    noSkinTitle={t('browse.noSkinShort')}
                    onSelect={setSelected}
                  />
                );
              })
            )}
          </div>
        </aside>

        <main className="catalog-detail">
          {!selected ? (
            <div className="catalog-empty">
              <div className="catalog-empty-icon">
                <IconCube />
              </div>
              <h2>{t('browse.selectVersion')}</h2>
              <p>
                {t('browse.selectHint')}
              </p>
            </div>
          ) : (
            <>
              {!account && (
                <div className="banner">
                  <div>
                    <h2>{t('browse.noAccount')}</h2>
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 4 }}
                    >
                      {t('browse.noAccountHint')}
                    </div>
                  </div>
                  <button className="btn primary" onClick={onGoToAccounts}>
                    {t('browse.toAccounts')}
                  </button>
                </div>
              )}

              <div className="catalog-hero">
                <div className="catalog-hero-info">
                  <div className="catalog-hero-eyebrow">
                    {isInstalled ? (
                      <>
                        <IconCheck /> {t('browse.readyEyebrow')}
                      </>
                    ) : (
                      t('browse.notInstalledEyebrow')
                    )}
                  </div>
                  <h2 className="catalog-hero-title">{selected}</h2>
                  {/* descriptionKey было моим костылём — описания идут через describeVersion(); см. ниже */}
                  <div className="catalog-hero-meta">
                    {selectedVersion && (
                      <>
                        <span className={"tag " + selectedVersion.type}>
                          {typeLabel[selectedVersion.type] ??
                            selectedVersion.type}
                        </span>
                        <span className="chip">
                          {new Date(
                            selectedVersion.releaseTime,
                          ).toLocaleDateString(t.locale === 'en' ? 'en-US' : 'ru-RU')}
                        </span>
                        {loadersForSel.map((l) => (
                          <span
                            key={l.id}
                            className="chip accent"
                            title={t('browse.installedStatus', { id: l.id })}
                          >
                            + {loaderLabel[l.loader!]} {l.loaderVersion}
                          </span>
                        ))}
                        {javaPlan && !javaPlan.error && (
                          <span
                            className={
                              "chip " +
                              (javaPlan.plan === "download"
                                ? "warn"
                                : "accent")
                            }
                          >
                            Java {javaPlan.required}
                            {javaPlan.plan === "reuse" && <> · {t('browse.javaFound')}</>}
                            {javaPlan.plan === "download" && (
                              <> · {t('browse.javaWillDownload')}</>
                            )}
                            {javaPlan.plan === "user" && <> · {t('browse.javaCustom')}</>}
                          </span>
                        )}
                        {!supportsCustomSkin(selected) && (
                          <span
                            className="chip warn"
                            title={t('browse.noSkinLong')}
                          >
                            <IconSkinOff /> {t('browse.noSkins')}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <button
                  className="play-btn home-play block"
                  disabled={!canAct}
                  onClick={onInstallAndPlay}
                >
                  {busy && progress && (
                    <span
                      className="progress-fill"
                      style={{ width: progress.percent + "%" }}
                    />
                  )}
                  <span className="label">
                    <IconPlay />
                    {playLabel}
                  </span>
                </button>

                {busy && progress && (
                  <div className="hero-progress">
                    <div className="ab-progress-info">
                      <span className="ab-progress-stage">
                        {progress.stage}
                      </span>
                      <span>
                        {formatProgressBytes(progress, t)}
                        {progress.percent}%
                      </span>
                    </div>
                    <div className="ab-progress-bar">
                      <div
                        className="fill"
                        style={{ width: progress.percent + "%" }}
                      />
                    </div>
                  </div>
                )}

                {status && !busy && (
                  <div
                    className={"status-line " + statusType}
                    style={{ marginTop: 12 }}
                  >
                    {statusType === "error" ? (
                      <IconAlert />
                    ) : statusType === "success" ? (
                      <IconCheck />
                    ) : (
                      <IconInfo />
                    )}
                    <span>{status}</span>
                  </div>
                )}

                <div className="catalog-hero-tools">
                  {!isInstalled && (
                    <button
                      className="btn"
                      disabled={!selected || busy}
                      onClick={onInstallOnly}
                    >
                      <IconRefresh /> {t('browse.downloadOnly')}
                    </button>
                  )}
                  {isInstalled && (
                    <button
                      className="btn"
                      disabled={!selected}
                      onClick={() =>
                        selected &&
                        window.api.minecraft.openFolder("version", selected)
                      }
                    >
                      <IconFolder /> {t('browse.versionFolder')}
                    </button>
                  )}
                  {isLoaderVersion && (
                    <button
                      className="btn"
                      disabled={!selected || busy}
                      onClick={() => setLoaderDialogOpen(true)}
                    >
                      <IconCube /> {t('browse.modLoader')}
                    </button>
                  )}
                  {loadersForSel.length > 0 && (
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={onRevertToVanilla}
                      title={t('browse.revertTooltip')}
                    >
                      <IconRefresh /> {t('browse.revertToVanilla')}
                    </button>
                  )}
                </div>
              </div>

              {selectedVersion && describeVersion(selectedVersion, t.locale) && (
                <div className="about-card">
                  <div className="about-head">
                    <span className="about-label">{t('browse.aboutVersion')}</span>
                    <span className="about-id mono">{selectedVersion.id}</span>
                  </div>
                  <p className="about-text">
                    {describeVersion(selectedVersion, t.locale)}
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <LoaderInstallDialog
        mcVersion={selected}
        open={loaderDialogOpen}
        onClose={() => setLoaderDialogOpen(false)}
        onInstalled={async (versionId) => {
          await refreshInstalled();
          // Селект остаётся на базовой MC-версии: лоадер впитывает её.
          // Активной делаем именно лоадер, чтобы "Играть" запустила его.
          onSettingsChange({ ...settings, lastVersionId: versionId });
          setStatus(t('browse.installedStatus', { id: versionId }));
          setStatusType("success");
        }}
      />
    </div>
  );
};
