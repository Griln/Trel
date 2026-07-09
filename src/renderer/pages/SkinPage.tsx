import React, { useEffect, useRef, useState } from 'react';
import type { MinecraftAccount } from '../../shared/types';
import type { InstalledVersionDetail } from '../../preload/preload';
import { IconTrash, IconSkin, IconSkinOff } from '../components/icons';
import { SkinFace, SkinBody } from '../components/SkinPreview';
import { SkinViewer3D } from '../components/SkinViewer3D';
import { SKIN_PRESETS, SkinPreset } from '../data/skin-presets';
import { supportsCustomSkin } from '../../shared/skin-support';
import { useT } from '../i18n';

interface Props {
  accounts: MinecraftAccount[];
  activeUuid: string | null;
  onSelect: (uuid: string) => void;
  onChange: () => void;
  onGoToAccounts: () => void;
}

interface SkinErrors {
  needPng: string;
  readFailed: string;
  notImage: string;
  badSize: (w: number, h: number) => string;
}

/**
 * Read a .png file as data-URL and validate dimensions (64×64 or 64×32).
 */
const readPngFromFile = (file: File, err: SkinErrors): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!/\.png$/i.test(file.name) && file.type !== 'image/png') {
      return reject(new Error(err.needPng));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(err.readFailed));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error(err.notImage));
      img.onload = () => {
        if (img.width !== 64 || (img.height !== 64 && img.height !== 32)) {
          return reject(new Error(err.badSize(img.width, img.height)));
        }
        resolve(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });

const validateDataUrlSize = (dataUrl: string, err: SkinErrors): Promise<void> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error(err.notImage));
    img.onload = () => {
      if (img.width !== 64 || (img.height !== 64 && img.height !== 32)) {
        reject(new Error(err.badSize(img.width, img.height)));
      } else {
        resolve();
      }
    };
    img.src = dataUrl;
  });

