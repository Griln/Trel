import React, { useCallback, useEffect, useState } from 'react';
import { IconRefresh, IconFolder, IconInfo } from '../components/icons';
import { useDialog } from '../components/Dialog';
import { useT } from '../i18n';

type ImportSource = {
  id: string; label: string; rootDir: string;
  available: string[]; approxSize: number; kind?: string;
  installableVersions?: string[];
  mojangOnlyBedrock?: boolean;
};
type ImportReport = {
  copied: Partial<Record<string, number>>;
  skipped?: Partial<Record<string, number>>;
  newAccounts: string[];
  installedVersions?: string[];
  errors: string[];
};

function formatImportSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes > 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function importCategoryLabel(t: (k: string) => string, cat: string): string {
  switch (cat) {
    case 'accounts': return t('settings.importAccounts');
    case 'worlds': return t('settings.importWorlds');
    case 'mods': return t('settings.importMods');
    case 'shaderpacks': return t('settings.importShaderpacks');
    case 'resourcepacks': return t('settings.importResourcepacks');
    case 'texturepacks': return t('settings.importTexturepacks');
    case 'servers': return t('import.catServers');
    case 'screenshots': return t('import.catScreenshots');
    case 'options': return t('import.catOptions');
    case 'config': return t('import.catConfig');
    case 'datapacks': return t('import.catDatapacks');
    case 'stats': return t('import.catStats');
    case 'advancements': return t('import.catAdvancements');
    case 'logs': return t('import.catLogs');
    case 'scripts': return t('import.catScripts');
    case 'defaultconfigs': return t('import.catDefaultconfigs');
    case 'backups': return t('import.catBackups');
    case 'local': return t('import.catLocal');
    case 'usercache': return t('import.catUsercache');
    case 'world_templates': return t('import.catWorldTemplates');
    case 'resources': return t('import.catResources');
    case 'pin': return t('import.catPin');
    case 'version-content': return t('import.catVersionContent');
    case 'pack-meta': return t('import.catPackMeta');
    case 'log-configs': return t('import.catLogConfigs');
    case 'version-install': return t('import.catVersionInstall');
    case 'assets': return t('import.catAssets');
    case 'libraries': return t('import.catLibraries');
    case 'skin-cache': return t('import.catSkins');
    default: return cat;
  }
}

const LAUNCHER_CATS = ['accounts', 'worlds', 'mods', 'shaderpacks', 'resourcepacks', 'texturepacks',
  'servers', 'screenshots', 'options', 'config', 'datapacks', 'stats', 'advancements',
  'logs', 'scripts', 'defaultconfigs', 'backups', 'local',
  'usercache', 'world_templates', 'resources', 'pin', 'version-content', 'pack-meta', 'log-configs', 'version-install'];
const CACHE_CATS = ['assets', 'libraries', 'skin-cache'];

