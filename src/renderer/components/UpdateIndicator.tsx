import React, { useEffect, useState } from 'react';
import { useT } from '../i18n';
import type { UpdaterState } from '../../preload/preload';
import { IconRefresh, IconCheck, IconAlert } from './icons';

export const UpdateIndicator: React.FC = () => {
  const t = useT();
  const [s, setS] = useState<UpdaterState | null>(null);

  useEffect(() => {
    window.api.updater.state().then(setS);
    const off = window.api.updater.onState(setS);
    return () => { off(); };
  }, []);

  if (!s) return null;
  if (s.status === 'idle' || s.status === 'up-to-date' || s.status === 'disabled') return null;

  const onClick = () => {
    if (s.status === 'downloaded') {
      if (confirm(t('update.readyPrompt', { version: s.latest ?? '' }))) {
        window.api.updater.install();
      }
    } else if (s.status === 'error') {
      window.api.updater.check();
    }
  };

  if (s.status === 'available' || s.status === 'downloading') {
    return (
      <div className="update-indicator" title={t('update.downloading', { version: s.latest ?? '' })}>
        <IconRefresh className="spin" />
        <span>{t('update.downloadingLabel')} {s.percent !== undefined ? `${s.percent}%` : ''}</span>
      </div>
    );
  }
  if (s.status === 'downloaded') {
    return (
      <div className="update-indicator ready" onClick={onClick} title={t('update.readyTitle')}>
        <IconCheck />
        <span>{t('update.readyLabel')}</span>
      </div>
    );
  }
  if (s.status === 'error') {
    return (
      <div className="update-indicator error" onClick={onClick} title={s.error || t('update.errorTitle')}>
        <IconAlert />
        <span>{t('update.errorLabel')}</span>
      </div>
    );
  }
  return null;
};
