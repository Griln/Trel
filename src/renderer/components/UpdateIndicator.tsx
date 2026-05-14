import React, { useEffect, useState } from 'react';
import type { UpdaterState } from '../../preload/preload';
import { IconRefresh, IconCheck, IconAlert } from './icons';

export const UpdateIndicator: React.FC = () => {
  const [s, setS] = useState<UpdaterState | null>(null);

  useEffect(() => {
    window.api.updater.state().then(setS);
    return window.api.updater.onState(setS);
  }, []);

  if (!s) return null;
  if (s.status === 'idle' || s.status === 'up-to-date' || s.status === 'disabled') return null;

  const onClick = () => {
    if (s.status === 'downloaded') {
      if (confirm(`Готово к установке версии ${s.latest}. Перезапустить лаунчер сейчас?`)) {
        window.api.updater.install();
      }
    } else if (s.status === 'error') {
      window.api.updater.check();
    }
  };

  if (s.status === 'available' || s.status === 'downloading') {
    return (
      <div className="update-indicator" title={`Загрузка обновления v${s.latest}...`}>
        <IconRefresh style={{ animation: 'spin 2s linear infinite' }} />
        <span>обновление {s.percent !== undefined ? `${s.percent}%` : ''}</span>
      </div>
    );
  }
  if (s.status === 'downloaded') {
    return (
      <div className="update-indicator ready" onClick={onClick} title="Нажмите, чтобы установить">
        <IconCheck />
        <span>обновление готово</span>
      </div>
    );
  }
  if (s.status === 'error') {
    return (
      <div className="update-indicator error" onClick={onClick} title={s.error || 'Ошибка обновления'}>
        <IconAlert />
        <span>ошибка</span>
      </div>
    );
  }
  return null;
};
