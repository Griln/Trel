import React, { useEffect, useMemo, useState } from 'react';
import type { InstalledVersionDetail } from '../../preload/preload';
import type { LauncherSettings } from '../../shared/types';
import { IconAlert, IconCheck, IconCopy, IconFolder, IconRefresh, IconSettings, IconSpark } from '../components/icons';
import { useT } from '../i18n';

type Check = { id: string; label: string; ok: boolean; level: 'ok' | 'warn' | 'error'; details: string; action?: string };
type Profile = { id: string; name: string; versionId: string; memoryMb: number; jvmArgs?: string; createdAt: number };

const fmtSize = (n: number) => n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} МБ` : `${(n / 1024).toFixed(0)} КБ`;

export const DiagnosticsPage: React.FC<{ settings: LauncherSettings; onSettingsChange: (s: LauncherSettings) => void }> = ({ settings, onSettingsChange }) => {
  const t = useT();
  const [checks, setChecks] = useState<Check[]>([]);
  const [versions, setVersions] = useState<InstalledVersionDetail[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(settings.lastVersionId || '');
  const [integrity, setIntegrity] = useState<string>('');
  const [logs, setLogs] = useState<Array<{ name: string; path: string; size: number; mtime: number }>>([]);
  const [logText, setLogText] = useState('');
  const [busy, setBusy] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try { return JSON.parse(localStorage.getItem('trel:profiles') || '[]'); } catch { return []; }
  });
  const [profileName, setProfileName] = useState('Мой профиль');

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
    const next = [{ id: crypto.randomUUID(), name: profileName.trim() || 'Профиль', versionId: selectedVersion, memoryMb: settings.memoryMb, jvmArgs: settings.jvmArgs, createdAt: Date.now() }, ...profiles];
    saveProfiles(next);
  };
  const applyProfile = (p: Profile) => onSettingsChange({ ...settings, lastVersionId: p.versionId, memoryMb: p.memoryMb, jvmArgs: p.jvmArgs });

  const selectedDetail = useMemo(() => versions.find((v) => v.id === selectedVersion), [versions, selectedVersion]);

  const checkIntegrity = async () => {
    if (!selectedVersion) return;
    setBusy(true);
    try {
      const r = await window.api.tools.integrityCheck(selectedVersion);
      setIntegrity(r.ok ? 'Файлы версии в порядке.' : [...r.issues, ...r.repaired].join('\n'));
    } catch (e) { setIntegrity((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="page p-24 diagnostics-page">
      <div className="page-head">
        <div>
          <h1>Диагностика и инструменты</h1>
          <p className="muted">Bedrock/TrelEmu, проверка файлов, логи, отчёты и профили запуска в одном месте.</p>
        </div>
        <button className="btn primary" onClick={runDiagnostics} disabled={busy}><IconRefresh /> Проверить</button>
      </div>

      <div className="diag-grid">
        <div className="card diag-card span-2">
          <div className="card-head"><h2>Bedrock / TrelEmu диагностика</h2><span className="chip mono">{checks.length} checks</span></div>
          <div className="diag-checks">
            {checks.map((c) => (
              <div className={`diag-check ${c.level}`} key={c.id}>
                <div className="diag-check-icon">{c.ok ? <IconCheck /> : <IconAlert />}</div>
                <div>
                  <strong>{c.label}</strong>
                  <p>{c.details}</p>
                  {c.action && !c.ok && <small>{c.action}</small>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card diag-card">
          <div className="card-head"><h2>Проверка файлов</h2></div>
          <label className="field-label">Версия</label>
          <select className="select" value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)}>
            {versions.map((v) => <option key={v.id} value={v.id}>{v.id} ({v.edition}{v.loader ? `/${v.loader}` : ''})</option>)}
          </select>
          <div className="hint">Проверяет jar/json/libraries/assets для Java и APK/TrelEmu для Bedrock. Если возможно, запускает докачку.</div>
          <button className="btn primary" onClick={checkIntegrity} disabled={!selectedVersion || busy}><IconSpark /> Проверить файлы</button>
          {integrity && <pre className="diag-log-preview">{integrity}</pre>}
        </div>

        <div className="card diag-card">
          <div className="card-head"><h2>Профили запуска</h2></div>
          <div className="row gap-8">
            <input className="input" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Название профиля" />
            <button className="btn" onClick={createProfile} disabled={!selectedVersion}>Сохранить</button>
          </div>
          <div className="diag-profile-list">
            {profiles.length === 0 && <div className="empty small">Профилей пока нет.</div>}
            {profiles.map((p) => (
              <div className="diag-profile" key={p.id}>
                <div><strong>{p.name}</strong><small>{p.versionId}, {p.memoryMb} МБ</small></div>
                <div className="row gap-6"><button className="btn sm ghost" onClick={() => applyProfile(p)}>Применить</button><button className="btn sm ghost" onClick={() => saveProfiles(profiles.filter((x) => x.id !== p.id))}>Удалить</button></div>
              </div>
            ))}
          </div>
        </div>

        <div className="card diag-card span-2">
          <div className="card-head">
            <h2>Логи и отчёт</h2>
            <div className="row gap-8">
              <button className="btn sm ghost" onClick={refreshLogs}><IconRefresh /> Обновить</button>
              <button className="btn sm ghost" onClick={() => window.api.tools.copyReport()}><IconCopy /> Скопировать отчёт</button>
            </div>
          </div>
          <div className="diag-logs">
            <div className="diag-log-list">
              {logs.map((l) => <button key={l.path} onClick={async () => setLogText(await window.api.tools.logRead(l.path))}><IconFolder /> <span>{l.name}</span><small>{fmtSize(l.size)}</small></button>)}
              {logs.length === 0 && <div className="empty small">Логи не найдены.</div>}
            </div>
            <pre className="diag-log-text">{logText || 'Выбери лог слева, чтобы посмотреть последние строки.'}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
