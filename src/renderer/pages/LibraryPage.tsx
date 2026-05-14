import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DownloadProgress, LauncherSettings, MinecraftAccount, VersionInfo } from '../../shared/types';
import type { JavaPlan } from '../../preload/preload';
import {
  IconPlay, IconInfo, IconAlert, IconCheck, IconSearch,
  IconFolder, IconTrash, IconRefresh,
} from '../components/icons';
import { describeVersion } from '../data/versions';

interface Props {
  settings: LauncherSettings;
  account: MinecraftAccount | null;
  onGoToAccounts: () => void;
  onSettingsChange: (s: LauncherSettings) => void;
}

type Filter = 'all' | 'release' | 'snapshot' | 'old_beta' | 'old_alpha' | 'installed';

const typeLabel: Record<string, string> = {
  release: 'релиз',
  snapshot: 'снапшот',
  old_beta: 'beta',
  old_alpha: 'alpha',
};

export const LibraryPage: React.FC<Props> = ({ settings, account, onGoToAccounts, onSettingsChange }) => {
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string>(settings.lastVersionId || '');
  const [filter, setFilter] = useState<Filter>('release');
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [status, setStatus] = useState<string>('');
  const [statusType, setStatusType] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [busy, setBusy] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [javaPlan, setJavaPlan] = useState<JavaPlan | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabsWrapRef = useRef<HTMLDivElement>(null);

  const syncTabsFade = () => {
    const el = tabsRef.current;
    const wrap = tabsWrapRef.current;
    if (!el || !wrap) return;
    const atLeft = el.scrollLeft > 2;
    const atRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    wrap.dataset.left = atLeft ? '1' : '0';
    wrap.dataset.right = atRight ? '1' : '0';
  };

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Horizontal wheel is already handled natively. Map vertical wheel to horizontal scroll
      // only when there is something to scroll, so the event can still bubble otherwise.
      if (el.scrollWidth <= el.clientWidth) return;
      if (e.deltaY !== 0 && e.deltaX === 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
        syncTabsFade();
      }
    };
    const onScroll = () => syncTabsFade();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', onScroll, { passive: true });
    syncTabsFade();
    const ro = new ResizeObserver(syncTabsFade);
    ro.observe(el);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);

  const refreshInstalled = async () => {
    const list = await window.api.minecraft.installed();
    setInstalled(new Set(list));
  };

  useEffect(() => {
    window.api.minecraft.versions().then((list) => {
      setVersions(list);
      if (!selected && list.length) {
        const first = list.find((v) => v.type === 'release') || list[0];
        setSelected(first.id);
      }
    }).catch((e) => {
      setStatus('Не удалось загрузить список версий: ' + (e as Error).message);
      setStatusType('error');
    });
    refreshInstalled();

    const offProgress = window.api.minecraft.onProgress(setProgress);
    const offLog = window.api.minecraft.onLog((line) => {
      setLogLines((prev) => [...prev.slice(-500), line]);
    });
    const offExit = window.api.minecraft.onExit((code) => {
      setStatus(`Игра завершилась (код ${code})`);
      setStatusType(code === 0 ? 'success' : 'error');
      setBusy(false);
    });
    const offManifest = window.api.minecraft.onManifestUpdated((list) => {
      setVersions(list);
    });
    return () => { offProgress(); offLog(); offExit(); offManifest(); };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines.length]);

  useEffect(() => {
    if (!selected) { setJavaPlan(null); return; }
    let cancelled = false;
    setJavaPlan(null);
    window.api.java.planFor(selected).then((p) => { if (!cancelled) setJavaPlan(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [selected]);

  const latestRelease = useMemo(() => versions.find(v => v.type === 'release'), [versions]);
  const latestSnapshot = useMemo(() => versions.find(v => v.type === 'snapshot'), [versions]);

  const filtered = useMemo(() => {
    return versions.filter((v) => {
      if (query && !v.id.toLowerCase().includes(query.toLowerCase())) return false;
      if (filter === 'all') return true;
      if (filter === 'installed') return installed.has(v.id);
      return v.type === filter;
    });
  }, [versions, query, filter, installed]);

  const selectedVersion = versions.find(v => v.id === selected);
  const isInstalled = !!(selected && installed.has(selected));
  const isLast = !!(selected && selected === settings.lastVersionId);
  const canAct = !!account && !!selected && !busy;

  const counts = useMemo(() => {
    const c = { all: versions.length, release: 0, snapshot: 0, old_beta: 0, old_alpha: 0, installed: installed.size };
    for (const v of versions) (c as any)[v.type]++;
    return c;
  }, [versions, installed]);

  const onPlayOrDownload = async () => {
    if (!account || !selected) return;
    setBusy(true);
    setLogLines([]);
    setShowLog(false);
    setStatusType('neutral');
    try {
      if (!isInstalled) {
        setStatus('Скачивание ' + selected);
        await window.api.minecraft.install(selected);
        await refreshInstalled();
        setStatus('Установлено: ' + selected);
        setStatusType('success');
        setBusy(false);
        return;
      }
      setStatus('Подготовка...');
      await window.api.minecraft.install(selected);
      await refreshInstalled();
      setStatus('Запуск Minecraft');
      onSettingsChange({ ...settings, lastVersionId: selected });
      await window.api.minecraft.launch({
        versionId: selected,
        account,
        memoryMb: settings.memoryMb,
      });
      setStatus('Minecraft запущен');
      setStatusType('success');
    } catch (e) {
      setStatus('Ошибка: ' + (e as Error).message);
      setStatusType('error');
      setBusy(false);
    }
  };

  const onInstallOnly = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus('Скачивание ' + selected);
    setStatusType('neutral');
    try {
      await window.api.minecraft.install(selected);
      await refreshInstalled();
      setStatus('Установлено: ' + selected);
      setStatusType('success');
    } catch (e) {
      setStatus('Ошибка: ' + (e as Error).message);
      setStatusType('error');
    } finally {
      setBusy(false);
    }
  };

  const onUninstall = async () => {
    if (!selected) return;
    const deep = confirm(
      `Удалить версию ${selected}?\n\n` +
      `OK — глубокое удаление: папка версии, её внутренние данные и (если это последняя установленная) libraries/assets.\n` +
      `Отмена — обычное удаление только папки версии.\n\n` +
      `Мировые сохранения в общей папке saves НЕ будут затронуты.`
    );
    if (deep) {
      await window.api.minecraft.uninstallDeep(selected);
      setStatus('Глубоко удалено: ' + selected);
    } else {
      const ok = await window.api.minecraft.uninstall(selected);
      if (!ok) return;
      setStatus('Удалено: ' + selected);
    }
    setStatusType('success');
    await refreshInstalled();
  };

  const onUninstallById = async (id: string) => {
    if (!confirm(`Удалить версию ${id}? Файлы будут удалены с диска.`)) return;
    const ok = await window.api.minecraft.uninstall(id);
    if (ok) {
      await refreshInstalled();
      setStatus('Удалено: ' + id);
      setStatusType('success');
    }
  };

  const onUninstallAll = async () => {
    const list = [...installed];
    if (list.length === 0) return;
    if (!confirm(`Удалить все установленные версии (${list.length})? Файлы будут удалены с диска.`)) return;
    for (const id of list) {
      try { await window.api.minecraft.uninstall(id); } catch {}
    }
    await refreshInstalled();
    setStatus(`Удалено: ${list.length} версий`);
    setStatusType('success');
  };

  const playLabel = busy
    ? (isInstalled ? 'Запуск...' : 'Скачивание...')
    : (isInstalled ? 'Играть' : 'Скачать');

  return (
    <div className="library">
      {/* LEFT: list */}
      <div className="lib-list">
        <div className="lib-search">
          <IconSearch className="search-icon" />
          <input
            className="input"
            placeholder="Поиск версий"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="lib-quicks">
          {latestRelease && (
            <button className="btn sm" onClick={() => setSelected(latestRelease.id)}>
              Последний релиз · <span className="mono">{latestRelease.id}</span>
            </button>
          )}
          {latestSnapshot && (
            <button className="btn sm" onClick={() => setSelected(latestSnapshot.id)}>
              Последний снапшот · <span className="mono">{latestSnapshot.id}</span>
            </button>
          )}
        </div>

        <div className="lib-tabs-wrap" ref={tabsWrapRef}>
          <div className="lib-tabs" ref={tabsRef}>
            {([
              { id: 'release', label: 'Релизы', c: counts.release },
              { id: 'snapshot', label: 'Снапшоты', c: counts.snapshot },
              { id: 'installed', label: 'Установлено', c: counts.installed },
              { id: 'old_beta', label: 'Beta', c: counts.old_beta },
              { id: 'old_alpha', label: 'Alpha', c: counts.old_alpha },
              { id: 'all', label: 'Все', c: counts.all },
            ] as { id: Filter; label: string; c: number }[]).map((t) => (
              <button
                key={t.id}
                className={'lib-tab' + (filter === t.id ? ' active' : '')}
                onClick={() => setFilter(t.id)}
              >
                {t.label}
                <span className="count">{t.c}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lib-scroll">
          {filter === 'installed' && installed.size > 0 && (
            <div className="lib-installed-head">
              <span className="muted" style={{ fontSize: 12 }}>
                {installed.size} установлено
              </span>
              <button className="btn ghost sm" onClick={onUninstallAll}>
                <IconTrash /> Удалить все
              </button>
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="empty">Ничего не найдено</div>
          ) : (
            filtered.map((v) => {
              const isInst = installed.has(v.id);
              const isSel = selected === v.id;
              const isLastPlayed = v.id === settings.lastVersionId;
              return (
                <div
                  key={v.id}
                  className={'version-row' + (isSel ? ' selected' : '')}
                  onClick={() => setSelected(v.id)}
                >
                  <span
                    className={'version-dot ' + (isInst ? 'installed' : 'not-installed')}
                    title={isInst ? 'Установлено' : 'Не установлено'}
                  />
                  <div className="version-main">
                    <div className="version-name">
                      {v.id}
                      {isLastPlayed && <span className="pill">играли</span>}
                    </div>
                    <div className="version-meta">
                      {new Date(v.releaseTime).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <span className={'tag ' + v.type}>{typeLabel[v.type] ?? v.type}</span>
                  {isInst && (
                    <button
                      className="icon-btn row-delete"
                      onClick={(e) => { e.stopPropagation(); onUninstallById(v.id); }}
                      title={`Удалить ${v.id}`}
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: detail */}
      <div className="lib-detail">
        {!account && (
          <div className="card" style={{ margin: 0 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h2>Нет активного аккаунта</h2>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Добавьте профиль, чтобы начать игру</div>
              </div>
              <button className="btn primary" onClick={onGoToAccounts}>В аккаунты</button>
            </div>
          </div>
        )}

        <div className="hero">
          <div className="hero-body">
            <div className="hero-info">
              <div className="hero-eyebrow">
                {isInstalled ? 'Готово к игре' : 'Выбрано'}
                {isLast && <span className="pill">последняя</span>}
              </div>
              <div className="hero-title">{selected || '—'}</div>
              <div className="hero-meta">
                {selectedVersion && (
                  <>
                    <span className={'tag ' + selectedVersion.type}>{typeLabel[selectedVersion.type] ?? selectedVersion.type}</span>
                    <span className="chip">
                      {new Date(selectedVersion.releaseTime).toLocaleDateString('ru-RU')}
                    </span>
                    {javaPlan && !javaPlan.error && (
                      <span className={'chip ' + (javaPlan.plan === 'download' ? 'warn' : 'accent')}>
                        Java {javaPlan.required}
                        {javaPlan.plan === 'reuse' && <> · найдена</>}
                        {javaPlan.plan === 'download' && <> · скачается</>}
                        {javaPlan.plan === 'user' && <> · своя</>}
                      </span>
                    )}
                    <span className={'chip ' + (isInstalled ? 'success' : '')}>
                      {isInstalled ? <><IconCheck /> установлено</> : 'не установлено'}
                    </span>
                  </>
                )}
              </div>
            </div>

            <button className="play-btn" disabled={!canAct} onClick={onPlayOrDownload}>
              {busy && progress && (
                <span className="progress-fill" style={{ width: progress.percent + '%' }} />
              )}
              <span className="label">
                <IconPlay />
                {playLabel}
              </span>
            </button>
          </div>

          {(status || busy) && (
            <div className="hero-extra">
              <div className={'hero-notice ' + statusType}>
                {statusType === 'error' ? <IconAlert /> : statusType === 'success' ? <IconCheck /> : <IconInfo />}
                <span>{busy && progress ? `${progress.stage} · ${progress.percent}%` : status}</span>
              </div>
              <div className="hero-actions">
                {!isInstalled && (
                  <button
                    className="icon-btn"
                    disabled={busy || !selected}
                    onClick={onInstallOnly}
                    title="Только скачать"
                  >
                    <IconRefresh />
                  </button>
                )}
                <button
                  className="icon-btn"
                  disabled={!selected}
                  onClick={() => selected && window.api.minecraft.openFolder('version', selected)}
                  title="Открыть папку версии"
                >
                  <IconFolder />
                </button>
                {isInstalled && (
                  <button
                    className="icon-btn"
                    disabled={!selected || busy}
                    onClick={onUninstall}
                    title="Удалить"
                  >
                    <IconTrash />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedVersion && describeVersion(selectedVersion) && (
          <div className="about-card">
            <div className="about-head">
              <span className="about-label">О версии</span>
              <span className="about-id mono">{selectedVersion.id}</span>
            </div>
            <p className="about-text">{describeVersion(selectedVersion)}</p>
          </div>
        )}

        {logLines.length > 0 && (
          <div className="card" style={{ margin: 0 }}>
            <div className="card-head">
              <div className="row" style={{ gap: 8 }}>
                <h2>Лог игры</h2>
                <span className="chip">{logLines.length} строк</span>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn ghost sm" onClick={() => setShowLog((v) => !v)}>
                  {showLog ? 'Скрыть' : 'Показать'}
                </button>
                <button className="btn ghost sm" onClick={() => setLogLines([])}>Очистить</button>
              </div>
            </div>
            {showLog && <div className="log" ref={logRef}>{logLines.join('')}</div>}
          </div>
        )}
      </div>
    </div>
  );
};
