import React, { useEffect, useRef, useState } from 'react';
import type { MinecraftAccount } from '../../shared/types';
import type { InstalledVersionDetail } from '../../preload/preload';
import { SkinFace } from '../components/SkinPreview';
import { VersionPicker } from '../components/VersionPicker';
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
  const viewerSkin = active?.skin ?? SKIN_PRESETS[0]?.dataUrl ?? '';

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

  const applyRef = useRef(false);
  const applySkin = async (uuid: string, dataUrl: string, model?: 'classic' | 'slim') => {
    // Fast clicks on the presets interleaved with setSkin — the last one did not win.
    if (applyRef.current) return;
    applyRef.current = true;
    setError('');
    try {
      const acc = accounts.find((a) => a.uuid === uuid);
      const m = model ?? acc?.skinModel ?? 'classic';
      await window.api.accounts.setSkin(uuid, dataUrl, m);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      applyRef.current = false;
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
        <span className="eyebrow">Внешность</span>
        <h1 className="page-title">{t('skin.title')} <span className="count">{SKIN_PRESETS.length}</span></h1>
        <p className="page-sub">{t('skin.subtitle')}</p>
      </div>

      {error && <div className="hint" style={{ color: 'var(--danger)' }}>{error}</div>}
      {unsupportedInstalled.length > 0 && <div className="warn-strip">{t('skin.unsupportedInstalled', { count: unsupportedInstalled.length })}</div>}
      <div className="skin-layout">
        <div className="viewer">
          <div className="viewer-stage">
            <SkinViewer3D skin={viewerSkin} model={active?.skinModel ?? 'classic'} />
          </div>
          <div className="viewer-bar">
            <div className="who"><div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}><SkinFace skin={active?.skin ?? null} size={32} fallbackName={active?.name ?? '?'} /><b>{active?.name}</b></div></div>
            <div className="model-switch">
              <button className={active?.skinModel !== 'slim' ? 'on' : ''} onClick={() => onPickModel('classic')}>CLASSIC</button>
              <button className={active?.skinModel === 'slim' ? 'on' : ''} onClick={() => onPickModel('slim')}>SLIM</button>
            </div>
            <button className="abtn del" title={t('skin.reset')} onClick={onRemoveSkin} disabled={!active?.skin}>×</button>
          </div>
          <div className="grain" />
        </div>

        <div>
          <section className="pane show" id="gallery">
            <div className="dropzone" ref={dropRef} onClick={onPickSkin}>
              <span className="big">⬆</span>
              <b style={{ color: 'var(--fg)', fontSize: 14 }}>{t('skin.dragPngHere')}</b>
              <div style={{ fontSize: 12, marginTop: 4 }}>{t('skin.dropFormatHint')}</div>
            </div>

            <div className="filters">
              <div className="fgroup">
                <button className={presetCat === 'all' ? 'on' : ''} onClick={() => setPresetCat('all')}>{t('skin.filterAll')}</button><button className={presetCat === 'male' ? 'on' : ''} onClick={() => setPresetCat('male')}>{t('skin.filterMale')}</button><button className={presetCat === 'female' ? 'on' : ''} onClick={() => setPresetCat('female')}>{t('skin.filterFemale')}</button><button className={presetCat === 'neutral' ? 'on' : ''} onClick={() => setPresetCat('neutral')}>{t('skin.filterNeutral')}</button>
              </div>
              <div className="fgroup">
                <button className={presetStyle === 'all' ? 'on' : ''} onClick={() => setPresetStyle('all')}>{t('skin.filterAllStyles')}</button><button className={presetStyle === 'cyber' ? 'on' : ''} onClick={() => setPresetStyle('cyber')}>{t('skin.filterCyber')}</button><button className={presetStyle === 'fantasy' ? 'on' : ''} onClick={() => setPresetStyle('fantasy')}>{t('skin.filterFantasy')}</button><button className={presetStyle === 'pastel' ? 'on' : ''} onClick={() => setPresetStyle('pastel')}>{t('skin.filterPastel')}</button>
              </div>
            </div>

            <div className="skin-grid">
              {filteredPresets.map((p) => (
                <div key={p.id} className={'skincard' + (isCurrentPreset(p) ? ' sel' : '')} onClick={() => onPickPreset(p)}>
                  <SkinFace skin={p.dataUrl} size={64} fallbackName={p.name} />
                  <b>{p.name}</b>
                  <span>{t('skin.presetMeta', { cat: p.category === 'male' ? t('skin.filterMaleShort') : p.category === 'female' ? t('skin.filterFemaleShort') : t('skin.filterNeutralShort'), style: p.style === 'cyber' ? t('skin.filterCyber') : p.style === 'fantasy' ? t('skin.filterFantasy') : p.style === 'pastel' ? t('skin.filterPastel') : p.style })}</span>
                </div>
              ))}
            </div>

            <div className="warn-strip">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth={2}><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
              Скины видны в игре только на версиях с поддержкой скин (нужен локальный скин-сервер). На 1.20.1+Fabric всё работает.
            </div>
          </section>

          <section className="pane" id="upload">
            <div className="dropzone" style={{ borderColor: 'rgba(94,203,111,.5)', background: 'rgba(94,203,111,.04)' }}>
              <span className="big">🖼</span>
              <b style={{ color: 'var(--green)', fontSize: 14 }}>{active?.skin ? '✓' : t('skin.dragPngHere')}</b>
              <div style={{ fontSize: 12, marginTop: 4 }}>Файл проверен. Модель определяется автоматически, можно поменять ниже.</div>
            </div>
            <div className="card">
              <div className="card-head"><h4>Применить скин</h4></div>
              <div className="set-row" style={{ border: 'none', paddingTop: 0, alignItems: 'flex-start' }}>
                <div className="info"><b>Аккаунт</b><span>на кого надеть скин</span></div>
                <div style={{ width: 240, flexShrink: 0 }}>
                  <VersionPicker
                    value={active?.uuid ?? ''}
                    onChange={onSelect}
                    maxHeight={220}
                    options={accounts.map((account) => ({ id: account.uuid, title: account.name, sub: account.type === 'online' ? 'Microsoft' : t('accounts.guest') }))}
                  />
                </div>
              </div>
              <div className="set-row">
                <div className="info"><b>Модель рук</b><span>classic — 4px, slim — 3px (Alex)</span></div>
                <div className="model-switch">
                  <button className={active?.skinModel !== 'slim' ? 'on' : ''}>CLASSIC</button>
                  <button className={active?.skinModel === 'slim' ? 'on' : ''}>SLIM</button>
                </div>
              </div>
              <button className="btn primary" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>Применить скин</button>
            </div>
            <p className="note">* валидация: только PNG, только 64×64 / 64×32. Ошибки показываются прямо на странице.</p>
          </section>
        </div>
      </div>
    </div>
  );
};
