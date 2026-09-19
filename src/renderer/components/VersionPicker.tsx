import React, { useEffect, useRef, useState } from 'react';
import { IconCube } from './icons';
import { useT } from '../i18n';

// Единый красивый пикер версий в стиле .vpick (как на странице «Контент»).
// Заменяет старые <select> в форме создания сервера, диалоге лоадеров
// и диагностике. Классы .vpick* — глобальные из styles-pages.css.

export interface VersionPickerOption {
  id: string;
  title: string;
  sub?: string;
  /** Доп. класс пункта: 'modded' | 'bedrock' — красит кубик. */
  tone?: string;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  options: VersionPickerOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Ограничение числа пунктов в списке (как раньше slice(0, 100)). */
  maxItems?: number;
  maxHeight?: number;
}

export const VersionPicker: React.FC<Props> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  maxItems,
  maxHeight = 300,
}) => {
  const t = useT();
  const ph = placeholder ?? t('common.noVersions');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find((o) => o.id === value);
  const shown = maxItems ? options.slice(0, maxItems) : options;

  return (
    <div className={'vpick compact' + (open ? ' open' : '')} ref={rootRef}>
      <button
        type="button"
        className="vpick-btn"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="vpick-cube"><IconCube /></span>
        <span className="vpick-info">
          <b>{current ? current.title : ph}</b>
          <span>{current?.sub ?? ''}</span>
        </span>
        <svg className="vpick-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div className="vpick-panel" style={{ maxHeight, overflowY: 'auto' }}>
        {shown.length === 0 ? (
          <div className="vpick-empty">{ph}</div>
        ) : shown.map((o) => (
          <button
            key={o.id}
            type="button"
            className={'vpick-item' + (o.id === value ? ' sel' : '') + (o.tone ? ` ${o.tone}` : '')}
            onClick={() => { onChange(o.id); setOpen(false); }}
          >
            <span className="vi-cube"><IconCube /></span>
            <span className="vi-body"><b>{o.title}</b>{o.sub ? <span>{o.sub}</span> : null}</span>
            <svg className="vi-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="m5 12 5 5 9-11" /></svg>
          </button>
        ))}
      </div>
    </div>
  );
};
