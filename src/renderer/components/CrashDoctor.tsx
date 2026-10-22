import React, { useEffect, useState } from 'react';
import { useT } from '../i18n';
import type { LauncherSettings } from '../../shared/types';
import type { CrashDiagnosis, CrashFixAction } from '../../preload/preload';

interface Props {
  settings: LauncherSettings | null;
  onSettingsChange: (s: LauncherSettings) => void;
  onNavigate: (page: 'settings' | 'content') => void;
}

// Crash Doctor — a popup card with the crash diagnosis and repair buttons.
// The buttons really repair: memory is applied right away, the driver is opened
// at the vendor, Java is rescanned before navigating to the settings.
export const CrashDoctor: React.FC<Props> = ({ settings, onSettingsChange, onNavigate }) => {
  const t = useT();
  const [crash, setCrash] = useState<CrashDiagnosis | null>(null);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  useEffect(() => {
    if (!window.api?.minecraft?.onCrash) return;
    const off = window.api.minecraft.onCrash((d) => { setCrash(d); setCopied(false); setApplied(null); });
    return () => { off(); };
  }, []);

  if (!crash) return null;

  const close = () => setCrash(null);

  const handle = async (a: CrashFixAction) => {
    switch (a.type) {
      case 'increase-memory': {
        if (settings) {
          const want = typeof a.hint === 'number' ? a.hint : 4096;
          const next = Math.max(settings.memoryMb || 0, want);
          onSettingsChange({ ...settings, memoryMb: next });
          try {
            // We push persist directly: the parent's onSettingsChange may
            // be local (without a write), while the memory has to grow for sure.
            const cur = await window.api.settings.get();
            await window.api.settings.set({ ...cur, memoryMb: next });
            setApplied(t('crash.appliedMemory', { mb: next }));
          } catch { /* the parent already updated it locally */ }
        }
        break;
      }
      case 'switch-java':
        // The Java list may have gone stale — we rescan before navigating.
        try { await window.api.java.scan(); } catch { /* ignore */ }
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
        const text = `${crash.title}\n${crash.detail}` + (crash.culprit ? `\n${t('crash.culprit')}: ${crash.culprit}` : '');
        try { await navigator.clipboard.writeText(text); setCopied(true); } catch {}
        break;
      }
      case 'update-gpu-driver':
        // A link from the backend (the vendor was detected); without it — silently nothing.
        if (a.url) {
          try { await window.api.tools.openUrl(a.url); } catch {}
        }
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
          <div className="crash-doctor-culprit">{t('crash.culprit')}: <code>{crash.culprit}</code></div>
        )}
        {applied && (
          <div className="crash-doctor-applied">{applied}</div>
        )}
        <div className="crash-doctor-actions">
          {crash.actions.map((a, i) => (
            <button key={i} className={i === 0 ? 'btn primary' : 'btn ghost'} onClick={() => handle(a)}>
              {a.type === 'copy-report' && copied ? t('crash.copied') : a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
