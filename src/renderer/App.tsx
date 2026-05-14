import React, { useEffect, useState } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { LibraryPage } from './pages/LibraryPage';
import { WorldsPage } from './pages/WorldsPage';
import { AccountsPage } from './pages/AccountsPage';
import { SettingsPage } from './pages/SettingsPage';
import { WelcomePage } from './pages/WelcomePage';
import type { LauncherSettings, MinecraftAccount } from '../shared/types';

export type Page = 'library' | 'worlds' | 'accounts' | 'settings';

export const App: React.FC = () => {
  const [page, setPage] = useState<Page>('library');
  const [settings, setSettings] = useState<LauncherSettings | null>(null);
  const [accounts, setAccounts] = useState<MinecraftAccount[]>([]);
  const [activeUuid, setActiveUuid] = useState<string | null>(null);
  const [accountsReady, setAccountsReady] = useState(false);

  useEffect(() => {
    window.api.settings.get().then(setSettings);
    window.api.accounts.list().then((list) => {
      setAccounts(list);
      if (list.length > 0) setActiveUuid(list[0].uuid);
      setAccountsReady(true);
    });
  }, []);

  const activeAccount = accounts.find((a) => a.uuid === activeUuid) || null;

  const refreshAccounts = async () => {
    const list = await window.api.accounts.list();
    setAccounts(list);
    if (!list.find((a) => a.uuid === activeUuid)) {
      setActiveUuid(list[0]?.uuid ?? null);
    }
  };

  if (!settings || !accountsReady) {
    return (
      <div className="app">
        <TitleBar />
        <div className="main">
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty">Загрузка...</div>
          </div>
        </div>
      </div>
    );
  }

  // First-run onboarding: no accounts saved yet.
  if (accounts.length === 0) {
    return (
      <div className="app">
        <TitleBar />
        <WelcomePage onDone={refreshAccounts} />
      </div>
    );
  }

  return (
    <div className="app">
      <TitleBar />
      <div className="main">
        <Sidebar
          page={page}
          onChange={setPage}
          activeAccount={activeAccount}
        />
        <div className={'content' + (page === 'library' ? ' flush' : '')}>
          {page === 'library' && (
            <LibraryPage
              settings={settings}
              account={activeAccount}
              onGoToAccounts={() => setPage('accounts')}
              onSettingsChange={(s) => {
                setSettings(s);
                window.api.settings.set(s);
              }}
            />
          )}
          {page === 'worlds' && <WorldsPage />}
          {page === 'accounts' && (
            <AccountsPage
              accounts={accounts}
              activeUuid={activeUuid}
              onSelect={setActiveUuid}
              onChange={refreshAccounts}
            />
          )}
          {page === 'settings' && (
            <SettingsPage
              settings={settings}
              onChange={(s) => {
                setSettings(s);
                window.api.settings.set(s);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
