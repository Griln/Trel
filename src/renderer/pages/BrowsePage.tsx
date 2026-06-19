import React, { useEffect, useMemo, useState, memo } from "react";
import type {
  DownloadProgress,
  LauncherSettings,
  MinecraftAccount,
  VersionInfo,
  BedrockVersionInfo,
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
import { bedrockDisplayName, describeVersion } from "../data/versions";
import { LoaderInstallDialog } from "../components/LoaderInstallDialog";
import { useDialog } from "../components/Dialog";
import { supportsCustomSkin } from "../../shared/skin-support";
import { effectiveInstalledCount } from "../../shared/installed";
import { formatProgressBytes } from '../util/format';
import { useT } from '../i18n';

interface TrelEmuStatus {
  state: 'unknown' | 'not-found' | 'downloading' | 'found' | 'starting' | 'running' | 'error';
  adbPort?: number;
  memoryMb?: number;
  cpuCores?: number;
  hasSnapshot?: boolean;
  source?: 'downloaded' | 'portable' | 'bundled' | 'dev' | 'unknown';
  root?: string;
  error?: string;
  downloadProgress?: {
    downloaded: number;
    total: number;
    ratio: number;
    speed: number;
    message: string;
    resumedFrom?: number;
  };
}

function normalizeBedrockVersions(list: BedrockVersionInfo[]): BedrockVersionInfo[] {
  const byId = new Map<string, BedrockVersionInfo>();
  for (const v of list) {
    if (!v?.id) continue;
    const prev = byId.get(v.id);
    if (!prev || ((v.postId ?? 0) > (prev.postId ?? 0))) byId.set(v.id, v);
  }
  return Array.from(byId.values()).sort((a, b) => (b.postId ?? 0) - (a.postId ?? 0));
}

function isTechnicalTimeoutMessage(message: string): boolean {
  const m = String(message || '');
  return /(?:8000|8_000).*?(?:timeout|timed out|exceeded)|(?:timeout|timed out|exceeded).*?(?:8000|8_000)|TimeoutError/i.test(m);
}

function isTransientTrelEmuTimeout(message: string): boolean {
  const m = String(message || '');
  return isTechnicalTimeoutMessage(m) || (/timeout|timed out|exceeded/i.test(m) && /adb|cmd package|pm |dumpsys|resolve-activity|am start|pidof|logcat/i.test(m));
}

function shortTrelEmuError(message: string, t: ReturnType<typeof useT>): string {
  if (isTransientTrelEmuTimeout(message)) {
    return t('trelemu.timeoutHidden');
  }
  return message;
}

function normalizeUiError(message: string, t: ReturnType<typeof useT>): string {
  if (isTechnicalTimeoutMessage(message)) {
    return t('trelemu.slowOperation');
  }
  return message;
}

const TrelEmuBar: React.FC<{
  status: TrelEmuStatus;
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
  onDownload: () => void;
  onCancelDownload: () => void;
  t: ReturnType<typeof useT>;
}> = ({ status, onStart, onStop, onRefresh, onDownload, onCancelDownload, t }) => {
  if (status.state === 'not-found') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span className="chip warn">{t('trelemu.notInstalled')}</span>
        <span className="muted" style={{ fontSize: 11 }}>
          {t('trelemu.downloadHint')}
        </span>
        <button
          className="btn"
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={onDownload}
          title={t('trelemu.downloadTitle')}
        >
          {t('trelemu.download')}
        </button>
        <button
          className="btn"
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={onRefresh}
          title={t('trelemu.refreshTitle')}
        >
          <IconRefresh />
        </button>
      </div>
    );
  }

  if (status.state === 'downloading') {
    const p = status.downloadProgress;
    const pct = p ? Math.round(p.ratio * 100) : 0;
    const speedMB = p ? (p.speed / 1024 / 1024).toFixed(1) : '0.0';
    const isResuming = !!(p && p.resumedFrom && p.resumedFrom > 0);
    return (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: 1 }}>
        <span className="chip accent">{isResuming ? t('trelemu.resuming') : t('trelemu.downloading')}</span>
        <div style={{ flex: 1, minWidth: 120, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent, #5b8def)', transition: 'width 0.2s' }} />
        </div>
        <span className="muted" style={{ fontSize: 11, minWidth: 80 }}>
          {pct}% · {speedMB} {t('trelemu.speed')}
        </span>
        <button
          className="btn"
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={onCancelDownload}
          title={t('trelemu.cancelTitle')}
        >
          {t('trelemu.cancel')}
        </button>
      </div>
    );
  }

  if (status.state === 'starting') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span className="chip accent">{t('trelemu.starting')}</span>
        <span className="muted" style={{ fontSize: 11 }}>
          {t('trelemu.bootingHint')}
        </span>
      </div>
    );
  }

  if (status.state === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span className="chip error">{t('trelemu.error')}</span>
          <button
            className="btn"
            style={{ padding: '2px 8px', fontSize: 11 }}
            onClick={onStart}
          >
            {t('trelemu.retry')}
          </button>
          <button
            className="btn"
            style={{ padding: '2px 8px', fontSize: 11 }}
            onClick={onRefresh}
          >
            <IconRefresh />
          </button>
        </div>
        {status.error && (
          <pre
            className="muted"
            style={{
              fontSize: 10,
              margin: 0,
              padding: '6px 8px',
              background: 'rgba(255,80,80,0.08)',
              border: '1px solid rgba(255,80,80,0.3)',
              borderRadius: 4,
              maxHeight: 120,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'ui-monospace, Consolas, monospace',
            }}
          >
            {status.error}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <span className={'chip ' + (status.state === 'running' ? 'success' : 'accent')}>
        {status.state === 'running'
          ? t('trelemu.ready')
          : status.source === 'downloaded'
            ? t('trelemu.downloaded')
            : status.source === 'portable'
              ? t('trelemu.portable')
              : status.source === 'bundled'
                ? t('trelemu.bundled')
                : t('trelemu.installed')}
      </span>
      {status.adbPort && (
        <span className="muted" style={{ fontSize: 11 }}>
          ADB: 127.0.0.1:{status.adbPort}
          {status.memoryMb ? ` · ${status.memoryMb} ${t('trelemu.mb')}` : ''}
          {status.cpuCores ? ` · ${status.cpuCores} ${t('trelemu.cores')}` : ''}
          {status.hasSnapshot === true ? ' · ⚡ snapshot' : ''}
          {status.hasSnapshot === false ? ' · 🐢 cold boot' : ''}
        </span>
      )}
      {status.state === 'found' && (
        <button
          className="btn"
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={onStart}
          title={status.hasSnapshot ? t('trelemu.snapshotTitle') : t('trelemu.coldBootTitle')}
        >
          {t('trelemu.start')}
        </button>
      )}
      {status.state === 'running' && (
        <button
          className="btn"
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={onStop}
          title={t('trelemu.stopTitle')}
        >
          {t('trelemu.stop')}
        </button>
      )}
      <button
        className="btn"
        style={{ padding: '2px 8px', fontSize: 11 }}
        onClick={onRefresh}
        title={t('trelemu.refreshTitle')}
      >
        <IconRefresh />
      </button>
    </div>
  );
};

const loaderLabel: Record<LoaderType, string> = {
  fabric: "Fabric",
  quilt: "Quilt",
  forge: "Forge",
  neoforge: "NeoForge",
};

interface RowProps {
  v: VersionInfo | BedrockVersionInfo;
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
  const isBedrock = v.type === 'bedrock';
  const displayName = isBedrock ? bedrockDisplayName(v.id, locale as any) : v.id;
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
          {displayName}
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
    bedrock: "Bedrock",
  };
  const [edition, setEdition] = useState<'java' | 'bedrock'>('java');
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [bedrockVersions, setBedrockVersions] = useState<BedrockVersionInfo[]>([]);
  const [bedrockInstalled, setBedrockInstalled] = useState<Set<string>>(new Set());
  const [trelEmuStatus, setTrelEmuStatus] = useState<TrelEmuStatus>({ state: 'unknown' });
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
  const setUiError = (message: string) => {
    const normalized = normalizeUiError(message, t);
    setStatus(t('browse.errorStatus', { message: normalized }));
    setStatusType(isTechnicalTimeoutMessage(message) ? "neutral" : "error");
  };
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

  const refreshTrelEmu = async () => {
    try {
      const info = await window.api.bedrock.trelEmuInfo();
      if (!info.found) {
        setTrelEmuStatus({ state: 'not-found' });
        return;
      }
      const running = await window.api.bedrock.trelEmuStatus();
      if (running) {
        setTrelEmuStatus({
          state: 'running',
          adbPort: info.adbPort,
          memoryMb: info.memoryMb,
          cpuCores: info.cpuCores,
          hasSnapshot: info.hasSnapshot,
          source: info.source,
          root: info.root,
        });
      } else {
        setTrelEmuStatus({
          state: 'found',
          adbPort: info.adbPort,
          memoryMb: info.memoryMb,
          cpuCores: info.cpuCores,
          hasSnapshot: info.hasSnapshot,
          source: info.source,
          root: info.root,
        });
      }
    } catch (e) {
      const message = (e as Error).message;
      setTrelEmuStatus((prev) => ({ ...prev, state: isTransientTrelEmuTimeout(message) ? 'found' : 'error', error: isTransientTrelEmuTimeout(message) ? undefined : shortTrelEmuError(message, t) }));
    }
  };

  const startTrelEmu = async () => {
    setTrelEmuStatus((s) => ({ ...s, state: 'starting', error: undefined }));
    try {
      const r = await window.api.bedrock.trelEmuStart();
      setTrelEmuStatus((s) => ({
        ...s,
        state: 'running',
        adbPort: r.serial.startsWith('127.0.0.1:') ? Number(r.serial.split(':')[1]) : s.adbPort,
      }));
    } catch (e) {
      const message = (e as Error).message;
      if (isTransientTrelEmuTimeout(message)) {
        setTrelEmuStatus((prev) => ({ ...prev, state: 'starting', error: undefined }));
        setTimeout(() => { refreshTrelEmu().catch(() => {}); }, 3000);
      } else {
        setTrelEmuStatus({ state: 'error', error: shortTrelEmuError(message, t) });
      }
    }
  };

  const stopTrelEmu = async () => {
    try {
      await window.api.bedrock.trelEmuStop();
    } catch {}
    await refreshTrelEmu();
  };

  const downloadTrelEmu = async () => {
    setTrelEmuStatus((s) => ({ ...s, state: 'downloading', error: undefined, downloadProgress: { downloaded: 0, total: 0, ratio: 0, speed: 0, message: 'Начинаем…' } }));
    try {
      const r = await window.api.bedrock.trelEmuDownload();
      if (r.ok) {
        await refreshTrelEmu();
        setStatus(t('trelemu.installedAt', { path: r.target || '' }));
        setStatusType('success');
      } else {
        { const message = r.error || t('trelemu.unknownError'); setTrelEmuStatus((prev) => isTransientTrelEmuTimeout(message) ? ({ ...prev, state: 'found', error: undefined }) : ({ state: 'error', error: shortTrelEmuError(message, t) })); }
      }
    } catch (e) {
      { const message = (e as Error).message; setTrelEmuStatus((prev) => isTransientTrelEmuTimeout(message) ? ({ ...prev, state: 'found', error: undefined }) : ({ state: 'error', error: shortTrelEmuError(message, t) })); }
    }
  };

  const cancelDownloadTrelEmu = async () => {
    try { await window.api.bedrock.trelEmuDownloadCancel(); } catch {}
    // Событие 'cancelled' придёт через onDownloadProgress и сбросит state
  };

  useEffect(() => {
    // Подписываемся на прогресс скачивания TrelEmu pack. Один раз.
    const off = window.api.bedrock.onDownloadProgress((p) => {
      if (p.state === 'downloading' || p.state === 'verifying' || p.state === 'extracting') {
        setTrelEmuStatus((s) => ({
          ...s,
          state: 'downloading',
          downloadProgress: {
            downloaded: p.downloaded,
            total: p.total,
            ratio: p.ratio,
            speed: p.speed,
            message: p.message,
            resumedFrom: p.resumedFrom,
          },
        }));
      } else if (p.state === 'error') {
        { const message = p.error || p.message; setTrelEmuStatus((s) => isTransientTrelEmuTimeout(message) ? ({ ...s, state: 'found', error: undefined }) : ({ ...s, state: 'error', error: shortTrelEmuError(message, t) })); }
      } else if (p.state === 'cancelled') {
        // Возвращаемся к not-found чтобы дать юзеру ретрай
        setTrelEmuStatus({ state: 'not-found' });
      }
    });
    return () => { off(); };
  }, []);

  const refreshBedrock = async () => {
    try {
      const [list, ids] = await Promise.all([
        window.api.bedrock.versions(),
        window.api.bedrock.installed(),
      ]);
      setBedrockVersions(normalizeBedrockVersions(list));
      setBedrockInstalled(new Set(ids));
      const normalized = normalizeBedrockVersions(list);
      if (!selected && normalized.length) setSelected(normalized[0].id);
    } catch (e) {
      setUiError(t('browse.loadError', { message: normalizeUiError((e as Error).message, t) }));
    }
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
        setUiError(t('browse.loadError', { message: normalizeUiError((e as Error).message, t) }));
      });
    refreshInstalled();

    // Pre-fetch Bedrock count in background
    window.api.bedrock.versions().then((list) => {
      if (!cancelled) setBedrockVersions(normalizeBedrockVersions(list));
    }).catch(() => {});
    window.api.bedrock.installed().then((ids) => {
      if (!cancelled) setBedrockInstalled(new Set(ids));
    }).catch(() => {});

    const offProgress = window.api.minecraft.onProgress(setProgress);
    const offBedrockProgress = window.api.bedrock.onProgress(setProgress);
    let launchHoldTimer: number | null = null;
    const clearLaunchHold = () => {
      if (launchHoldTimer !== null) {
        window.clearTimeout(launchHoldTimer);
        launchHoldTimer = null;
      }
    };
    const offExit = window.api.minecraft.onExit((code) => {
      clearLaunchHold();
      setStatus(t('browse.exitStatus', { code: String(code) }));
      setStatusType(code === 0 ? "success" : "error");
      setBusy(false);
    });
    const offLaunchStart = window.api.minecraft.onLaunchStart(() => {
      clearLaunchHold();
      launchHoldTimer = window.setTimeout(() => {
        setBusy(false);
        launchHoldTimer = null;
      }, 3000);
    });
    const offManifest = window.api.minecraft.onManifestUpdated((details) => {
      setDetails(details);
      const ids = details.map((d) => d.id);
      setInstalled(new Set(ids));
    });
    return () => {
      clearLaunchHold();
      offProgress();
      offBedrockProgress();
      offExit();
      offLaunchStart();
      offManifest();
    };
  }, []);

  // Fetch Bedrock data when switching to Bedrock tab
  useEffect(() => {
    if (edition !== 'bedrock') return;
    let cancelled = false;
    (async () => {
      try {
        const [list, ids] = await Promise.all([
          window.api.bedrock.versions(),
          window.api.bedrock.installed(),
        ]);
        if (cancelled) return;
        setBedrockVersions(normalizeBedrockVersions(list));
        setBedrockInstalled(new Set(ids));
        if (list.length) {
          const anySelected = list.some((v) => v.id === selected);
          if (!anySelected) setSelected(list[0].id);
        }
      } catch (e) {
        if (cancelled) return;
        setUiError(t('browse.loadError', { message: normalizeUiError((e as Error).message, t) }));
      }
      // Каждый раз при заходе на вкладку Bedrock пересканируем TrelEmu —
      // быстрая проверка готовности bundled-эмулятора.
      if (!cancelled) await refreshTrelEmu();
    })();
    return () => { cancelled = true; };
  }, [edition]);

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
    if (edition === 'bedrock') {
      return bedrockVersions.filter((v) => {
        if (query && !v.id.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      }).map(v => ({ ...v, type: 'bedrock' as const, url: '' }));
    }
    return versions.filter((v) => {
      if (query && !v.id.toLowerCase().includes(query.toLowerCase()))
        return false;
      if (filter === "all") return true;
      return v.type === filter;
    });
  }, [edition, versions, bedrockVersions, query, filter]);

  const selectedVersion = (edition === 'bedrock'
    ? bedrockVersions.find((v) => v.id === selected)
    : versions.find((v) => v.id === selected)) as VersionInfo | BedrockVersionInfo | undefined;
  const selectedBedrock = edition === 'bedrock'
    ? bedrockVersions.find((v) => v.id === selected)
    : undefined;
  // Лоадеры, установленные для выбранной MC версии
  const loadersForSel = selected && edition === 'java' ? (loadersByBase.get(selected) ?? []) : [];
  const primaryLoader = loadersForSel[0] ?? null;
  // То, что мы реально запустим, если нажать "Играть":
  // если стоит лоадер — лоадер впитывает ваниль; иначе — голая версия.
  const launchId = primaryLoader ? primaryLoader.id : selected;
  const isInstalled = edition === 'bedrock'
    ? !!(selected && bedrockInstalled.has(selected))
    : !!(
        selected &&
        (installed.has(selected) || primaryLoader)
      );
  const canAct = !!account && !!selected && !busy && !(settings.lockOnLaunch && gameRunning);

  const counts = useMemo(() => {
    if (edition === 'bedrock') {
      return { all: bedrockVersions.length, release: 0, snapshot: 0, old_beta: 0, old_alpha: 0 };
    }
    const c = {
      all: versions.length,
      release: 0,
      snapshot: 0,
      old_beta: 0,
      old_alpha: 0,
    };
    for (const v of versions) (c as any)[v.type]++;
    return c;
  }, [edition, versions, bedrockVersions]);

  const onInstallAndPlay = async () => {
    if (!account || !selected) return;
    if (edition === 'bedrock') {
      await onBedrockInstallAndPlay();
      return;
    }
    setBusy(true);
    setStatusType("neutral");
    try {
      if (!isInstalled) {
        setStatus(t('browse.downloadingStatus', { id: selected }));
        await window.api.minecraft.install(selected);
        await refreshInstalled();
        setStatus(t('browse.installedStatus', { id: selected }));
        setStatusType("success");
        onSettingsChange({ ...settings, lastVersionId: selected, lastVersionEdition: edition });
        return;
      }
      setStatus(t('browse.launchingStatus'));
      onSettingsChange({ ...settings, lastVersionId: launchId, lastVersionEdition: 'java' });
      await window.api.minecraft.launch({
        versionId: launchId,
        account,
        memoryMb: settings.memoryMb,
      });
      setStatus(t('browse.runningStatus'));
      setStatusType("success");
    } catch (e) {
      setUiError((e as Error).message);
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
      onSettingsChange({ ...settings, lastVersionId: selected, lastVersionEdition: edition });
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
      if (edition === 'bedrock') {
        await window.api.bedrock.install(selected);
        await refreshBedrock();
      } else {
        await window.api.minecraft.install(selected);
        await refreshInstalled();
      }
      setStatus(t('browse.installedStatus', { id: selected }));
      setStatusType("success");
    } catch (e) {
      setUiError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onBedrockInstallAndPlay = async () => {
    if (!account || !selected) return;
    setBusy(true);
    setStatusType("neutral");
    try {
      const isInst = bedrockInstalled.has(selected);
      if (!isInst) {
        setStatus(t('browse.downloadingStatus', { id: selected }));
        await window.api.bedrock.install(selected);
        await refreshBedrock();
        setStatus(t('browse.installedStatus', { id: selected }));
        setStatusType("success");
      }
      // Передаём пустой serial — main process сам поднимет TrelEmu.
      // (Если TrelEmu не входит в бандл, пользователь увидит понятную ошибку.)
      setStatus(t('browse.launchingStatus'));
      await window.api.bedrock.launch(selected, '');
      onSettingsChange({ ...settings, lastVersionId: selected, lastVersionEdition: edition });
      setStatus(t('browse.runningStatus'));
      setStatusType("success");
    } catch (e) {
      setUiError((e as Error).message);
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

  const isLoaderVersion = edition === 'java' && !!selected && /^1\.\d+(\.\d+)?$/.test(selected);

  return (
    <div className="catalog">
      <header className="catalog-head">
        <div>
          <h1>{t('browse.title')}</h1>
          <p>{t('browse.subtitle')}</p>
          <div className="lib-side-tabs" style={{ marginTop: 8 }}>
            <button className={"side-tab tab-release" + (edition === 'java' ? " active" : "")} onClick={() => { setEdition('java'); setFilter('release'); }}>
              <span className="side-tab-dot" />
              <span className="side-tab-label">Java Edition</span>
              <span className="count">{versions.length}</span>
            </button>
            <button className={"side-tab tab-bedrock" + (edition === 'bedrock' ? " active" : "")} onClick={() => { setEdition('bedrock'); }}>
              <span className="side-tab-dot" style={{ background: '#00a8ff' }} />
              <span className="side-tab-label">Bedrock Edition</span>
              <span className="count">{bedrockVersions.length || '...'}</span>
            </button>
          </div>
        </div>
        <div className="catalog-head-stats">
          {edition === 'java' ? (
            <>
              <span className="chip">
                <b>{versions.length}</b> {t('browse.available')}
              </span>
              <span className="chip success">
                <b>{effectiveInstalledCount(details)}</b> {t('browse.installed')}
              </span>
            </>
          ) : (
            <>
              <span className="chip">
                <b>{bedrockVersions.length}</b> {t('browse.available')}
              </span>
              <span className="chip success">
                <b>{bedrockInstalled.size}</b> {t('browse.installed')}
              </span>
            </>
          )}
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
            {edition === 'java' ? (
              filterTabs.map((tab) => (
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
              ))
            ) : (
              <button className="side-tab tab-bedrock active">
                <span className="side-tab-dot" style={{ background: '#00a8ff' }} />
                <span className="side-tab-label">Bedrock</span>
                <span className="count">{counts.all}</span>
              </button>
            )}
          </div>

          <div className="catalog-list-scroll">
            {filtered.length === 0 ? (
              <div className="empty">{t('browse.nothingFound')}</div>
            ) : (
              filtered.map((v) => {
                const rowLoaders = edition === 'bedrock' ? [] : (loadersByBase.get(v.id) ?? []);
                const isInst = edition === 'bedrock' ? bedrockInstalled.has(v.id) : (installed.has(v.id) || rowLoaders.length > 0);
                const isSel = selected === v.id;
                const lastId = settings.lastVersionId;
                const isLastPlayed =
                  v.id === lastId || rowLoaders.some((l) => l.id === lastId);
                const noSkin = !supportsCustomSkin(v.id);
                return (
                  <VersionRow
                    key={`${edition}:${v.id}`}
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

              {status && !busy && (
                <div
                  key={`${statusType}:${status}`}
                  className={(statusType === "error" ? "status-line status-line-prominent " : "status-toast ") + statusType}
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
                  <h2 className="catalog-hero-title">{edition === 'bedrock' ? bedrockDisplayName(selected, t.locale as any) : selected}</h2>
                  <div className="catalog-hero-meta">
                    {edition === 'bedrock' && selectedBedrock ? (
                      <>
                        <span className="tag bedrock">Bedrock</span>
                        <span className="chip">
                          {new Date(selectedBedrock.releaseTime).toLocaleDateString(t.locale === 'en' ? 'en-US' : 'ru-RU')}
                        </span>
                        {isInstalled && (
                          <span className="chip accent">
                            <IconCheck /> .apk
                          </span>
                        )}
                      </>
                    ) : selectedVersion && (
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
                  {edition === 'bedrock' && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <TrelEmuBar
                        status={trelEmuStatus}
                        onStart={startTrelEmu}
                        onStop={stopTrelEmu}
                        onRefresh={refreshTrelEmu}
                        onDownload={downloadTrelEmu}
                        onCancelDownload={cancelDownloadTrelEmu}
                        t={t}
                      />
                    </div>
                  )}
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
                      {edition === 'bedrock' && (
                        <button
                          className="btn cancel-btn"
                          style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
                          onClick={() => window.api.bedrock.cancelDownload()}
                        >
                          Отмена
                        </button>
                      )}
                    </div>
                    <div className="ab-progress-bar">
                      <div
                        className="fill"
                        style={{ width: progress.percent + "%" }}
                      >
                      </div>
                    </div>
                  </div>
                )}

                <div className="catalog-hero-tools">
                  {edition === 'bedrock' ? (
                    <>
                      {!isInstalled && (
                        <button className="btn" disabled={!selected || busy} onClick={onInstallOnly}>
                          <IconRefresh /> {t('browse.downloadOnly')}
                        </button>
                      )}
                      {isInstalled && (
                        <button className="btn" disabled={!selected}
                          onClick={() => selected && window.api.bedrock.openFolder(selected)}
                        >
                          <IconFolder /> {t('browse.versionFolder')}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {!isInstalled && (
                        <button className="btn" disabled={!selected || busy} onClick={onInstallOnly}>
                          <IconRefresh /> {t('browse.downloadOnly')}
                        </button>
                      )}
                      {isInstalled && (
                        <button className="btn" disabled={!selected}
                          onClick={() => selected && window.api.minecraft.openFolder("version", selected)}
                        >
                          <IconFolder /> {t('browse.versionFolder')}
                        </button>
                      )}
                      {isLoaderVersion && (
                        <button className="btn" disabled={!selected || busy} onClick={() => setLoaderDialogOpen(true)}>
                          <IconCube /> {t('browse.modLoader')}
                        </button>
                      )}
                      {loadersForSel.length > 0 && (
                        <button className="btn" disabled={busy} onClick={onRevertToVanilla} title={t('browse.revertTooltip')}>
                          <IconRefresh /> {t('browse.revertToVanilla')}
                        </button>
                      )}
                    </>
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
          onSettingsChange({ ...settings, lastVersionId: versionId, lastVersionEdition: 'java' });
          setStatus(t('browse.installedStatus', { id: versionId }));
          setStatusType("success");
        }}
      />
    </div>
  );
};
