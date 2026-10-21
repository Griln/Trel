import React, { useEffect, useMemo, useState } from 'react';
import type { ContentItem, ContentKind, InstalledVersionDetail, LoaderType } from '../../preload/preload';
import {
  IconCube, IconFolder, IconTrash, IconRefresh, IconArchive, IconSpark,
} from '../components/icons';
import { useDialog } from '../components/Dialog';
import { useT } from '../i18n';

interface Props {
  lastVersionId?: string;
  onPickVersion: (versionId: string) => void;
}

const TAB_IDS: ContentKind[] = ['mod', 'shader', 'resourcepack', 'texturepack'];

const TAB_LABEL_KEY: Record<ContentKind, string> = {
  mod: 'content.tabMods',
  shader: 'content.tabShaders',
  resourcepack: 'content.tabResourcepacks',
  texturepack: 'content.tabTexturepacks',
};

const loaderLabel: Record<LoaderType, string> = {
  fabric: 'Fabric', quilt: 'Quilt', forge: 'Forge', neoforge: 'NeoForge',
};

function prettyVersionName(d: InstalledVersionDetail): string {
  if (d.loader) return `${d.baseMc} + ${loaderLabel[d.loader]} ${d.loaderVersion ?? ''}`.trim();
  return d.id;
}

const KindIcon: Record<ContentKind, React.FC<any>> = {
  mod: IconCube,
  shader: IconSpark,
  resourcepack: IconArchive,
  texturepack: IconArchive,
};

const HINT_KEY: Record<ContentKind, string> = {
  mod: 'content.hintMod',
  shader: 'content.hintShader',
  resourcepack: 'content.hintResourcepack',
  texturepack: 'content.hintTexturepack',
};

const BEDROCK_LABEL_KEY: Record<ContentKind, string> = {
  mod: 'content.bedrockAddons',
  shader: 'content.tabShaders',
  resourcepack: 'content.bedrockResourcepacks',
  texturepack: 'content.bedrockWorlds',
};

const BEDROCK_HINT_KEY: Record<ContentKind, string> = {
  mod: 'content.bedrockHintAddons',
  shader: 'content.hintShader',
  resourcepack: 'content.bedrockHintResourcepacks',
  texturepack: 'content.bedrockHintWorlds',
};

