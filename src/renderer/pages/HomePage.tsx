import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DownloadProgress, LauncherSettings, MinecraftAccount, VersionInfo } from '../../shared/types';
import type { JavaPlan, InstalledVersionDetail, LoaderType } from '../../preload/preload';
import {
  IconPlay, IconInfo, IconAlert, IconCheck, IconFolder, IconArrow,
} from '../components/icons';
import { GameConsole } from '../components/GameConsole';
import { describeVersion } from '../data/versions';
import { formatProgressBytes } from '../util/format';
import { useT } from '../i18n';

const loaderLabel: Record<LoaderType, string> = {
  fabric: 'Fabric', quilt: 'Quilt', forge: 'Forge', neoforge: 'NeoForge',
};

const FALLBACK_RECOMMENDED = ['1.21.4', '1.20.1', '1.19.4', '1.16.5'];

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
  const [details, setDetails] = useState<InstalledVersionDetail[]>([]);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [busy, setBusy] = useState(false);
  const [javaPlan, setJavaPlan] = useState<JavaPlan | null>(null);
  const [javaTick, setJavaTick] = useState(0);
  const [msLoading, setMsLoading] = useState(false);
  const [randomIdx, setRandomIdx] = useState(0);
  const [heroBg, setHeroBg] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ down: boolean; startX: number; scrollLeft: number; moved: boolean }>({
    down: false, startX: 0, scrollLeft: 0, moved: false,
  });

  const scrollCarousel = (dir: -1 | 1) => {
    const el = carouselRef.current;
    if (!el) return;
    // We scroll exactly by one card, so that no “leftovers” remain between the steps.
    const card = el.querySelector<HTMLElement>('.home-carousel-card');
    const step = card ? card.offsetWidth + 16 : 360;
    const target = Math.max(0, Math.round(el.scrollLeft / step) * step + dir * step);
    el.scrollTo({ left: target, behavior: 'smooth' });
  };

  const onCarouselKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollCarousel(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); scrollCarousel(-1); }
  };

  const onCarouselWheel = (e: React.WheelEvent) => {
    const el = carouselRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  };

  const onDragStart = (e: React.MouseEvent) => {
    const el = carouselRef.current;
    if (!el) return;
    dragState.current = { down: true, startX: e.pageX, scrollLeft: el.scrollLeft, moved: false };
  };

  const onDragMove = (e: React.MouseEvent) => {
    const st = dragState.current;
    const el = carouselRef.current;
    if (!st.down || !el) return;
    const dx = e.pageX - st.startX;
    if (Math.abs(dx) > 4) st.moved = true;
    el.scrollLeft = st.scrollLeft - dx;
  };

  const onDragEnd = () => {
    dragState.current.down = false;
  };

  useEffect(() => {
    let cancelled = false;
    window.api.minecraft.versions().then((v) => { if (!cancelled) setVersions(v); }).catch(() => {});
    window.api.minecraft.installedDetailed().then((d) => {
      if (!cancelled) { setDetails(d); }
    }).catch(() => {});

    const offProgress = window.api.minecraft.onProgress(setProgress);
    const offExit = window.api.minecraft.onExit((code) => {
      setStatus(t('home.exitStatus', { code: String(code) }));
      setStatusType(code === 0 ? 'success' : 'error');
      setBusy(false);
      playRef.current = false;
      setJavaTick((n) => n + 1);
    });
    const offLaunchStart = window.api.minecraft.onLaunchStart(() => {
      // We release the Ref together with busy: the guard is only needed against a double click
      // before the start, not against a second launch while the game is running.
      setTimeout(() => { setBusy(false); playRef.current = false; }, 3000);
    });
    const offManifest = window.api.minecraft.onManifestUpdated((d) => {
      setDetails(d);
    });
    return () => {
      cancelled = true;
      offProgress(); offExit(); offLaunchStart(); offManifest();
    };
  }, []);

  const playableVersions = useMemo(() => {
    const isWin = window.api.platform === 'win32';
    return details.filter((d) => {
      if (!isWin && d.edition === 'bedrock') return false;
      return true;
    });
  }, [details]);

  const pickRandom = () => {
    if (playableVersions.length <= 1) return;
    setRandomIdx((prev) => {
      let next = Math.floor(Math.random() * playableVersions.length);
      if (next === prev) next = (next + 1) % playableVersions.length;
      return next;
    });
  };

  useEffect(() => { pickRandom(); }, []);

  useEffect(() => {
    if (playableVersions.length <= 1) return;
    const timer = setInterval(pickRandom, 60000);
    return () => clearInterval(timer);
  }, [playableVersions.length]);

  const isPinned = (id: string) => (settings.pinnedVersions ?? []).includes(id);
  const togglePin = (id: string) => {
    const pins = settings.pinnedVersions ?? [];
    onSettingsChange({ ...settings, pinnedVersions: pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id] });
  };
  const sortedDetails = [...details].sort((a, b) => Number(isPinned(b.id)) - Number(isPinned(a.id)));
  const activeDetail = playableVersions.length > 0
    ? playableVersions[randomIdx % playableVersions.length]
    : null;

  const activeId = activeDetail?.id ?? '';
  const baseForMeta = activeDetail?.baseMc ?? activeId;
  const activeVersion = useMemo(() => {
    if (activeDetail?.edition === 'bedrock') return null;
    return versions.find((v) => v.id === baseForMeta) ?? null;
  }, [versions, baseForMeta, activeDetail?.edition]);

  useEffect(() => {
    if (!activeId || activeDetail?.edition === 'bedrock') { setJavaPlan(null); return; }
    let cancelled = false;
    window.api.java.planFor(activeId).then((p) => { if (!cancelled) setJavaPlan(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeId, activeDetail?.edition, javaTick]);

  // Cinematic poster: a random screenshot as the hero background
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const shots = await window.api.screenshots.list();
        if (!alive || !shots.length) return;
        const pick = shots[Math.floor(Math.random() * shots.length)];
        const data = await window.api.screenshots.read(pick.path);
        if (alive) setHeroBg(data);
      } catch { /* no screenshots — the gradient background stays */ }
    })();
    return () => { alive = false; };
  }, []);

  const canPlay = !!account && !!activeId && !busy && !(settings.lockOnLaunch && gameRunning);

  const playRef = useRef(false);
  const [dlPaused, setDlPaused] = useState(false);
  const onPlay = async (selected: InstalledVersionDetail | null = activeDetail) => {
    if (!account || !selected) return;
    // Double click before the re-render with disabled: both calls would see busy=false.
    // The Ref fires synchronously — the second launch does not start.
    if (playRef.current) return;
    playRef.current = true;
    const selectedId = selected.id;
    setBusy(true);
    setStatusType('neutral');
    try {
      if (selected.edition === 'bedrock') {
        setStatus(t('home.launching'));
        onSettingsChange({ ...settings, lastVersionId: selectedId, lastVersionEdition: 'bedrock' });
        await window.api.bedrock.launch(selectedId, '');
      } else {
        setStatus(t('home.launching'));
        onSettingsChange({ ...settings, lastVersionId: selectedId, lastVersionEdition: 'java' });
        await window.api.minecraft.launch({
          versionId: selectedId, account, memoryMb: settings.memoryMb,
        });
      }
      setStatus(t('home.running'));
      setStatusType('success');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus(t('home.error', { message }));
      setStatusType('error');
      setBusy(false);
      playRef.current = false;
    }
  };

  const onInstallAndPlay = async (id: string) => {
    setBusy(true);
    setStatusType('neutral');
    setStatus(t('home.suggestedDownloading', { id }));
    try {
      await window.api.minecraft.install(id);
      const det = await window.api.minecraft.installedDetailed();
      setDetails(det);
      onSettingsChange({ ...settings, lastVersionId: id, lastVersionEdition: 'java' });
      setStatus(t('home.suggestedDone', { id }));
      setStatusType('success');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus(t('home.suggestedError', { id, message }));
      setStatusType('error');
    } finally {
      setBusy(false);
    }
  };

  const addMicrosoft = async () => {
    setMsLoading(true);
    try {
      await window.api.accounts.addMicrosoft();
      window.location.reload();
    } catch {
      alert(t('accounts.addMicrosoftHint'));
    } finally {
      setMsLoading(false);
    }
  };

  const recommended = useMemo(() => {
    const releases = versions.filter((v) => v.type === 'release');
    const snapshots = versions.filter((v) => v.type === 'snapshot');
    const ids: string[] = [];
    if (releases[0]) ids.push(releases[0].id);
    if (releases[1]) ids.push(releases[1].id);
    if (releases[2]) ids.push(releases[2].id);
    if (snapshots[0]) ids.push(snapshots[0].id);
    for (const fid of FALLBACK_RECOMMENDED) {
      if (!ids.includes(fid)) ids.push(fid);
    }
    return ids.slice(0, 6);
  }, [versions]);

  const hasVersions = playableVersions.length > 0;

  if (!hasVersions) {
    return (
      <div className="home">
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

        <div className="home-picker">
          <div className="home-picker-head">
            <h1>{t('home.noVersionsTitle')}</h1>
            <p>{t('home.noVersionsSubtitle')}</p>
          </div>
          <div className="home-carousel-wrap">
            <button
              className="home-carousel-nav prev"
              onClick={() => scrollCarousel(-1)}
              aria-label={t('home.carouselPrev')}
              type="button"
            >
              <span className="nav-arrow left"><IconArrow /></span>
            </button>
            <div
              className="home-carousel"
              ref={carouselRef}
              tabIndex={0}
              role="listbox"
              onKeyDown={onCarouselKeyDown}
              onWheel={onCarouselWheel}
              onMouseDown={onDragStart}
              onMouseMove={onDragMove}
              onMouseUp={onDragEnd}
              onMouseLeave={onDragEnd}
            >
              {recommended.map((id) => {
                const v = versions.find((x) => x.id === id);
                const desc = v ? describeVersion(v, t.locale) : '';
                return (
                  <button
                    key={id}
                    className={'home-carousel-card' + ((v?.type ?? 'release') === 'snapshot' ? ' snapshot' : '')}
                    onClick={() => { if (!dragState.current.moved) onInstallAndPlay(id); }}
                    disabled={busy}
                    type="button"
                  >
                    <div className="home-carousel-top">
                      <div className="home-carousel-id">{id}</div>
                      <span className="home-carousel-type">
                        {typeLabel[v?.type ?? 'release'] ?? (v?.type ?? 'release')}
                      </span>
                    </div>
                    {desc && <div className="home-carousel-desc">{desc}</div>}
                    <div className="home-carousel-action">
                      <IconArrow />
                      <span>{t('home.btnDownloadPlay')}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              className="home-carousel-nav next"
              onClick={() => scrollCarousel(1)}
              aria-label={t('home.carouselNext')}
              type="button"
            >
              <span className="nav-arrow right"><IconArrow /></span>
            </button>
          </div>
          <button className="btn ghost sm home-picker-browse" onClick={onGoToBrowse}>
            {t('home.allVersions')} <IconArrow />
          </button>
        </div>

        {status && !busy && (
          <div className={'status-line ' + statusType} style={{ marginTop: 14, maxWidth: 920, margin: '14px auto 0' }}>
            {statusType === 'error' ? <IconAlert /> : statusType === 'success' ? <IconCheck /> : <IconInfo />}
            <span>{status}</span>
          </div>
        )}
        {busy && progress && (
          <div className="hero-progress" style={{ maxWidth: 920, margin: '14px auto 0' }}>
            <div className="ab-progress-info">
              <span className="ab-progress-stage">{progress.stage}</span>
              <span>{formatProgressBytes(progress, t)}{progress.percent}%</span>
            </div>
            <div className="ab-progress-bar">
              <div className="fill" style={{ width: `${Math.min(100, Math.max(0, Number.isFinite(progress.percent) ? progress.percent : 0))}%` }} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={'home home-player' + (heroBg ? ' has-bg' : '')}>
      <div className="gab">
        {gameRunning && <span className="gab-pill success">● {t('home.gameRunning')}</span>}
        {progress && (
          <span className="gab-pill">
            {t('home.downloading', { id: activeId })}
            <span className="meter"><i style={{ width: `${Math.min(100, Math.max(0, Number.isFinite(progress.percent) ? progress.percent : 0))}%` }} /></span>
            {Number.isFinite(progress.percent) ? progress.percent : 0}%
            <button
              className="btn ghost sm"
              style={{ marginLeft: 8, padding: '0 8px' }}
              title={dlPaused ? t('home.dlResume') : t('home.dlPause')}
              onClick={async () => {
                try {
                  if (dlPaused) { await window.api.importer.downloadsResume(); setDlPaused(false); }
                  else { await window.api.importer.downloadsPause(); setDlPaused(true); }
                } catch { /* ignore */ }
              }}
            >
              {dlPaused ? '▶' : '⏸'}
            </button>
          </span>
        )}
      </div>

      <section className="home-hero">
        <div
          className="home-bg"
          style={heroBg ? { backgroundImage: `url(${heroBg})` } : undefined}
          aria-hidden="true"
        />
        <div className="home-bg-veil" aria-hidden="true" />
        <div className="home-hero-row">
          <div className="home-hero-info">
            <span className="home-hero-eyebrow">{t('home.continueEyebrow')}</span>
            <h1 className="home-hero-title">{activeId}</h1>
            <div className="home-hero-meta">
              <span className="chip green">{typeLabel[activeVersion?.type ?? activeDetail?.edition ?? 'release'] ?? activeDetail?.edition}</span>
              {activeDetail?.loader && <span className="chip amber">{loaderLabel[activeDetail.loader]} {activeDetail.loaderVersion ?? ''}</span>}
              <span className="chip">{activeDetail?.edition === 'bedrock' ? 'Bedrock' : `Java ${javaPlan?.major ?? javaPlan?.required ?? '—'}`}</span>
              <span className="chip green"><IconCheck /> {t('home.installed')}</span>
            </div>
            <p className="home-hero-desc">
              {activeVersion ? describeVersion(activeVersion, t.locale) : t('home.installedSubtitle')}
            </p>
            {activeDetail?.edition !== 'bedrock' && javaPlan && (
              <div className="home-java-note">
                Java {javaPlan.required}: {javaPlan.plan === 'download' ? t('home.javaWillDownload') : t('home.javaFound')}
                {javaPlan.vendor ? ` · ${javaPlan.vendor}` : ''}
              </div>
            )}
          </div>
          <button className="play-btn home-play" onClick={() => onPlay()} disabled={!canPlay}>
            <span className="label"><IconPlay /> {busy ? t('home.btnLaunching') : t('home.btnPlay')}</span>
          </button>
        </div>
      </section>

      {!account && (
        <div className="banner">
          <div><h2>{t('home.noAccount')}</h2><div className="muted text-xs mt-4">{t('home.noAccountHint')}</div></div>
          <div className="row gap-8">
            <button className="btn primary" onClick={addMicrosoft} disabled={msLoading}>{msLoading ? t('app.loading') : t('accounts.addMicrosoft')}</button>
            <button className="btn ghost" onClick={onGoToAccounts}>{t('accounts.addGuest')}</button>
          </div>
        </div>
      )}

      <section className="home-player-list">
        <div className="home-section-head">
          <h2>{t('home.otherInstalled')}</h2>
          <button className="btn ghost sm" onClick={onGoToInstalled}>{t('home.all')} <IconArrow /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {sortedDetails.map((d) => {
            const isActive = d.id === activeId;
            return (
              <div key={d.id} className={'irow' + (isActive ? ' is-active' : '')}>
                <button
                  type="button"
                  className="home-version-select"
                  onClick={() => setRandomIdx(Math.max(0, playableVersions.findIndex((v) => v.id === d.id)))}
                  aria-label={t('home.makeActive', { id: d.id })}
                >
                  <div className="icube"><IconFolder /></div>
                  <div className="i-body">
                    <div className="i-top">
                      <span className="i-id">{d.id}</span>
                      {isPinned(d.id) && <span className="chip">📌</span>}
                      {d.loader && <span className="chip amber">{loaderLabel[d.loader]} {d.loaderVersion ?? ''}</span>}
                      {isActive && <span className="chip green">{t('home.continueEyebrow')}</span>}
                    </div>
                    <div className="i-sub">{d.edition === 'bedrock' ? 'Bedrock' : `Minecraft ${d.baseMc} · Java`}</div>
                  </div>
                </button>
                <button className="btn ghost sm" onClick={() => togglePin(d.id)} title={isPinned(d.id) ? t('home.unpin') : t('home.pin')}>
                  {isPinned(d.id) ? '📌' : '📍'}
                </button>
                <button className="btn primary sm" onClick={() => onPlay(d)} disabled={!account || busy || (settings.lockOnLaunch && gameRunning)}>
                  <IconPlay /> {t('home.btnPlay')}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="home-quick">
        <button className="home-quick-tile" onClick={onGoToBrowse}><IconArrow /><span>{t('home.allVersions')}</span></button>
        <button className="home-quick-tile" onClick={onGoToInstalled}><IconFolder /><span>{t('home.otherInstalled')}</span></button>
      </div>

      {settings.showConsole && <GameConsole />}

      {status && !busy && (
        <div className={'status-line ' + statusType}>
          {statusType === 'error' ? <IconAlert /> : statusType === 'success' ? <IconCheck /> : <IconInfo />}
          <span>{status}</span>
        </div>
      )}
      {busy && progress && (
        <div className="hero-progress">
          <div className="ab-progress-info"><span className="ab-progress-stage">{progress.stage}</span><span>{formatProgressBytes(progress, t)}{progress.percent}%</span></div>
          <div className="ab-progress-bar"><div className="fill" style={{ width: `${Math.min(100, Math.max(0, Number.isFinite(progress.percent) ? progress.percent : 0))}%` }} /></div>
        </div>
      )}
    </div>
  );
};