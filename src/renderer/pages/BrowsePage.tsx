import React, { useEffect, useMemo, useState } from "react";
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
  IconInfo,
  IconAlert,
  IconCheck,
  IconSearch,
  IconFolder,
  IconRefresh,
  IconCube,
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
    old_beta: t('browse.typeBeta'),
    old_alpha: t('browse.typeAlpha'),
    bedrock: "Bedrock",
  };
  // Английские синоимы типов — чтобы «beta»/«snapshot» находились в любой локали.
  const typeEn: Record<string, string> = {
    release: 'release',
    snapshot: 'snapshot',
    old_beta: 'beta',
    old_alpha: 'alpha',
    bedrock: 'bedrock',
  };
  // TrelEmu pack — Windows-only (qemu-system-x86_64.exe, scrcpy.exe, adb.exe).
  // На Linux/macOS скрываем вкладку Bedrock Edition целиком.
  const isWin = window.api.platform === 'win32';
  const [edition, setEdition] = useState<'java' | 'bedrock'>(isWin ? 'java' : 'java');
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [bedrockVersions, setBedrockVersions] = useState<BedrockVersionInfo[]>([]);
  const [bedrockInstalled, setBedrockInstalled] = useState<Set<string>>(new Set());
  const [trelEmuStatus, setTrelEmuStatus] = useState<TrelEmuStatus>({ state: 'unknown' });
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<InstalledVersionDetail[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [filters, setFilters] = useState<Filter[]>(["release"]);
  // Мультивыбор типов: клик по чипу добавляет/убирает тип.
  // «Все» сбрасывает на всё; пустой выбор не оставляем — откат на «все».
  const toggleFilter = (id: Filter) => {
    setFilters((prev) => {
      if (id === 'all') return ['all'];
      const next = prev.includes(id)
        ? prev.filter((f) => f !== id)
        : [...prev.filter((f) => f !== 'all'), id];
      return next.length ? next : ['all'];
    });
  };
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
    // Поиск v3: числовые (версионные) токены матчатся по границам сегментов id
    // («1.0» находит только 1.0, а не даты и не 1.10.2), текстовые — по описанию
    // патча и типу версии. Несколько слов — каждое должно найтись (И).
    const q = query.trim().toLowerCase();
    const parts = q ? q.split(/\s+/).filter(Boolean) : [];
    const segMatch = (id: string, p: string) =>
      id === p || id.startsWith(p + '.') || id.startsWith(p + '-') || id.includes('.' + p) || id.includes('-' + p);
    const matchPart = (id: string, hay: string, p: string) =>
      /^\d/.test(p) ? segMatch(id, p) : hay.includes(p);
    if (edition === 'bedrock') {
      return bedrockVersions.filter((v) => {
        if (!parts.length) return true;
        const id = v.id.toLowerCase();
        const hay = bedrockDisplayName(v.id, t.locale as any).toLowerCase();
        return parts.every((p) => matchPart(id, hay, p));
      }).map(v => ({ ...v, type: 'bedrock' as const, url: '' }));
    }
    return versions.filter((v) => {
      if (parts.length) {
        const id = v.id.toLowerCase();
        const hay = [describeVersion(v as VersionInfo, t.locale), typeLabel[v.type] ?? '', typeEn[v.type] ?? '', v.type]
          .join(' ').toLowerCase();
        if (!parts.every((p) => matchPart(id, hay, p))) return false;
      }
      if (filters.includes("all")) return true;
      return filters.includes(v.type);
    });
  }, [edition, versions, bedrockVersions, query, filters, t.locale]);

  // Пока пользователь ищет, панель деталей следует за первым результатом —
  // иначе под списком остаётся «поломанный» блок старой выбранной версии,
  // которой нет в выдаче.
  useEffect(() => {
    if (!query.trim()) return;
    if (filtered.length && !filtered.some((v) => v.id === selected)) {
      setSelected(filtered[0].id);
    }
  }, [query, filtered, selected]);

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
    <div className="page-frame">
      <div className="page-head">
        <span className="eyebrow">{t('browse.eyebrow')}</span>
        <div className="page-head-row">
          <div>
            <h1 className="page-title">{edition === 'bedrock' ? 'Bedrock' : t('browse.title')} <span className="count">{edition === 'bedrock' ? bedrockVersions.length : versions.length}</span></h1>
            <p className="page-sub">{t('browse.subtitle')}</p>
          </div>
          {edition === 'java' ? (
            <div className="head-chips">
              <span className="chip"><b>{versions.length}</b> {t('browse.available')}</span>
              <span className="chip success"><b>{effectiveInstalledCount(details)}</b> {t('browse.installed')}</span>
            </div>
          ) : (
            <div className="head-chips">
              <span className="chip"><b>{bedrockVersions.length}</b> {t('browse.available')}</span>
              <span className="chip success"><b>{bedrockInstalled.size}</b> {t('browse.installed')}</span>
            </div>
          )}
        </div>
      </div>

      <div>
          <div className="edition-switch">
            <button className={"ed-btn" + (edition === 'java' ? ' on' : '')} onClick={() => { setEdition('java'); setFilters(['release']); }}>Java</button>
            {isWin && (
              <button className={"ed-btn" + (edition === 'bedrock' ? ' on' : '')} onClick={() => { setEdition('bedrock'); }}>Bedrock + TrelEmu</button>
            )}
          </div>

          {isWin && edition === 'bedrock' && (
            <div style={{ marginTop: 12, marginBottom: 8 }}>
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

          <div className="toolbar">
            <div className="search-wrap">
              <IconSearch />
              <input
                className="input"
                placeholder={t('browse.searchPlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {edition === 'java' && filterTabs.map((tab) => (
              <button
                key={tab.id}
                className={"ftype k-" + tab.accent + (filters.includes(tab.id) ? ' on' : '')}
                onClick={() => toggleFilter(tab.id)}
              >
                {tab.label} <span className="cnt">{tab.c}</span>
              </button>
            ))}
          </div>

          {edition === 'java' && (
            <div className="vcount">{t('browse.shown')} <b>{filtered.length}</b> {t('browse.shownOf')} <b>{filters.includes('all') ? counts.all : filterTabs.reduce((s, tab) => (filters.includes(tab.id) ? s + tab.c : s), 0)}</b> {filters.includes('all') ? t('browse.filterAll') : filterTabs.filter((tab) => filters.includes(tab.id)).map((tab) => tab.label).join(' + ')}{' '}· {t('browse.autoRefresh')}</div>
          )}

          <div className="vlist">
            {filtered.length === 0 ? (
              <div className="empty">{t('browse.nothingFound')}</div>
            ) : (
              filtered.map((v) => {
                const rowLoaders = edition === 'bedrock' ? [] : (loadersByBase.get(v.id) ?? []);
                const isInst = edition === 'bedrock' ? bedrockInstalled.has(v.id) : (installed.has(v.id) || rowLoaders.length > 0);
                const isSel = selected === v.id;
                const lastId = settings.lastVersionId;
                const isLastPlayed = v.id === lastId || rowLoaders.some((l) => l.id === lastId);
                const noSkin = !supportsCustomSkin(v.id);
            const rowProgress = progress && (progress as any).versionId === v.id ? progress : null;
            const isBedrock = v.type === 'bedrock';
            const displayName = isBedrock ? bedrockDisplayName(v.id, t.locale as any) : v.id;
            return (
              <div
                key={`${edition}:${v.id}`}
                className={"vrow" + (isSel ? " sel" : '') + (v.type === 'snapshot' ? " snapshot" : '') + (isBedrock ? " bedrock" : '') + (isInst ? " installed" : '') + (rowProgress && (rowProgress as any).percent > 0 && (rowProgress as any).percent < 100 ? " downloading" : '')}
                onClick={() => setSelected(v.id)}
              >
                <div className="v-id">{displayName}</div>
                <div className="v-body">
                  <div className="v-name">{isBedrock ? bedrockDisplayName(v.id, t.locale as any) : (describeVersion(v as VersionInfo, t.locale) || v.id)}</div>
                  <div className="v-desc">{isBedrock ? bedrockDisplayName(v.id, t.locale as any) : v.id}</div>
                </div>
                <div className="v-tags">
                  <span className={"chip " + v.type}>{typeLabel[v.type] ?? v.type}</span>
                  {isInst && <span className="chip solid">✓ {t('browse.isInstalled')}</span>}
                  {isLastPlayed && <span className="chip green">{t('browse.played')}</span>}
                  {noSkin && <span className="chip warn" title={t('browse.noSkinLong')}>{t('browse.noSkins')}</span>}
                </div>
                <div className="loaders">
                  {rowLoaders.map((l) => (
                    <span key={l.id} className={"ldr " + l.loader}>{loaderLabel[l.loader!]}</span>
                  ))}
                </div>
                <div className="v-date">{new Date(v.releaseTime).toLocaleDateString(t.locale === 'en' ? 'en-US' : 'ru-RU')}</div>
                <div className="v-actions">
                  <button className="btn primary sm" disabled={!canAct || !account} onClick={(e) => { e.stopPropagation(); onInstallAndPlay(); }}>
                    {isInst ? <><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>{t('browse.btnPlay')}</> : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>{t('browse.btnInstall')}</>}
                  </button>
                </div>
                <div className="v-dl">
                  {rowProgress && (rowProgress as any).percent > 0 && (rowProgress as any).percent < 100 ? (
                    <><div className="progress" style={{ flex: 1 }}><i style={{ width: (rowProgress as any).percent + '%' }}></i></div><span className="pct">{(rowProgress as any).percent}% · {formatProgressBytes(rowProgress as DownloadProgress, t)}</span></>
                  ) : ''}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selected && !query.trim() && (
        <div className="section">
          <div className="section-head">
            <h3>{edition === 'bedrock' ? bedrockDisplayName(selected, t.locale as any) : selected}</h3>
          </div>
          {!account && (
            <div className="banner">
              <div>
                <h2>{t('browse.noAccount')}</h2>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('browse.noAccountHint')}</div>
              </div>
              <button className="btn primary" onClick={onGoToAccounts}>{t('browse.toAccounts')}</button>
            </div>
          )}
          {status && !busy && (
            <div key={`${statusType}:${status}`} className={(statusType === "error" ? "status-line status-line-prominent " : "status-toast ") + statusType}>
              {statusType === "error" ? <IconAlert /> : statusType === "success" ? <IconCheck /> : <IconInfo />}
              <span>{status}</span>
            </div>
          )}
          {busy && progress && (
            <div className="hero-progress">
              <div className="ab-progress-info">
                <span className="ab-progress-stage">{progress.stage}</span>
                <span>{formatProgressBytes(progress, t)}{progress.percent}%</span>
                  {edition === 'bedrock' && <button className="btn cancel-btn" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }} onClick={() => window.api.bedrock.cancelDownload()}>{t('browse.cancel')}</button>}
              </div>
              <div className="ab-progress-bar"><div className="fill" style={{ width: `${Math.min(100, Math.max(0, Number.isFinite(progress.percent) ? progress.percent : 0))}%` }}></div></div>
            </div>
          )}
          {selectedVersion && describeVersion(selectedVersion as VersionInfo, t.locale) && (
            <div className="about-card">
              <div className="about-head">
                <span className="about-label">{t('browse.aboutVersion')}</span>
                <span className="about-id mono">{selectedVersion.id}</span>
              </div>
              <p className="about-text">{describeVersion(selectedVersion as VersionInfo, t.locale)}</p>
            </div>
          )}
          {edition === 'java' && isLoaderVersion && (
            <button className="btn" disabled={!selected || busy} onClick={() => setLoaderDialogOpen(true)}><IconCube /> {t('browse.modLoader')}</button>
          )}
          {edition === 'java' && loadersForSel.length > 0 && (
            <button className="btn" disabled={busy} onClick={onRevertToVanilla} title={t('browse.revertTooltip')}><IconRefresh /> {t('browse.revertToVanilla')}</button>
          )}
          {edition === 'java' && isInstalled && (
            <button className="btn" disabled={!selected} onClick={() => selected && window.api.minecraft.openFolder("version", selected)}><IconFolder /> {t('browse.versionFolder')}</button>
          )}
          {edition === 'bedrock' && isInstalled && (
            <button className="btn" disabled={!selected} onClick={() => selected && window.api.bedrock.openFolder(selected)}><IconFolder /> {t('browse.versionFolder')}</button>
          )}
          {edition === 'java' && !isInstalled && (
            <button className="btn" disabled={!selected || busy} onClick={onInstallOnly}><IconRefresh /> {t('browse.downloadOnly')}</button>
          )}
          {edition === 'bedrock' && !isInstalled && (
            <button className="btn" disabled={!selected || busy} onClick={onInstallOnly}><IconRefresh /> {t('browse.downloadOnly')}</button>
          )}
        </div>
      )}

      <p className="note">{t('browse.loadersNote')}</p>

      <LoaderInstallDialog
        mcVersion={selected}
        open={loaderDialogOpen}
        onClose={() => setLoaderDialogOpen(false)}
        onInstalled={async (versionId) => {
          await refreshInstalled();
          onSettingsChange({ ...settings, lastVersionId: versionId, lastVersionEdition: 'java' });
          setStatus(t('browse.installedStatus', { id: versionId }));
          setStatusType("success");
        }}
      />
    </div>
    </div>
  );
};