import React, { useEffect, useState } from 'react';
import type { LauncherSettings } from '../../shared/types';
import type { CrashDiagnosis, CrashFixAction } from '../../preload/preload';

interface Props {
  settings: LauncherSettings | null;
  onSettingsChange: (s: LauncherSettings) => void;
  onNavigate: (page: 'settings' | 'content') => void;
}

// Crash Doctor — всплывающая карточка с диагнозом краша и кнопками починки.
export const CrashDoctor: React.FC<Props> = ({ settings, onSettingsChange, onNavigate }) => {
  const [crash, setCrash] = useState<CrashDiagnosis | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!window.api?.minecraft?.onCrash) return;
    const off = window.api.minecraft.onCrash((d) => { setCrash(d); setCopied(false); });
    return () => { off(); };
  }, []);

  if (!crash) return null;

  const close = () => setCrash(null);

  const handle = (a: CrashFixAction) => {
    switch (a.type) {
      case 'increase-memory': {
        if (settings) {
          const want = typeof a.hint === 'number' ? a.hint : 4096;
          const next = Math.max(settings.memoryMb || 0, want);
          onSettingsChange({ ...settings, memoryMb: next });
        }
        onNavigate('settings');
        close();
        break;
      }
      case 'switch-java':
        onNavigate('settings');
        close();
        break;
      case 'open-mods':
        onNavigate('content');
        close();
        break;
      case 'open-folder':
        window.api?.minecraft?.openFolder?.('game');
        break;
      case 'copy-report': {
        const text = `${crash.title}\n${crash.detail}` + (crash.culprit ? `\nВиновник: ${crash.culprit}` : '');
        try { navigator.clipboard.writeText(text); setCopied(true); } catch {}
        break;
      }
      case 'update-gpu-driver':
        window.api?.minecraft?.openFolder?.('game');
        break;
      default:
        break;
    }
  };

  return (
    <div className="crash-doctor-overlay" onClick={close}>
      <div className={`crash-doctor crash-${crash.severity}`} onClick={(e) => e.stopPropagation()}>
        <div className="crash-doctor-head">
          <span className="crash-doctor-badge">Crash Doctor</span>
          <button className="crash-doctor-close" onClick={close} aria-label="Close">×</button>
        </div>
        <h2 className="crash-doctor-title">{crash.title}</h2>
        <p className="crash-doctor-detail">{crash.detail}</p>
        {crash.culprit && (
          <div className="crash-doctor-culprit">Вероятный виновник: <code>{crash.culprit}</code></div>
        )}
        <div className="crash-doctor-actions">
          {crash.actions.map((a, i) => (
            <button key={i} className={i === 0 ? 'btn-primary' : 'btn-secondary'} onClick={() => handle(a)}>
              {a.type === 'copy-report' && copied ? 'Скопировано ✓' : a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};