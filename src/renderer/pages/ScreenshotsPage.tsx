import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { Shot } from '../../preload/preload';
import { IconTrash, IconRefresh, IconFolder, IconCopy } from '../components/icons';
import { useDialog } from '../components/Dialog';
import { useT } from '../i18n';
const fmtDate = (ms: number) => new Date(ms).toLocaleString();
const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} КБ` : `${(b / 1024 / 1024).toFixed(1)} МБ`;

const HOTKEY_LS = 'trel.shots.hotkey';

// Клавиши, по умолчанию занятые в Minecraft — чтобы игрок не выбрал конфликтующую.
const MC_RESERVED: { key: string; action: string }[] = [
  { key: 'W', action: 'shots.mcForward' },
  { key: 'A', action: 'shots.mcLeft' },
  { key: 'S', action: 'shots.mcBack' },
  { key: 'D', action: 'shots.mcRight' },
  { key: 'Space', action: 'shots.mcJump' },
  { key: 'Shift', action: 'shots.mcSneak' },
  { key: 'E', action: 'shots.mcInventory' },
  { key: 'Q', action: 'shots.mcDrop' },
  { key: 'T', action: 'shots.mcChat' },
  { key: 'F', action: 'shots.mcSwapHand' },
  { key: 'F1', action: 'shots.mcHideHud' },
  { key: 'F2', action: 'shots.mcScreenshot' },
  { key: 'F3', action: 'shots.mcDebug' },
  { key: 'F5', action: 'shots.mcPerspective' },
  { key: 'F11', action: 'shots.mcFullscreen' },
];
const isReserved = (key: string) => MC_RESERVED.find((r) => r.key.toUpperCase() === key.toUpperCase());

const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const groupLabel = (ms: number, t: ReturnType<typeof useT>): string => {
  const today = startOfDay(Date.now());
  const day = startOfDay(ms);
  const diff = Math.round((today - day) / 86400000);
  if (diff <= 0) return t('shots.today');
  if (diff === 1) return t('shots.yesterday');
  if (diff < 7) return t('shots.thisWeek');
  return new Date(ms).toLocaleDateString();
};

const Thumb: React.FC<{ shot: Shot; selected: boolean; onOpen: () => void; onQuickDelete: () => void; deleteLabel: string }> = ({ shot, selected, onOpen, onQuickDelete, deleteLabel }) => {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    let alive = true;
    window.api.screenshots.read(shot.path).then((d) => { if (alive) setSrc(d); }).catch(() => {});
    return () => { alive = false; };
  }, [shot.path]);
  return (
    <div className={'shot-thumb' + (selected ? ' is-selected' : '')} title={shot.name}>
      <button className="shot-thumb-open" onClick={onOpen}>
        {src ? <img src={src} alt={shot.name} loading="lazy" /> : <div className="shot-skeleton" />}
        <span className="shot-meta">{shot.source === 'global' ? '' : shot.source + ' · '}{fmtSize(shot.size)}</span>
      </button>
      <button
        className="shot-thumb-del"
        title={deleteLabel}
        aria-label={deleteLabel}
        onClick={(e) => { e.stopPropagation(); onQuickDelete(); }}
      >
        <IconTrash />
      </button>
    </div>
  );
};

export const ScreenshotsPage: React.FC = () => {
  const t = useT();
  const dialog = useDialog();
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<{ shot: Shot; src: string } | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'new' | 'old' | 'size'>('new');
  const [hotkey, setHotkey] = useState<string>(() => localStorage.getItem(HOTKEY_LS) || 'F2');
  const [capturing, setCapturing] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = React.useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setShots(await window.api.screenshots.list()); }
    catch { setShots([]); }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Регистрируем собственный глобальный хоткей и обновляем список при захвате.
  useEffect(() => {
    window.api.screenshots.setHotkey(hotkey).catch(() => {});
    const off = window.api.screenshots.onCaptured((s) => { refresh(); showToast(t('shots.captured', { name: s.name })); });
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setCapturing(false); return; }
      const k = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
      setHotkey(k);
      localStorage.setItem(HOTKEY_LS, k);
      setCapturing(false);
      window.api.screenshots.setHotkey(k).catch(() => { /* ignore */ });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing]);

  const quickDelete = useCallback(async (shot: Shot) => {
    setShots((prev) => prev.filter((x) => x.path !== shot.path));
    if (view?.shot.path === shot.path) setView(null);
    try { await window.api.screenshots.delete(shot.path); }
    catch { refresh(); }
    showToast(t('shots.deleted'));
  }, [view, refresh, showToast, t]);

  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete') { e.preventDefault(); quickDelete(view.shot); }
      else if (e.key === 'Escape') setView(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, quickDelete]);

  const openViewer = async (shot: Shot) => {
    try { setView({ shot, src: await window.api.screenshots.read(shot.path) }); }
    catch { /* */ }
  };

  const onDelete = async (shot: Shot) => {
    const choice = await dialog.show({
      title: t('shots.deleteTitle'),
      tone: 'danger',
      message: t('shots.deleteConfirm', { name: shot.name }),
      buttons: [
        { label: t('worlds.deleteCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('shots.deleteAction'), value: 'ok', variant: 'danger' },
      ],
      defaultIndex: 1,
      cancelValue: 'cancel',
    });
    if (choice !== 'ok') return;
    await window.api.screenshots.delete(shot.path);
    setView(null);
    refresh();
  };

  const filtered = useMemo(() => {
    let list = shots.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
    list = [...list].sort((a, b) =>
      sort === 'new' ? b.mtime - a.mtime : sort === 'old' ? a.mtime - b.mtime : b.size - a.size);
    return list;
  }, [shots, query, sort]);

  const groups = useMemo(() => {
    if (sort === 'size') return [{ label: '', items: filtered }];
    const map = new Map<string, Shot[]>();
    for (const s of filtered) {
      const label = groupLabel(s.mtime, t);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(s);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  }, [filtered, sort, t]);

  return (
    <div className="page screenshots-page">
      <div className="page-head">
        <div>
          <h1>{t('shots.title')}</h1>
          <p className="page-subtitle">{t('shots.subtitle')}</p>
        </div>
        <div className="row-gap">
          <button className="btn sm" onClick={() => window.api.screenshots.capture()}>
            ⧉ {t('shots.captureNow')}
          </button>
          <button className="btn ghost sm" onClick={() => window.api.screenshots.openFolder()}>
            <IconFolder /> {t('shots.openFolder')}
          </button>
          <button className="btn ghost sm" onClick={refresh}>
            <IconRefresh /> {t('shots.refresh')}
          </button>
        </div>
      </div>

      <div className="shots-toolbar">
        <input
          className="shots-search"
          type="text"
          placeholder={t('shots.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="shots-sort">
          <button className={'chip' + (sort === 'new' ? ' accent' : '')} onClick={() => setSort('new')}>{t('shots.sortNew')}</button>
          <button className={'chip' + (sort === 'old' ? ' accent' : '')} onClick={() => setSort('old')}>{t('shots.sortOld')}</button>
          <button className={'chip' + (sort === 'size' ? ' accent' : '')} onClick={() => setSort('size')}>{t('shots.sortSize')}</button>
        </div>
        <div className="shots-hotkey" title={t('shots.hotkeyHint')}>
          <span className="shots-hotkey-label">{t('shots.hotkey')}</span>
          <button
            className={'kbd-capture' + (capturing ? ' is-capturing' : '')}
            onClick={() => setCapturing((v) => !v)}
          >
            {capturing ? t('shots.pressKey') : hotkey}
          </button>
        </div>
        <button className="btn ghost sm shots-memo-toggle" onClick={() => setShowMemo((v) => !v)}>
          ⌨ {t('shots.reservedTitle')}
        </button>
      </div>

      {isReserved(hotkey) && (
        <div className="shots-conflict">
          ⚠ {t('shots.conflictWarn', { key: hotkey, action: t(isReserved(hotkey)!.action) })}
        </div>
      )}

      {showMemo && (
        <div className="shots-memo">
          <div className="shots-memo-head">{t('shots.reservedHint')}</div>
          <div className="shots-memo-grid">
            {MC_RESERVED.map((r) => (
              <div className="shots-memo-item" key={r.key}>
                <kbd>{r.key}</kbd>
                <span>{t(r.action)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty p-24">{t('app.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="empty p-24">{query ? t('shots.noMatch') : t('shots.empty', { key: hotkey })}</div>
      ) : (
        <div className="shots-scroll">
          {groups.map((g) => (
            <div className="shots-group" key={g.label || 'all'}>
              {g.label && <div className="shots-group-head">{g.label} <span className="shots-group-count">{g.items.length}</span></div>}
              <div className="shots-masonry">
                {g.items.map((s) => (
                  <Thumb key={s.path} shot={s} selected={view?.shot.path === s.path} onOpen={() => openViewer(s)} onQuickDelete={() => quickDelete(s)} deleteLabel={t('shots.deleteAction')} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view && (
        <div className="shot-viewer-overlay" onClick={() => setView(null)}>
          <div className="shot-viewer shot-viewer-split" onClick={(e) => e.stopPropagation()}>
            <div className="shot-viewer-stage">
              <img src={view.src} alt={view.shot.name} />
            </div>
            <div className="shot-info-panel">
              <div className="shot-info-title">{view.shot.name}</div>
              <dl className="shot-info-list">
                <div><dt>{t('shots.infoDate')}</dt><dd>{fmtDate(view.shot.mtime)}</dd></div>
                <div><dt>{t('shots.infoSize')}</dt><dd>{fmtSize(view.shot.size)}</dd></div>
                <div><dt>{t('shots.infoSource')}</dt><dd>{view.shot.source}</dd></div>
                <div><dt>{t('shots.infoPath')}</dt><dd className="shot-info-path">{view.shot.path}</dd></div>
              </dl>
              <div className="shot-info-actions">
                <button className="btn ghost sm" onClick={() => window.api.screenshots.copy(view.shot.path)}>
                  <IconCopy /> {t('shots.copy')}
                </button>
                <button className="btn ghost sm" onClick={() => window.api.screenshots.reveal(view.shot.path)}>
                  <IconFolder /> {t('shots.reveal')}
                </button>
                <button className="btn danger sm" onClick={() => onDelete(view.shot)}>
                  <IconTrash /> {t('shots.deleteAction')}
                </button>
                <button className="btn sm" onClick={() => setView(null)}>{t('shots.close')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="shots-toast">{toast}</div>}
    </div>
  );
};