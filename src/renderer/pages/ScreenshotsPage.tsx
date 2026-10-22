import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { Shot } from '../../preload/preload';
import { IconTrash, IconFolder, IconCopy } from '../components/icons';
import { useDialog } from '../components/Dialog';
import { useT } from '../i18n';
const fmtSize = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} КБ` : `${(b / 1024 / 1024).toFixed(1)} МБ`;

const HOTKEY_LS = 'trel.shots.hotkey';

// Keys that are taken by default in Minecraft — so that the player does not pick a conflicting one.
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
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);
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

  // We register our own global hotkey and refresh the list on capture.
  useEffect(() => {
    window.api.screenshots.setHotkey(hotkey).catch(() => {});
    const off = window.api.screenshots.onCaptured((s) => { refresh(); showToast(t('shots.captured', { name: s.name })); });
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // We turn the error codes from main into human-readable localized messages.
  const reasonText = (r?: string) =>
    r === 'unsupported-key' ? t('shots.unsupportedKey')
    : r === 'register-failed' ? t('shots.registerFailed')
    : (r || t('shots.hotkeyHint'));

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setCapturing(false); return; }
      const k = e.code === 'Space' ? 'Space'
        : e.code.startsWith('Key') ? e.code.slice(3)
        : e.code.startsWith('Digit') ? e.code.slice(5)
        : e.key.length === 1 ? e.key.toUpperCase() : e.key;
      setCapturing(false);
      setHotkeyError(null);
      void window.api.screenshots.setHotkey(k).then((result) => {
        if (!result.ok) { setHotkeyError(reasonText(result.reason)); return; }
        setHotkey(k);
        localStorage.setItem(HOTKEY_LS, k);
        const conflict = isReserved(k);
        if (conflict) showToast(t('shots.conflictWarn', { key: k, action: t(conflict.action) }));
      }).catch(() => setHotkeyError(t('shots.hotkeyHint')));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, showToast, t]);

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

  const shotsRef = React.useRef(shots);
  shotsRef.current = shots;
  const openViewer = async (shot: Shot) => {
    try {
      const src = await window.api.screenshots.read(shot.path);
      // While we were reading — the screenshot might have been deleted: showing a deleted one is worse than showing nothing.
      if (!shotsRef.current.some((x) => x.path === shot.path)) return;
      setView({ shot, src });
    }
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
      // defaultIndex: 0 (cancel), and not Delete: a stray Enter in the focus
      // would otherwise delete the screenshot without a deliberate click.
      defaultIndex: 0,
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

  const [showAllShots, setShowAllShots] = useState(false);
  const GALLERY_CAP = 80;
  const groups = useMemo(() => {
    const capped = showAllShots ? filtered : filtered.slice(0, GALLERY_CAP);
    if (sort === 'size') return [{ label: '', items: capped }];
    const map = new Map<string, Shot[]>();
    for (const s of capped) {
      const label = groupLabel(s.mtime, t);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(s);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  }, [filtered, sort, t, showAllShots]);

return (
    <div>
      <div className="page-head">
        <span className="eyebrow">{t('shots.hotkey')}</span>
        <div className="page-head-row">
          <div><h1 className="page-title">{t('shots.title')} <span className="count">{filtered.length}</span></h1><p className="page-sub">{t('shots.subtitle')}</p></div>
          <button className="btn ghost sm" onClick={() => window.api.screenshots.openFolder()}><IconFolder /> {t('shots.openFolder')}</button>
        </div>
      </div>
      <section className="pane show">
        <div className="shots-toolbar">
          <div className="search-wrap"><input className="input" placeholder={t('shots.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <div className="sortseg">
            {(['new', 'old', 'size'] as const).map((value) => <button key={value} className={sort === value ? 'on' : ''} onClick={() => setSort(value)}>{t(`shots.sort${value[0].toUpperCase() + value.slice(1)}`)}</button>)}
          </div>
          <div className="hotslot">{t('shots.hotkey')}: <button className="kbd" onClick={() => setCapturing(true)}>{capturing ? t('shots.pressKey') : hotkey}</button></div>
        </div>
        {capturing && <div className="hint">{t('shots.pressKey')}</div>}
        {hotkeyError && <div className="hint" style={{ color: 'var(--danger)' }}>{hotkeyError}</div>}
        {toast && <div className="hint">{toast}</div>}
        {loading ? <div className="hint">{t('shots.refresh')}</div> : (query.trim() && filtered.length === 0) ? <div className="empty"><h2>{t('shots.noMatch')}</h2><p>{t('shots.noMatchHint')}</p></div> : shots.length === 0 ? <div className="empty"><h2>{t('shots.title')}</h2><p>{t('shots.empty', { key: hotkey })}</p></div> : filtered.length === 0 ? <div className="empty"><h2>{t('shots.noMatch')}</h2><p>{t('shots.noMatchHint')}</p></div> : groups.map((group) => <div className="day-group" key={group.label || 'all'}>{group.label && <div className="day-label"><b>{group.label}</b><i /><span>{group.items.length}</span></div>}<div className="sh-grid">{group.items.map((shot) => <Thumb key={shot.path} shot={shot} selected={view?.shot.path === shot.path} onOpen={() => openViewer(shot)} onQuickDelete={() => quickDelete(shot)} deleteLabel={t('shots.deleteAction')} />)}</div></div>)}
        {!showAllShots && filtered.length > GALLERY_CAP && (
          <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => setShowAllShots(true)}>
            {t('shots.showAll', { count: filtered.length - GALLERY_CAP })}
          </button>
        )}
      </section>
      {view && <div className="lightbox" onClick={(e) => { if (e.target === e.currentTarget) setView(null); }}><div className="lb-stage"><img className="lb-img" src={view.src} alt={view.shot.name} /><div className="lb-bar"><span className="lb-name">{view.shot.name}</span><button className="btn ghost sm" onClick={() => window.api.screenshots.copy(view.shot.path)}><IconCopy /> {t('shots.copy')}</button><button className="btn ghost sm" onClick={() => window.api.screenshots.reveal(view.shot.path)}><IconFolder /> {t('shots.reveal')}</button><button className="btn danger sm" onClick={() => onDelete(view.shot)}><IconTrash /> {t('shots.deleteAction')}</button><button className="btn ghost sm" onClick={() => setView(null)}>{t('shots.close')}</button></div></div></div>}
    </div>
  );
};
