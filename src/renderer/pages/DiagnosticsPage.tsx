import React, { useEffect, useState } from 'react';
import type { InstalledVersionDetail } from '../../preload/preload';
import type { LauncherSettings } from '../../shared/types';
import { IconAlert, IconCheck, IconCopy, IconRefresh, IconSpark } from '../components/icons';
import { VersionPicker } from '../components/VersionPicker';
import { useT } from '../i18n';

type Check = { id: string; label: string; ok: boolean; level: 'ok' | 'warn' | 'error'; details: string; action?: string };
const safeDetail = (value: string) => value.replace(/(?:[A-Za-z]:)?[/\\][^\n]*/g, '…');

type Profile = { id: string; name: string; versionId: string; memoryMb: number; jvmArgs?: string; createdAt: number };

export const DiagnosticsPage: React.FC<{ settings: LauncherSettings; onSettingsChange: (s: LauncherSettings) => void }> = ({ settings, onSettingsChange }) => {
  const t = useT();
  const [checks, setChecks] = useState<Check[]>([]);
  const [versions, setVersions] = useState<InstalledVersionDetail[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(settings.lastVersionId || '');
  const [integrity, setIntegrity] = useState<string>('');
  const [logs, setLogs] = useState<Array<{ name: string; path: string; size: number; mtime: number }>>([]);
  const [busy, setBusy] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try { return JSON.parse(localStorage.getItem('trel:profiles') || '[]'); } catch { return []; }
  });
  const [profileName, setProfileName] = useState('');

  const runDiagnostics = async () => {
    setBusy(true);
    try { setChecks((await window.api.tools.diagnostics()).checks); }
    finally { setBusy(false); }
  };
  const refreshLogs = async () => setLogs(await window.api.tools.logsList());

  useEffect(() => {
    window.api.minecraft.installedDetailed().then((v) => {
      setVersions(v);
      if (!selectedVersion && v[0]) setSelectedVersion(v[0].id);
    });
    runDiagnostics();
    refreshLogs();
  }, []);

  const saveProfiles = (next: Profile[]) => {
    setProfiles(next);
    localStorage.setItem('trel:profiles', JSON.stringify(next));
  };
  const createProfile = () => {
    if (!selectedVersion) return;
    const next = [{ id: crypto.randomUUID(), name: profileName.trim() || t('diagnostics.profilesTitle'), versionId: selectedVersion, memoryMb: settings.memoryMb, jvmArgs: settings.jvmArgs, createdAt: Date.now() }, ...profiles];
    saveProfiles(next);
  };
  const applyProfile = (p: Profile) => onSettingsChange({ ...settings, lastVersionId: p.versionId, memoryMb: p.memoryMb, jvmArgs: p.jvmArgs });
  const deleteProfile = (id: string) => saveProfiles(profiles.filter((p) => p.id !== id));

  const checkIntegrity = async () => {
    if (!selectedVersion) return;
    setBusy(true);
    try {
      const r = await window.api.tools.integrityCheck(selectedVersion);
      setIntegrity(r.ok ? t('diagnostics.integrityOk') : [...r.issues, ...r.repaired].join('\n'));
    } catch (e) { setIntegrity((e as Error).message); }
    finally { setBusy(false); }
  };

  const okCount = checks.filter((c) => c.ok).length;
  const totalCount = checks.length;
  const pct = totalCount > 0 ? Math.round((okCount / totalCount) * 100) : 0;
  const errors = checks.filter((c) => c.level === 'error').length;
  const warnings = checks.filter((c) => c.level === 'warn').length;
  const overallKey = errors ? 'diagnostics.overallErrors' : warnings ? 'diagnostics.overallWarnings' : 'diagnostics.overallGood';
  const [copyMsg, setCopyMsg] = React.useState<string | null>(null);
  const copyReport = async () => {
    try { await window.api.tools.copyReport(); setCopyMsg(t('diagnostics.copied')); }
    catch (e) { setCopyMsg(t('diagnostics.copyFailed', { message: (e as Error).message })); }
  };
  const circumference = 2 * Math.PI * 46;
  const dashLen = (pct / 100) * circumference;

  return (
    <div className="page-frame">
      <div className="page-head">
        <span className="eyebrow">{t('diagnostics.eyebrow')}</span>
        <div className="page-head-row">
          <div>
            <h1 className="page-title">{t('diagnostics.title')}</h1>
            <p className="page-sub">{t(window.api.platform === 'win32' ? 'diagnostics.subtitleWindows' : 'diagnostics.subtitle')}</p>
          </div>
          <button className="btn ghost sm" onClick={runDiagnostics} disabled={busy}><IconRefresh /> {t('diagnostics.refresh')}</button>
        </div>
      </div>

      <div className="diag-grid">
        <div className="card span2">
          <div className="card-head"><h2>{t(window.api.platform === 'win32' ? 'diagnostics.bedrockTitle' : 'diagnostics.environmentTitle')}<span className="chip mono">{checks.length} {t('diagnostics.checks')}</span></h2></div>
          <div className="score-wrap">
            <div className="score-ring">
              <svg width="110" height="110" viewBox="0 0 110 110">
                <circle cx="55" cy="55" r="46" fill="none" stroke="var(--surface-4)" strokeWidth={10} />
                <circle cx="55" cy="55" r="46" fill="none" stroke="var(--green)" strokeWidth={10} strokeLinecap="round" strokeDasharray={`${dashLen} ${circumference}`} style={{ transition: 'stroke-dasharray 1s var(--ease)' }} />
              </svg>
              <span className="val">{okCount}/{totalCount}</span>
            </div>
            <div className="txt">
              <b>{t(overallKey)}</b>
              <span>{t('diagnostics.summary', { ok: okCount, warnings, errors })}</span>
            </div>
            <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={copyReport}><IconCopy /> {t('diagnostics.copyReport')}</button>
            {copyMsg && <span className="hint" style={{ marginLeft: 8 }}>{copyMsg}</span>}
          </div>
          <div className="checks">
            {checks.map((c) => (
              <div className={`chk ${c.level}`} key={c.id}>
                <div className="chk-ico">{c.ok ? <IconCheck /> : <IconAlert />}</div>
                <div className="chk-body">
                  <b>{c.label}</b>
                  <p>{safeDetail(c.details)}</p>
                  {c.action && !c.ok && <small>{c.action}</small>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>{t('diagnostics.integrityTitle')}</h2></div>
          <label className="field-label">{t('diagnostics.versionLabel')}</label>
          <VersionPicker
            value={selectedVersion}
            onChange={setSelectedVersion}
            maxHeight={240}
            options={versions.map((v) => ({ id: v.id, title: v.id, sub: `${v.edition}${v.loader ? `/${v.loader}` : ''}` }))}
          />
          <div className="hint">{t('diagnostics.integrityHint', { bedrock: window.api.platform === 'win32' ? t('diagnostics.bedrockSuffix') : '' })}</div>
          <button className="btn primary" onClick={checkIntegrity} disabled={!selectedVersion || busy}><IconSpark /> {t('diagnostics.checkFiles')}</button>
          {integrity && <pre className="diag-log-preview">{integrity}</pre>}
        </div>

        <div className="card">
          <div className="card-head"><h2>{t('diagnostics.profilesTitle')}</h2></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input className="input" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder={t('diagnostics.profileNamePlaceholder')} style={{ flex: 1 }} />
            <button className="btn ghost" onClick={createProfile} disabled={!selectedVersion}>{t('diagnostics.save')}</button>
          </div>
          {profiles.length === 0 ? (
            <div className="hint">{t('diagnostics.noProfiles')}</div>
          ) : profiles.map((profile) => (
            <div className="prof-row" key={profile.id}><div className="pn"><b>{profile.name}</b><span>{profile.versionId} · {profile.memoryMb} {t('size.mb')}{profile.jvmArgs ? ` · ${profile.jvmArgs}` : ''}</span></div>
              <button className="btn ghost" onClick={() => applyProfile(profile)}>{t('diagnostics.apply')}</button><button className="btn ghost icon" onClick={() => deleteProfile(profile.id)} style={{ color: 'var(--red)' }} aria-label={t('diagnostics.deleteProfile')}>✕</button></div>
          ))}
        </div>

        <div className="card span2">
          <div className="card-head"><h4>{t('diagnostics.logs')}</h4>
            <button className="btn ghost" onClick={refreshLogs}><IconRefresh /> {t('content.refresh')}</button>
          </div>
          <div className="logs-split">
            <div className="log-list">
              {logs.length === 0 ? <div className="hint">{t('diagnostics.noLogs')}</div> : logs.map((log) => (
                <div className="log-item" key={log.path}>{log.name}<small>{(log.size / 1024).toFixed(0)} {t('size.kb')}</small></div>
              ))}
            </div>
            <div className="log-view"><span className="i">{t('diagnostics.logPreviewUnavailable')}</span></div>
          </div>
        </div>
      </div>
      <p className="note">{t('diagnostics.note')}</p>
    </div>
  );
};