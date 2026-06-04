import React, { useEffect, useRef, useState } from 'react';
import type {
  ServerInstance, ServerStatus, ServerProperties, ServerCreateProgress,
} from '../../preload/preload';
import type { VersionInfo } from '../../shared/types';
import {
  IconPlay, IconStop, IconTrash, IconFolder,
  IconTerminal, IconPlus, IconServer, IconAlert, IconCopy, IconRefresh,
} from '../components/icons';
import { useDialog } from '../components/Dialog';
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

  // Подгружаем буфер логов для активного сервера, если ещё не было
  useEffect(() => {
    if (!activeId) return;
    if (logs[activeId] !== undefined) return;
    let cancelled = false;
    window.api.servers.logBuffer(activeId).then((buf) => {
      if (!cancelled) setLogs((prev) => ({ ...prev, [activeId]: buf }));
    });
    return () => { cancelled = true; };
  }, [activeId]);

  // Автоскролл консоли
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [activeId, logs[activeId ?? '']?.length]);

  const active = list.find((s) => s.id === activeId) ?? null;
  const activeStatus: ServerStatus = active ? statuses[active.id] ?? 'stopped' : 'stopped';

  const onStart = async (id: string) => {
    setStatus(t('servers.startingStatus'));
    try {
      await window.api.servers.start(id);
      setStatus('');
    } catch (e) {
      setStatus(t('servers.startError', { message: (e as Error).message }));
    }
  };
  const onStop = async (id: string) => {
    setStatus(t('servers.stoppingStatus'));
    try {
      await window.api.servers.stop(id);
      setStatus('');
    } catch (e) {
      setStatus(t('servers.stopError', { message: (e as Error).message }));
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
      <div className="page-head">
        <h1>{t('servers.title')}</h1>
        <p>{t('servers.subtitle')}</p>
      </div>

      {status && <div className="hint" style={{ marginBottom: 12 }}>{status}</div>}

      <div className="server-shell">
        <aside className="server-list">
          <div className="server-list-head">
            <span className="muted" style={{ fontSize: 13 }}>{list.length} {t.plural(list.length, t('plural.server.one'), t('plural.server.few'), t('plural.server.many'))}</span>
            <button className="btn primary sm" onClick={() => setShowCreate(true)}>
              <IconPlus /> {t('servers.create')}
            </button>
          </div>

          {showCreate && (
            <CreateServerForm
              onCancel={() => setShowCreate(false)}
              onCreated={async () => {
                setShowCreate(false);
                await refreshList();
              }}
            />
          )}

          {list.length === 0 && !showCreate ? (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <div className="server-empty-icon"><IconServer /></div>
              <h2 style={{ fontSize: 15, marginBottom: 6 }}>{t('servers.empty')}</h2>
              <p className="muted" style={{ fontSize: 12.5 }}>
                {t('servers.emptyHint')}
              </p>
            </div>
          ) : (
            <div className="server-list-items">
              {list.map((s) => {
                const st = statuses[s.id] ?? 'stopped';
                return (
                  <div
                    key={s.id}
                    className={'server-item' + (activeId === s.id ? ' active' : '')}
                    onClick={() => setActiveId(s.id)}
                  >
                    <div className={'server-item-dot ' + statusTone[st]} />
                    <div className="server-item-info">
                      <div className="server-item-name">{s.name}</div>
                      <div className="server-item-sub">
                        <span>{s.versionId}</span>
                        <span>·</span>
                        <span>:{s.properties.serverPort}</span>
                      </div>
                    </div>
                    <span className={'chip ' + statusTone[st]}>{statusLabel[st]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <main className="server-detail">
          {!active ? (
            <div className="catalog-empty">
              <div className="catalog-empty-icon"><IconServer /></div>
              <h2>{t('servers.selectServer')}</h2>
              <p>{t('servers.selectHint')}</p>
            </div>
          ) : (
            <ActiveServer
              server={active}
              status={activeStatus}
              logs={logs[active.id] ?? []}
              logRef={logRef}
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
    </div>
  );
};

// ─── Active server pane ─────────────────────────────────────────────────────

const ActiveServer: React.FC<{
  server: ServerInstance;
  status: ServerStatus;
  logs: string[];
  logRef: React.RefObject<HTMLDivElement>;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<ServerProperties>) => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onSetMemory: (mb: number) => Promise<void>;
}> = ({ server, status, logs, logRef, onStart, onStop, onDelete, onUpdate, onRename, onSetMemory }) => {
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

  // Адреса для подключения (localhost + IP в LAN). Пересчитываем при смене
  // сервера и при смене порта в настройках.
  useEffect(() => {
    let cancelled = false;
    window.api.servers.connectAddresses(server.id).then((arr) => {
      if (!cancelled) setAddresses(arr);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [server.id, server.properties.serverPort]);

  const isRunning = status === 'running' || status === 'starting';
  const isReady = status === 'running'; // именно «Done» — можно подключаться

  const onSendCommand = async () => {
    if (!cmd.trim() || !isReady) return;
    try {
      await window.api.servers.sendCommand(server.id, cmd);
      setCmd('');
    } catch {
      // Если сервер не запущен — просто игнорируем (UI кнопка сама блокирует, но на всякий)
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
      {/* Hero */}
      <div className="server-hero">
        <div className="server-hero-info">
          <div className="server-hero-eyebrow">
            <span className={'chip ' + statusTone[status]}>{statusLabel[status]}</span>
            <span className="chip">{server.versionId}</span>
          </div>
          {editName ? (
            <input
              className="input server-name-input"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onBlur={async () => {
                setEditName(false);
                if (name.trim() && name !== server.name) await onRename(name);
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') { setName(server.name); setEditName(false); }
              }}
            />
          ) : (
            <h2
              className="server-hero-title"
              onClick={() => setEditName(true)}
              title={t('servers.renameTitle')}
            >
              {server.name}
            </h2>
          )}
          <div className="server-hero-meta">
            <span>{t('servers.port')} {server.properties.serverPort}</span>
            <span>·</span>
            <span>{server.memoryMb} {t('servers.memory')}</span>
            <span>·</span>
            <span>{t('servers.created')} {new Date(server.createdAt).toLocaleDateString(t.locale === 'en' ? 'en-US' : 'ru-RU')}</span>
          </div>
        </div>

        <div className="server-hero-actions">
          {status === 'running' ? (
            <button className="btn danger" onClick={onStop}>
              <IconStop /> {t('servers.stop')}
            </button>
          ) : status === 'starting' ? (
            <button className="btn warn" onClick={onStop}>
              <IconRefresh /> {t('servers.starting')}
            </button>
          ) : (
            <button className="btn primary" onClick={onStart}>
              <IconPlay /> {t('servers.start')}
            </button>
          )}
          <button className="icon-btn" onClick={() => window.api.servers.openFolder(server.id)} title={t('servers.openFolder')}>
            <IconFolder />
          </button>
          <button className="icon-btn" onClick={onDelete} disabled={isRunning} title={t('servers.deleteBtn')}>
            <IconTrash />
          </button>
        </div>
      </div>

      {/* Подключение */}
      <div className="card server-connect-card">
        <div className="card-head">
          <h2>{t('servers.connectTitle')}</h2>
          {isReady ? (
            <span className="chip success">{t('servers.serverReady')}</span>
          ) : status === 'starting' ? (
            <span className="chip accent">{t('servers.serverStarting')}</span>
          ) : (
            <span className="chip">{t('servers.serverStopped')}</span>
          )}
        </div>
        <ol className="server-connect-steps">
          <li>{t('servers.connectStep1')}</li>
          <li>{t('servers.connectStep2', { address: primaryAddr })}</li>
          <li>{t('servers.connectStep3')}</li>
        </ol>
        <div className="server-connect-list">
          {addresses.map((a) => {
            // Для default-порта 25565 адрес можно писать без `:25565` — это
            // понятнее. Но в кнопку копирования всё равно кладём явный.
            const display = a.port === 25565 ? a.host : `${a.host}:${a.port}`;
            const fullAddr = `${a.host}:${a.port}`;
            return (
              <div key={fullAddr} className="server-connect-row">
                <div className="server-connect-info">
                  <div className="server-connect-label">{a.label}</div>
                  <code className="server-connect-addr">{display}</code>
                </div>
                <button
                  className="btn ghost sm"
                  onClick={() => copyToClipboard(display)}
                  title={t('servers.copy')}
                >
                  <IconCopy /> {copied === display ? t('servers.copied') : t('servers.copy')}
                </button>
              </div>
            );
          })}
          {addresses.length === 1 && (
            <div className="hint" style={{ fontSize: 12 }}>
              {t('servers.noInterfaces')}
            </div>
          )}
        </div>
        <div className="hint" style={{ fontSize: 12, marginTop: 10 }}>
          {t('servers.lanHint')}
        </div>
      </div>

      {/* Console */}
      <div className="card server-console-card">
        <div className="card-head">
          <h2><IconTerminal style={{ verticalAlign: 'middle', marginRight: 6 }} /> {t('servers.console')}</h2>
          <span className="chip">{logs.length} {t.plural(logs.length, t('plural.line.one'), t('plural.line.few'), t('plural.line.many'))}</span>
        </div>
        <div className="server-log" ref={logRef}>
          {logs.length === 0 ? (
            <div className="muted" style={{ padding: '20px 8px', fontSize: 12.5 }}>
              {status === 'starting' ? t('servers.consoleStarting') : isRunning ? t('servers.consoleWaiting') : t('servers.consoleStopped')}
            </div>
          ) : (
            logs.map((line, i) => <span key={i}>{line}</span>)
          )}
          {status === 'starting' && logs.length > 0 && (
            <div className="muted" style={{ padding: '4px 8px', fontSize: 12.5 }}>{t('servers.consoleStarting')}</div>
          )}
        </div>
        <div className="server-cmd-row">
          <span className="server-cmd-prompt">/</span>
          <input
            className="input"
            placeholder={isReady ? t('servers.commandPlaceholder') : status === 'starting' ? t('servers.consoleStarting') : t('servers.commandDisabled')}
            value={cmd}
            disabled={!isReady}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSendCommand(); }}
          />
          <button className="btn" onClick={onSendCommand} disabled={!isReady || !cmd.trim()}>
            {t('servers.send')}
          </button>
        </div>
      </div>

      {/* Command reference */}
      <div className="card">
        <div className="card-head">
          <h2>{t('servers.cmdRefTitle')}</h2>
        </div>
        <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          {[
            ['stop', t('servers.cmdStop')],
            ['kick <player> [reason]', t('servers.cmdKick')],
            ['ban <player> [reason]', t('servers.cmdBan')],
            ['pardon <player>', t('servers.cmdPardon')],
            ['ban-ip <ip> [reason]', t('servers.cmdBanIp')],
            ['pardon-ip <ip>', t('servers.cmdPardonIp')],
            ['op <player>', t('servers.cmdOp')],
            ['deop <player>', t('servers.cmdDeop')],
            ['whitelist on|off', t('servers.cmdWhitelist')],
            ['whitelist add|remove <player>', t('servers.cmdWhitelistManage')],
            ['gamemode <mode> <player>', t('servers.cmdGamemode')],
            ['give <player> <item> [amount]', t('servers.cmdGive')],
            ['tp <player> <target>', t('servers.cmdTp')],
            ['time set <value>', t('servers.cmdTime')],
            ['weather clear|rain|thunder', t('servers.cmdWeather')],
            ['difficulty peaceful|easy|normal|hard', t('servers.cmdDifficulty')],
            ['gamerule <rule> <value>', t('servers.cmdGamerule')],
            ['effect give <player> <effect> [seconds]', t('servers.cmdEffect')],
            ['fill <x1> <y1> <z1> <x2> <y2> <z2> <block>', t('servers.cmdFill')],
            ['clone <x1> <y1> <z1> <x2> <y2> <z2> <dest>', t('servers.cmdClone')],
            ['say <message>', t('servers.cmdSay')],
            ['tell <player> <message>', t('servers.cmdTell')],
            ['title <player> <action> <text>', t('servers.cmdTitle')],
            ['particle <type> <x> <y> <z>', t('servers.cmdParticle')],
            ['playsound <sound> <player>', t('servers.cmdPlaysound')],
            ['execute as <entity> run <command>', t('servers.cmdExecute')],
            ['schedule function <fn> <ticks>', t('servers.cmdSchedule')],
            ['reload', t('servers.cmdReload')],
            ['save-all', t('servers.cmdSaveAll')],
            ['save-off|save-on', t('servers.cmdSaveToggle')],
            ['seed', t('servers.cmdSeed')],
            ['list', t('servers.cmdList')],
            ['tps', t('servers.cmdTps')],
          ].map(([cmd, desc]) => (
            <div key={cmd} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <code style={{ color: 'var(--accent)', minWidth: 280, fontSize: 12, fontFamily: 'monospace' }}>{cmd}</code>
              <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="card">
        <div className="card-head">
          <h2>{t('servers.settings')}</h2>
          {isRunning && (
            <span className="hint" style={{ fontSize: 11.5 }}>
              {t('servers.settingsHint')}
            </span>
          )}
        </div>
        <div className="server-settings-grid">
          <Field label={t('servers.motd')}>
            <input
              className="input"
              value={server.properties.motd}
              onChange={(e) => onUpdate({ motd: e.target.value })}
            />
          </Field>
          <Field label={t('servers.portLabel')}>
            <input
              className="input"
              type="number"
              value={server.properties.serverPort}
              onChange={(e) => onUpdate({ serverPort: Math.max(1, Math.min(65535, parseInt(e.target.value, 10) || 25565)) })}
            />
          </Field>
          <Field label={t('servers.maxPlayers')}>
            <input
              className="input"
              type="number"
              value={server.properties.maxPlayers}
              onChange={(e) => onUpdate({ maxPlayers: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            />
          </Field>
          <Field label={t('servers.memoryLabel')}>
            <input
              className="input"
              type="number"
              value={server.memoryMb}
              onChange={(e) => onSetMemory(Math.max(512, parseInt(e.target.value, 10) || 1024))}
            />
          </Field>
          <Field label={t('servers.gamemode')}>
            <select
              className="input"
              value={server.properties.gamemode}
              onChange={(e) => onUpdate({ gamemode: e.target.value as ServerProperties['gamemode'] })}
            >
              <option value="survival">{t('servers.gmSurvival')}</option>
              <option value="creative">{t('servers.gmCreative')}</option>
              <option value="adventure">{t('servers.gmAdventure')}</option>
              <option value="spectator">{t('servers.gmSpectator')}</option>
            </select>
          </Field>
          <Field label={t('servers.difficulty')}>
            <select
              className="input"
              value={server.properties.difficulty}
              onChange={(e) => onUpdate({ difficulty: e.target.value as ServerProperties['difficulty'] })}
            >
              <option value="peaceful">{t('servers.diffPeaceful')}</option>
              <option value="easy">{t('servers.diffEasy')}</option>
              <option value="normal">{t('servers.diffNormal')}</option>
              <option value="hard">{t('servers.diffHard')}</option>
            </select>
          </Field>
          <Field label={t('servers.spawnProtection')}>
            <input
              className="input"
              type="number"
              value={server.properties.spawnProtection}
              onChange={(e) => onUpdate({ spawnProtection: Math.max(0, parseInt(e.target.value, 10) || 0) })}
            />
          </Field>
          <div className="server-toggles">
            <Toggle label={t('servers.pvp')} value={server.properties.pvp} onChange={(v) => onUpdate({ pvp: v })} />
            <Toggle label={t('servers.whiteList')} value={server.properties.whiteList} onChange={(v) => onUpdate({ whiteList: v })} />
            <Toggle label={t('servers.onlineMode')} value={server.properties.onlineMode} onChange={(v) => onUpdate({ onlineMode: v })} />
          </div>
        </div>
        <div className="hint" style={{ marginTop: 14, fontSize: 12 }}>
          {t('servers.portChangeHint')}
        </div>
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

const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
  <label className="server-toggle">
    <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

// ─── Create form (inline в боковой колонке) ─────────────────────────────────

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
      // Берём только релизы — для них Mojang всегда отдаёт server.jar
      const releases = list.filter((v) => v.type === 'release');
      setVersions(releases);
      if (releases[0]) setVersionId(releases[0].id);
    });
    const off = window.api.servers.onCreateProgress(setProgress);
    return () => { cancelled = true; off(); };
  }, []);

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
    <div className="card server-create-card">
      <div className="card-head">
        <h2>{t('servers.newServer')}</h2>
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
          <select
            className="input"
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
            disabled={busy}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>{v.id}</option>
            ))}
          </select>
        </Field>
        <Field label={t('servers.memoryField')}>
          <input
            className="input"
            type="number"
            value={memoryMb}
            onChange={(e) => setMemoryMb(Math.max(512, parseInt(e.target.value, 10) || 1024))}
            disabled={busy}
          />
        </Field>
        <div className="hint" style={{ fontSize: 12 }}>
          {t('servers.jarHint')}{' '}{t('servers.eulaHint')}
        </div>
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
        <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onCancel} disabled={busy}>{t('servers.cancelCreate')}</button>
          <button className="btn primary" onClick={onCreate} disabled={busy || !versionId}>
            {busy ? t('servers.creating') : t('servers.createBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};
