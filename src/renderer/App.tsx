import React, { useEffect, useMemo, useState, lazy, Suspense, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { HomePage } from './pages/HomePage';
import { WelcomePage } from './pages/WelcomePage';
import { DialogProvider } from './components/Dialog';
import { IntroAnimation } from './components/IntroAnimation';
import { LocaleProvider, useT } from './i18n';
import type { LauncherSettings, MinecraftAccount, Page } from '../shared/types';
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
  const [gameRunning, setGameRunning] = useState(false);
  const [introDone, setIntroDone] = useState(false);
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
    const offLaunchStart = window.api.minecraft.onLaunchStart(() => setGameRunning(true));
    const offExit = window.api.minecraft.onExit(() => setGameRunning(false));
    // Manifest-update триггерит и реконсиляцию счётчиков (новая версия могла
    // быть установлена через скрипт извне, и т.п.). Используем payload события
    // напрямую чтобы не делать лишний IPC-вызов.
    const offManifest = window.api.minecraft.onManifestUpdated((details) => {
      setInstalledDetails(details);
    });

    return () => { offServerStatus(); offUpdater(); offManifest(); offLaunchStart(); offExit(); };
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
              <SettingsPage settings={settings} onChange={updateSettings} />
            )}
            {page === 'import' && <ImportPage />}
            </Suspense>
          </div>
        </div>
        </div>
        {!introDone && settings?.showIntro !== false && <IntroAnimation theme={currentTheme} onDone={onIntroDone} />}
      </DialogProvider>
    </LocaleProvider>
  );
};