export const ImportPage: React.FC = () => {
  const dlg = useDialog();
  const t = useT();

  const [importSources, setImportSources] = useState<ImportSource[]>([]);
  const [importChecked, setImportChecked] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [versionProgress, setVersionProgress] = useState<string | null>(null);

  const [customDir, setCustomDir] = useState('');
  const [customSource, setCustomSource] = useState<ImportSource | null>(null);
  const [customDetecting, setCustomDetecting] = useState(false);

  const [selectionSource, setSelectionSource] = useState<ImportSource | null>(null);
  const [selectionCats, setSelectionCats] = useState<Record<string, boolean>>({});
  const [deduplicate, setDeduplicate] = useState(true);

  useEffect(() => {
    let cancelled = false;
    window.api.importer.detect()
      .then((list) => { if (!cancelled) setImportSources(list as ImportSource[]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setImportChecked(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const unsub = window.api.importer.onProgress((p) => {
      setImportProgress({ current: p.current, total: p.total });
      setVersionProgress(p.stage || null);
    });
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!customDir) { setCustomSource(null); return; }
      setCustomSource(null);
      setCustomDetecting(true);
      try {
        const result = await window.api.importer.detectFromDir(customDir);
        if (!cancelled) setCustomSource(result as ImportSource | null);
      } catch { if (!cancelled) setCustomSource(null); }
      finally { if (!cancelled) setCustomDetecting(false); }
    })();
    return () => { cancelled = true; };
  }, [customDir]);

  const refreshImportSources = async () => {
    setImportChecked(false);
    try {
      setImportSources((await window.api.importer.detect()) as ImportSource[]);
    } finally { setImportChecked(true); }
  };

  const openImportSelection = (source: ImportSource) => {
    const sel: Record<string, boolean> = {};
    for (const cat of source.available) sel[cat] = true;
    setSelectionCats(sel);
    setSelectionSource(source);
  };

  const confirmAndImport = async () => {
    if (!selectionSource) return;
    const selCats = Object.entries(selectionCats).filter(([, v]) => v).map(([k]) => k);
    if (selCats.length === 0) return;
    const source = selectionSource;
    setSelectionSource(null);

    const choice = await dlg.show({
      title: t('settings.importConfirmTitle', { name: source.label }),
      tone: 'info',
      message: (
        <div style={{ display: 'grid', gap: 10 }}>
          <div>{t('import.confirmMsg')}</div>
          <div className="mono" style={{ fontSize: 12, opacity: 0.75, wordBreak: 'break-all' }}>{source.rootDir}</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {selCats.map((cat) => <span key={cat} className="chip">{importCategoryLabel(t, cat)}</span>)}
          </div>
          {selCats.includes('version-install') && source.installableVersions && (
            <div className="hint">
              {t('import.versionInstallHint', { count: source.installableVersions.length })}
              {': ' + source.installableVersions.slice(0, 10).join(', ')}
              {source.installableVersions.length > 10 ? '…' : ''}
            </div>
          )}
          <label className="toggle-row" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={deduplicate} onChange={(e) => setDeduplicate(e.target.checked)} />
              <span>{t('import.deduplicate')}</span>
            </div>
          </label>
          {selCats.includes('accounts') && <div className="hint">{t('settings.importAccountsHint')}</div>}
          {source.kind === 'bedrock' && <div className="hint">{t('import.bedrockHint')}</div>}
          <div className="hint" style={{ color: 'var(--warn)' }}>{t('import.antivirusHint')}</div>
        </div>
      ),
      buttons: [
        { label: t('settings.importCancel'), value: 'cancel', variant: 'ghost' },
        { label: t('import.importBtn'), value: 'go', variant: 'primary' },
      ],
      defaultIndex: 1,
      cancelValue: 'cancel',
    });
    if (choice !== 'go') return;

    setImporting(source.id);
    const versionCount = selCats.includes('version-install') && source.installableVersions
      ? source.installableVersions.length : 0;
    const initTotal = selCats.length + (versionCount > 0 ? versionCount - 1 : 0);
    setImportProgress({ current: 0, total: Math.max(initTotal, 1) });
    setVersionProgress(null);
    try {
      const report = (await window.api.importer.perform({
        sourceId: source.id, sourceRootDir: source.rootDir, categories: selCats, deduplicate,
      })) as ImportReport;
      setImportProgress(null);
      setVersionProgress(null);
      const parts = Object.entries(report.copied).filter(([, n]) => !!n).map(([cat, n]) => `${importCategoryLabel(t, cat)}: ${n}`);
      const skippedParts = Object.entries(report.skipped ?? {}).filter(([, n]) => !!n).map(([cat, n]) => `${importCategoryLabel(t, cat)}: ${n} ${t('import.skipped')}`);
      if (report.newAccounts.length) parts.push(`${t('settings.importAccounts')}: ${report.newAccounts.join(', ')}`);
      if (report.installedVersions?.length) parts.push(`${t('import.catVersionInstall')}: ${report.installedVersions.join(', ')}`);
      await dlg.show({
        title: t('settings.importDoneTitle'),
        tone: report.errors.length ? 'warn' : 'info',
        message: (
          <div style={{ display: 'grid', gap: 8 }}>
            <div>{parts.length ? parts.join(' · ') : t('settings.importNothingCopied')}</div>
            {skippedParts.length > 0 && <div className="hint">{skippedParts.join(' · ')}</div>}
            {report.errors.length > 0 && <div className="hint">{t('settings.importErrors', { count: report.errors.length })}</div>}
          </div>
        ),
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }],
        defaultIndex: 0,
        cancelValue: 'ok',
      });
      await refreshImportSources();
    } finally { setImporting(null); }
  };

  const pickCustomDir = async () => {
    const dir = await window.api.settings.pickDir();
    if (dir) setCustomDir(dir);
  };

  const allSources = [
    ...importSources,
    ...(customSource && !importSources.find(s => s.id === customSource.id && s.rootDir === customSource.rootDir)
      ? [customSource] : []),
  ];

  return (
    <div>
      <div className="page-head">
        <h1>{t('import.title')}</h1>
        <p>{t('import.subtitle')}</p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{t('import.launchersTitle')}</h2>
          <button className="btn ghost sm" onClick={refreshImportSources} disabled={!importChecked}>
            <IconRefresh /> {t('import.refresh')}
          </button>
        </div>
        <p className="hint">{t('import.launchersHint')}</p>

        {!importChecked && importSources.length === 0 ? (
          <div className="empty" style={{ padding: 18 }}>{t('import.scanning')}</div>
        ) : null}

        {importChecked && importSources.length === 0 && !customSource ? (
          <div className="empty" style={{ padding: 18 }}>{t('import.empty')}</div>
        ) : null}

        {allSources.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {allSources.map((source) => (
              <div key={source.id + ':' + source.rootDir} className="java-row" title={source.rootDir}>
                <div className="java-row-main">
                  <div className="java-row-head">
                    <span>{source.label}</span>
                    {!source.mojangOnlyBedrock && <span className="chip mono">{formatImportSize(source.approxSize)}</span>}
                    {source.kind === 'bedrock' && <span className="chip" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Bedrock</span>}
                  </div>
                  <div className="java-row-path">{source.rootDir}</div>
                  {!source.mojangOnlyBedrock && (
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {source.available.map((cat) => (
                        <span key={cat} className="chip">{importCategoryLabel(t, cat)}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button className="btn primary sm" onClick={() => openImportSelection(source)} disabled={importing === source.id || !!source.mojangOnlyBedrock}>
                  {importing === source.id ? t('import.importing') : t('import.importBtn')}
                </button>
              </div>
            ))}
          </div>
        )}

        {importProgress && importing && (
          <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>{versionProgress || t('import.importing')}</span>
              <span>{importProgress.current} / {importProgress.total}</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min((importProgress.current / importProgress.total) * 100, 100)}%`,
                height: '100%',
                background: 'var(--accent)',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div className="field">
            <label>{t('import.customLabel')}</label>
            <div className="row">
              <input className="input mono" value={customDir} onChange={(e) => setCustomDir(e.target.value)} placeholder={t('import.customPlaceholder')} />
              <button className="btn ghost" onClick={pickCustomDir}><IconFolder /> {t('import.customBrowse')}</button>
            </div>
            {customDetecting && <div className="hint" style={{ marginTop: 4 }}>{t('import.scanning')}</div>}
            {!customDetecting && customDir && !customSource && (
              <div className="hint" style={{ marginTop: 4, color: 'var(--warn)' }}>{t('import.customEmpty')}</div>
            )}
          </div>
        </div>
      </div>

      {selectionSource && (
        <div className="dialog-backdrop" onClick={() => setSelectionSource(null)}>
          <div className="dialog info" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-icon"><IconInfo /></div>
            <div className="dialog-body">
              <h3 className="dialog-title">{t('import.selectTitle', { name: selectionSource.label })}</h3>
              <div className="dialog-msg">
                {selectionSource.mojangOnlyBedrock ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div className="mono" style={{ fontSize: 12, opacity: 0.75, wordBreak: 'break-all' }}>{selectionSource.rootDir}</div>
                    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,50,50,0.12)', border: '1px solid rgba(220,50,50,0.3)', color: '#e55', fontSize: 13 }}>
                      {t('import.mojangOnlyBedrock')}
                    </div>
                  </div>
                ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div>{t('import.selectMsg')}</div>
                  <div className="mono" style={{ fontSize: 12, opacity: 0.75, wordBreak: 'break-all' }}>{selectionSource.rootDir}</div>
                  {LAUNCHER_CATS
                    .filter((cat) => selectionSource.available.includes(cat))
                    .map((cat) => (
                      <label key={cat} className="toggle-row" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="checkbox" checked={!!selectionCats[cat]} onChange={(e) => setSelectionCats((prev) => ({ ...prev, [cat]: e.target.checked }))} />
                          <span>{importCategoryLabel(t, cat)}</span>
                        </div>
                        {cat === 'version-install' && selectionSource.installableVersions && (
                          <span className="chip mono" style={{ fontSize: 11 }}>{selectionSource.installableVersions.length}</span>
                        )}
                      </label>
                    ))}
                  {CACHE_CATS.some(c => selectionSource.available.includes(c)) &&
                    selectionSource.kind !== 'bedrock' && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>
                      {t('import.cacheSection')}
                    </div>
                  )}
                  {CACHE_CATS
                    .filter((cat) => selectionSource.available.includes(cat) && selectionSource.kind !== 'bedrock')
                    .map((cat) => (
                      <label key={cat} className="toggle-row" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="checkbox" checked={!!selectionCats[cat]} onChange={(e) => setSelectionCats((prev) => ({ ...prev, [cat]: e.target.checked }))} />
                          <span>{importCategoryLabel(t, cat)}</span>
                        </div>
                      </label>
                    ))}
                  {selectionSource.available.includes('accounts') && <div className="hint">{t('settings.importAccountsHint')}</div>}
                  {selectionSource.kind === 'bedrock' && <div className="hint">{t('import.bedrockHint')}</div>}
                </div>
                )}
              </div>
              <div className="dialog-actions">
                <button className="btn ghost" onClick={() => setSelectionSource(null)}>{t('settings.importCancel')}</button>
                <button className="btn primary" onClick={confirmAndImport} disabled={!Object.values(selectionCats).some(Boolean)}>
                  {t('import.importBtn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
