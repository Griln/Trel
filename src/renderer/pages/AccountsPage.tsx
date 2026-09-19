import React, { useState } from 'react';
import type { MinecraftAccount } from '../../shared/types';
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
          <label className="dlg-check" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={v} onChange={(e) => { setV(e.target.checked); clearCache = e.target.checked; }} />
            <span className="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5}><path d="m5 12 5 5 9-11" /></svg></span>
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
        <span className="eyebrow">{t('accounts.eyebrow')}</span>
        <h1 className="page-title">{t('accounts.title')} <span className="count">{accounts.length}</span></h1>
        <p className="page-sub">{t('accounts.subtitle')}</p>
      </div>

      {error && <div className="hint" style={{ color: 'var(--danger)' }}>{error}</div>}
      <div className="acc-layout">
        <div>
          <div className="ms-card">
            <div className="ms-logo"><i></i><i></i><i></i><i></i></div>
            <h3>Microsoft</h3>
            <p>{t('accounts.addMicrosoftHint')}</p>
            <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }} onClick={addMicrosoft} disabled={loading}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
              {t('accounts.addMicrosoft')}
            </button>
          </div>

          <div className="guest-card">
            <h3>{t('accounts.addGuest')}</h3>
            <p>{t('accounts.hint')}</p>
            <div className="guest-row">
              <input className="input" placeholder={t('accounts.nicknamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} maxLength={16} />
              <button className="btn ghost" onClick={addGuest} disabled={loading || !name.trim()}>{t('accounts.addBtn')}</button>
            </div>
          </div>

        </div>

        <div className="acc-list">
          {accounts.map((a) => (
            <div
              key={a.uuid}
              className={'acc' + (activeUuid === a.uuid ? ' active' : '')}
              onClick={() => onSelect(a.uuid)}
            >
              <SkinFace skin={a.skin ?? null} size={48} fallbackName={a.name} className="account-face" />
              <div className="acc-body">
                <div className="acc-name">
                  {a.name}
                  {activeUuid === a.uuid && <span className="chip green">{t('accounts.active')}</span>}
                </div>
                <div className="acc-sub">
                  <span>uuid: {a.uuid.slice(0, 8)}…</span>
                  <span>·</span>
                  <span>{t('accounts.skin')}: {a.skin ? (a.skin.startsWith('data:') ? t('accounts.skinCustom') : a.skin) : t('accounts.skinDefault')}</span>
                </div>
              </div>
              <div className="acc-actions">
                <button className="abtn" title={t('accounts.skinBtn')} onClick={(e) => { e.stopPropagation(); onSelect(a.uuid); onGoToSkin(); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </button>
                {a.type === 'online' && <button className="abtn" title={t('accounts.refreshBtn')} onClick={(e) => { e.stopPropagation(); refresh(a); }}>↻</button>}
                <button className="abtn del" title={t('accounts.deleteBtn')} onClick={(e) => { e.stopPropagation(); remove(a); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};