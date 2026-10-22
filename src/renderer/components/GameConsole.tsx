import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';

const MAX_LINES = 500;

/**
 * Game console: a live launch log. Error filter, search, auto-scroll,
 * copying. Visible only when the showConsole setting is enabled.
 */
export const GameConsole: React.FC = () => {
  const t = useT();
  const [lines, setLines] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'errors'>('all');
  const [query, setQuery] = useState('');
  const [follow, setFollow] = useState(true);
  const [open, setOpen] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.api?.minecraft?.onLog) return;
    const off = window.api.minecraft.onLog((line: string) => {
      setLines((prev) => {
        const next = [...prev, line];
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      });
    });
    return () => { off(); };
  }, []);

  useEffect(() => {
    if (follow && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines, follow]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lines.filter((l) => {
      if (filter === 'errors' && !/ERROR|FATAL|Exception|SEVERE|WARN|FAILED|Error/i.test(l)) return false;
      if (q && !l.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lines, filter, query]);

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(shown.join('\n')); } catch { /* ignore */ }
  };

  return (
    <section className="card" style={{ marginTop: 12 }}>
      <div className="card-head" style={{ cursor: 'pointer' }} onClick={() => setOpen((v) => !v)}>
        <h4>{t('console.title')} <span className="muted">({lines.length})</span></h4>
        <span className="muted">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <button className={'btn ghost sm' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>
              {t('console.all')}
            </button>
            <button className={'btn ghost sm' + (filter === 'errors' ? ' on' : '')} onClick={() => setFilter('errors')}>
              {t('console.errors')}
            </button>
            <input
              className="input sm"
              style={{ maxWidth: 200 }}
              placeholder={t('console.searchPh')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="toggle" title={t('console.follow')}>
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
              <span className="track" />
            </label>
            <button className="btn ghost sm" onClick={() => setLines([])}>{t('console.clear')}</button>
            <button className="btn ghost sm" onClick={copyAll}>{t('console.copy')}</button>
          </div>
          <div
            ref={boxRef}
            className="mono"
            style={{ maxHeight: 260, overflow: 'auto', fontSize: 11.5, display: 'grid', gap: 1, background: 'var(--bg)', borderRadius: 8, padding: 10 }}
          >
            {shown.length === 0 && <span className="muted">{t('console.empty')}</span>}
            {shown.map((line, i) => {
              const cls = /ERROR|FATAL|Exception|SEVERE/i.test(line) ? 'err' : /WARN/i.test(line) ? 'warn' : /INFO/i.test(line) ? 'info' : '';
              return <span key={i} className={'log-ln ' + cls}>{line}</span>;
            })}
          </div>
        </>
      )}
    </section>
  );
};
