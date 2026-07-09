import React, { useState } from 'react';
import type { MinecraftAccount } from '../../shared/types';
import { IconTrash, IconSkin } from '../components/icons';
import { SkinFace } from '../components/SkinPreview';
import { useT } from '../i18n';
import { useDialog } from '../components/Dialog';

interface Props {
  accounts: MinecraftAccount[];
  activeUuid: string | null;
  onSelect: (uuid: string) => void;
  onChange: () => void;
  onGoToSkin: () => void;
}

export const AccountsPage: React.FC<Props> = ({ accounts, activeUuid, onSelect, onChange, onGoToSkin }) => {
  const t = useT();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const dialog = useDialog();

  const addMicrosoft = async () => {
    setError('');
    setLoading(true);
    try {
      await window.api.accounts.addMicrosoft();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const addGuest = async () => {
    if (!name.trim()) return;
    setError('');
    setLoading(true);
    try {
      await window.api.accounts.addGuest(name);
      setName('');
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async (acc: MinecraftAccount) => {
    setLoading(true);
    setError('');
    try {
      await window.api.accounts.refreshMicrosoft(acc.uuid);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (acc: MinecraftAccount) => {
    let clearCache = false;
    const Body: React.FC = () => {
      const [v, setV] = React.useState(false);
      return (
        <div>
          <p>{t('accounts.deleteConfirm', { name: acc.name })}</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={v} onChange={(e) => { setV(e.target.checked); clearCache = e.target.checked; }} />
            <span>{t('accounts.deleteWipeCache')}</span>
          </label>
        </div>
      );
    };
    const choice = await dialog.show({
      title: t('accounts.deleteBtn'),
      tone: 'danger',
      message: <Body />,
      buttons: [
        { label: t('accounts.deleteCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('accounts.deleteOk'), value: 'ok', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (choice !== 'ok') return;
    await window.api.accounts.remove(acc.uuid, clearCache);
    onChange();
  };

  return (
    <div>
      <div className="page-head">
        <h1>{t('accounts.title')}</h1>
        <p>{t('accounts.subtitle')}</p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('accounts.addMicrosoft')}</h2>
        </div>
        <div className="row">
          <button className="btn primary" onClick={addMicrosoft} disabled={loading}>
            {loading ? t('app.loading') : t('accounts.addMicrosoft')}
          </button>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          {t('accounts.addMicrosoftHint')}
        </div>
      </div>

      {error && <div className="hint" style={{ color: 'var(--danger)', marginTop: 8, marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="card-head">
          <h2>{t('accounts.addGuest')}</h2>
        </div>
        <div className="row">
          <input
            className="input"
            placeholder="Steve"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addGuest(); }}
            maxLength={16}
          />
          <button className="btn primary" onClick={addGuest} disabled={loading || !name.trim()}>
            {t('accounts.addBtn')}
          </button>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          {t('accounts.hint')}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('accounts.savedTitle')}</h2>
          <span className="chip">{accounts.length}</span>
        </div>
        {accounts.length === 0 ? (
          <div className="empty">{t('accounts.empty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {accounts.map((a) => (
              <div
                key={a.uuid}
                className={'account-tile' + (activeUuid === a.uuid ? ' active' : '')}
                onClick={() => onSelect(a.uuid)}
              >
                <SkinFace skin={a.skin ?? null} size={40} fallbackName={a.name} className="account-avatar" />
                <div className="info">
                  <div className="name">{a.name}</div>
                  <div className="role">{
                    a.msRefreshToken
                      ? (activeUuid === a.uuid ? t('accounts.roleActiveMicrosoft') : t('accounts.microsoftRole'))
                      : (activeUuid === a.uuid ? t('accounts.roleActive') : t('accounts.roleGuest'))
                  }</div>
                </div>
                <button
                  className="icon-btn"
                  onClick={(e) => { e.stopPropagation(); onSelect(a.uuid); onGoToSkin(); }}
                  title={t('accounts.skinBtn')}
                >
                  <IconSkin />
                </button>
                {a.type === 'online' && a.msRefreshToken && (
                  <button
                    className="icon-btn"
                    onClick={(e) => { e.stopPropagation(); refresh(a); }}
                    title={t('accounts.refreshBtn')}
                    disabled={loading}
                  >
                    ↻
                  </button>
                )}
                <button
                  className="icon-btn"
                  onClick={(e) => { e.stopPropagation(); remove(a); }}
                  title={t('accounts.deleteBtn')}
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
