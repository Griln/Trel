import React, { useEffect, useMemo, useState, useRef, lazy, Suspense, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { HomePage } from './pages/HomePage';
import { WelcomePage } from './pages/WelcomePage';
import { DialogProvider } from './components/Dialog';
import { IntroAnimation } from './components/IntroAnimation';
import { Onboarding } from './components/Onboarding';
import { CrashDoctor } from './components/CrashDoctor';
import { LocaleProvider, useT } from './i18n';
import type { DownloadProgress, LauncherSettings, MinecraftAccount, Page } from '../shared/types';
import type { InstalledVersionDetail, ServerStatus, UpdaterState } from '../preload/preload';
import { effectiveInstalledCount } from '../shared/installed';

// Heavy tabs are loaded on demand. Three benefits:
//   1. Smaller startup bundle → faster start and less memory used by the code.
//   2. SkinPage pulls in three.js (~600 KB) — without lazy loading it ended up in the shared
//      chunk and was loaded at startup, although it is only needed once you open the skin.
//   3. Each tab lives in its own JS file → easier to free memory
//      when switching (V8 can unload unused code).
const BrowsePage = lazy(() => import('./pages/BrowsePage').then(m => ({ default: m.BrowsePage })));
const InstalledPage = lazy(() => import('./pages/InstalledPage').then(m => ({ default: m.InstalledPage })));
const WorldsPage = lazy(() => import('./pages/WorldsPage').then(m => ({ default: m.WorldsPage })));
const ContentPage = lazy(() => import('./pages/ContentPage').then(m => ({ default: m.ContentPage })));
const ModpacksPage = lazy(() => import('./pages/ModpacksPage').then(m => ({ default: m.ModpacksPage })));
const ScreenshotsPage = lazy(() => import('./pages/ScreenshotsPage').then(m => ({ default: m.ScreenshotsPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })));
const SkinPage = lazy(() => import('./pages/SkinPage').then(m => ({ default: m.SkinPage })));
const ServersPage = lazy(() => import('./pages/ServersPage').then(m => ({ default: m.ServersPage })));
const AccountsPage = lazy(() => import('./pages/AccountsPage').then(m => ({ default: m.AccountsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then(m => ({ default: m.ImportPage })));
const DiagnosticsPage = lazy(() => import('./pages/DiagnosticsPage').then(m => ({ default: m.DiagnosticsPage })));


type TrelEmuProgress = {
  state: string;
  downloaded: number;
  total: number;
  ratio: number;
  speed: number;
  message: string;
  error?: string;
};

const fmtBytesShort = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`;
};

const GlobalActivityBar: React.FC<{
  serverStatuses: Record<string, ServerStatus>;
  gameRunning: boolean;
  minecraftProgress: DownloadProgress | null;
  bedrockProgress: DownloadProgress | null;
  trelEmuProgress: TrelEmuProgress | null;
  updaterState: UpdaterState | null;
}> = ({ serverStatuses, gameRunning, minecraftProgress, bedrockProgress, trelEmuProgress, updaterState }) => {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const ru = t.locale === 'ru';
  const runningServers = Object.values(serverStatuses).filter((s) => s === 'running').length;
  const startingServers = Object.values(serverStatuses).filter((s) => s === 'starting' || s === 'stopping').length;

  const progress = bedrockProgress ?? minecraftProgress;
  const showProgress = !!progress && (progress.percent < 100 || progress.current < progress.total);
  const showTrelEmu = !!trelEmuProgress && !['idle', 'done', 'cancelled'].includes(trelEmuProgress.state);
  const updaterDownloading = updaterState?.status === 'downloading';
  const items: React.ReactNode[] = [];
  if (gameRunning) {
    items.push(<span className="global-activity-pill success" key="game">● {ru ? 'Игра запущена' : 'Game running'}</span>);
  }
  if (runningServers > 0) {
    items.push(<span className="global-activity-pill success" key="servers">● {ru ? `Серверов запущено: ${runningServers}` : `Servers running: ${runningServers}`}</span>);
  }
  if (startingServers > 0) {
    items.push(<span className="global-activity-pill warn" key="servers-starting">● {ru ? `Серверы меняют состояние: ${startingServers}` : `Servers changing state: ${startingServers}`}</span>);
  }
  if (showProgress && progress) {
    const percent = Math.max(0, Math.min(100, Math.round(progress.percent ?? 0)));
    items.push(
      <span className="global-activity-pill progress" key="progress" title={progress.stage}>
        <span>{ru ? 'Загрузка' : 'Download'}: {progress.stage}</span>
        <span className="global-activity-percent">{percent}%</span>
        <span className="global-activity-meter"><span style={{ width: `${percent}%` }} /></span>
      </span>,
    );
  }
  if (showTrelEmu && trelEmuProgress && window.api.platform === 'win32') {
    const percent = Math.max(0, Math.min(100, Math.round((trelEmuProgress.ratio || 0) * 100)));
    items.push(
      <span className="global-activity-pill progress" key="trelemu" title={trelEmuProgress.message}>
        <span>TrelEmu: {trelEmuProgress.message || trelEmuProgress.state}</span>
        {trelEmuProgress.total > 0 && <span className="global-activity-percent">{fmtBytesShort(trelEmuProgress.downloaded)} / {fmtBytesShort(trelEmuProgress.total)}</span>}
        {trelEmuProgress.total > 0 && <span className="global-activity-meter"><span style={{ width: `${percent}%` }} /></span>}
      </span>,
    );
  }
  if (updaterDownloading) {
    const percent = Math.max(0, Math.min(100, Math.round(updaterState?.percent ?? 0)));
    items.push(
      <span className="global-activity-pill progress" key="updater">
        <span>{ru ? 'Обновление лаунчера' : 'Launcher update'}</span>
        <span className="global-activity-percent">{percent}%</span>
        <span className="global-activity-meter"><span style={{ width: `${percent}%` }} /></span>
      </span>,
    );
  }
  if (items.length === 0) return null;
  return (
    <div className="global-activity-wrap">
      <button className="global-activity-bar" aria-live="polite" onClick={() => setExpanded(!expanded)} title={ru ? 'Открыть центр активности' : 'Open activity center'}>{items}</button>
      {expanded && (
        <div className="global-activity-panel">
          <strong>{ru ? 'Центр активности' : 'Activity center'}</strong>
          <div className="global-activity-panel-items">{items.map((item, i) => <div key={i}>{item}</div>)}</div>
        </div>
      )}
    </div>
  );
};

class PageErrorBoundary extends React.Component<
  { page: Page; children: React.ReactNode; t: (k: string) => string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[renderer] page crashed', this.props.page, error, info.componentStack);
  }

  componentDidUpdate(prevProps: { page: Page }) {
    if (prevProps.page !== this.props.page && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="empty p-24" style={{ maxWidth: 720, margin: '32px auto' }}>
          <h2>{this.props.t('app.crashTitle')}</h2>
          <p className="muted">{this.props.t('app.crashMsg')}</p>
          <pre className="mono text-xs" style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{this.state.error.message}</pre>
          <button className="btn primary" style={{ marginTop: 12 }} onClick={() => this.setState({ error: null })}>{this.props.t('app.crashRetry')}</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Prefetch heavy pages after initial render so they load instantly on navigation
setTimeout(() => {
  import('./pages/InstalledPage');
  import('./pages/WorldsPage');
}, 3000);

export const App: React.FC = () => {
  const [page, setPage] = useState<Page>('home');
  const [settings, setSettings] = useState<LauncherSettings | null>(null);
  const [accounts, setAccounts] = useState<MinecraftAccount[]>([]);
  const [activeUuid, setActiveUuid] = useState<string | null>(null);
  const [accountsReady, setAccountsReady] = useState(false);
  const [minLoadingDone, setMinLoadingDone] = useState(false);
  const loadStartTime = useMemo(() => Date.now(), []);
  // Global counters/indicators for the sidebar — refreshed periodically
  // and on key events. This gives the user an overview of “what I have”
  // without visiting every tab.
  const [installedDetails, setInstalledDetails] = useState<InstalledVersionDetail[]>([]);
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({});
  const [updaterState, setUpdaterState] = useState<UpdaterState | null>(null);
  const [minecraftProgress, setMinecraftProgress] = useState<DownloadProgress | null>(null);
  const [bedrockProgress, setBedrockProgress] = useState<DownloadProgress | null>(null);
  const [trelEmuProgress, setTrelEmuProgress] = useState<TrelEmuProgress | null>(null);
  const [gameRunning, setGameRunning] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const onIntroDone = useCallback(() => setIntroDone(true), []);
  const t = useT();

  useEffect(() => {
    window.api.settings.get().then(setSettings);
    window.api.accounts.list().then((list) => {
      setAccounts(list);
      if (list.length > 0) setActiveUuid(list[0].uuid);
      setAccountsReady(true);
    });
    // Subscribe to the global signals behind the sidebar badges
    const refreshInstalled = () => {
      window.api.minecraft.installedDetailed().then(setInstalledDetails).catch(() => {});
    };
    const refreshServerStatuses = () => {
      window.api.servers.statuses().then(setServerStatuses).catch(() => {});
    };
    refreshInstalled();
    refreshServerStatuses();
    window.api.updater.state().then(setUpdaterState).catch(() => {});
    // Register our own global screenshot hotkey on launcher startup
    try {
      const savedKey = localStorage.getItem('trel.shots.hotkey') || 'F2';
      window.api.screenshots.setHotkey(savedKey).catch(() => {});
    } catch { /* ignore */ }

    const offServerStatus = window.api.servers.onStatus((id, status) => {
      setServerStatuses((prev) => ({ ...prev, [id]: status }));
    });
    const offUpdater = window.api.updater.onState(setUpdaterState);
    const offMinecraftProgress = window.api.minecraft.onProgress(setMinecraftProgress);
    const offBedrockProgress = window.api.bedrock.onProgress(setBedrockProgress);
    const offTrelEmuProgress = window.api.bedrock.onDownloadProgress(setTrelEmuProgress);
    const offLaunchStart = window.api.minecraft.onLaunchStart(() => setGameRunning(true));
    const offExit = window.api.minecraft.onExit(() => {
      setGameRunning(false);
      setMinecraftProgress(null);
      setBedrockProgress(null);
    });
    // The manifest update triggers a counter reconciliation (a new version may have been
    // installed by an external script, etc.). We use the event payload
    // directly to avoid an extra IPC call.
    const offManifest = window.api.minecraft.onManifestUpdated((details) => {
      setInstalledDetails(details);
      setMinecraftProgress(null);
      setBedrockProgress(null);
    });

    return () => { offServerStatus(); offUpdater(); offMinecraftProgress(); offBedrockProgress(); offTrelEmuProgress(); offManifest(); offLaunchStart(); offExit(); };
  }, []);

  // Adaptive minimum: we show the animation for at least 2 seconds.
  // If the load takes longer — we do not add any delay.
  useEffect(() => {
    if (!settings || !accountsReady || minLoadingDone) return;
    if (settings.showIntro === false) { setMinLoadingDone(true); setIntroDone(true); return; }
    const elapsed = Date.now() - loadStartTime;
    const MIN_MS = 2000;
    const remaining = Math.max(0, MIN_MS - elapsed);
    if (remaining === 0) setMinLoadingDone(true);
    else { const t = setTimeout(() => setMinLoadingDone(true), remaining); return () => clearTimeout(t); }
  }, [settings, accountsReady, minLoadingDone, loadStartTime]);

  // First run: we open the tour once after the intro, or right away,
  // if the intro is disabled. The v5 key is deliberately new so that the updated tour
  // (18 steps across all sections) is shown once after the update.
  // On WelcomePage (no accounts) we do not open the tour — it has its own steps,
  // and cross-page navigation is not available there; the tour appears after an account is created.
  useEffect(() => {
    if (!settings || !accountsReady || !minLoadingDone || onboardingChecked) return;
    if (settings.showIntro !== false && !introDone) return;
    if (accounts.length === 0) return;
    setOnboardingChecked(true);
    try {
      if (localStorage.getItem('trel:onboarding-seen:v5') !== '1') {
        setOnboardingOpen(true);
      }
    } catch {
      setOnboardingOpen(true);
    }
  }, [settings, accountsReady, minLoadingDone, introDone, onboardingChecked, accounts.length]);

  // Auto-hide of the left panel: if the user stays on a tab for more than
  // 5 seconds and does not hover the panel — it collapses smoothly,
  // giving the space to the content. Hovering the left edge (the strip) brings it back.
  // While the onboarding is open we do not hide it — tours highlight panel elements.
  const [sideHidden, setSideHidden] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(() => {
    try { return localStorage.getItem('trel-side-collapsed') === '1'; } catch { return false; }
  });
  const toggleRail = () => {
    setRailCollapsed((v) => {
      try { localStorage.setItem('trel-side-collapsed', v ? '0' : '1'); } catch { /* ignore */ }
      return !v;
    });
  };
  const sideTimer = useRef<number | null>(null);
  const sideHover = useRef(false);
  const autoHideSidebar = settings?.autoHideSidebar !== false;

  const armSideHide = useCallback(() => {
    if (sideTimer.current != null) window.clearTimeout(sideTimer.current);
    sideTimer.current = window.setTimeout(() => {
      if (!sideHover.current) setSideHidden(true);
    }, 5000);
  }, []);

  useEffect(() => {
    if (sideTimer.current != null) window.clearTimeout(sideTimer.current);
    sideTimer.current = null;
    if (!autoHideSidebar || onboardingOpen) { setSideHidden(false); return; }
    // New tab — the panel is visible, the 5 second timer starts over.
    setSideHidden(false);
    armSideHide();
    return () => { if (sideTimer.current != null) window.clearTimeout(sideTimer.current); };
  }, [page, autoHideSidebar, onboardingOpen, armSideHide]);

  const installedCount = useMemo(
    () => effectiveInstalledCount(installedDetails),
    [installedDetails],
  );
  const hasRunningServer = useMemo(
    () => Object.values(serverStatuses).some((s) => s === 'running' || s === 'starting'),
    [serverStatuses],
  );
  const hasUpdate = useMemo(
    () => updaterState?.status === 'available' || updaterState?.status === 'downloaded',
    [updaterState],
  );

  const activeAccount = accounts.find((a) => a.uuid === activeUuid) || null;

  const refreshAccounts = async () => {
    const list = await window.api.accounts.list();
    setAccounts(list);
    if (!list.find((a) => a.uuid === activeUuid)) {
      setActiveUuid(list[0]?.uuid ?? null);
    }
  };

  const updateSettings = (s: LauncherSettings) => {
    setSettings(s);
    // Fire-and-forget used to produce an unhandled rejection on an IPC error —
    // the UI thought it had been saved, while settings.json had not.
    window.api.settings.set(s).catch((e) => console.error('[app] settings.set failed:', e));
  };

  // We apply the theme on the root <html> on load and on every change.
  // This gives an instant switch of all CSS variables through the cascade,
  // without a reload or a flash. The default is mono (dark, no decoration).
  useEffect(() => {
    const theme = settings?.theme ?? 'mono';
    document.documentElement.setAttribute('data-theme', theme);
  }, [settings?.theme]);

  const currentTheme = settings?.theme ?? 'mono';

  if (!settings || !accountsReady || !minLoadingDone) {
    return (
      <LocaleProvider value={settings?.locale ?? 'ru'}>
        <DialogProvider>
          <div className="app">
            <TitleBar />
            <div className="main">
              <div className="flex-center" style={{ gridColumn: '1 / -1' }}>
                <div className="empty p-24">{t('app.loading')}</div>
              </div>
            </div>
          </div>
        </DialogProvider>
      </LocaleProvider>
    );
  }

  if (accounts.length === 0) {
    return (
      <LocaleProvider value={settings?.locale ?? 'ru'}>
        <DialogProvider>
          <div className="app">
            <TitleBar />
            <WelcomePage onDone={refreshAccounts} />
          </div>
          {!introDone && settings?.showIntro !== false && <IntroAnimation theme={currentTheme} onDone={onIntroDone} />}
        </DialogProvider>
      </LocaleProvider>
    );
  }

  const isFlush = page === 'browse';

  return (
    <LocaleProvider value={settings?.locale ?? 'ru'}>
      <DialogProvider>
        <div className="app">
          <TitleBar />
          <GlobalActivityBar
            serverStatuses={serverStatuses}
            gameRunning={gameRunning}
            minecraftProgress={minecraftProgress}
            bedrockProgress={bedrockProgress}
            trelEmuProgress={trelEmuProgress}
            updaterState={updaterState}
          />
          <CrashDoctor settings={settings} onSettingsChange={updateSettings} onNavigate={(p) => setPage(p)} />
          <div className={'main' + (sideHidden && autoHideSidebar ? ' side-hidden' : '')}>
          <div
            className="side-wrap"
            onMouseEnter={() => { sideHover.current = true; if (sideHidden) setSideHidden(false); if (autoHideSidebar && !onboardingOpen) armSideHide(); }}
            onMouseLeave={() => { sideHover.current = false; if (autoHideSidebar && !sideHidden && !onboardingOpen) armSideHide(); }}
          >
          <Sidebar
            page={page}
            onChange={setPage}
            activeAccount={activeAccount}
            installedCount={installedCount}
            hasRunningServer={hasRunningServer}
            hasUpdate={hasUpdate}
            collapsed={railCollapsed}
            onToggleCollapse={toggleRail}
          />
          </div>
          {sideHidden && autoHideSidebar && (
            <div
              className="side-reveal"
              title={t('nav.sideRevealHint')}
              onMouseEnter={() => { sideHover.current = false; setSideHidden(false); if (autoHideSidebar) armSideHide(); }}
            />
          )}
          <div className={'content' + (isFlush ? ' flush' : '')}>
            <PageErrorBoundary page={page} t={t}>
            <Suspense fallback={<div className="empty p-24">{t('app.loading')}</div>}>
            {page === 'home' && (
              <HomePage
                settings={settings}
                account={activeAccount}
                onGoToAccounts={() => setPage('accounts')}
                onGoToBrowse={() => setPage('browse')}
                onGoToInstalled={() => setPage('installed')}
                onSettingsChange={updateSettings}
                gameRunning={gameRunning}
              />
            )}
            {page === 'browse' && (
              <BrowsePage
                settings={settings}
                account={activeAccount}
                onGoToAccounts={() => setPage('accounts')}
                onSettingsChange={updateSettings}
                gameRunning={gameRunning}
              />
            )}
            {page === 'installed' && (
              <InstalledPage
                settings={settings}
                account={activeAccount}
                onSettingsChange={updateSettings}
                onGoToBrowse={() => setPage('browse')}
                gameRunning={gameRunning}
              />
            )}
            {page === 'worlds' && <WorldsPage />}
            {page === 'content' && (
              <ContentPage
                lastVersionId={settings.lastVersionId}
                onPickVersion={(id) => updateSettings({ ...settings, lastVersionId: id })}
              />
            )}
            {page === 'modpacks' && <ModpacksPage />}
            {page === 'screenshots' && <ScreenshotsPage />}
            {page === 'stats' && <StatsPage />}
            {page === 'servers' && <ServersPage />}
            {page === 'accounts' && (
              <AccountsPage
                accounts={accounts}
                activeUuid={activeUuid}
                onSelect={setActiveUuid}
                onChange={refreshAccounts}
                onGoToSkin={() => setPage('skin')}
              />
            )}
            {page === 'skin' && (
              <SkinPage
                accounts={accounts}
                activeUuid={activeUuid}
                onSelect={setActiveUuid}
                onChange={refreshAccounts}
                onGoToAccounts={() => setPage('accounts')}
              />
            )}
            {page === 'settings' && (
              <SettingsPage
                settings={settings}
                onChange={updateSettings}
              />
            )}
            {page === 'import' && <ImportPage />}
            {page === 'diagnostics' && (
              <DiagnosticsPage settings={settings} onSettingsChange={updateSettings} />
            )}
            </Suspense>
            </PageErrorBoundary>
          </div>
        </div>
        </div>
        <Onboarding
          open={onboardingOpen}
          onClose={() => setOnboardingOpen(false)}
          onNavigate={(nextPage) => setPage(nextPage)}
        />
        {!introDone && settings?.showIntro !== false && <IntroAnimation theme={currentTheme} onDone={onIntroDone} />}
      </DialogProvider>
    </LocaleProvider>
  );
};