export const SkinPage: React.FC<Props> = ({ accounts, activeUuid, onSelect, onChange, onGoToAccounts }) => {
  const t = useT();
  const [error, setError] = useState<string>('');
  const [presetCat, setPresetCat] = useState<'all' | 'male' | 'female' | 'neutral'>('all');
  const [presetStyle, setPresetStyle] = useState<'all' | 'cyber' | 'fantasy' | 'pastel'>('all');
  const [unsupportedInstalled, setUnsupportedInstalled] = useState<InstalledVersionDetail[]>([]);
  const dropRef = useRef<HTMLDivElement>(null);

  const active = accounts.find((a) => a.uuid === activeUuid) ?? null;

  const skinErrors: SkinErrors = {
    needPng: t('skin.errNeedPng'),
    readFailed: t('skin.errReadFailed'),
    notImage: t('skin.errNotImage'),
    badSize: (w, h) => t('skin.errBadSize', { w: String(w), h: String(h) }),
  };

  // Load installed versions and filter those where skin doesn't work,
  // to show the user a warning right on this page.
  useEffect(() => {
    let cancelled = false;
    window.api.minecraft.installedDetailed().then((list) => {
      if (cancelled) return;
      setUnsupportedInstalled(
        list.filter((d) => !supportsCustomSkin(d.id, d.baseMc)),
      );
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const applySkin = async (uuid: string, dataUrl: string, model?: 'classic' | 'slim') => {
    setError('');
    try {
      const acc = accounts.find((a) => a.uuid === uuid);
      const m = model ?? acc?.skinModel ?? 'classic';
      await window.api.accounts.setSkin(uuid, dataUrl, m);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onPickSkin = async () => {
    if (!active) return;
    setError('');
    try {
      const dataUrl = await window.api.accounts.pickSkinFile();
      if (!dataUrl) return;
      await validateDataUrlSize(dataUrl, skinErrors);
      await applySkin(active.uuid, dataUrl);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onRemoveSkin = async () => {
    if (!active) return;
    await window.api.accounts.removeSkin(active.uuid);
    onChange();
  };

  const onPickModel = async (model: 'classic' | 'slim') => {
    if (!active || !active.skin) return;
    if (active.skinModel === model) return;
    await applySkin(active.uuid, active.skin, model);
  };

  const onPickPreset = async (preset: SkinPreset) => {
    if (!active) return;
    await applySkin(active.uuid, preset.dataUrl, preset.model);
  };

  const filteredPresets = SKIN_PRESETS.filter((p) =>
    (presetCat === 'all' || p.category === presetCat) &&
    (presetStyle === 'all' || p.style === presetStyle)
  );

  const isCurrentPreset = (preset: SkinPreset): boolean =>
    !!active?.skin && active.skin === preset.dataUrl;

  // Drag&drop PNG directly onto preview
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onOver = (e: DragEvent) => { e.preventDefault(); el.classList.add('dragover'); };
    const onLeave = () => el.classList.remove('dragover');
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      el.classList.remove('dragover');
      if (!active) return;
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await readPngFromFile(file, skinErrors);
        await applySkin(active.uuid, dataUrl);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    el.addEventListener('dragover', onOver);
    el.addEventListener('dragleave', onLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onOver);
      el.removeEventListener('dragleave', onLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [active?.uuid, accounts]);

  if (accounts.length === 0) {
    return (
      <div>
        <div className="page-head">
          <h1>{t('skin.title')}</h1>
          <p>{t('skin.subtitle')}</p>
        </div>
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>{t('skin.addAccountFirst')}</h2>
          <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
            {t('skin.skinBoundHint')}
          </p>
          <button className="btn primary" onClick={onGoToAccounts}>{t('skin.goToAccounts')}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>{t('skin.title')}</h1>
        <p>{t('skin.subtitle')}</p>
      </div>

      {/* Account switcher when there are multiple */}
      {accounts.length > 1 && (
        <div className="card">
          <div className="card-head">
            <h2>{t('skin.accountTitle')}</h2>
            <span className="chip">{accounts.length}</span>
          </div>
          <div className="skin-account-list">
            {accounts.map((a) => (
              <button
                key={a.uuid}
                className={'skin-account-pill' + (activeUuid === a.uuid ? ' active' : '')}
                onClick={() => onSelect(a.uuid)}
              >
                <SkinFace skin={a.skin ?? null} size={28} fallbackName={a.name} />
                <span>{a.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {active && (
        <div className="card skin-card">
          <div className="card-head">
            <h2>{active.name}</h2>
            {active.skin && (
              <span className="chip accent">
                {active.skinModel === 'slim' ? 'Alex (slim)' : 'Steve (classic)'}
              </span>
            )}
          </div>

          <div className="skin-card-body">
            <div className="skin-preview-wrap" ref={dropRef}>
              {active.skin ? (
                <SkinViewer3D
                  skin={active.skin}
                  model={active.skinModel ?? 'classic'}
                  height={256}
                  autoRotate
                />
              ) : (
                <div className="skin-empty">
                  <IconSkin className="skin-empty-icon" />
                  <div className="skin-empty-text">{t('skin.skinNotLoaded')}</div>
                  <div className="skin-empty-sub">{t('skin.dragPngHere')}</div>
                </div>
              )}
            </div>

            <div className="skin-controls">
              <div className="skin-section-title">{t('skin.fileSection')}</div>
              <div className="skin-tip">
                {t('skin.fileTip')}
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <button className="btn primary" onClick={onPickSkin}>
                  {t('skin.pickFile')}
                </button>
                {active.skin && (
                  <button className="btn ghost" onClick={onRemoveSkin}>
                    <IconTrash /> {t('skin.reset')}
                  </button>
                )}
              </div>

              {active.skin && (
                <>
                  <div className="skin-section-title" style={{ marginTop: 14 }}>{t('skin.modelSection')}</div>
                  <div className="skin-model-toggle">
                    <button
                      className={'skin-model-btn' + (active.skinModel !== 'slim' ? ' active' : '')}
                      onClick={() => onPickModel('classic')}
                    >
                      <span className="skin-model-name">Steve</span>
                      <span className="skin-model-sub">{t('skin.steveClassic')}</span>
                    </button>
                    <button
                      className={'skin-model-btn' + (active.skinModel === 'slim' ? ' active' : '')}
                      onClick={() => onPickModel('slim')}
                    >
                      <span className="skin-model-name">Alex</span>
                      <span className="skin-model-sub">{t('skin.alexSlim')}</span>
                    </button>
                  </div>
                </>
              )}

              {error && (
                <div className="hint" style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</div>
              )}

              <div className="hint" style={{ marginTop: 12, fontSize: 12 }}>
                {t('skin.authlibHint')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preset gallery */}
      {active && (
        <div className="card">
          <div className="card-head">
            <h2>{t('skin.presets')}</h2>
            <div className="col" style={{ gap: 6, alignItems: 'flex-end' }}>
              <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                {(['all', 'cyber', 'fantasy', 'pastel'] as const).map((s) => (
                  <button
                    key={s}
                    className={'btn sm ' + (presetStyle === s ? 'primary' : 'ghost')}
                    onClick={() => setPresetStyle(s)}
                  >
                    {s === 'all' ? t('skin.styleAll') :
                     s === 'cyber' ? t('skin.styleCyber') :
                     s === 'fantasy' ? t('skin.styleFantasy') :
                     t('skin.stylePastel')}
                  </button>
                ))}
              </div>
              <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                {(['all', 'male', 'female', 'neutral'] as const).map((cat) => (
                  <button
                    key={cat}
                    className={'btn sm ' + (presetCat === cat ? 'primary' : 'ghost')}
                    onClick={() => setPresetCat(cat)}
                  >
                    {cat === 'all' ? t('skin.catAll') :
                      cat === 'male' ? t('skin.catMale') :
                      cat === 'female' ? t('skin.catFemale') :
                      t('skin.catNeutral')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="skin-preset-grid">
            {filteredPresets.map((p) => (
              <button
                key={p.id}
                className={'skin-preset-card' + (isCurrentPreset(p) ? ' active' : '')}
                onClick={() => onPickPreset(p)}
                title={p.description}
              >
                <div className="skin-preset-preview">
                  <SkinBody skin={p.dataUrl} model={p.model} height={112} />
                </div>
                <div className="skin-preset-info">
                  <div className="skin-preset-name">{p.name}</div>
                  <div className="skin-preset-cat">
                    {p.category === 'male' ? t('skin.presetMale') :
                      p.category === 'female' ? t('skin.presetFemale') :
                      t('skin.presetNeutral')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Versions without skin support */}
      {active && unsupportedInstalled.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h2>
              <IconSkinOff style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {t('skin.unsupportedTitle')}
            </h2>
            <span className="chip">{unsupportedInstalled.length}</span>
          </div>
          <div className="hint" style={{ marginBottom: 10, fontSize: 12.5 }}>
            {t('skin.unsupportedHint')}
          </div>
          <div className="skin-unsupported-list">
            {unsupportedInstalled.map((it) => (
              <div key={it.id} className="skin-unsupported-row">
                <IconSkinOff />
                <span className="skin-unsupported-id">{it.id}</span>
                {it.loader && (
                  <span className="chip accent">+ {it.loader}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
