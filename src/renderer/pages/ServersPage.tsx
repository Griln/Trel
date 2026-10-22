import React, { useEffect, useRef, useState } from 'react';
import type {
  ServerInstance, ServerStatus, ServerProperties, ServerCreateProgress,
} from '../../preload/preload';
import type { VersionInfo } from '../../shared/types';
import {
  IconPlay, IconStop, IconTrash, IconFolder,
  IconPlus, IconServer, IconAlert, IconCopy, IconRefresh, IconClose,
} from '../components/icons';
import { useDialog } from '../components/Dialog';
import { VersionPicker } from '../components/VersionPicker';
import { useT } from '../i18n';

const statusTone: Record<ServerStatus, string> = {
  stopped: 'neutral',
  starting: 'accent',
  running: 'success',
  stopping: 'warn',
  error: 'danger',
};

export const ServersPage: React.FC = () => {
  const dialog = useDialog();
  const t = useT();
  const [list, setList] = useState<ServerInstance[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ServerStatus>>({});
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [status, setStatus] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  // Saved remote servers (servers.dat) + their live status.
  const [saved, setSaved] = useState<Array<{ name: string; ip: string }>>([]);
  const [savedPing, setSavedPing] = useState<Record<string, { online: boolean; players?: string; motd?: string; latencyMs?: number }>>({});
  const [pinging, setPinging] = useState(false);
  const pingRun = useRef(0);

  const refreshSaved = async () => {
    const run = ++pingRun.current;
    setPinging(true);
    try {
      const list = await window.api.servers.saved();
      if (pingRun.current !== run) return;
      setSaved(list);
      // We ping in batches of 4, otherwise hundreds of servers would take the network down.
      const out: Record<string, { online: boolean; players?: string; motd?: string; latencyMs?: number }> = {};
      for (let i = 0; i < list.length; i += 4) {
        if (pingRun.current !== run) return;
        const batch = await Promise.all(list.slice(i, i + 4).map(async (sv) => {
          try {
            const r = await window.api.servers.ping(sv.ip);
            return [sv.ip, { online: r.online, latencyMs: r.latencyMs,
              players: r.players ? `${r.players.online}/${r.players.max}` : undefined,
              motd: r.motd?.slice(0, 80) }] as const;
          } catch { return [sv.ip, { online: false }] as const; }
        }));
        for (const [ip, st] of batch) out[ip] = st;
        if (pingRun.current !== run) return;
        setSavedPing({ ...out });
      }
    } catch { /* servers.dat may be missing — the section is simply empty */ }
    finally { if (pingRun.current === run) setPinging(false); }
  };

  useEffect(() => {
    refreshSaved();
    return () => { pingRun.current++; };
  }, []);

  const statusLabel: Record<ServerStatus, string> = {
    stopped: t('servers.statusStopped'),
    starting: t('servers.statusStarting'),
    running: t('servers.statusRunning'),
    stopping: t('servers.statusStopping'),
    error: t('servers.statusError'),
  };

  const refreshList = async () => {
    const [l, st] = await Promise.all([
      window.api.servers.list(),
      window.api.servers.statuses(),
    ]);
    setList(l);
    setStatuses(st);
    if (!activeId && l.length > 0) setActiveId(l[0].id);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [l, st] = await Promise.all([
        window.api.servers.list(),
        window.api.servers.statuses(),
      ]);
      if (cancelled) return;
      setList(l);
      setStatuses(st);
      if (!activeId && l.length > 0) setActiveId(l[0].id);
    })();
    const offLog = window.api.servers.onLog((id, line) => {
      setLogs((prev) => {
        const arr = (prev[id] ?? []).slice();
        arr.push(line);
        if (arr.length > 1000) arr.shift();
        return { ...prev, [id]: arr };
      });
    });
    const offStatus = window.api.servers.onStatus((id, s) => {
      setStatuses((prev) => ({ ...prev, [id]: s }));
    });
    return () => { cancelled = true; offLog(); offStatus(); };
  }, []);

  // We load the log buffer of the active server, if it was not loaded yet
  useEffect(() => {
    if (!activeId) return;
    if (logs[activeId] !== undefined) return;
    let cancelled = false;
    window.api.servers.logBuffer(activeId).then((buf) => {
      if (!cancelled) setLogs((prev) => ({ ...prev, [activeId]: buf }));
    });
    return () => { cancelled = true; };
  }, [activeId]);

  // Console auto-scroll
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [activeId, logs[activeId ?? '']?.length]);

  const active = list.find((s) => s.id === activeId) ?? null;
  const activeStatus: ServerStatus = active ? statuses[active.id] ?? 'stopped' : 'stopped';

  // Busy state per server: a double start spawned processes, a double stop hammered the state.
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const onStart = async (id: string) => {
    if (busyIds[id]) return;
    setBusyIds((b) => ({ ...b, [id]: true }));
    setStatus(t('servers.startingStatus'));
    try {
      await window.api.servers.start(id);
      setStatus('');
    } catch (e) {
      setStatus(t('servers.startError', { message: (e as Error).message }));
    } finally {
      setBusyIds((b) => ({ ...b, [id]: false }));
    }
  };
  const onStop = async (id: string) => {
    if (busyIds[id]) return;
    setBusyIds((b) => ({ ...b, [id]: true }));
    setStatus(t('servers.stoppingStatus'));
    try {
      await window.api.servers.stop(id);
      setStatus('');
    } catch (e) {
      setStatus(t('servers.stopError', { message: (e as Error).message }));
    } finally {
      setBusyIds((b) => ({ ...b, [id]: false }));
    }
  };
  const onDelete = async (s: ServerInstance) => {
    const choice = await dialog.show({
      title: t('servers.deleteTitle', { name: s.name }),
      tone: 'danger',
      message: t('servers.deleteMessage'),
      buttons: [
        { label: t('servers.deleteCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('servers.deleteConfirm'), value: 'ok', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (choice !== 'ok') return;
    try {
      await window.api.servers.delete(s.id);
      if (activeId === s.id) setActiveId(null);
      await refreshList();
    } catch (e) {
      setStatus(t('servers.deleteError', { message: (e as Error).message }));
    }
  };

  return (
    <div>
      <div className="page-head v2">
        <span className="eyebrow">{t('servers.eyebrow')}</span>
        <h1 className="page-title">{t('servers.title')} <span className="count">{list.length}</span></h1>
        <p className="page-sub">{t('servers.subtitle')}</p>
      </div>

      {status && <div className="hint" style={{ marginBottom: 12 }}>{status}</div>}

      <div className="srv-layout">
        <aside className="srv-list">
          {list.map((s) => {
            const st = statuses[s.id] ?? 'stopped';
            return (
              <div
                key={s.id}
                className={'srv' + (activeId === s.id ? ' sel' : '')}
                onClick={() => setActiveId(s.id)}
              >
                <div className="srv-ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <rect x="2" y="3" width="20" height="7" rx="2" />
                    <rect x="2" y="14" width="20" height="7" rx="2" />
                    <path d="M6 6.5h.01M6 17.5h.01" />
                  </svg>
                </div>
                <div className="srv-body">
                  <b>{s.name}</b>
                  <span>{s.versionId} · :{s.properties.serverPort}</span>
                </div>
                {st === 'running' && <span className="sdot ok" title={statusLabel[st]} />}
                {st === 'stopped' && <span className="sdot off" title={statusLabel[st]} />}
              </div>
            );
          })}
          <button className="srv srv-add" onClick={() => setShowCreate(true)}>+ {t('servers.create')}</button>
          {saved.length > 0 && (
            <div className="srv-saved">
              <div className="srv-saved-head">
                <span>{t('servers.savedTitle')}</span>
                <button className="btn ghost sm" onClick={refreshSaved} disabled={pinging} title={t('servers.refreshSaved')}>
                  {pinging ? '…' : <IconRefresh />}
                </button>
              </div>
              {saved.map((sv) => {
                const st = savedPing[sv.ip];
                return (
                  <div key={sv.ip} className="srv srv-saved-row" title={sv.ip}>
                    <span className={'sdot ' + (st ? (st.online ? 'ok' : 'off') : '')} />
                    <div className="srv-body">
                      <b>{sv.name}</b>
                      <span>
                        {st ? (st.online
                          ? `${st.players ?? ''}${st.latencyMs != null ? ` · ${st.latencyMs}ms` : ''}${st.motd ? ` · ${st.motd}` : ''}`
                          : t('servers.savedOffline')) : t('servers.savedChecking')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <main>
          {showCreate ? (
            <CreateServerForm
              onCancel={() => setShowCreate(false)}
              onCreated={async () => {
                setShowCreate(false);
                await refreshList();
              }}
            />
          ) : !active ? (
            list.length === 0 ? (
              <div className="empty p-24">
                <div className=""><IconServer /></div>
                <h2>{t('servers.empty')}</h2>
                <p>{t('servers.emptyHint')}</p>
                <div style={{ marginTop: 18 }}>
                  <button className="btn primary" onClick={() => setShowCreate(true)}>+ {t('servers.newServer')}</button>
                </div>
              </div>
            ) : (
              <div className="empty p-24">
                <div className=""><IconServer /></div>
                <h2>{t('servers.selectServer')}</h2>
                <p>{t('servers.selectHint')}</p>
              </div>
            )
          ) : (
            <ActiveServer
              server={active}
              status={activeStatus}
              logs={logs[active.id] ?? []}
              logRef={logRef}
              busy={!!busyIds[active.id]}
              onStart={() => onStart(active.id)}
              onStop={() => onStop(active.id)}
              onDelete={() => onDelete(active)}
              onUpdate={async (patch) => {
                const next = await window.api.servers.setProperties(active.id, patch);
                setList((prev) => prev.map((x) => (x.id === next.id ? next : x)));
              }}
              onRename={async (name) => {
                const next = await window.api.servers.rename(active.id, name);
                setList((prev) => prev.map((x) => (x.id === next.id ? next : x)));
              }}
              onSetMemory={async (mb) => {
                const next = await window.api.servers.setMemory(active.id, mb);
                setList((prev) => prev.map((x) => (x.id === next.id ? next : x)));
              }}
            />
          )}
        </main>
      </div>
      <p className="note">{t('servers.localNote')}</p>
    </div>
  );
};

// ─── Active server pane ─────────────────────────────────────────────────────

const ActiveServer: React.FC<{
  server: ServerInstance;
  status: ServerStatus;
  busy?: boolean;
  logs: string[];
  logRef: React.RefObject<HTMLDivElement>;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<ServerProperties>) => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onSetMemory: (mb: number) => Promise<void>;
}> = ({ server, status, busy, logs, logRef, onStart, onStop, onDelete, onRename }) => {
  const t = useT();
  const [cmd, setCmd] = useState('');
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(server.name);
  const [addresses, setAddresses] = useState<{ label: string; host: string; port: number }[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const statusLabel: Record<ServerStatus, string> = {
    stopped: t('servers.statusStopped'),
    starting: t('servers.statusStarting'),
    running: t('servers.statusRunning'),
    stopping: t('servers.statusStopping'),
    error: t('servers.statusError'),
  };

  useEffect(() => { setName(server.name); }, [server.name]);

  // The addresses to connect to (localhost + IP in the LAN). We recalculate them when the
  // server changes and when the port in the settings changes.
  useEffect(() => {
    let cancelled = false;
    window.api.servers.connectAddresses(server.id).then((arr) => {
      if (!cancelled) setAddresses(arr);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [server.id, server.properties.serverPort]);

  const isRunning = status === 'running' || status === 'starting';
  const isReady = status === 'running'; // exactly "Done" — you can connect

  const onSendCommand = async () => {
    if (!cmd.trim() || !isReady) return;
    try {
      await window.api.servers.sendCommand(server.id, cmd);
      setCmd('');
    } catch {
      // If the server is not running — we simply ignore it (the UI button blocks it by itself, but just in case)
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const primaryAddr = addresses.length > 0
    ? (addresses[0].port === 25565 ? addresses[0].host : `${addresses[0].host}:${addresses[0].port}`)
    : `localhost:${server.properties.serverPort}`;

  return (
    <>
      <div className="console-wrap">
        <div className="console-head">
          {editName ? (
            <input
              className="input"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onBlur={async () => { setEditName(false); if (name.trim() && name !== server.name) await onRename(name); }}
              onKeyDown={async (e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setName(server.name); setEditName(false); } }}
            />
          ) : (
            <span className="nm" onClick={() => setEditName(true)} title={t('servers.renameTitle')} style={{ cursor: 'pointer' }}>{server.name}</span>
          )}
          <span className={'chip ' + statusTone[status]}>
            <span className={'sdot ' + (isRunning ? 'ok' : 'off')} />
            {statusLabel[status]}
          </span>
          <div className="right">
            {!isRunning && (
              <button className="btn primary sm" onClick={onStart} disabled={busy}>
                <IconPlay /> {t('servers.start')}
              </button>
            )}
            <button className="btn ghost sm" onClick={() => window.api.servers.openFolder(server.id)} title={t('servers.openFolder')}>
              <IconFolder /> {t('servers.folder')}
            </button>
            <button className="btn ghost sm" onClick={() => copyToClipboard(primaryAddr)} title={t('servers.copy')}>
              <IconCopy /> {copied === primaryAddr ? t('servers.copied') : t('servers.copyIp')}
            </button>
            {isRunning ? (
              <button className="btn danger sm" onClick={onStop} disabled={busy}>
                <IconStop /> {t('servers.stop')}
              </button>
            ) : (
              <button className="btn danger sm" onClick={onDelete} disabled={busy} title={t('servers.deleteTitle', { name: server.name })}>
                <IconTrash /> {t('servers.delete')}
              </button>
            )}
          </div>
        </div>
        <div className="console" ref={logRef}>
          {logs.length === 0 ? (
            <div className="muted" style={{ padding: '20px 8px', fontSize: 12.5 }}>
              {status === 'starting' ? t('servers.consoleStarting') : isRunning ? t('servers.consoleWaiting') : t('servers.consoleStopped')}
            </div>
          ) : (
            // Thousands of lines in the DOM hung the tab: we render a tail of 300 lines.
            logs.slice(-300).map((line, i) => {
              const cls = /ERROR|FATAL|Exception|SEVERE/i.test(line) ? 'err' : /WARN/i.test(line) ? 'warn' : /INFO/i.test(line) ? 'info' : '';
              return <span key={i} className={'log-ln ' + cls}>{line}</span>;
            })
          )}
        </div>
        <div className="console-cmd">
          <input className="input" placeholder={isReady ? t('servers.commandPlaceholder') : status === 'starting' ? t('servers.consoleStarting') : t('servers.commandDisabled')} value={cmd} disabled={!isReady} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSendCommand(); }} />
          <button className="btn primary sm" onClick={onSendCommand} disabled={!isReady || !cmd.trim()}>{t('servers.send')}</button>
        </div>
      </div>

      <div className="props">
        <div className="prop"><span>{t('servers.motd')}</span><b>{server.properties.motd}</b></div>
        <div className="prop"><span>{t('servers.port')}</span><b>{server.properties.serverPort}</b></div>
        <div className="prop"><span>{t('servers.maxPlayers')}</span><b>{server.properties.maxPlayers}</b></div>
        <div className="prop"><span>{t('servers.gamemode')}</span><b>{server.properties.gamemode}</b></div>
        <div className="prop"><span>{t('servers.difficulty')}</span><b>{server.properties.difficulty}</b></div>
        <div className="prop"><span>PvP</span><b>{server.properties.pvp ? t('servers.on') : t('servers.off')}</b></div>
        <div className="prop"><span>online-mode</span><b>{server.properties.onlineMode ? t('servers.on') : t('servers.off')}</b></div>
        <div className="prop"><span>{t('servers.memory')}</span><b>{server.memoryMb} МБ</b></div>
      </div>
    </>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="server-field">
    <span className="server-field-label">{label}</span>
    {children}
  </label>
);

// ─── Create form (a nice modal on top of the page) ──────────────────────────────

const CreateServerForm: React.FC<{
  onCancel: () => void;
  onCreated: () => void;
}> = ({ onCancel, onCreated }) => {
  const t = useT();
  const [name, setName] = useState('');
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [versionId, setVersionId] = useState('');
  const [memoryMb, setMemoryMb] = useState(2048);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<ServerCreateProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.api.minecraft.versions().then((list) => {
      if (cancelled) return;
      // We take only the releases — for those Mojang always serves server.jar
      const releases = list.filter((v) => v.type === 'release');
      setVersions(releases);
      if (releases[0]) setVersionId(releases[0].id);
    });
    const off = window.api.servers.onCreateProgress(setProgress);
    return () => { cancelled = true; off(); };
  }, []);

  // Esc closes the modal (as long as the creation is not running)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const onCreate = async () => {
    if (!versionId) { setError(t('servers.selectVersion')); return; }
    setBusy(true);
    setError('');
    try {
      await window.api.servers.create({
        name: name.trim() || `Server-${versionId}`,
        versionId,
        memoryMb,
      });
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="srv-create-backdrop" onClick={busy ? undefined : onCancel}>
      <div className="srv-create" onClick={(e) => e.stopPropagation()}>
        <div className="srv-create-head">
          <div>
            <h2><IconServer /> {t('servers.newServer')}</h2>
            <p>{t('servers.jarHint')} {t('servers.eulaHint')}</p>
          </div>
          <button className="onboarding-close" onClick={onCancel} disabled={busy} aria-label={t('servers.cancelCreate')}><IconClose /></button>
        </div>
        <div className="server-create-body">
          <Field label={t('servers.nameLabel')}>
            <input
              className="input"
              autoFocus
              placeholder={t('servers.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </Field>
          <Field label={t('servers.versionLabel')}>
            <VersionPicker
              value={versionId}
              onChange={setVersionId}
              disabled={busy}
              placeholder={t('servers.selectVersion')}
              options={versions.map((v) => ({ id: v.id, title: v.id, sub: 'release' }))}
              maxHeight={260}
            />
          </Field>
          <Field label={t('servers.memoryField')}>
            <div className="mem-row">
              <input
                className="input"
                type="number"
                value={memoryMb}
                onChange={(e) => setMemoryMb(Math.max(512, parseInt(e.target.value, 10) || 1024))}
                disabled={busy}
              />
              <div className="mem-chips">
                {[1024, 2048, 4096, 8192].map((mb) => (
                  <button
                    key={mb}
                    type="button"
                    className={'mchip' + (memoryMb === mb ? ' on' : '')}
                    onClick={() => setMemoryMb(mb)}
                    disabled={busy}
                  >
                    {mb / 1024}G
                  </button>
                ))}
              </div>
            </div>
          </Field>
          {progress && (
            <div className="hero-progress">
              <div className="ab-progress-info">
                <span className="ab-progress-stage">{progress.stage}</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="ab-progress-bar">
                <div className="fill" style={{ width: progress.percent + '%' }} />
              </div>
            </div>
          )}
          {error && (
            <div className="hint" style={{ color: 'var(--danger)' }}>
              <IconAlert /> {error}
            </div>
          )}
          <div className="srv-create-actions">
            <button className="btn ghost" onClick={onCancel} disabled={busy}>{t('servers.cancelCreate')}</button>
            <button className="btn primary" onClick={onCreate} disabled={busy || !versionId}>
              {busy ? t('servers.creating') : <><IconPlus /> {t('servers.createBtn')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
