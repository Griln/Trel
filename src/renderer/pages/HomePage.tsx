import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { BedrockVersionInfo, DownloadProgress, LauncherSettings, MinecraftAccount, VersionInfo } from '../../shared/types';
import type { JavaPlan, InstalledVersionDetail, LoaderType } from '../../preload/preload';
import {
  IconPlay, IconInfo, IconAlert, IconCheck, IconCube, IconFolder, IconArrow,
} from '../components/icons';
import { describeVersion } from '../data/versions';
import { formatProgressBytes } from '../util/format';
import { useT } from '../i18n';

const loaderLabel: Record<LoaderType, string> = {
  fabric: 'Fabric', quilt: 'Quilt', forge: 'Forge', neoforge: 'NeoForge',
};

interface Props {
  settings: LauncherSettings;
  account: MinecraftAccount | null;
  onGoToAccounts: () => void;
  onGoToBrowse: () => void;
  onGoToInstalled: () => void;
  onSettingsChange: (s: LauncherSettings) => void;
  gameRunning?: boolean;
}

export const HomePage: React.FC<Props> = ({
  settings, account, onGoToAccounts, onGoToBrowse, onGoToInstalled, onSettingsChange, gameRunning = false,
}) => {
  const t = useT();

  const typeLabel: Record<string, string> = {
    release: t('home.typeRelease'), snapshot: t('home.typeSnapshot'), old_beta: 'beta', old_alpha: 'alpha', bedrock: 'Bedrock',
  };
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<InstalledVersionDetail[]>([]);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [busy, setBusy] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const logBufferRef = useRef<string[]>([]);
  const logFlushTimerRef = useRef<number | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [javaPlan, setJavaPlan] = useState<JavaPlan | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const settingsLastId = settings.lastVersionId || '';
  const moddedBases = useMemo(
    () => new Set(details.filter((d) => d.loader).map((d) => d.baseMc)),
    [details],
  );
  const candidateIds = useMemo(() => {
    const installedIds = Array.from(installed);
    return installedIds.filter((id) => {
      const det = details.find((d) => d.id === id);
      if (!det?.loader) return true;
      return !moddedBases.has(det.baseMc);
    });
  }, [installed, details, moddedBases]);

  // Если активная версия не задана — берём САМУЮ свежую установленную,
  // чтобы главная не показывала пустое «Готов к игре», когда у пользователя
  // уже есть установленные версии.
  const lastId = useMemo(() => {
    if (settingsLastId) return settingsLastId;
    if (!candidateIds.length) return '';
    const sorted = [...candidateIds].sort((a, b) => {
      const va = versions.find((v) => v.id === a);
      const vb = versions.find((v) => v.id === b);
      const ta = va ? new Date(va.releaseTime).getTime() : 0;
      const tb = vb ? new Date(vb.releaseTime).getTime() : 0;
      return tb - ta;
    });
    return sorted[0];
  }, [settingsLastId, candidateIds, versions]);

  const lastDetail = useMemo(() => {
    const matches = details.filter((d) => d.id === lastId);
    return matches.find((d) => d.edition === settings.lastVersionEdition) ?? matches[0] ?? null;
  }, [details, lastId, settings.lastVersionEdition]);

  useEffect(() => {
    let cancelled = false;
    window.api.minecraft.versions().then((v) => { if (!cancelled) setVersions(v); }).catch(() => {});
    window.api.minecraft.installedDetailed().then((d) => { if (!cancelled) { setDetails(d); setInstalled(new Set(d.map((x) => x.id))); } }).catch(() => {});

    const offProgress = window.api.minecraft.onProgress(setProgress);
    const flushLogState = () => {
      if (logFlushTimerRef.current) {
        window.clearTimeout(logFlushTimerRef.current);
        logFlushTimerRef.current = null;
      }
      setLogLines([...logBufferRef.current]);
    };
    const offLog = window.api.minecraft.onLog((line) => {
      const buf = logBufferRef.current;
      buf.push(line);
      if (buf.length > 500) buf.shift();
      // Throttle React state updates to every 200ms to avoid re-rendering on every log line
      if (!logFlushTimerRef.current) {
        logFlushTimerRef.current = window.setTimeout(flushLogState, 200);
      }
    });
    let launchHoldTimer: number | null = null;
    const clearLaunchHold = () => {
      if (launchHoldTimer !== null) {
        window.clearTimeout(launchHoldTimer);
        launchHoldTimer = null;
      }
    };
    const offExit = window.api.minecraft.onExit((code) => {
      clearLaunchHold();
      setStatus(t('home.exitStatus', { code: String(code) }));
      setStatusType(code === 0 ? 'success' : 'error');
      setBusy(false);
    });
    const offLaunchStart = window.api.minecraft.onLaunchStart(() => {
      // Игра spawn'нулась, но окно ещё не открылось, держим кнопку
      // «Запуск...» ещё ~3 секунды, пока Java не инициализирует окно.
      clearLaunchHold();
      launchHoldTimer = window.setTimeout(() => {
        setBusy(false);
        launchHoldTimer = null;
      }, 3000);
    });
    // manifestUpdated приходит после consolidateInstalls, обновляем данные.
    // Без этого sidebar показывает phantom-счётчик пока не перезайдёт.
    const offManifest = window.api.minecraft.onManifestUpdated((details) => {
      setDetails(details);
      setInstalled(new Set(details.map((d) => d.id)));
    });
    return () => {
      cancelled = true;
      clearLaunchHold();
      offProgress(); offLog(); offExit(); offLaunchStart(); offManifest();
      if (logFlushTimerRef.current) {
        window.clearTimeout(logFlushTimerRef.current);
        logFlushTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines.length]);

  useEffect(() => {
    if (!lastId || lastDetail?.edition === 'bedrock') { setJavaPlan(null); return; }
    let cancelled = false;
    window.api.java.planFor(lastId).then((p) => { if (!cancelled) setJavaPlan(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [lastId, lastDetail?.edition]);

  // Для отображения берём метаданные базовой ванильной версии (релиз/дата),
  // даже если активна модифицированная (Forge/Fabric) — у мод-профиля своих
  // мета-данных нет, он наследует от базы.
  const baseForMeta = lastDetail?.baseMc ?? lastId;
  const lastVersion = useMemo(() => {
    if (lastDetail?.edition === 'bedrock') {
      return { id: lastId, type: 'bedrock', releaseTime: new Date(0).toISOString(), postId: 0, slug: lastId } as BedrockVersionInfo;
    }
    return versions.find((v) => v.id === baseForMeta);
  }, [versions, baseForMeta, lastDetail?.edition, lastId]);
  const isInstalled = installed.has(lastId);
  const heroTitle = lastDetail?.loader
    ? `${lastDetail.baseMc} + ${loaderLabel[lastDetail.loader]}`
    : (lastDetail?.id ?? lastId);
  const installedRecent = useMemo(() => {
    // Скрываем «впитанную» ваниль: если для базы есть лоадер, отдельную
    // ванильную карточку не показываем.
    const moddedBases = new Set(details.filter((d) => d.loader).map((d) => d.baseMc));
    return [...installed]
      .filter((id) => id !== lastId)
      .filter((id) => {
        const det = details.find((d) => d.id === id);
        if (det?.loader) return true;
        return !moddedBases.has(id);
      })
      .map((id): VersionInfo => {
        // Если в манифесте Mojang нет — это модовый/легаси профиль:
        // делаем минимальный VersionInfo, чтобы карточка всё равно отрисовалась.
        const det = details.find((d) => d.id === id);
        if (det?.edition === 'bedrock') return { id, type: 'bedrock', url: '', releaseTime: new Date(0).toISOString(), postId: 0, slug: id } as any;
        const v = versions.find((x) => x.id === id);
        if (v) return v;
        const baseV = det?.baseMc ? versions.find((x) => x.id === det.baseMc) : undefined;
        return {
          id,
          type: (baseV?.type ?? 'release'),
          url: '',
          releaseTime: baseV?.releaseTime ?? new Date(0).toISOString(),
        };
      })
      .slice(0, 6);
  }, [installed, details, versions, lastId]);

  const canPlay = !!account && !!lastId && !busy && !(settings.lockOnLaunch && gameRunning);

  const onPlay = async () => {
    if (!account || !lastId) return;
    setBusy(true);
    setLogLines([]);
    setShowLog(false);
    setStatusType('neutral');
    try {
      if (lastDetail?.edition === 'bedrock') {
        setStatus(t('home.launching'));
        onSettingsChange({ ...settings, lastVersionId: lastId, lastVersionEdition: 'bedrock' });
        await window.api.bedrock.launch(lastId, '');
      } else {
        if (!isInstalled) {
          // Не установлено — качаем сначала
          setStatus(t('home.downloading', { id: lastId }));
          await window.api.minecraft.install(lastId);
          const det = await window.api.minecraft.installedDetailed();
          setDetails(det);
          setInstalled(new Set(det.map((x) => x.id)));
        }
        // Уже установлено — сразу запускаем без проверок
        setStatus(t('home.launching'));
        onSettingsChange({ ...settings, lastVersionId: lastId, lastVersionEdition: 'java' });
        await window.api.minecraft.launch({
          versionId: lastId, account, memoryMb: settings.memoryMb,
        });
      }
      setStatus(t('home.running'));
      setStatusType('success');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus(t('home.error', { message }));
      setStatusType('error');
      setBusy(false);
    }
  };

  const [msLoading, setMsLoading] = useState(false);

  const addMicrosoft = async () => {
    setMsLoading(true);
    try {
      await window.api.accounts.addMicrosoft();
      window.location.reload();
    } catch (e) {
      // Show generic alert for errors, but owned-status notification is handled via log
      alert(t('accounts.addMicrosoftHint'));
    } finally {
      setMsLoading(false);
    }
  };

  // Empty state — no last version yet
  if (!lastId) {
    return (
      <div className="home">
        <div className="home-hero empty-hero">
          <div className="home-hero-eyebrow">Trel</div>
          <h1 className="home-hero-title">{t('home.readyTitle')}</h1>
          <p className="home-hero-sub">
            {t('home.readySubtitle')}
          </p>
          {!account && (
            <div className="flex-col-center gap-8 mt-16">
              <button className="btn primary lg" onClick={addMicrosoft} disabled={msLoading}>
                {msLoading ? t('app.loading') : t('accounts.addMicrosoft')}
              </button>
              <div className="hint">{t('accounts.addMicrosoftHint')}</div>
              <button className="btn ghost sm mt-8" onClick={onGoToAccounts}>
                {t('accounts.addGuest')} <IconArrow />
              </button>
            </div>
          )}
          {account && (
            <button className="btn primary lg mt-16" onClick={onGoToBrowse}>
              {t('home.openCatalog')} <IconArrow />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="home">
      {/* Account banner */}
      {!account && (
        <div className="banner">
          <div>
            <h2>{t('home.noAccount')}</h2>
            <div className="muted text-xs mt-4">{t('home.noAccountHint')}</div>
          </div>
          <div className="row gap-8">
            <button className="btn primary" onClick={addMicrosoft} disabled={msLoading}>
              {msLoading ? t('app.loading') : t('accounts.addMicrosoft')}
            </button>
            <button className="btn ghost" onClick={onGoToAccounts}>{t('accounts.addGuest')}</button>
          </div>
        </div>
      )}

      {/* Hero — continue playing */}
      <div className="home-hero">
        <div className="home-hero-eyebrow">
          {isInstalled ? t('home.continueEyebrow') : t('home.lastSession')}
        </div>
        <div className="home-hero-row">
          <div className="home-hero-info">
            <div className="home-hero-title">{heroTitle}</div>
            <div className="home-hero-meta">
              {lastVersion && (
                <>
                  <span className={'tag ' + lastVersion.type}>{typeLabel[lastVersion.type] ?? lastVersion.type}</span>
                  <span className="chip">{new Date(lastVersion.releaseTime).toLocaleDateString(t.locale === 'en' ? 'en-US' : 'ru-RU')}</span>
                </>
              )}
              {lastDetail?.loader && (
                <span className="chip accent" title={lastDetail.id}>
                  {loaderLabel[lastDetail.loader]} {lastDetail.loaderVersion ?? ''}
                </span>
              )}
              {javaPlan && !javaPlan.error && (
                <span className={'chip ' + (javaPlan.plan === 'download' ? 'warn' : 'accent')}>
                  Java {javaPlan.required}
                  {javaPlan.plan === 'reuse' && <> · {t('home.javaFound')}</>}
                  {javaPlan.plan === 'download' && <> · {t('home.javaWillDownload')}</>}
                </span>
              )}
              <span className={'chip ' + (isInstalled ? 'success' : '')}>
                {isInstalled ? <><IconCheck /> {t('home.installed')}</> : t('home.willDownload')}
              </span>
            </div>

            {lastVersion && describeVersion(lastVersion, t.locale) && (
              <p className="home-hero-desc">{describeVersion(lastVersion, t.locale)}</p>
            )}
          </div>

          <button className="play-btn home-play" disabled={!canPlay} onClick={onPlay}>
            {busy && progress && (
              <span className="progress-fill" style={{ width: progress.percent + '%' }} />
            )}
            <span className="label">
              <IconPlay />
              {busy ? (isInstalled ? t('home.btnLaunching') : t('home.btnDownloading')) : t('home.btnPlay')}
            </span>
          </button>
        </div>

        {(busy && progress) && (
          <div className="hero-progress">
            <div className="ab-progress-info">
              <span className="ab-progress-stage">{progress.stage}</span>
              <span>
                {formatProgressBytes(progress, t)}
                {progress.percent}%
              </span>
            </div>
            <div className="ab-progress-bar">
              <div className="fill" style={{ width: progress.percent + '%' }} />
            </div>
          </div>
        )}

        {status && !busy && (
          <div className={'status-line ' + statusType} style={{ marginTop: 14 }}>
            {statusType === 'error' ? <IconAlert /> : statusType === 'success' ? <IconCheck /> : <IconInfo />}
            <span>{status}</span>
          </div>
        )}
      </div>

      {/* Quick actions — компактный ряд утилит. Раньше тут были две большие
          плитки «Каталог»/«Установленные», но они дублировали sidebar. Теперь
          даём ссылки на действия, которые НЕ доступны через основную нав-цепочку. */}
      <div className="home-quick">
        <button className="home-quick-tile" onClick={() => window.api.minecraft.openFolder('game')}>
          <IconFolder />
          <span>{t('home.gameFolder')}</span>
        </button>
        {isInstalled && (
          <button
            className="home-quick-tile"
            onClick={() => window.api.minecraft.openFolder('version', lastId)}
          >
            <IconCube />
            <span>{t('home.versionFolder')}</span>
          </button>
        )}
        <button className="home-quick-tile" onClick={onGoToBrowse}>
          <IconCube />
          <span>{t('home.allVersions')}</span>
        </button>
      </div>

      {/* Recently used */}
      {installedRecent.length > 0 && (
        <div className="home-section">
          <div className="home-section-head">
            <h2>{t('home.otherInstalled')}</h2>
            <button className="btn ghost sm" onClick={onGoToInstalled}>{t('home.all')}</button>
          </div>
          <div className="home-section-hint">
            {t('home.clickToActivate')}
          </div>
          <div className="home-recent">
            {installedRecent.map((v) => (
              <button
                key={v.id}
                className="recent-card"
                onClick={() => {
                  onSettingsChange({ ...settings, lastVersionId: v.id, lastVersionEdition: (v as any).type === 'bedrock' ? 'bedrock' : 'java' });
                }}
                title={t('home.makeActive', { id: v.id })}
              >
                <div className="recent-name">{v.id}</div>
                <span className={'tag ' + v.type}>{typeLabel[v.type] ?? v.type}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Лог игры — показываем только если последний выход с ошибкой,
          и по умолчанию свёрнут. Раньше был развёрнут на главной всегда —
          это превращало главную в «терминал», что отвлекает от запуска. */}
      {logLines.length > 0 && (statusType === 'error' || settings.showConsole) && (
        <div className="card" style={{ margin: 0 }}>
          <div className="card-head">
            <div className="row" style={{ gap: 8 }}>
              <h2>{t('home.logTitle')}</h2>
              <span className="chip danger">{logLines.length} {t('home.lines')}</span>
            </div>
            <div className="row" style={{ gap: 4 }}>
              <button className="btn ghost sm" onClick={() => setShowLog((v) => !v)}>
                {showLog ? t('home.hide') : t('home.show')}
              </button>
              <button className="btn ghost sm" onClick={() => setLogLines([])}>{t('home.clear')}</button>
            </div>
          </div>
          {showLog && <div className="log" ref={logRef}>{logLines.join('')}</div>}
        </div>
      )}
    </div>
  );
};

