import React, { useEffect, useState } from 'react';
import { IconRefresh, IconFolder, IconInfo } from '../components/icons';
import { useDialog } from '../components/Dialog';
import { useT } from '../i18n';

type ImportModpack = {
  origin: 'modrinth' | 'curseforge' | 'packwiz' | 'mmc';
  name: string;
  version?: string;
  mc: string;
  loader: 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge';
  loaderVersion?: string;
  fileCount: number;
};
type LauncherTweaks = { maxMemoryMb?: number; minMemoryMb?: number; jvmArgs?: string; javaPath?: string };
type ImportSource = {
  id: string; label: string; rootDir: string;
  available: string[]; approxSize: number; kind?: string;
  installableVersions?: string[];
  mojangOnlyBedrock?: boolean;
  modpack?: ImportModpack;
  launcherTweaks?: LauncherTweaks;
  /** Временная распаковка архива: удалить после импорта (cleanupDir). */
  tmpDir?: string;
};
type ImportReport = {
  copied: Partial<Record<string, number>>;
  skipped?: Partial<Record<string, number>>;
  newAccounts: string[];
  installedVersions?: string[];
  errors: string[];
  warnings?: string[];
  bytesWritten?: number;
  totalMs?: number;
  aborted?: boolean;
  pausedMs?: number;
  savedBytes?: number;
  rolledBackFiles?: number;
  movedSource?: boolean;
  archivedWorlds?: string;
  quarantine?: string[];
  duplicateMods?: string[];
  authServers?: string[];
  logPath?: string;
};
type ImportServer = { name: string; ip: string };
type ImportPreview = {
  files: Partial<Record<string, number>>;
  bytes: Partial<Record<string, number>>;
  totalFiles: number;
  totalBytes: number;
  freeBytes: number;
  freeSpaceUnknown: boolean;
  notEnoughSpace: boolean;
  versions: string[];
  warnings: string[];
  servers?: ImportServer[];
  diff?: { fresh: number; overwrite: number; identical: number };
  savedBytesEstimate?: number;
  etaSecondsEstimate?: number;
  fileTree?: Array<{ path: string; bytes: number }>;
};
type LastImportInfo = {
  at: number;
  sourceId: string;
  categories: string[];
  copiedFiles: number;
  aborted: boolean;
  hardlinks: boolean;
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
    case 'schematics': return t('import.catSchematics');
    case 'replays': return t('import.catReplays');
    case 'minimap': return t('import.catMinimap');
    case 'coremods': return t('import.catCoremods');
    case 'openloader': return t('import.catOpenloader');
    case 'debug': return t('import.catDebug');
    case 'behaviorpacks': return t('import.catBehaviorpacks');
    case 'skinpacks': return t('import.catSkinpacks');
    default: return cat;
  }
}

/**
 * Порядок категорий в диалоге выбора. Кэш (assets/libraries/skin-cache) идёт
 * последним: он крупный, но переносить его не обязательно — Trel докачает
 * ассеты сам. Раньше эти категории детектились, но в списке отсутствовали:
 * карточка источника показывала их объём, а перенести было нельзя.
 */
const LAUNCHER_CATS = ['accounts', 'worlds', 'mods', 'coremods', 'shaderpacks', 'resourcepacks', 'texturepacks',
  'servers', 'screenshots', 'options', 'config', 'datapacks', 'stats', 'advancements',
  'logs', 'debug', 'scripts', 'openloader', 'schematics', 'minimap', 'replays', 'defaultconfigs', 'backups', 'local',
  'usercache', 'world_templates', 'resources', 'pin', 'version-content', 'pack-meta', 'log-configs', 'version-install',
  'behaviorpacks', 'skinpacks',
  'assets', 'libraries', 'skin-cache'];

/**
 * Кэш по умолчанию не отмечаем: это десятки тысяч файлов и гигабайты, которые
 * лаунчер умеет скачать сам. Пользователь включит осознанно, если хочет
 * сэкономить трафик.
 */
const CACHE_CATS = new Set(['assets', 'libraries', 'skin-cache']);

function formatSpeed(bytesPerSecond: number): string {
  return (bytesPerSecond / 1024 / 1024).toFixed(1);
}

