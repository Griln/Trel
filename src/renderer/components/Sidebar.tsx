import React from 'react';
import { useT } from '../i18n';
import type { Page } from '../../shared/types';
import type { MinecraftAccount } from '../../shared/types';
import { IconPlay, IconCube, IconCheck, IconUser, IconSettings, IconGlobe, IconArchive, IconSkin, IconServer, IconImport } from './icons';
import { SkinFace } from './SkinPreview';

interface Props {
  page: Page;
  onChange: (p: Page) => void;
  activeAccount: MinecraftAccount | null;
  /** Дополнительные счётчики/индикаторы для пунктов меню. */
  installedCount?: number;
  hasRunningServer?: boolean;
  hasUpdate?: boolean;
}

interface NavItem {
  id: Page;
  label: string;
  Icon: React.FC<any>;
  /** Бейдж справа: число (счётчик) или 'dot' (точка-индикатор). */
  badge?: number | 'dot' | null;
}

interface NavGroup {
  /** Заголовок секции. Не показывается если пустой. */
  label: string;
  items: NavItem[];
}

const SidebarBase: React.FC<Props> = ({
  page, onChange, activeAccount,
  installedCount, hasRunningServer, hasUpdate,
}) => {
  const t = useT();
  // Группируем пункты по логическим разделам. Раньше было 2 группы
  // (PRIMARY/SECONDARY) — это смешивало «Контент» и «Скин» с разной семантикой.
  // Теперь:
  //   ИГРАТЬ — что сделать прямо сейчас (запуск, выбор версии, серверы)
  //   ДАННЫЕ — работа с тем что уже есть в игре (миры, моды, паки)
  //   ПРОФИЛЬ — кто я (аккаунт, скин) и настройки лаунчера
  const groups: NavGroup[] = [
    {
      label: t('nav.play'),
      items: [
        { id: 'home',      label: t('nav.home'),      Icon: IconPlay },
        { id: 'browse',    label: t('nav.browse'),     Icon: IconCube },
        { id: 'installed', label: t('nav.installed'),  Icon: IconCheck,
          badge: installedCount && installedCount > 0 ? installedCount : null },
        { id: 'servers',   label: t('nav.servers'),    Icon: IconServer,
          badge: hasRunningServer ? 'dot' : null },
      ],
    },
    {
      label: t('nav.data'),
      items: [
        { id: 'worlds',  label: t('nav.worlds'),   Icon: IconGlobe },
        { id: 'content', label: t('nav.content'),  Icon: IconArchive },
        { id: 'import',  label: t('nav.import'),    Icon: IconImport },
      ],
    },
    {
      label: t('nav.profile'),
      items: [
        { id: 'accounts', label: t('nav.accounts'),  Icon: IconUser },
        { id: 'skin',     label: t('nav.skin'),      Icon: IconSkin },
        { id: 'settings', label: t('nav.settings'),  Icon: IconSettings,
          badge: hasUpdate ? 'dot' : null },
      ],
    },
  ];

  const renderItem = (it: NavItem) => (
    <div
      key={it.id}
      className={'nav-item' + (page === it.id ? ' active' : '')}
      onClick={() => onChange(it.id)}
    >
      <it.Icon />
      <span className="nav-item-label">{it.label}</span>
      {it.badge === 'dot' && (
        <span
          className="nav-item-dot"
          title={it.id === 'settings' ? t('nav.updateAvailable') : t('nav.serverRunning')}
        />
      )}
      {typeof it.badge === 'number' && (
        <span className="nav-item-count">{it.badge}</span>
      )}
    </div>
  );

  return (
    <aside className="sidebar">
      {groups.map((group, idx) => (
        <React.Fragment key={group.label}>
          <div className="nav-group">
            <div className="nav-group-label">{group.label}</div>
            {group.items.map(renderItem)}
          </div>
          {idx < groups.length - 1 && <div className="nav-divider" />}
        </React.Fragment>
      ))}

      <div className="spacer" />
      {activeAccount && (
        <button
          className="account-chip"
          onClick={() => onChange('accounts')}
          title={t('nav.openAccounts')}
        >
          <SkinFace
            skin={activeAccount.skin ?? null}
            size={32}
            fallbackName={activeAccount.name}
            className="avatar-sm"
          />
          <div className="info">
            <div className="name">{activeAccount.name}</div>
            <div className="role">{t('nav.guest')}</div>
          </div>
        </button>
      )}
    </aside>
  );
};

export const Sidebar = React.memo(SidebarBase);
