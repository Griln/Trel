import React from 'react';
import { useT } from '../i18n';
import { IconMinimize, IconMaximize, IconClose, IconSpark } from './icons';
import { UpdateIndicator } from './UpdateIndicator';

export const TitleBar: React.FC = () => {
  const t = useT();
  return (
    <div className="titlebar">
      <div className="brand">
        <span className="brand-mark"><IconSpark /></span>
        <span>Trel</span>
      </div>
      <div className="spacer" />
      <UpdateIndicator />
      <div className="win-controls">
        <button className="win-btn" onClick={() => window.api.window.minimize()} title={t('titlebar.minimize')}>
          <IconMinimize />
        </button>
        <button className="win-btn" onClick={() => window.api.window.maximize()} title={t('titlebar.maximize')}>
          <IconMaximize />
        </button>
        <button className="win-btn close" onClick={() => window.api.window.close()} title={t('titlebar.close')}>
          <IconClose />
        </button>
      </div>
    </div>
  );
};