function formatAgo(t: (k: string, p?: Record<string, string | number>) => string, at: number): string {
  const mins = Math.max(1, Math.round((Date.now() - at) / 60000));
  if (mins < 60) return t('import.agoMinutes', { count: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t('import.agoHours', { count: hours });
  return t('import.agoDays', { count: Math.round(hours / 24) });
}

export const ImportPage: React.FC = () => {
  const dlg = useDialog();
  const t = useT();

  const [importSources, setImportSources] = useState<ImportSource[]>([]);
  const [importChecked, setImportChecked] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; bytes?: number; bytesPerSecond?: number; etaSeconds?: number; currentFile?: string; paused?: boolean; queueSource?: string } | null>(null);
  const [versionProgress, setVersionProgress] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [lastImport, setLastImport] = useState<LastImportInfo | null>(null);

  const [customDir, setCustomDir] = useState('');
  const [customSource, setCustomSource] = useState<ImportSource | null>(null);
  const [customDetecting, setCustomDetecting] = useState(false);

  const [selectionSource, setSelectionSource] = useState<ImportSource | null>(null);
  const [selectionCats, setSelectionCats] = useState<Record<string, boolean>>({});
  const [deduplicate, setDeduplicate] = useState(true);
  const [useHardlinks, setUseHardlinks] = useState(false);
  const [skipSecrets, setSkipSecrets] = useState(false);
  const [moveSource, setMoveSource] = useState(false);
  const [archiveWorlds, setArchiveWorlds] = useState(false);
  const [paused, setPaused] = useState(false);
  const [queue, setQueue] = useState<Array<{ source: ImportSource; categories: string[] }>>([]);
  const [showTree, setShowTree] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [installingModpack, setInstallingModpack] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.api.importer.detect()
      .then((list) => { if (!cancelled) setImportSources(list as ImportSource[]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setImportChecked(true); });
    // Манифест прошлого импорта: без него пользователь не помнит, переносил
    // он уже эту сборку или нет, и делает второй заход «на всякий случай».
    window.api.importer.lastReport()
      .then((r) => { if (!cancelled) setLastImport(r as LastImportInfo | null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const unsub = window.api.importer.onProgress((p) => {
      setImportProgress({ current: p.current, total: p.total, bytes: p.bytes, bytesPerSecond: p.bytesPerSecond, etaSeconds: p.etaSeconds, currentFile: p.currentFile, paused: p.paused, queueSource: p.queueSource });
      setVersionProgress(p.stage || null);
      setPaused(!!p.paused);
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
    // Кэш не отмечаем по умолчанию — см. CACHE_CATS.
    for (const cat of source.available) sel[cat] = !CACHE_CATS.has(cat);
    setSelectionCats(sel);
    setSelectionSource(source);
    // Предпросмотр относится к конкретному набору категорий — при смене
    // источника старые цифры показывать нельзя.
    setPreview(null);
  };

  const cancelImport = async () => {
    setCancelling(true);
    try { await window.api.importer.cancel(); } catch {}
  };
  const togglePause = async () => {
    try {
      if (paused) { await window.api.importer.resume(); setPaused(false); }
      else { await window.api.importer.pause(); setPaused(true); }
    } catch {}
  };
  const rollbackLast = async () => {
    try {
      const n = (await window.api.importer.rollback()) as number;
      await dlg.show({
        title: t('settings.importDoneTitle'), tone: 'info',
        message: t('import.rollbackDone', { count: n }),
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }],
        defaultIndex: 0, cancelValue: 'ok',
      });
      await refreshImportSources();
    } catch (e) { await dlg.show({ title: t('settings.importDoneTitle'), tone: 'warn', message: (e as Error).message, buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' }); }
  };
  const applySourceTweaks = async (source: ImportSource) => {
    try {
      await window.api.importer.applyTweaks({ maxMemoryMb: source.launcherTweaks?.maxMemoryMb, jvmArgs: source.launcherTweaks?.jvmArgs });
      await dlg.show({ title: t('settings.importDoneTitle'), tone: 'info', message: t('import.tweaksApplied'),
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' });
    } catch (e) { await dlg.show({ title: t('settings.importDoneTitle'), tone: 'warn', message: (e as Error).message, buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' }); }
  };

  const selectedCats = Object.entries(selectionCats).filter(([, v]) => v).map(([k]) => k);

  const calcPreview = async () => {
    if (!selectionSource) return;
    setPreviewing(true);
    try {
      const p = (await window.api.importer.preview({
        sourceId: selectionSource.id, sourceRootDir: selectionSource.rootDir,
        categories: selectedCats, deduplicate, useHardlinks,
      })) as ImportPreview;
      setPreview(p);
    } catch {
      setPreview(null);
    } finally { setPreviewing(false); }
  };

  /**
   * Ставит распознанную сборку штатным механизмом Trel вместо копирования
   * файлов: полученная версия остаётся обновляемой из лаунчера.
   */
  const installDetectedModpack = async (source: ImportSource) => {
    const mp = source.modpack;
    if (!mp) return;
    setInstallingModpack(true);
    try {
      const res = await window.api.modpacks.installFromProfile({
        mc: mp.mc, loader: mp.loader, loaderVersion: mp.loaderVersion, name: mp.name,
      });
      await dlg.show({
        title: t('settings.importDoneTitle'),
        tone: 'info',
        message: t('import.modpackDone', { id: res.versionId }),
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }],
        defaultIndex: 0, cancelValue: 'ok',
      });
    } catch (e) {
      await dlg.show({
        title: t('settings.importDoneTitle'),
        tone: 'warn',
        message: (e as Error).message,
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }],
        defaultIndex: 0, cancelValue: 'ok',
      });
    } finally { setInstallingModpack(false); }
  };

  const confirmAndImport = async () => {
    if (!selectionSource) return;
    const selCats = selectedCats;
    if (selCats.length === 0) return;
    const source = selectionSource;

    // Считаем объём заранее: нехватку места лучше увидеть до старта, а не
    // получить ENOSPC посреди копирования десятков гигабайт.
    let pre = preview;
    if (!pre) {
      try {
        pre = (await window.api.importer.preview({
          sourceId: source.id, sourceRootDir: source.rootDir,
          categories: selCats, deduplicate, useHardlinks,
        })) as ImportPreview;
        setPreview(pre);
      } catch { pre = null; }
    }
    setSelectionSource(null);

    const choice = await dlg.show({
      title: t('settings.importConfirmTitle', { name: source.label }),
      tone: pre?.notEnoughSpace ? 'warn' : 'info',
      message: (
        <div style={{ display: 'grid', gap: 10 }}>
          <div>{t('import.confirmMsg')}</div>
          <div className="mono" style={{ fontSize: 12, opacity: 0.75, wordBreak: 'break-all' }}>{source.rootDir}</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {selCats.map((cat) => <span key={cat} className="chip">{importCategoryLabel(t, cat)}</span>)}
          </div>
          {pre && (
            <div className="hint">
              {t('import.previewTotals', { files: pre.totalFiles, size: formatImportSize(pre.totalBytes) })}
              {!pre.freeSpaceUnknown && pre.freeBytes > 0 && ' · ' + t('import.previewFree', { size: formatImportSize(pre.freeBytes) })}
            </div>
          )}
          {pre?.notEnoughSpace && (
            <div className="hint" style={{ color: 'var(--warning)' }}>{t('import.previewNoSpace')}</div>
          )}
          {pre?.freeSpaceUnknown && <div className="hint">{t('import.previewFreeUnknown')}</div>}
          {selCats.some((c) => CACHE_CATS.has(c)) && <div className="hint">{t('import.cacheHint')}</div>}
          {selCats.includes('version-install') && source.installableVersions && (
            <div className="hint">
              {t('import.versionInstallHint', { count: source.installableVersions.length })}
              {': ' + source.installableVersions.slice(0, 10).join(', ')}
              {source.installableVersions.length > 10 ? '…' : ''}
            </div>
          )}
          <label className="dlg-check" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={deduplicate} onChange={(e) => setDeduplicate(e.target.checked)} />
            <span className="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5}><path d="m5 12 5 5 9-11" /></svg></span>
            <span>{t('import.deduplicate')}</span>
          </label>
          <label className="dlg-check">
            <input type="checkbox" checked={skipSecrets} onChange={(e) => setSkipSecrets(e.target.checked)} />
            <span className="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5}><path d="m5 12 5 5 9-11" /></svg></span>
            <span>{t('import.skipSecrets')}</span>
          </label>
          <label className="dlg-check">
            <input type="checkbox" checked={moveSource} onChange={(e) => setMoveSource(e.target.checked)} />
            <span className="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5}><path d="m5 12 5 5 9-11" /></svg></span>
            <span>{t('import.moveSource')}</span>
          </label>
          <label className="dlg-check">
            <input type="checkbox" checked={archiveWorlds} onChange={(e) => setArchiveWorlds(e.target.checked)} />
            <span className="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5}><path d="m5 12 5 5 9-11" /></svg></span>
            <span>{t('import.archiveWorlds')}</span>
          </label>
          {useHardlinks && <div className="hint">{t('import.hardlinksHint')}</div>}
          {moveSource && <div className="hint" style={{ color: 'var(--warning)' }}>{t('import.moveSourceHint')}</div>}
          {source.launcherTweaks?.maxMemoryMb && (
            <div className="hint" style={{ color: 'var(--warning)' }}>
              {t('import.memoryWarn', { mb: source.launcherTweaks.maxMemoryMb })}
              {' '}<button className="btn ghost sm" onClick={() => applySourceTweaks(source)}>{t('import.applyTweaks')}</button>
            </div>
          )}
          {selCats.includes('accounts') && <div className="hint">{t('settings.importAccountsHint')}</div>}
          {source.kind === 'bedrock' && <div className="hint">{t('import.bedrockHint')}</div>}
          <div className="hint" style={{ color: 'var(--warning)' }}>{t('import.antivirusHint')}</div>
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
    setCancelling(false);
    const versionCount = selCats.includes('version-install') && source.installableVersions
      ? source.installableVersions.length : 0;
    const initTotal = selCats.length + (versionCount > 0 ? versionCount - 1 : 0);
    setImportProgress({ current: 0, total: Math.max(initTotal, 1) });
    setVersionProgress(null);
    try {
      const report = (await window.api.importer.perform({
        sourceId: source.id, sourceRootDir: source.rootDir, categories: selCats, deduplicate, useHardlinks,
        skipSecrets, moveSource, archiveWorlds,
        ...(source.tmpDir ? { cleanupDir: source.tmpDir } : {}),
      })) as ImportReport;
      setImportProgress(null);
      setVersionProgress(null);
      const parts = Object.entries(report.copied).filter(([, n]) => !!n).map(([cat, n]) => `${importCategoryLabel(t, cat)}: ${n}`);
      const skippedParts = Object.entries(report.skipped ?? {}).filter(([, n]) => !!n).map(([cat, n]) => `${importCategoryLabel(t, cat)}: ${n} ${t('import.skipped')}`);
      if (report.newAccounts.length) parts.push(`${t('settings.importAccounts')}: ${report.newAccounts.join(', ')}`);
      if (report.installedVersions?.length) parts.push(`${t('import.catVersionInstall')}: ${report.installedVersions.join(', ')}`);
      const seconds = (report.totalMs ?? 0) / 1000;
      const statsLine = report.bytesWritten && seconds > 0
        ? t('import.doneStats', {
            size: formatImportSize(report.bytesWritten),
            seconds: seconds.toFixed(1),
            speed: (report.bytesWritten / 1024 / 1024 / seconds).toFixed(1),
          })
        : null;
      await dlg.show({
        title: report.aborted ? t('import.cancelledTitle') : t('settings.importDoneTitle'),
        tone: report.errors.length || report.aborted ? 'warn' : 'info',
        message: (
          <div style={{ display: 'grid', gap: 8 }}>
            {report.aborted && <div>{t('import.cancelledMsg')}</div>}
            <div>{parts.length ? parts.join(' · ') : t('settings.importNothingCopied')}</div>
            {statsLine && <div className="hint">{statsLine}</div>}
            {skippedParts.length > 0 && <div className="hint">{skippedParts.join(' · ')}</div>}
            {report.errors.length > 0 && (
              <div className="hint" style={{ color: 'var(--warning)', display: 'grid', gap: 4 }}>
                <div>{t('settings.importErrors', { count: report.errors.length })}</div>
                {report.errors.slice(0, 5).map((err, i) => (
                  <div key={i} className="mono" style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{err}</div>
                ))}
                {report.errors.length > 5 && <div>{t('import.moreErrors', { count: report.errors.length - 5 })}</div>}
              </div>
            )}
            {(report.warnings ?? []).some((w) => w.includes('imported as online')) && (
              <div className="hint">{t('import.reloginNeeded')}</div>
            )}
            {!!report.savedBytes && (
              <div className="hint">{t('import.savedBytes', { size: formatImportSize(report.savedBytes) })}</div>
            )}
            {!!report.rolledBackFiles && (
              <div className="hint" style={{ color: 'var(--warning)' }}>{t('import.rolledBack', { count: report.rolledBackFiles })}</div>
            )}
            {(report.quarantine?.length ?? 0) > 0 && (
              <div className="hint" style={{ color: 'var(--warning)' }}>
                <div>{t('import.quarantineTitle', { count: report.quarantine!.length })}</div>
                {report.quarantine!.slice(0, 5).map((q, i) => (
                  <div key={i} className="mono" style={{ fontSize: 11, wordBreak: 'break-word' }}>{q}</div>
                ))}
              </div>
            )}
            {(report.duplicateMods?.length ?? 0) > 0 && (
              <div className="hint">{t('import.duplicateMods', { list: report.duplicateMods!.slice(0, 3).join('; ') })}</div>
            )}
            {report.archivedWorlds && (
              <div className="hint">{t('import.archivedTo', { path: report.archivedWorlds })}</div>
            )}
          </div>
        ),
        buttons: [
          { label: t('import.openGameDir'), value: 'open', variant: 'ghost' },
          { label: t('import.rollbackBtn'), value: 'rollback', variant: 'ghost' },
          { label: t('settings.ok'), value: 'ok', variant: 'default' },
        ],
        defaultIndex: 2,
        cancelValue: 'ok',
      }).then((v) => {
        if (v === 'open') window.api.importer.openGameDir().catch(() => {});
        if (v === 'rollback') rollbackLast();
      });
      setPreview(null);
      await refreshImportSources();
      try { setLastImport((await window.api.importer.lastReport()) as LastImportInfo | null); } catch {}
    } catch (e) {
      // Импорт мог не начаться вовсе: запущенная игра, занятый лок и т.п.
      setImportProgress(null);
      setVersionProgress(null);
      await dlg.show({
        title: t('settings.importDoneTitle'),
        tone: 'warn',
        message: (e as Error).message,
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }],
        defaultIndex: 0,
        cancelValue: 'ok',
      });
    } finally { setImporting(null); setCancelling(false); }
  };

  const addToQueue = () => {
    if (!selectionSource || selectedCats.length === 0) return;
    if (queue.length >= 5 || queue.some((q) => q.source.id === selectionSource.id)) return;
    // Снапшот категорий на момент добавления: у каждого источника свой набор.
    setQueue((q) => [...q, { source: selectionSource, categories: [...selectedCats] }]);
    setSelectionSource(null);
    setPreview(null);
  };
  const runQueue = async () => {
    if (queue.length === 0 || importing) return;
    const plans = queue.map((q) => ({
      sourceId: q.source.id, sourceRootDir: q.source.rootDir,
      categories: q.categories,
      deduplicate, useHardlinks, skipSecrets, moveSource, archiveWorlds,
    }));
    setImporting('queue');
    setCancelling(false);
    setImportProgress({ current: 0, total: plans.length });
    try {
      const results = (await window.api.importer.performMany(plans)) as Array<{ sourceId: string; status: string; report?: ImportReport }>;
      const summary = results.map((r) => {
        const n = r.report ? Object.values(r.report.copied).reduce<number>((a, b) => a + (b ?? 0), 0) : 0;
        return `${r.sourceId}: ${r.status === 'done' ? t('import.queueDone', { count: n }) : t('import.queueCancelled')}`;
      }).join('\n');
      await dlg.show({ title: t('settings.importDoneTitle'), tone: 'info', message: summary,
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' });
      setQueue([]);
      await refreshImportSources();
    } catch (e) {
      await dlg.show({ title: t('settings.importDoneTitle'), tone: 'warn', message: (e as Error).message,
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' });
    } finally { setImporting(null); setCancelling(false); setImportProgress(null); setVersionProgress(null); }
  };

  const pickCustomDir = async () => {
    const dir = await window.api.settings.pickDir();
    if (dir) setCustomDir(dir);
  };
  const [archiveBusy, setArchiveBusy] = useState(false);
  const pickArchive = async () => {
    setArchiveBusy(true);
    try {
      const file = (await window.api.importer.pickArchive()) as string | null;
      if (!file) return;
      // .trelpack — наш формат: импорт сразу в версию, без детекта лаунчеров.
      if (file.toLowerCase().endsWith('.trelpack')) {
        const base = file.split(/[\\/]/).pop()!.replace(/\.trelpack$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 64) || 'imported-pack';
        const target = base;
        const res = await window.api.snapshots.importPack(file, target);
        await dlg.show({ title: t('settings.importDoneTitle'), tone: 'info',
          message: t('import.packImported', { id: res.versionId, count: res.copied }),
          buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' });
        await refreshImportSources();
        return;
      }
      const src = (await window.api.importer.fromArchive(file)) as ImportSource & { tmpDir?: string };
      setCustomSource(src);
      const sel: Record<string, boolean> = {};
      for (const cat of src.available) sel[cat] = !CACHE_CATS.has(cat);
      setSelectionCats(sel);
      setSelectionSource(src);
      setPreview(null);
    } catch (e) {
      await dlg.show({ title: t('settings.importDoneTitle'), tone: 'warn', message: (e as Error).message,
        buttons: [{ label: t('settings.ok'), value: 'ok', variant: 'default' }], defaultIndex: 0, cancelValue: 'ok' });
    } finally { setArchiveBusy(false); }
  };

  const allSources = [
    ...importSources,
    ...(customSource && !importSources.find(s => s.id === customSource.id && s.rootDir === customSource.rootDir)
      ? [customSource] : []),
  ];

  return (
    <div>
      <div className="page-head">
        <span className="eyebrow">Импорт</span>
        <h1 className="page-title">{t('import.title')}</h1>
        <p className="page-sub">{t('import.subtitle')}</p>
      </div>

      <section className="pane show" id="detect">
        <div className="card-head" style={{ marginBottom: 12 }}>
          <h4>{t('import.launchersTitle')}</h4>
          <button className="btn ghost sm" onClick={refreshImportSources} disabled={!importChecked || !!importing}>
            <IconRefresh /> {t('import.refresh')}
          </button>
        </div>
        {!importChecked && <p className="note">{t('import.scanning')}</p>}
        {importChecked && allSources.length === 0 && <p className="note">{t('import.empty')}</p>}
        {lastImport && !importing && (
          <p className="note">
            <IconInfo /> {t('import.lastImport', {
              when: formatAgo(t, lastImport.at),
              files: lastImport.copiedFiles,
            })}
            {lastImport.aborted && ' · ' + t('import.lastImportAborted')}
          </p>
        )}
        <div className="src-list">
          {allSources.map((source) => (
            <div key={source.id + ':' + source.rootDir} className="src" onClick={() => openImportSelection(source)}>
              <div className="src-ico">{source.kind === 'bedrock' ? '🔵' : source.label.includes('TLauncher') ? '🟠' : '📁'}</div>
              <div className="src-body">
                <b>
                  {source.label}
                  {!source.mojangOnlyBedrock && <span className="chip amber">{formatImportSize(source.approxSize)}</span>}
                  {source.modpack && <span className="chip">{source.modpack.loader} {source.modpack.mc}</span>}
                  {lastImport?.sourceId === source.id && <span className="chip">{t('import.alreadyImported')}</span>}
                </b>
                <div className="path">{source.rootDir}</div>
                <div className="src-cats">
                  {source.available.slice(0, 5).map((cat) => (
                    <span key={cat} className="chip">{importCategoryLabel(t, cat)}</span>
                  ))}
                  {source.available.length > 5 && <span className="chip">+{source.available.length - 5}</span>}
                </div>
                {source.mojangOnlyBedrock && (
                  <div className="hint"><IconInfo /> {t('import.mojangOnlyBedrock')}</div>
                )}
              </div>
              <button className="btn primary sm src-go" disabled={importing === source.id || !!source.mojangOnlyBedrock}>
                {importing === source.id ? t('import.importing') : t('import.importBtn')}
              </button>
            </div>
          ))}
        </div>

        <div className="custom-pick" onClick={pickCustomDir}>
          <div className="src-ico"><IconFolder /></div>
          <div className="info" style={{ flex: 1 }}>
            <b>{t('import.customLabel')}</b>
            <span>{customDetecting ? t('import.scanning') : (customDir || t('import.customPlaceholder'))}</span>
          </div>
          <button className="btn ghost sm">{t('import.customBrowse')}</button>
          <button className="btn ghost sm" onClick={pickArchive} disabled={archiveBusy}>
            {archiveBusy ? t('import.previewCalculating') : t('import.archiveBtn')}
          </button>
        </div>
        {customDir && !customDetecting && !customSource && (
          <p className="note" style={{ color: 'var(--warning)' }}>{t('import.customEmpty')}</p>
        )}

        {importProgress && importing && (
          <div className="imp-progress" style={{ maxWidth: 560, margin: '20px auto 0' }}>
            <div style={{ fontSize: 34, animation: 'bob 1.6s ease-in-out infinite', display: 'inline-block' }}>📦</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--fg-bright)', marginTop: 10 }}>{selectionSource?.label || ''}</h3>
            <div className="imp-stage">{versionProgress || t('import.importing')}… {importProgress.current} / {importProgress.total}</div>
            <div className="progress"><i style={{ width: `${Math.min((importProgress.current / importProgress.total) * 100, 100)}%` }} /></div>
            {/* Байты и скорость: по счётчику файлов не видно, идёт перенос или подвис. */}
            {!!importProgress.bytes && (
              <div className="imp-stage" style={{ opacity: 0.75 }}>
                {formatImportSize(importProgress.bytes)}
                {!!importProgress.bytesPerSecond && importProgress.bytesPerSecond > 0 &&
                  ' · ' + t('import.speed', { speed: formatSpeed(importProgress.bytesPerSecond) })}
                {!!importProgress.etaSeconds && importProgress.etaSeconds > 0 &&
                  ' · ' + t('import.eta', { seconds: importProgress.etaSeconds })}
              </div>
            )}
            {/* Текущий файл: видно, что процесс живой, а не завис на процентах. */}
            {!!importProgress.currentFile && (
              <div className="imp-stage" style={{ opacity: 0.55, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                {importProgress.currentFile}
              </div>
            )}
            <div className="imp-files">
              <div className="ifile done"><span className="sdot" /></div>
              <div className="ifile done"><span className="sdot" /></div>
              <div className="ifile now"><span className="sdot ok" /></div>
            </div>
            <div className="row" style={{ gap: 8, justifyContent: 'center', marginTop: 12 }}>
              <button className="btn ghost sm" onClick={togglePause} disabled={cancelling}>
                {paused ? t('import.resumeBtn') : t('import.pauseBtn')}
              </button>
              <button className="btn ghost sm" onClick={cancelImport} disabled={cancelling}>
                {cancelling ? t('import.cancelling') : t('import.cancelBtn')}
              </button>
            </div>
            {paused && <div className="imp-stage" style={{ opacity: 0.75 }}>{t('import.pausedHint')}</div>}
          </div>
        )}

        <p className="note">{t('import.hint')}</p>
        <p className="note" style={{ marginTop: 6 }}>{t('import.supported')}</p>
      </section>

      {selectionSource && (
        <section className="pane" id="select">
          <div className="card" style={{ maxWidth: 720 }}>
            <div className="card-head">
              <h4>{t('import.selectTitle', { name: selectionSource.label })}</h4>
              <button className="btn ghost sm" onClick={() => setSelectionSource(null)}>← назад</button>
            </div>
            <div className="cats-grid">
              {LAUNCHER_CATS.filter((cat) => selectionSource.available.includes(cat)).map((cat) => (
                <label key={cat} className="cat">
                  <input
                    type="checkbox"
                    checked={!!selectionCats[cat]}
                    onChange={(e) => {
                      setSelectionCats((prev) => ({ ...prev, [cat]: e.target.checked }));
                      setPreview(null);  // цифры относятся к прежнему набору
                    }}
                  />
                  <span className="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5}><path d="m5 12 5 5 9-11" /></svg></span>
                  {importCategoryLabel(t, cat)}
                  <span className="sz">
                    {preview?.files[cat]
                      ? formatImportSize(preview.bytes[cat] ?? 0)
                      : cat === 'version-install' && selectionSource.installableVersions ? selectionSource.installableVersions.length : ''}
                  </span>
                </label>
              ))}
            </div>
            {selectedCats.some((c) => CACHE_CATS.has(c)) && (
              <p className="note">{t('import.cacheHint')}</p>
            )}

            {selectionSource.modpack && (
              <div className="dedup" style={{ alignItems: 'flex-start' }}>
                <div className="info" style={{ flex: 1 }}>
                  <b>{t('import.modpackTitle', { name: selectionSource.modpack.name })}</b>
                  <span>
                    {t('import.modpackHint', {
                      loader: selectionSource.modpack.loader,
                      mc: selectionSource.modpack.mc,
                    })}
                  </span>
                </div>
                <button
                  className="btn ghost sm"
                  onClick={() => installDetectedModpack(selectionSource)}
                  disabled={installingModpack}
                >
                  {installingModpack ? t('import.modpackInstalling') : t('import.modpackInstall')}
                </button>
              </div>
            )}

            <div className="dedup">
              <label className="toggle"><input type="checkbox" checked={deduplicate} onChange={(e) => setDeduplicate(e.target.checked)} /><span className="track" /></label>
              <div className="info"><b>{t('import.deduplicate')}</b><span>{t('import.deduplicateHint')}</span></div>
            </div>

            <div className="dedup">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={useHardlinks}
                  onChange={(e) => { setUseHardlinks(e.target.checked); setPreview(null); }}
                />
                <span className="track" />
              </label>
              <div className="info"><b>{t('import.hardlinks')}</b><span>{t('import.hardlinksHint')}</span></div>
            </div>

            <div className="dedup">
              <label className="toggle"><input type="checkbox" checked={skipSecrets} onChange={(e) => setSkipSecrets(e.target.checked)} /><span className="track" /></label>
              <div className="info"><b>{t('import.skipSecrets')}</b><span>{t('import.skipSecretsHint')}</span></div>
            </div>

            <div className="dedup">
              <label className="toggle"><input type="checkbox" checked={moveSource} onChange={(e) => setMoveSource(e.target.checked)} /><span className="track" /></label>
              <div className="info"><b>{t('import.moveSource')}</b><span>{t('import.moveSourceHint')}</span></div>
            </div>

            <div className="dedup">
              <label className="toggle"><input type="checkbox" checked={archiveWorlds} onChange={(e) => setArchiveWorlds(e.target.checked)} /><span className="track" /></label>
              <div className="info"><b>{t('import.archiveWorlds')}</b><span>{t('import.archiveWorldsHint')}</span></div>
            </div>

            {selectionSource.launcherTweaks?.maxMemoryMb && (
              <p className="note" style={{ color: 'var(--warning)' }}>
                {t('import.memoryWarn', { mb: selectionSource.launcherTweaks.maxMemoryMb })}
                {' '}<button className="btn ghost sm" onClick={() => applySourceTweaks(selectionSource)}>{t('import.applyTweaks')}</button>
              </p>
            )}

            {preview && (
              <div className="note" style={{ display: 'grid', gap: 4, color: preview.notEnoughSpace ? 'var(--warning)' : undefined }}>
                <div>
                  <b>{t('import.previewTitle')}: </b>
                  {t('import.previewTotals', { files: preview.totalFiles, size: formatImportSize(preview.totalBytes) })}
                  {!preview.freeSpaceUnknown && preview.freeBytes > 0 && ' · ' + t('import.previewFree', { size: formatImportSize(preview.freeBytes) })}
                  {preview.freeSpaceUnknown && ' · ' + t('import.previewFreeUnknown')}
                  {preview.notEnoughSpace && ' · ' + t('import.previewNoSpace')}
                </div>
                {preview.diff && (preview.diff.fresh + preview.diff.overwrite + preview.diff.identical) > 0 && (
                  <div>{t('import.previewDiff', { fresh: preview.diff.fresh, overwrite: preview.diff.overwrite, identical: preview.diff.identical })}</div>
                )}
                {!!preview.savedBytesEstimate && (
                  <div>{t('import.savedBytes', { size: formatImportSize(preview.savedBytesEstimate) })}</div>
                )}
                {!!preview.etaSecondsEstimate && preview.etaSecondsEstimate > 0 && (
                  <div>{t('import.etaEstimate', { seconds: preview.etaSecondsEstimate })}</div>
                )}
                {(preview.servers?.length ?? 0) > 0 && (
                  <div>
                    <b>{t('import.serversTitle')}: </b>
                    {preview.servers!.slice(0, 8).map((srv, i) => (
                      <span key={i} className="chip" title={srv.ip}>{srv.name}</span>
                    ))}
                    {(preview.servers?.length ?? 0) > 8 && <span className="hint">+{preview.servers!.length - 8}</span>}
                  </div>
                )}
                {(preview.fileTree?.length ?? 0) > 0 && (
                  <div>
                    <button className="btn ghost sm" onClick={() => setShowTree((v) => !v)}>
                      {showTree ? t('import.treeHide') : t('import.treeShow', { count: preview.fileTree!.length })}
                    </button>
                    {showTree && (
                      <div className="mono" style={{ fontSize: 11, maxHeight: 160, overflow: 'auto', marginTop: 6, display: 'grid', gap: 2 }}>
                        {preview.fileTree!.slice(0, 100).map((f, i) => (
                          <div key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path} · {formatImportSize(f.bytes)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn ghost"
                style={{ justifyContent: 'center' }}
                onClick={calcPreview}
                disabled={previewing || selectedCats.length === 0}
              >
                {previewing ? t('import.previewCalculating') : t('import.previewBtn')}
              </button>
              <button
                className="btn ghost"
                style={{ justifyContent: 'center' }}
                onClick={addToQueue}
                disabled={selectedCats.length === 0 || queue.length >= 5 || queue.some((q) => q.source.id === selectionSource.id)}
                title={t('import.queueAddHint')}
              >
                {t('import.queueAdd')}
              </button>
              <button
                className="btn primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={confirmAndImport}
                disabled={selectedCats.length === 0 || !!importing}
              >
                {t('import.importBtn')}
              </button>
            </div>
            {queue.length > 0 && (
              <div className="note" style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                <div><b>{t('import.queueTitle', { count: queue.length })}:</b> {queue.map((q) => `${q.source.label} (${q.categories.length})`).join(' · ')}</div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn primary sm" onClick={runQueue} disabled={!!importing}>{t('import.queueRun')}</button>
                  <button className="btn ghost sm" onClick={() => setQueue([])} disabled={!!importing}>{t('import.queueClear')}</button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
