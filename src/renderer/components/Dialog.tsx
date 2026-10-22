import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { IconAlert, IconInfo } from './icons';

export interface DialogButton {
  label: string;
  variant?: 'primary' | 'danger' | 'ghost' | 'default';
  /** Returned value when this button is pressed. */
  value: string;
}

export interface DialogOptions {
  title: string;
  message?: string | React.ReactNode;
  tone?: 'info' | 'warn' | 'danger';
  buttons: DialogButton[];
  /** Default button index (returned on Enter). */
  defaultIndex?: number;
  /** Returned when dialog is dismissed (Esc / backdrop click). */
  cancelValue?: string;
}

interface DialogContextValue {
  show: (opts: DialogOptions) => Promise<string>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
  return ctx;
};

type Resolver = (value: string) => void;

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [opts, setOpts] = useState<DialogOptions | null>(null);
  // Queue: a repeated show() while a dialog is open used to overwrite the
  // resolver — the first promise hung forever, and the calling code waited forever.
  const queue = useRef<Array<{ opts: DialogOptions; resolve: Resolver }>>([]);
  const currentResolve = useRef<Resolver | null>(null);

  const show = useCallback((next: DialogOptions): Promise<string> => {
    return new Promise<string>((resolve) => {
      queue.current.push({ opts: next, resolve });
      // If the dialog is already open — we join the queue, otherwise we show it right away.
      if (!currentResolve.current) {
        const first = queue.current.shift()!;
        currentResolve.current = first.resolve;
        setOpts(first.opts);
      }
    });
  }, []);

  const close = (value: string) => {
    currentResolve.current?.(value);
    currentResolve.current = null;
    const next = queue.current.shift();
    if (next) {
      currentResolve.current = next.resolve;
      setOpts(next.opts);
    } else {
      setOpts(null);
    }
  };

  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(opts.cancelValue ?? 'cancel');
      if (e.key === 'Enter' && opts.defaultIndex !== undefined) {
        // Enter in an input field — not confirm: otherwise typing a world/command name
        // would accidentally trigger “delete/launch” via the default button.
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        const btn = opts.buttons[opts.defaultIndex];
        if (btn) close(btn.value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opts]);

  return (
    <DialogContext.Provider value={{ show }}>
      {children}
      {opts && (
        <div className="dialog-backdrop" onClick={() => close(opts.cancelValue ?? 'cancel')}>
          <div className={'dialog ' + (opts.tone || 'info')} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-icon">
              {opts.tone === 'danger' || opts.tone === 'warn' ? <IconAlert /> : <IconInfo />}
            </div>
            <div className="dialog-body">
              <h3 className="dialog-title">{opts.title}</h3>
              {opts.message && <div className="dialog-msg">{opts.message}</div>}
              <div className="dialog-actions">
                {opts.buttons.map((b, i) => (
                  <button
                    key={i}
                    autoFocus={opts.defaultIndex === i}
                    className={'btn ' + (b.variant || 'default')}
                    onClick={() => close(b.value)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};
