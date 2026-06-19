import React, { useEffect, useMemo, useState, lazy, Suspense, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { HomePage } from './pages/HomePage';
import { WelcomePage } from './pages/WelcomePage';
import { DialogProvider } from './components/Dialog';
import { IntroAnimation } from './components/IntroAnimation';
import { OnboardingTour } from './components/OnboardingTour';
import { LocaleProvider, useT } from './i18n';
import type { DownloadProgress, LauncherSettings, MinecraftAccount, Page } from '../shared/types';
import type { InstalledVersionDetail, ServerStatus, UpdaterState } from '../preload/preload';
import { effectiveInstalledCount } from '../shared/installed';

// Тяжёлые вкладки грузим по требованию. Три бенефита:
//   1. Стартовый bundle меньше → быстрее старт и меньше памяти под код.
//   2. SkinPage тянет three.js (~600 КБ) — без lazy он попадал в общий
//      чанк и грузился на старте, хотя нужен только когда зашёл в скин.
//   3. Каждая вкладка в своём JS-файле → проще освобождать память
//      при переключении (V8 сможет выгрузить неиспользуемый код).
const BrowsePage = lazy(() => import('./pages/BrowsePage').then(m => ({ default: m.BrowsePage })));
const InstalledPage = lazy(() => import('./pages/InstalledPage').then(m => ({ default: m.InstalledPage })));
const WorldsPage = lazy(() => import('./pages/WorldsPage').then(m => ({ default: m.WorldsPage })));
const ContentPage = lazy(() => import('./pages/ContentPage').then(m => ({ default: m.ContentPage })));
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
  if (showTrelEmu && trelEmuProgress) {
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
  { page: Page; children: React.ReactNode },
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
          <h2>Страница не загрузилась</h2>
          <p className="muted">Trel поймал ошибку интерфейса вместо чёрного экрана. Перейдите на другую вкладку или перезагрузите страницу.</p>
          <pre className="mono text-xs" style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{this.state.error.message}</pre>
          <button className="btn primary" style={{ marginTop: 12 }} onClick={() => this.setState({ error: null })}>Попробовать снова</button>
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
  // Глобальные счётчики/индикаторы для sidebar — обновляются периодически
  // и при ключевых событиях. Это даёт пользователю обзор «что у меня есть»
  // без перехода на каждую вкладку.
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
    // Подписываемся на глобальные сигналы для бейджей в sidebar
    const refreshInstalled = () => {
      window.api.minecraft.installedDetailed().then(setInstalledDetails).catch(() => {});
    };
    const refreshServerStatuses = () => {
      window.api.servers.statuses().then(setServerStatuses).catch(() => {});
    };
    refreshInstalled();
    refreshServerStatuses();
    window.api.updater.state().then(setUpdaterState).catch(() => {});

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
    // Manifest-update триггерит и реконсиляцию счётчиков (новая версия могла
    // быть установлена через скрипт извне, и т.п.). Используем payload события
    // напрямую чтобы не делать лишний IPC-вызов.
    const offManifest = window.api.minecraft.onManifestUpdated((details) => {
      setInstalledDetails(details);
      setMinecraftProgress(null);
      setBedrockProgress(null);
    });

    return () => { offServerStatus(); offUpdater(); offMinecraftProgress(); offBedrockProgress(); offTrelEmuProgress(); offManifest(); offLaunchStart(); offExit(); };
  }, []);

  // Адаптивный минимум: показываем анимацию минимум 2 секунды.
  // Если загрузка дольше — не добавляем задержку.
  useEffect(() => {
    if (!settings || !accountsReady || minLoadingDone) return;
    if (settings.showIntro === false) { setMinLoadingDone(true); setIntroDone(true); return; }
    const elapsed = Date.now() - loadStartTime;
    const MIN_MS = 2000;
    const remaining = Math.max(0, MIN_MS - elapsed);
    if (remaining === 0) setMinLoadingDone(true);
    else { const t = setTimeout(() => setMinLoadingDone(true), remaining); return () => clearTimeout(t); }
  }, [settings, accountsReady, minLoadingDone, loadStartTime]);

  // Первый запуск: открываем обучение один раз после интро или сразу,
  // если интро отключено. Ключ v2 специально новый, чтобы проверить текущий тур.
  useEffect(() => {
    if (!settings || !accountsReady || !minLoadingDone || onboardingChecked) return;
    if (settings.showIntro !== false && !introDone) return;
    setOnboardingChecked(true);
    try {
      if (localStorage.getItem('trel:onboarding-seen:v2') !== '1') {
        setOnboardingOpen(true);
      }
    } catch {
      setOnboardingOpen(true);
    }
  }, [settings, accountsReady, minLoadingDone, introDone, onboardingChecked]);

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
    window.api.settings.set(s);
  };

  // Применяем тему на корневой <html> при загрузке и каждой смене.
  // Это даёт мгновенное переключение всех CSS-переменных через каскад,
  // без перезагрузки или флеша. Дефолт — mono (тёмная без декора).
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
          <OnboardingTour
            open={onboardingOpen}
            onClose={() => setOnboardingOpen(false)}
            onNavigate={(nextPage) => { try { localStorage.setItem('trel:onboarding-seen:v2', '1'); } catch {} setPage(nextPage); setOnboardingOpen(false); }}
          />
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
          <div className="main">
          <Sidebar
            page={page}
            onChange={setPage}
            activeAccount={activeAccount}
            installedCount={installedCount}
            hasRunningServer={hasRunningServer}
            hasUpdate={hasUpdate}
          />
          <div className={'content' + (isFlush ? ' flush' : '')}>
            <PageErrorBoundary page={page}>
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
        <OnboardingTour
          open={onboardingOpen}
          onClose={() => setOnboardingOpen(false)}
          onNavigate={(nextPage) => { try { localStorage.setItem('trel:onboarding-seen:v2', '1'); } catch {} setPage(nextPage); setOnboardingOpen(false); }}
        />
        {!introDone && settings?.showIntro !== false && <IntroAnimation theme={currentTheme} onDone={onIntroDone} />}
      </DialogProvider>
    </LocaleProvider>
  );
};
