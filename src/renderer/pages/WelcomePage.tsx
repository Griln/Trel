import React, { useState } from 'react';
import { IconArrow } from '../components/icons';
import { useT } from '../i18n';

interface Props {
  onDone: () => void;
}

export const WelcomePage: React.FC<Props> = ({ onDone }) => {
  const t = useT();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) return;
    setError('');
    setLoading(true);
    try {
      await window.api.accounts.addGuest(name);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="welcome-wrap">
      <section className="pane show" id="welcome" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <div className="wcard">
          <div className="wlogo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 3l1.9 5.7L19.6 10l-5.7 1.9L12 17.6l-1.9-5.7L4.4 10l5.7-1.9L12 3Z"/><path d="M19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9L19 15Z"/></svg>
          </div>
          <h1 className="wtitle">{t('welcome.heading1')}<br />{t('welcome.heading2')}</h1>
          <p className="wsub">{t('welcome.subtitle')}</p>

          <div className="wfield">
            <label className="field-label">{t('welcome.nicknameLabel')}</label>
            <div className="winput-wrap">
              <span className="face"></span>
              <input className="input" placeholder="Steve" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} maxLength={16} />
            </div>
            <div className="hint">{t('welcome.nicknameHint')}</div>
          </div>

          {error && <div className="hint" style={{ color: 'var(--danger)' }}>{error}</div>}

          <button className="btn primary wbtn" disabled={loading || !name.trim()} onClick={submit}>
            {loading ? t('welcome.saving') : <>{t('welcome.continue')} <IconArrow /></>}
          </button>

          <div className="wstorage">{t('welcome.storageHint')}</div>

          <div className="wsteps">
            <div className="wstep now"><i>1</i>{t('welcome.stepNick')}</div>
            <div className="wstep"><i>2</i>{t('welcome.stepTour')}</div>
            <div className="wstep"><i>3</i>{t('welcome.stepVersion')}</div>
          </div>
          <div className="grain"></div>
        </div>
      </section>
    </div>
  );
};