import React, { useEffect, useState } from 'react';
import type { LoaderType, LoaderVersionInfo } from '../../preload/preload';
import { IconRefresh, IconCheck } from './icons';
import { useT } from '../i18n';

interface Props {
  mcVersion: string;
  open: boolean;
  onClose: () => void;
  onInstalled: (versionId: string) => void;
}

const LOADERS: { id: LoaderType; label: string; hintKey: string }[] = [
  { id: 'fabric',   label: 'Fabric',   hintKey: 'loader.fabricHint' },
  { id: 'quilt',    label: 'Quilt',    hintKey: 'loader.quiltHint' },
  { id: 'neoforge', label: 'NeoForge', hintKey: 'loader.neoforgeHint' },
  { id: 'forge',    label: 'Forge',    hintKey: 'loader.forgeHint' },
];

export const LoaderInstallDialog: React.FC<Props> = ({ mcVersion, open, onClose, onInstalled }) => {
  const t = useT();
  const [loader, setLoader] = useState<LoaderType>('fabric');
  const [versions, setVersions] = useState<LoaderVersionInfo[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setVersions([]);
    setSelected('');
    setError('');
    setLoading(true);
    window.api.loaders.list(loader, mcVersion)
      .then((list) => {
        setVersions(list);
        if (list.length) setSelected(list[0].version);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [loader, mcVersion, open]);

  if (!open) return null;

  const onInstall = async () => {
    if (!selected) return;
    setInstalling(true);
    setError('');
    try {
      const { versionId } = await window.api.loaders.install(loader, mcVersion, selected);
      onInstalled(versionId);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="dialog-backdrop" onClick={installing ? undefined : onClose}>
      <div
        className="dialog"
        style={{ maxWidth: 540, alignItems: 'stretch' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-icon"><IconRefresh /></div>
        <div className="dialog-body">
        <h3 className="dialog-title">{t('loader.title', { mcVersion })}</h3>

          <div className="loader-types">
            {LOADERS.map((l) => (
              <button
                key={l.id}
                className={'loader-type' + (loader === l.id ? ' active' : '')}
                onClick={() => setLoader(l.id)}
                disabled={installing}
              >
                <div className="loader-type-name">{l.label}</div>
                <div className="loader-type-hint">{t(l.hintKey)}</div>
              </button>
            ))}
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label>{t('loader.versionLabel')}</label>
            {loading ? (
              <div className="empty" style={{ padding: 16 }}>{t('loader.loading')}</div>
            ) : versions.length === 0 ? (
              <div className="empty" style={{ padding: 16 }}>
                {t('loader.empty', { loader: LOADERS.find(l => l.id === loader)?.label ?? loader, mcVersion })}
              </div>
            ) : (
              <select
                className="select"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={installing}
              >
                {versions.slice(0, 100).map((v) => (
                  <option key={v.version} value={v.version}>
                    {v.version}{v.stable ? ` · ${t('loader.stable')}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && <div className="hint" style={{ color: 'var(--danger)' }}>{error}</div>}

          <div className="dialog-actions">
            <button className="btn ghost" onClick={onClose} disabled={installing}>
              {t('loader.cancel')}
            </button>
            <button
              className="btn primary"
              onClick={onInstall}
              disabled={!selected || installing}
            >
              {installing ? t('loader.installing') : <><IconCheck /> {t('loader.install')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