export const ContentPage: React.FC<Props> = ({ lastVersionId, onPickVersion }) => {
  const t = useT();
  const dlg = useDialog();
  const [tab, setTab] = useState<ContentKind>('mod');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Обновления модов (Modrinth): файл -> свежая версия.
  const [modUpdates, setModUpdates] = useState<Record<string, { latest: string; current?: string; url?: string }>>({});
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updatingFile, setUpdatingFile] = useState<string | null>(null);
  // Профили модов: именованные наборы включённых jar.
  const [profiles, setProfiles] = useState<Record<string, string[]>>({});
  const [activeProfile, setActiveProfile] = useState<string>('');
  const [newProfile, setNewProfile] = useState('');

  const loadProfiles = async (vid: string) => {
    if (!vid) { setProfiles({}); return; }
    try { setProfiles(await window.api.content.modProfiles(vid)); }
    catch { setProfiles({}); }
  };

  const saveProfile = async () => {
    const name = newProfile.trim();
    if (!name || !versionId) return;
    try {
      await window.api.content.modProfileSave(versionId, name);
      setNewProfile('');
      setActiveProfile(name);
      await loadProfiles(versionId);
      setStatus(t('content.profileSaved', { name }));
    } catch (e) { setStatus(t('content.profileFailed', { message: (e as Error).message })); }
  };
  const applyProfile = async (name: string) => {
    if (!name || !versionId) return;
    try {
      const r = await window.api.content.modProfileApply(versionId, name);
      setActiveProfile(name);
      setStatus(t('content.profileApplied', { enabled: r.enabled, disabled: r.disabled }));
      refresh();
    } catch (e) { setStatus(t('content.profileFailed', { message: (e as Error).message })); }
  };
  const deleteProfile = async (name: string) => {
    if (!name || !versionId) return;
    try {
      await window.api.content.modProfileDelete(versionId, name);
      if (activeProfile === name) setActiveProfile('');
      await loadProfiles(versionId);
    } catch (e) { setStatus(t('content.profileFailed', { message: (e as Error).message })); }
  };

  const checkUpdates = async () => {
    if (!versionId || !currentDetail || checkingUpdates) return;
    setCheckingUpdates(true);
    try {
      const baseMc = currentDetail.baseMc || versionId;
      const loaders = currentDetail.loader ? [currentDetail.loader] : [];
      const list = await window.api.content.checkModUpdates(versionId, baseMc, loaders);
      const map: Record<string, { latest: string; current?: string; url?: string }> = {};
      for (const u of list) if (u.url) map[u.file] = { latest: u.latest ?? '?', current: u.current, url: u.url };
      setModUpdates(map);
      if (list.length === 0) setStatus(t('content.updatesNone'));
      else setStatus(t('content.updatesFound', { count: list.length }));
    } catch (e) {
      setStatus(t('content.updatesFailed', { message: (e as Error).message }));
    } finally {
      setCheckingUpdates(false);
      refresh();
    }
  };

  const applyUpdate = async (file: string) => {
    const u = modUpdates[file];
    if (!u?.url || updatingFile) return;
    setUpdatingFile(file);
    try {
      await window.api.content.updateMod(versionId, file, u.url);
      setModUpdates((m) => { const c = { ...m }; delete c[file]; return c; });
      setStatus(t('content.updatedOk', { file }));
    } catch (e) {
      setStatus(t('content.updatedFailed', { message: (e as Error).message }));
    } finally {
      setUpdatingFile(null);
      refresh();
    }
  };
  const [details, setDetails] = useState<InstalledVersionDetail[]>([]);
  const [versionId, setVersionId] = useState<string>(lastVersionId ?? '');
  React.useEffect(() => { loadProfiles(versionId); setActiveProfile(''); setNewProfile(''); }, [versionId]);

  function fmtSize(b: number): string {
    if (b < 1024) return b + ' ' + t('size.b');
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' ' + t('size.kb');
    if (b < 1024 ** 3) return (b / (1024 * 1024)).toFixed(1) + ' ' + t('size.mb');
    return (b / (1024 ** 3)).toFixed(2) + ' ' + t('size.gb');
  }

  // Available versions: loader absorbs vanilla, so if a loader exists
  // for the base MC — keep only the loader (as in Installed).
  const availableVersions = useMemo(() => {
    const moddedBases = new Set(details.filter((d) => d.loader).map((d) => d.baseMc));
    return details.filter((d) => d.loader || !moddedBases.has(d.id));
  }, [details]);

  // Load installed versions and pick active one if needed
  useEffect(() => {
    let cancelled = false;
    window.api.minecraft.installedDetailed().then((list) => {
      if (cancelled) return;
      setDetails(list);
      const ids = new Set(list.map((d) => d.id));
      if (!ids.has(versionId)) {
        const moddedBases = new Set(list.filter((d) => d.loader).map((d) => d.baseMc));
        const filtered = list.filter((d) => d.loader || !moddedBases.has(d.id));
        const last = lastVersionId && ids.has(lastVersionId)
          ? list.find((d) => d.id === lastVersionId)
          : null;
        const pick =
          (last && filtered.includes(last) ? last : null) ??
          filtered[0] ??
          list[0] ??
          null;
        // Если среди установленных версий нет текущей (в т.ч. список пуст) —
        // сбрасываем выбор, чтобы не показывать фантомную версию из настроек.
        setVersionId(pick ? pick.id : '');
      }
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentDetail = details.find((d) => d.id === versionId) ?? null;
  const isBedrock = currentDetail?.edition === 'bedrock';
  const effectiveTab = isBedrock && tab === 'shader' ? 'mod' : tab;
  const Icon = KindIcon[effectiveTab];
  const noVersionPicked = !versionId || !currentDetail;
  const tabLabel = t(isBedrock ? BEDROCK_LABEL_KEY[effectiveTab] : TAB_LABEL_KEY[effectiveTab]);
  const placeholderHint = t(isBedrock ? BEDROCK_HINT_KEY[effectiveTab] : HINT_KEY[effectiveTab]);
  const totalSize = items.reduce((acc, it) => acc + it.size, 0);

  useEffect(() => {
    if (isBedrock && tab === 'shader') setTab('mod');
  }, [isBedrock, tab]);

  const aliveRef = React.useRef(true);
  React.useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);
  const refresh = async () => {
    if (!versionId) { setItems([]); return; }
    setLoading(true);
    setError(null);
    try {
      const list = await window.api.content.list(effectiveTab, versionId, currentDetail?.edition);
      if (aliveRef.current) setItems(list);
    } catch (e) {
      if (aliveRef.current) setError((e as Error).message);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!versionId) { setItems([]); return; }
      setLoading(true);
      try {
        const list = await window.api.content.list(effectiveTab, versionId, currentDetail?.edition);
        if (!cancelled) setItems(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveTab, versionId, currentDetail?.edition]);

  const onAdd = async () => {
    if (!versionId) return;
    const res = await window.api.content.add(effectiveTab, versionId, currentDetail?.edition);
    if (res.copied > 0) {
      const files = t.plural(res.copied, t('plural.file.one'), t('plural.file.few'), t('plural.file.many'));
      setStatus(t('content.statusAdded', { count: String(res.copied), files }));
      refresh();
    } else if (res.errors.length > 0) {
      setStatus(t('content.statusErrors', { errors: res.errors.join('; ') }));
    }
  };

  const onDelete = async (it: ContentItem) => {
    if (!versionId) return;
    const choice = await dlg.show({
      title: t('content.deleteTitle', { name: it.displayName }),
      tone: 'danger',
      message: t('content.deleteMessage'),
      buttons: [
        { label: t('content.deleteCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('content.deleteConfirm'), value: 'ok', variant: 'danger' },
      ],
      defaultIndex: 0,
      cancelValue: 'cancel',
    });
    if (choice !== 'ok') return;
    const ok = await window.api.content.delete(effectiveTab, it.name, versionId, currentDetail?.edition);
    if (ok) {
      setStatus(t('content.statusDeleted', { name: it.displayName }));
      refresh();
    }
  };

  const onToggle = async (it: ContentItem) => {
    if (!versionId) return;
    const ok = await window.api.content.toggle(effectiveTab, it.name, versionId, currentDetail?.edition);
    if (ok) {
      setStatus(it.enabled
        ? t('content.statusDisabled', { name: it.displayName })
        : t('content.statusEnabled', { name: it.displayName }));
      refresh();
    }
  };


  const onInstallToBedrock = async (it: ContentItem) => {
    if (!versionId) return;
    setStatus(t('content.installingToBedrock', { name: it.meta?.title || it.displayName }));
    try {
      const res = await window.api.content.installToBedrock(effectiveTab, it.name, versionId);
      setStatus(t('content.installedToBedrock', { serial: res.serial, target: res.target }));
    } catch (e) {
      setStatus(t('content.installToBedrockFailed', { message: (e as Error).message }));
    }
  };


  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">{t('content.eyebrow')}</span>
        <h1 className="page-title">{t('content.title')}</h1>
        <p className="page-sub">{t('content.subtitle')}</p>
      </div>

      {/* Version picker */}
      <div className="vpick" id="vpick">
        <button className="vpick-btn" onClick={() => { const el = document.getElementById('vpick'); if (el) el.classList.toggle('open'); }}>
          <span className="vpick-cube"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg></span>
          <span className="vpick-info">
            <b id="vpickName">{versionId || t('common.noVersions')}</b>
            <span id="vpickSub">{currentDetail ? `${currentDetail.loader ? loaderLabel[currentDetail.loader] + ' · ' : ''}${currentDetail.id}` : ''}</span>
          </span>
          <svg className="vpick-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div className="vpick-panel">
          {availableVersions.length === 0 && <div className="vpick-empty">{t('common.noVersions')}</div>}
          {availableVersions.map((d) => (
            <button key={d.id} className={'vpick-item' + (versionId === d.id ? ' sel' : '') + (d.loader ? ' modded' : '')} onClick={() => { setVersionId(d.id); onPickVersion(d.id); const el = document.getElementById('vpick'); if (el) el.classList.remove('open'); }}>
              <span className="vi-cube"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg></span>
              <span className="vi-body"><b>{prettyVersionName(d)}</b><span>{d.id}</span></span>
              <svg className="vi-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="m5 12 5 5 9-11"/></svg>
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div className="drop-hint"><b>{t('content.dropHintTitle')}</b> {t('content.dropHintText')} <span style={{ textDecoration: 'underline' }}>{t('content.dropHintChoose')}</span>.</div>

      {/* Filters */}
      <div className="cfilters">
        {TAB_IDS.map(id => {
          const T = KindIcon[id];
          const cnt = items.filter(it => it.kind === id).length;
          return (
            <button key={id} className={'cf' + (tab === id ? ' on' : '')} data-f={id} onClick={() => setTab(id)}>
              <T /> {t(isBedrock ? BEDROCK_LABEL_KEY[id] : TAB_LABEL_KEY[id])} <span className="cnt">{cnt}</span>
            </button>
          );
        })}
        <span className="cf-hint">{t('content.filterHint')}</span>
        {tab === 'mod' && !isBedrock && versionId && (
          <button className="btn ghost sm" onClick={checkUpdates} disabled={checkingUpdates} title={t('content.checkUpdatesHint')}>
            {checkingUpdates ? t('content.checkingUpdates') : t('content.checkUpdates')}
            {Object.keys(modUpdates).length > 0 && ` (${Object.keys(modUpdates).length})`}
          </button>
        )}
      </div>
      {tab === 'mod' && !isBedrock && versionId && (
        <div className="prow" style={{ gap: 8, marginTop: 8 }}>
          <select
            className="input sm"
            value={activeProfile}
            onChange={(e) => { setActiveProfile(e.target.value); if (e.target.value) applyProfile(e.target.value); }}
            title={t('content.profileHint')}
          >
            <option value="">{t('content.profileNone')}</option>
            {Object.keys(profiles).map((n) => (
              <option key={n} value={n}>{n} ({profiles[n].length})</option>
            ))}
          </select>
          <input
            className="input sm"
            style={{ maxWidth: 170 }}
            placeholder={t('content.profileNamePh')}
            value={newProfile}
            onChange={(e) => setNewProfile(e.target.value)}
            maxLength={64}
          />
          <button className="btn ghost sm" onClick={saveProfile} disabled={!newProfile.trim()}>{t('content.profileSave')}</button>
          {activeProfile && (
            <button className="btn ghost sm" onClick={() => deleteProfile(activeProfile)}>{t('content.profileDelete')}</button>
          )}
        </div>
      )}

      {/* Content grid */}
      {noVersionPicked ? (
        <div className="content-empty">
          <div className="content-empty-icon"><IconCube /></div>
          <h2>{t('content.noVersionPicked')}</h2>
          <p>{t('content.noVersionPickedHint')}</p>
        </div>
      ) : (
        <>
          <div className="content-toolbar">
            <button className="btn primary" onClick={onAdd}>{t('content.addFiles')}</button>
            <button className="btn" onClick={() => window.api.content.openFolder(effectiveTab, versionId, currentDetail?.edition)}><IconFolder /> {t('content.openFolder')}</button>
            <button className="btn ghost sm" onClick={refresh} disabled={loading}><IconRefresh /> {t('content.refresh')}</button>
            <div className="spacer" />
            <span className="muted content-file-summary">{t('content.fileSummary', { count: String(items.length), files: t.plural(items.length, t('plural.file.one'), t('plural.file.few'), t('plural.file.many')), size: fmtSize(totalSize) })}</span>
          </div>

          {status && <div className="hint" style={{ marginBottom: 10 }}>{status}</div>}
          {error && <div className="hint" style={{ marginBottom: 10, color: 'var(--warning)' }}>{error}</div>}

          {loading ? (
            <div className="empty">{t('content.loading')}</div>
          ) : items.length === 0 ? (
            <div className="content-empty">
              <div className="content-empty-icon"><Icon /></div>
              <h2>{t('content.emptyTitle')}</h2>
              <p>{t('content.emptyHint', { folder: tabLabel.toLowerCase() })}<br />{placeholderHint}</p>
            </div>
          ) : (
            <div className="c-grid">
              {items.map(it => {
                const ItemIcon = KindIcon[effectiveTab];
                const isOff = !it.enabled;
                return (
                  <div key={it.name} className={'ccard' + (isOff ? ' off' : '')}>
                    <div className="c-top">
                      <div className={'c-ico' + (it.kind === 'mod' ? ' mod' : it.kind === 'shader' ? ' shader' : it.kind === 'resourcepack' || it.kind === 'texturepack' ? ' pack' : '')}>
                        <ItemIcon />
                      </div>
                      <div className="c-name"><b>{it.meta?.title || it.displayName}</b><span>{it.name}</span></div>
                      <label className="toggle"><input type="checkbox" checked={!isOff} onChange={() => onToggle(it)} /><span className="track" /></label>
                    </div>
                    <div className="c-desc">{it.description || ''}</div>
                    {it.kind === 'mod' && modUpdates[it.name] && (
                      <div className="cupd">
                        <span className="chip green">{t('content.updateAvailable', { ver: modUpdates[it.name].latest })}</span>
                        {modUpdates[it.name].current && <span className="hint">{modUpdates[it.name].current} → {modUpdates[it.name].latest}</span>}
                        <button className="btn primary sm" disabled={!!updatingFile} onClick={() => applyUpdate(it.name)}>
                          {updatingFile === it.name ? t('content.updating') : t('content.updateBtn')}
                        </button>
                      </div>
                    )}
                    <div className="c-foot">
                      {it.kind === 'mod' && <span className="chip amber">{it.meta?.loader || 'mod'}</span>}
                      {it.kind === 'shader' && <span className="chip cyan">{t('content.chipShader')}</span>}
                      {(it.kind === 'resourcepack' || it.kind === 'texturepack') && <span className="chip purple">{t('content.chipResourcepack')}</span>}
                      <span className="size">{fmtSize(it.size)}</span>
                    </div>
                    {it.meta?.warnings?.length ? (
                      <div className="cwarn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>{it.meta.warnings[0]}</div>
                    ) : null}
                    <div className="content-actions" style={{ marginTop: 8 }}>
                      {isBedrock && (
                        <button className="icon-btn" onClick={() => onInstallToBedrock(it)} title={t('content.installToBedrock')}><IconSpark /></button>
                      )}
                      <button className="icon-btn" onClick={() => onDelete(it)} title={t('content.deleteBtn')}><IconTrash /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      <p className="note">{t('content.note')}</p>
    </div>
  );
};
