import React, { useEffect, useMemo, useState } from 'react';
import type { ContentItem, ContentKind, InstalledVersionDetail, LoaderType } from '../../preload/preload';
import {
  IconCube, IconFolder, IconTrash, IconCheck, IconAlert, IconRefresh, IconArchive, IconSpark,
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

const IconInfoLocal: React.FC<any> = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const HINT_KEY: Record<ContentKind, string> = {
  mod: 'content.hintMod',
  shader: 'content.hintShader',
  resourcepack: 'content.hintResourcepack',
  texturepack: 'content.hintTexturepack',
};

const BEDROCK_TAB_IDS: ContentKind[] = ['mod', 'resourcepack', 'texturepack'];

function bedrockLabel(kind: ContentKind, locale: string): string {
  const ru = locale === 'ru';
  if (kind === 'mod') return ru ? 'Аддоны' : 'Add-ons';
  if (kind === 'resourcepack') return ru ? 'Ресурс-паки' : 'Resource packs';
  if (kind === 'texturepack') return ru ? 'Миры' : 'Worlds';
  return ru ? 'Ресурс-паки' : 'Resource packs';
}

function bedrockHint(kind: ContentKind, locale: string): string {
  const ru = locale === 'ru';
  if (kind === 'mod') {
    return ru
      ? 'Bedrock не использует Java .jar-моды. Добавляй .mcaddon/.mcpack или распакованные behavior_packs.'
      : 'Bedrock does not use Java .jar mods. Add .mcaddon/.mcpack files or extracted behavior_packs.';
  }
  if (kind === 'resourcepack') {
    return ru
      ? 'Для Bedrock сюда подходят .mcpack/.zip или распакованные resource_packs.'
      : 'For Bedrock, use .mcpack/.zip files or extracted resource_packs here.';
  }
  return ru
    ? 'Для Bedrock сюда подходят .mcworld/.mctemplate/.zip или распакованные minecraftWorlds.'
    : 'For Bedrock, use .mcworld/.mctemplate/.zip files or extracted minecraftWorlds here.';
}

export const ContentPage: React.FC<Props> = ({ lastVersionId, onPickVersion }) => {
  const t = useT();
  const dlg = useDialog();
  const [tab, setTab] = useState<ContentKind>('mod');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [details, setDetails] = useState<InstalledVersionDetail[]>([]);
  const [versionId, setVersionId] = useState<string>(lastVersionId ?? '');

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
        if (pick) setVersionId(pick.id);
      }
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentDetail = details.find((d) => d.id === versionId) ?? null;
  const isBedrock = currentDetail?.edition === 'bedrock';
  const visibleTabs = isBedrock ? BEDROCK_TAB_IDS : TAB_IDS;
  const effectiveTab = isBedrock && tab === 'shader' ? 'mod' : tab;
  const Icon = KindIcon[effectiveTab];
  const noVersionPicked = !versionId || !currentDetail;
  const isModdable = currentDetail?.edition === 'java' && !!currentDetail?.loader;
  const tabLabel = isBedrock ? bedrockLabel(effectiveTab, t.locale) : t(TAB_LABEL_KEY[effectiveTab]);
  const placeholderHint = isBedrock ? bedrockHint(effectiveTab, t.locale) : t(HINT_KEY[effectiveTab]);
  const totalSize = items.reduce((acc, it) => acc + it.size, 0);

  useEffect(() => {
    if (isBedrock && tab === 'shader') setTab('mod');
  }, [isBedrock, tab]);

  const refresh = async () => {
    if (!versionId) { setItems([]); return; }
    setLoading(true);
    try {
      const list = await window.api.content.list(effectiveTab, versionId, currentDetail?.edition);
      setItems(list);
    } finally {
      setLoading(false);
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
    setStatus(t.locale === 'ru' ? `Устанавливаю в Android: ${it.meta?.title || it.displayName}...` : `Installing to Android: ${it.meta?.title || it.displayName}...`);
    try {
      const res = await window.api.content.installToBedrock(effectiveTab, it.name, versionId);
      setStatus(t.locale === 'ru'
        ? `Установлено в Bedrock (${res.serial}): ${res.target}`
        : `Installed to Bedrock (${res.serial}): ${res.target}`);
    } catch (e) {
      setStatus(t.locale === 'ru'
        ? `Не удалось установить в Bedrock: ${(e as Error).message}`
        : `Failed to install to Bedrock: ${(e as Error).message}`);
    }
  };


  return (
    <div>
      <div className="page-head">
        <h1>{t('content.title')}</h1>
        <p>{t('content.subtitle')}</p>
      </div>

      {/* Version switcher */}
      <div className="content-version-bar">
        <label className="muted" style={{ fontSize: 12, marginRight: 8 }}>
          {t('content.versionLabel')}
        </label>
        <select
          className="select"
          value={versionId}
          onChange={(e) => {
            const id = e.target.value;
            setVersionId(id);
            onPickVersion(id);
          }}
          disabled={availableVersions.length === 0}
          style={{ minWidth: 260 }}
        >
          {availableVersions.length === 0 && (
            <option value="">{t('content.noVersionsInstalled')}</option>
          )}
          {availableVersions.map((d) => (
            <option key={d.id} value={d.id}>{prettyVersionName(d)}</option>
          ))}
        </select>
        {currentDetail && (
          <span className="chip" style={{ marginLeft: 8 }} title={currentDetail.id}>
            {t('content.folderChip', { id: currentDetail.id })}
          </span>
        )}
      </div>

      <div className="content-tabs">
        {visibleTabs.map(id => {
          const T = KindIcon[id];
          return (
            <button
              key={id}
              className={'content-tab' + (tab === id ? ' active' : '')}
              onClick={() => setTab(id)}
            >
              <T />
              <span>{isBedrock ? bedrockLabel(id, t.locale) : t(TAB_LABEL_KEY[id])}</span>
            </button>
          );
        })}
      </div>

      {isBedrock && (
        <div className="content-banner info">
          <div className="content-banner-icon"><IconInfoLocal /></div>
          <div className="content-banner-body">
            <h3>{t.locale === 'ru' ? 'Режим Bedrock-контента' : 'Bedrock content mode'}</h3>
            <p>{t.locale === 'ru'
              ? 'Bedrock использует не Java-моды, а аддоны, behavior packs, resource packs и .mcworld. Шейдеры Java здесь скрыты, потому что они несовместимы с Bedrock/RenderDragon.'
              : 'Bedrock uses add-ons, behavior packs, resource packs and .mcworld files instead of Java mods. Java shaders are hidden because they are not compatible with Bedrock/RenderDragon.'}</p>
          </div>
        </div>
      )}

      {!isBedrock && tab === 'shader' && (
        <div className="content-banner info">
          <div className="content-banner-icon"><IconAlert /></div>
          <div className="content-banner-body">
            <h3>{t('content.shaderBannerTitle')}</h3>
            <p>{t('content.shaderBannerText')}</p>
          </div>
        </div>
      )}

      {!isBedrock && tab === 'texturepack' && (
        <div className="content-banner warn">
          <div className="content-banner-icon"><IconAlert /></div>
          <div className="content-banner-body">
            <h3>{t('content.texturepackBannerTitle')}</h3>
            <p>{t('content.texturepackBannerText')}</p>
          </div>
        </div>
      )}

      {!isBedrock && tab === 'mod' && !isModdable && currentDetail && (
        <div className="content-banner accent">
          <div className="content-banner-icon"><IconInfoLocal /></div>
          <div className="content-banner-body">
            <h3>{t('content.modBannerTitle')}</h3>
            <p>{t('content.modBannerText', { id: currentDetail.id })}</p>
          </div>
        </div>
      )}

      {noVersionPicked ? (
        <div className="content-empty">
          <div className="content-empty-icon"><IconCube /></div>
          <h2>{t('content.noVersionPicked')}</h2>
          <p>{t('content.noVersionPickedHint')}</p>
        </div>
      ) : (
        <>
          <div className="content-toolbar">
            <button className="btn primary" onClick={onAdd}>
              {t('content.addFiles')}
            </button>
            <button className="btn" onClick={() => window.api.content.openFolder(effectiveTab, versionId, currentDetail?.edition)}>
              <IconFolder /> {t('content.openFolder')}
            </button>
            <button className="btn ghost sm" onClick={refresh} disabled={loading}>
              <IconRefresh /> {t('content.refresh')}
            </button>
            <div className="spacer" />
            <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
              {t('content.fileSummary', {
                count: String(items.length),
                files: t.plural(items.length, t('plural.file.one'), t('plural.file.few'), t('plural.file.many')),
                size: fmtSize(totalSize),
              })}
            </span>
          </div>

          {status && <div className="hint" style={{ marginBottom: 10 }}>{status}</div>}

          {loading ? (
            <div className="empty">{t('content.loading')}</div>
          ) : items.length === 0 ? (
            <div className="content-empty">
              <div className="content-empty-icon"><Icon /></div>
              <h2>{t('content.emptyTitle')}</h2>
              <p>{t('content.emptyHint', { folder: tabLabel.toLowerCase() })}<br />{placeholderHint}</p>
            </div>
          ) : (
            <div className="content-grid">
              {items.map(it => {
                const ItemIcon = KindIcon[effectiveTab];
                return (
                  <div key={it.name} className={'content-card' + (it.enabled ? '' : ' disabled')}>
                    <div className="content-icon"><ItemIcon /></div>
                    <div className="content-body">
                      <div className="content-name" title={it.name}>{it.meta?.title || it.displayName}</div>
                      <div className="content-meta">
                        <span className="chip">{fmtSize(it.size)}</span>
                        {it.meta?.loader && <span className="chip">{it.meta.loader}</span>}
                        {it.meta?.version && <span className="chip mono">v{it.meta.version}</span>}
                        {it.isFolder && <span className="chip">{t('content.chipFolder')}</span>}
                        {!it.enabled && <span className="chip warn">{t('content.chipDisabled')}</span>}
                        {it.meta?.warnings?.length ? <span className="chip warn">{it.meta.warnings.length} warn</span> : null}
                      </div>
                      {it.meta?.authors?.length ? <div className="content-subtle">{it.meta.authors.slice(0, 3).join(', ')}</div> : null}
                      {it.meta?.warnings?.length ? <div className="content-warnings">{it.meta.warnings.map((w) => <div key={w}>⚠ {w}</div>)}</div> : null}
                    </div>
                    <div className="content-actions">
                      {!isBedrock && effectiveTab === 'mod' && (
                        <button
                          className="icon-btn"
                          onClick={() => onToggle(it)}
                          title={it.enabled ? t('content.toggleDisable') : t('content.toggleEnable')}
                        >
                          {it.enabled ? <IconCheck /> : <IconAlert />}
                        </button>
                      )}
                      {isBedrock && (
                        <button
                          className="icon-btn"
                          onClick={() => onInstallToBedrock(it)}
                          title={t.locale === 'ru' ? 'Установить в Android / TrelEmu' : 'Install to Android / TrelEmu'}
                        >
                          <IconSpark />
                        </button>
                      )}
                      <button
                        className="icon-btn"
                        onClick={() => onDelete(it)}
                        title={t('content.deleteBtn')}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
