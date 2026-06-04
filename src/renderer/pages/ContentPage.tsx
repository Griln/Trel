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

  const refresh = async () => {
    if (!versionId) { setItems([]); return; }
    setLoading(true);
    try {
      const list = await window.api.content.list(tab, versionId);
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
        const list = await window.api.content.list(tab, versionId);
        if (!cancelled) setItems(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, versionId]);

  const onAdd = async () => {
    if (!versionId) return;
    const res = await window.api.content.add(tab, versionId);
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
    const ok = await window.api.content.delete(tab, it.name, versionId);
    if (ok) {
      setStatus(t('content.statusDeleted', { name: it.displayName }));
      refresh();
    }
  };

  const onToggle = async (it: ContentItem) => {
    if (!versionId) return;
    const ok = await window.api.content.toggle(tab, it.name, versionId);
    if (ok) {
      setStatus(it.enabled
        ? t('content.statusDisabled', { name: it.displayName })
        : t('content.statusEnabled', { name: it.displayName }));
      refresh();
    }
  };

  const tabLabel = t(TAB_LABEL_KEY[tab]);
  const totalSize = items.reduce((acc, it) => acc + it.size, 0);
  const Icon = KindIcon[tab];
  const currentDetail = details.find((d) => d.id === versionId) ?? null;
  const noVersionPicked = !versionId || !currentDetail;
  const isModdable = !!currentDetail?.loader;

  const placeholderHint = t(HINT_KEY[tab]);

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
        {TAB_IDS.map(id => {
          const T = KindIcon[id];
          return (
            <button
              key={id}
              className={'content-tab' + (tab === id ? ' active' : '')}
              onClick={() => setTab(id)}
            >
              <T />
              <span>{t(TAB_LABEL_KEY[id])}</span>
            </button>
          );
        })}
      </div>

      {tab === 'shader' && (
        <div className="content-banner info">
          <div className="content-banner-icon"><IconAlert /></div>
          <div className="content-banner-body">
            <h3>{t('content.shaderBannerTitle')}</h3>
            <p>{t('content.shaderBannerText')}</p>
          </div>
        </div>
      )}

      {tab === 'texturepack' && (
        <div className="content-banner warn">
          <div className="content-banner-icon"><IconAlert /></div>
          <div className="content-banner-body">
            <h3>{t('content.texturepackBannerTitle')}</h3>
            <p>{t('content.texturepackBannerText')}</p>
          </div>
        </div>
      )}

      {tab === 'mod' && !isModdable && currentDetail && (
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
            <button className="btn" onClick={() => window.api.content.openFolder(tab, versionId)}>
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
                const ItemIcon = KindIcon[tab];
                return (
                  <div key={it.name} className={'content-card' + (it.enabled ? '' : ' disabled')}>
                    <div className="content-icon"><ItemIcon /></div>
                    <div className="content-body">
                      <div className="content-name" title={it.name}>{it.displayName}</div>
                      <div className="content-meta">
                        <span className="chip">{fmtSize(it.size)}</span>
                        {it.isFolder && <span className="chip">{t('content.chipFolder')}</span>}
                        {!it.enabled && <span className="chip warn">{t('content.chipDisabled')}</span>}
                      </div>
                    </div>
                    <div className="content-actions">
                      {tab === 'mod' && (
                        <button
                          className="icon-btn"
                          onClick={() => onToggle(it)}
                          title={it.enabled ? t('content.toggleDisable') : t('content.toggleEnable')}
                        >
                          {it.enabled ? <IconCheck /> : <IconAlert />}
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
