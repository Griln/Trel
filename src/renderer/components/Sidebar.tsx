import React from 'react';
import type { Page } from '../App';
import type { MinecraftAccount } from '../../shared/types';
import { IconPlay, IconUser, IconSettings, IconGlobe } from './icons';

interface Props {
  page: Page;
  onChange: (p: Page) => void;
  activeAccount: MinecraftAccount | null;
}

const items: { id: Page; label: string; Icon: React.FC<any> }[] = [
  { id: 'library', label: 'Библиотека', Icon: IconPlay },
  { id: 'worlds',   label: 'Миры',       Icon: IconGlobe },
  { id: 'accounts', label: 'Аккаунты', Icon: IconUser },
  { id: 'settings', label: 'Настройки', Icon: IconSettings },
];

export const Sidebar: React.FC<Props> = ({ page, onChange, activeAccount }) => {
  return (
    <aside className="sidebar">
      {items.map(({ id, label, Icon }) => (
        <div
          key={id}
          className={'nav-item' + (page === id ? ' active' : '')}
          onClick={() => onChange(id)}
        >
          <Icon />
          <span>{label}</span>
        </div>
      ))}
      <div className="spacer" />
      {activeAccount && (
        <div className="account-chip">
          <div className="avatar-sm">{activeAccount.name.charAt(0).toUpperCase()}</div>
          <div className="info">
            <div className="name">{activeAccount.name}</div>
            <div className="role">Гость</div>
          </div>
        </div>
      )}
    </aside>
  );
};
