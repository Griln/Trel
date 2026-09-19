import { contextBridge, ipcRenderer } from 'electron';

import type { LaunchOptions, LauncherSettings, MinecraftAccount, VersionInfo, BedrockVersionInfo, DownloadProgress, ServerStatus, ServerProperties, ServerInstance, ContentKind, ContentItem } from '../shared/types';



export interface JavaInstallInfo {

  path: string;

  home: string;

  major: number;

  version: string;

  vendor?: string;

  managed: boolean;

}



export interface JavaPlan {

  required: number;

  plan: 'user' | 'reuse' | 'download';

  path: string | null;

  major?: number;

  version?: string;

  vendor?: string;

  error?: string;
}



export interface WorldEntry {

  name: string;

  displayName: string;

  path: string;

  lastPlayed: number;

  sizeBytes: number;

  gameMode?: number;

  hardcore?: boolean;

  version?: string;

  hasIcon: boolean;

}



export interface UpdaterState {

  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error' | 'disabled';

  current: string;

  latest?: string;

  percent?: number;

  bytesPerSecond?: number;

  error?: string;
  isPortableHint?: boolean;
  downloadedPath?: string;
}

export type LoaderType = 'fabric' | 'quilt' | 'neoforge' | 'forge';



export interface LoaderVersionInfo {

  loader: LoaderType;

  version: string;

  stable?: boolean;

  mcVersion?: string;

}



export type { ContentKind, ContentItem } from '../shared/types';

export interface InstalledVersionDetail {

  id: string;

  baseMc: string;

  edition: 'java' | 'bedrock';

  loader: LoaderType | null;

  loaderVersion: string | null;

}



export type { ServerStatus, ServerProperties, ServerInstance };

export interface ServerCreateProgress {
  stage: string;
  percent: number;
}

export interface EmuResetResult {
  ok: boolean;
  removed: string[];
  errors: string[];
}

export interface CrashFixAction {
  type: 'increase-memory' | 'switch-java' | 'open-folder' | 'open-mods' | 'copy-report' | 'update-gpu-driver' | 'none';
  label: string;
  hint?: string | number;
  /** Ссылка для действий типа update-gpu-driver (только allowlist-хосты). */
  url?: string;
}

export interface CrashDiagnosis {
  id: string;
  severity: 'fatal' | 'warning' | 'info';
  title: string;
  detail: string;
  actions: CrashFixAction[];
  culprit?: string;
}

export interface ModpackSummary { projectId: string; slug: string; title: string; description: string; author: string; downloads: number; iconUrl: string | null; categories: string[]; }

export interface ModpackVersion { versionId: string; name: string; versionNumber: string; gameVersions: string[]; loaders: string[]; datePublished: string; fileUrl: string | null; fileName: string | null; fileSize: number; }

export interface ModpackInstallResult { versionId: string; name: string; mc: string; loader: string; modCount: number; }

export interface ModpackProgress { stage: string; percent: number; current?: number; total?: number; }

export interface BackupEntry { file: string; name: string; world: string; mtime: number; size: number; }
export interface Shot { path: string; name: string; source: string; mtime: number; size: number; }
export interface SavedServerEntry { name: string; ip: string; }
export interface PingResultEntry { online: boolean; players?: { online: number; max: number }; version?: string; motd?: string; favicon?: string; latencyMs?: number; error?: string; }
export interface VersionStatEntry { versionId: string; totalMs: number; sessions: number; lastPlayed: number; }
export interface PlaytimeStatsEntry { totalMs: number; totalSessions: number; lastPlayed: number; byVersion: VersionStatEntry[]; byDay: { day: string; ms: number }[]; }

const api = {
  /** Текущая платформа: 'win32' | 'darwin' | 'linux'. UI использует, чтобы скрывать win-only секции (TrelEmu/Bedrock, nativeScreenshot hotkey и т.д.). */
  platform: process.platform as NodeJS.Platform,

  emu: {
    reset: (): Promise<EmuResetResult> => ipcRenderer.invoke('emu:reset')
  },

  window: {

    minimize: () => ipcRenderer.invoke('window:minimize'),

    maximize: () => ipcRenderer.invoke('window:maximize'),

    close: () => ipcRenderer.invoke('window:close'),

  },

  settings: {

    get: (): Promise<LauncherSettings> => ipcRenderer.invoke('settings:get'),

    set: (s: LauncherSettings): Promise<LauncherSettings> => ipcRenderer.invoke('settings:set', s),

    pickDir: (): Promise<string | null> => ipcRenderer.invoke('settings:pickDir'),

    desktopShortcutExists: (): Promise<boolean> => ipcRenderer.invoke('settings:desktopShortcutExists'),

    createDesktopShortcut: (): Promise<boolean> => ipcRenderer.invoke('settings:createDesktopShortcut'),

    removeDesktopShortcut: (): Promise<boolean> => ipcRenderer.invoke('settings:removeDesktopShortcut'),

    moveGameDir: (oldDir: string, newDir: string): Promise<{ moved: number; errors: string[] }> => ipcRenderer.invoke('settings:moveGameDir', oldDir, newDir),

    /** Включить/выключить автозапуск Trel вместе с системой. См. autostart.ts. */
    autoLaunchGet: (): Promise<{ enabled: boolean; unavailable?: boolean; reason?: string }> =>
      ipcRenderer.invoke('settings:autoLaunchGet'),

    autoLaunchSet: (enabled: boolean): Promise<{ ok: boolean; unavailable?: boolean; reason?: string }> =>
      ipcRenderer.invoke('settings:autoLaunchSet', enabled),

  },

  accounts: {

    list: (): Promise<MinecraftAccount[]> => ipcRenderer.invoke('accounts:list'),

    addMicrosoft: (): Promise<MinecraftAccount> => ipcRenderer.invoke('accounts:addMicrosoft'),
    refreshMicrosoft: (uuid: string): Promise<MinecraftAccount> => ipcRenderer.invoke('accounts:refreshMicrosoft', uuid),
    addGuest: (name: string): Promise<MinecraftAccount> => ipcRenderer.invoke('accounts:addGuest', name),

    remove: (uuid: string, clearCache?: boolean): Promise<MinecraftAccount[]> => ipcRenderer.invoke('accounts:remove', uuid, clearCache),
    setSkin: (uuid: string, dataUrl: string, model: 'classic' | 'slim'): Promise<MinecraftAccount> =>
      ipcRenderer.invoke('accounts:setSkin', uuid, dataUrl, model),
    removeSkin: (uuid: string): Promise<MinecraftAccount> =>
      ipcRenderer.invoke('accounts:removeSkin', uuid),
    pickSkinFile: (): Promise<string | null> =>
      ipcRenderer.invoke('accounts:pickSkinFile'),

  },

  java: {

    list: (): Promise<JavaInstallInfo[]> => ipcRenderer.invoke('java:list'),

    scan: (): Promise<JavaInstallInfo[]> => ipcRenderer.invoke('java:scan'),

    planFor: (versionId: string): Promise<JavaPlan | null> => ipcRenderer.invoke('java:planFor', versionId),

  },

  worlds: {

    list: (): Promise<WorldEntry[]> => ipcRenderer.invoke('worlds:list'),

    icon: (name: string): Promise<string | null> => ipcRenderer.invoke('worlds:icon', name),

    delete: (name: string): Promise<boolean> => ipcRenderer.invoke('worlds:delete', name),

    deleteWithBackups: (name: string): Promise<{ world: boolean; backupsRemoved: number }> =>

      ipcRenderer.invoke('worlds:deleteWithBackups', name),

    backup: (name: string): Promise<string> => ipcRenderer.invoke('worlds:backup', name),

    listBackups: (): Promise<BackupEntry[]> => ipcRenderer.invoke('worlds:listBackups'),

    restore: (backupFile: string): Promise<string> => ipcRenderer.invoke('worlds:restore', backupFile),

    openBackupsFolder: (): Promise<string> => ipcRenderer.invoke('worlds:openBackupsFolder'),

    openFolder: (name?: string): Promise<string> => ipcRenderer.invoke('worlds:openFolder', name),

  },


  importer: {
    detect: (): Promise<any[]> => ipcRenderer.invoke('import:detect'),
    perform: (plan: { sourceId: string; sourceRootDir?: string; categories: string[]; deduplicate?: boolean; useHardlinks?: boolean; skipSecrets?: boolean; moveSource?: boolean; archiveWorlds?: boolean; cleanupDir?: string }): Promise<any> =>
      ipcRenderer.invoke('import:perform', plan),
    /** Очередь: несколько источников подряд (макс. 5), отмена стопает остаток. */
    performMany: (plans: Array<{ sourceId: string; sourceRootDir?: string; categories: string[]; deduplicate?: boolean; useHardlinks?: boolean; skipSecrets?: boolean; moveSource?: boolean; archiveWorlds?: boolean }>): Promise<any> =>
      ipcRenderer.invoke('import:performMany', plans),
    /** Предпросмотр плана: файлы/байты по категориям, хватит ли места. */
    preview: (plan: { sourceId: string; sourceRootDir?: string; categories: string[]; deduplicate?: boolean; useHardlinks?: boolean }): Promise<any> =>
      ipcRenderer.invoke('import:preview', plan),
    /** Прерывает текущий импорт. Уже скопированные файлы остаются на месте. */
    cancel: (): Promise<void> => ipcRenderer.invoke('import:cancel'),
    /** Пауза/продолжение: замирает между файлами, файл не рвётся. */
    pause: (): Promise<void> => ipcRenderer.invoke('import:pause'),
    resume: (): Promise<void> => ipcRenderer.invoke('import:resume'),
    /** Откат последнего импорта по журналу (удаляет созданное). */
    rollback: (): Promise<number> => ipcRenderer.invoke('import:rollback'),
    /** Открыть папку игры в файловом менеджере. */
    openGameDir: (): Promise<void> => ipcRenderer.invoke('import:openGameDir'),
    /** Применить память/JVM-аргументы источника к настройкам Trel. */
    applyTweaks: (tweaks: { maxMemoryMb?: number; jvmArgs?: string }): Promise<any> =>
      ipcRenderer.invoke('import:applyTweaks', tweaks),
    /** Проверить токен аккаунта (нужен ли повторный вход). */
    checkAccount: (name: string): Promise<{ ok: boolean; reason?: string }> =>
      ipcRenderer.invoke('import:checkAccount', name),
    /** Импорт модпака из .zip/.mrpack: распаковка + detect. */
    fromArchive: (archivePath: string): Promise<any> =>
      ipcRenderer.invoke('import:fromArchive', archivePath),
    /** Диалог выбора архива модпака (.zip/.mrpack) или null. */
    pickArchive: (): Promise<string | null> => ipcRenderer.invoke('import:pickArchive'),
    /** Отчёт о последнем импорте в текущую папку игры (или null). */
    lastReport: (): Promise<any | null> => ipcRenderer.invoke('import:lastReport'),
    detectFromDir: (dir: string): Promise<any> =>
      ipcRenderer.invoke('import:detectFromDir', dir),
    /** Пауза/продолжение всех скачиваний (очередь держит стримы). */
    downloadsPause: (): Promise<void> => ipcRenderer.invoke('tools:downloadsPause'),
    downloadsResume: (): Promise<void> => ipcRenderer.invoke('tools:downloadsResume'),
    downloadsStatus: (): Promise<{ active: number; queued: number; paused: boolean }> =>
      ipcRenderer.invoke('tools:downloadsStatus'),
    /** Портативный ли запуск (данные рядом с бинарём). */
    portable: (): Promise<boolean> => ipcRenderer.invoke('app:portable'),
    /** Проверка прокси: GET манифеста Mojang через него. */
    proxyTest: (proxyUrl: string): Promise<{ ok: boolean; latencyMs?: number; error?: string }> =>
      ipcRenderer.invoke('tools:proxyTest', proxyUrl),
    /** Карта диска папки игры: кто сколько съел + свободно. */
    diskUsage: (): Promise<{ entries: Array<{ name: string; bytes: number; files: number }>; total: number; freeBytes: number | null }> =>
      ipcRenderer.invoke('tools:diskUsage'),
    /** Безопасная чистка: 'logs' (логи+краши) или 'tmp' (.trel_tmp хвосты). */
    clean: (target: 'logs' | 'tmp'): Promise<{ removedFiles: number; freedBytes: number }> =>
      ipcRenderer.invoke('tools:clean', target),
    onProgress: (cb: (p: { current: number; total: number; stage: string; bytes?: number; bytesPerSecond?: number; etaSeconds?: number; currentFile?: string; paused?: boolean; queueSource?: string }) => void) => {
      const listener = (_: unknown, p: { current: number; total: number; stage: string; bytes?: number; bytesPerSecond?: number; etaSeconds?: number; currentFile?: string; paused?: boolean; queueSource?: string }) => cb(p);
      ipcRenderer.on('import:progress', listener);
      return () => ipcRenderer.removeListener('import:progress', listener);
    },
  },
  reset: {

    perform: (opts: { keepUserData: boolean }): Promise<{ removed: string[]; keptUserData: boolean }> =>

      ipcRenderer.invoke('reset:perform', opts),

    restart: (): Promise<void> => ipcRenderer.invoke('reset:restart'),

    uninstallLauncher: (keepUserData: boolean): Promise<{ ok: boolean; reason?: string }> =>

      ipcRenderer.invoke('reset:uninstallLauncher', keepUserData),

  },

  loaders: {

    list: (loader: 'fabric' | 'quilt' | 'neoforge' | 'forge', mcVersion: string): Promise<LoaderVersionInfo[]> =>

      ipcRenderer.invoke('loaders:list', loader, mcVersion),

    install: (

      loader: 'fabric' | 'quilt' | 'neoforge' | 'forge',

      mcVersion: string,

      loaderVersion: string,

    ): Promise<{ versionId: string }> =>

      ipcRenderer.invoke('loaders:install', loader, mcVersion, loaderVersion),

  },

  modpacks: {
    search: (query: string): Promise<ModpackSummary[]> => ipcRenderer.invoke('modpacks:search', query),
    versions: (projectId: string): Promise<ModpackVersion[]> => ipcRenderer.invoke('modpacks:versions', projectId),
    install: (version: ModpackVersion): Promise<ModpackInstallResult> => ipcRenderer.invoke('modpacks:install', version),
    /** Ставит версию по профилю, распознанному из импортируемой сборки (mc + loader). */
    installFromProfile: (profile: { mc: string; loader: string; loaderVersion?: string; name?: string }): Promise<ModpackInstallResult> =>
      ipcRenderer.invoke('modpacks:installFromProfile', profile),
    onProgress: (cb: (p: ModpackProgress) => void) => {
      const listener = (_: unknown, p: ModpackProgress) => cb(p);
      ipcRenderer.on('modpacks:progress', listener);
      return () => ipcRenderer.removeListener('modpacks:progress', listener);
    },
  },


  snapshots: {
    create: (versionId: string, label?: string): Promise<{ file: string; versionId: string; label: string; at: number; size: number }> =>
      ipcRenderer.invoke('snapshots:create', versionId, label),
    list: (versionId?: string): Promise<Array<{ file: string; versionId: string; label: string; at: number; size: number }>> =>
      ipcRenderer.invoke('snapshots:list', versionId),
    restore: (file: string): Promise<string> => ipcRenderer.invoke('snapshots:restore', file),
    remove: (file: string): Promise<boolean> => ipcRenderer.invoke('snapshots:remove', file),
    exportDialog: (versionId: string): Promise<{ file: string; size: number } | null> =>
      ipcRenderer.invoke('packs:exportDialog', versionId),
    importPack: (archivePath: string, targetId: string): Promise<{ versionId: string; copied: number }> =>
      ipcRenderer.invoke('packs:import', archivePath, targetId),
  },
  webdav: {
    status: (): Promise<{ configured: boolean; url?: string; login?: string; lastSyncAt?: number; lastDirection?: string }> =>
      ipcRenderer.invoke('webdav:status'),
    configure: (url: string, login: string, password: string): Promise<void> =>
      ipcRenderer.invoke('webdav:configure', url, login, password),
    push: (): Promise<{ file: string; size: number }> => ipcRenderer.invoke('webdav:push'),
    pull: (): Promise<{ file: string; worlds: number }> => ipcRenderer.invoke('webdav:pull'),
  },
  screenshots: {
    list: (): Promise<Shot[]> => ipcRenderer.invoke('screenshots:list'),
    read: (path: string): Promise<string> => ipcRenderer.invoke('screenshots:read', path),
    delete: (path: string): Promise<void> => ipcRenderer.invoke('screenshots:delete', path),
    reveal: (path: string): Promise<void> => ipcRenderer.invoke('screenshots:reveal', path),
    openFolder: (): Promise<void> => ipcRenderer.invoke('screenshots:openFolder'),
    copy: (path: string): Promise<void> => ipcRenderer.invoke('screenshots:copy', path),
    setHotkey: (key: string): Promise<{ ok: boolean; reason?: string }> => ipcRenderer.invoke('screenshots:setHotkey', key),
    capture: (): Promise<string | null> => ipcRenderer.invoke('screenshots:capture'),
    onCaptured: (cb: (s: { path: string; name: string }) => void) => {
      const listener = (_: unknown, s: { path: string; name: string }) => cb(s);
      ipcRenderer.on('screenshots:captured', listener);
      return () => ipcRenderer.removeListener('screenshots:captured', listener);
    },
  },

  serverPing: {
    saved: (): Promise<SavedServerEntry[]> => ipcRenderer.invoke('servers:saved'),
    ping: (ip: string): Promise<PingResultEntry> => ipcRenderer.invoke('servers:ping', ip),
  },

  stats: {
    playtime: (): Promise<PlaytimeStatsEntry> => ipcRenderer.invoke('stats:playtime'),
  },

  tools: {
    /** Открыть https-ссылку в браузере (только allowlist-хосты). */
    openUrl: (url: string): Promise<void> => ipcRenderer.invoke('tools:openUrl', url),
    diagnostics: (): Promise<{ generatedAt: string; checks: Array<{ id: string; label: string; ok: boolean; level: 'ok' | 'warn' | 'error'; details: string; action?: string }> }> =>
      ipcRenderer.invoke('tools:diagnostics'),
    integrityCheck: (versionId: string): Promise<{ ok: boolean; issues: string[]; repaired: string[]; edition?: 'java' | 'bedrock' }> =>
      ipcRenderer.invoke('tools:integrityCheck', versionId),
    logsList: (): Promise<Array<{ name: string; path: string; size: number; mtime: number }>> =>
      ipcRenderer.invoke('tools:logsList'),
    logRead: (path: string): Promise<string> => ipcRenderer.invoke('tools:logRead', path),
    copyReport: (): Promise<string> => ipcRenderer.invoke('tools:copyReport'),
  },

  content: {

    list: (kind: ContentKind, versionId?: string, edition?: 'java' | 'bedrock'): Promise<ContentItem[]> =>

      ipcRenderer.invoke('content:list', kind, versionId, edition),

    delete: (kind: ContentKind, name: string, versionId?: string, edition?: 'java' | 'bedrock'): Promise<boolean> =>

      ipcRenderer.invoke('content:delete', kind, name, versionId, edition),

    toggle: (kind: ContentKind, name: string, versionId?: string, edition?: 'java' | 'bedrock'): Promise<boolean> =>

      ipcRenderer.invoke('content:toggle', kind, name, versionId, edition),

    openFolder: (kind: ContentKind, versionId?: string, edition?: 'java' | 'bedrock'): Promise<string> =>

      ipcRenderer.invoke('content:openFolder', kind, versionId, edition),

    add: (kind: ContentKind, versionId?: string, edition?: 'java' | 'bedrock'): Promise<{ copied: number; errors: string[] }> =>

      ipcRenderer.invoke('content:add', kind, versionId, edition),
    installToBedrock: (kind: ContentKind, name: string, versionId?: string, serial?: string): Promise<{ target: string; serial: string; output: string }> =>
      ipcRenderer.invoke('content:installToBedrock', kind, name, versionId, serial),
    /** Проверка обновлений модов через Modrinth (только java/моды). */
    checkModUpdates: (versionId: string, gameVersion: string, loaders: string[]): Promise<Array<{ file: string; name: string; current?: string; latest?: string; url?: string; filename?: string }>> =>
      ipcRenderer.invoke('content:checkModUpdates', versionId, gameVersion, loaders),
    /** Профили модов: наборы включённых jar. */
    modProfiles: (versionId: string): Promise<Record<string, string[]>> =>
      ipcRenderer.invoke('content:modProfiles', versionId),
    modProfileSave: (versionId: string, name: string): Promise<string[]> =>
      ipcRenderer.invoke('content:modProfileSave', versionId, name),
    modProfileDelete: (versionId: string, name: string): Promise<boolean> =>
      ipcRenderer.invoke('content:modProfileDelete', versionId, name),
    modProfileApply: (versionId: string, name: string): Promise<{ enabled: number; disabled: number }> =>
      ipcRenderer.invoke('content:modProfileApply', versionId, name),
    /** Скачать и поставить обновление мода (старый jar — в .bak). */
    updateMod: (versionId: string, fileName: string, url: string): Promise<{ file: string; backup: string }> =>
      ipcRenderer.invoke('content:updateMod', versionId, fileName, url),

  },

  updater: {

    state: (): Promise<UpdaterState> => ipcRenderer.invoke('updater:state'),

    check: (): Promise<UpdaterState> => ipcRenderer.invoke('updater:check'),

    download: (): Promise<void> => ipcRenderer.invoke('updater:download'),

    install: (): Promise<void> => ipcRenderer.invoke('updater:install'),

    onState: (cb: (s: UpdaterState) => void) => {

      const listener = (_: unknown, s: UpdaterState) => cb(s);

      ipcRenderer.on('updater:state', listener);

      return () => ipcRenderer.removeListener('updater:state', listener);

    },

  },

  minecraft: {

    versions: (): Promise<VersionInfo[]> => ipcRenderer.invoke('minecraft:versions'),

    installed: (): Promise<string[]> => ipcRenderer.invoke('minecraft:installed'),

    installedDetailed: (): Promise<InstalledVersionDetail[]> => ipcRenderer.invoke('minecraft:installedDetailed'),

    revertToVanilla: (versionId: string): Promise<{ removed: string[]; settings?: LauncherSettings }> => ipcRenderer.invoke('minecraft:revertToVanilla', versionId),

    install: (versionId: string): Promise<boolean> => ipcRenderer.invoke('minecraft:install', versionId),

    uninstall: (versionId: string): Promise<boolean> => ipcRenderer.invoke('minecraft:uninstall', versionId),

    uninstallDeep: (versionId: string): Promise<{ removed: string[] }> => ipcRenderer.invoke('minecraft:uninstallDeep', versionId),

    openFolder: (kind: 'game' | 'version', versionId?: string): Promise<string> =>

      ipcRenderer.invoke('minecraft:openFolder', kind, versionId),

    launch: (opts: LaunchOptions): Promise<number> => ipcRenderer.invoke('minecraft:launch', opts),

    onProgress: (cb: (p: DownloadProgress) => void) => {

      const listener = (_: unknown, p: DownloadProgress) => cb(p);

      ipcRenderer.on('minecraft:progress', listener);

      return () => ipcRenderer.removeListener('minecraft:progress', listener);

    },

    onLog: (cb: (line: string) => void) => {

      const listener = (_: unknown, line: string) => cb(line);

      ipcRenderer.on('minecraft:log', listener);

      return () => ipcRenderer.removeListener('minecraft:log', listener);

    },

    onExit: (cb: (code: number) => void) => {

      const listener = (_: unknown, code: number) => cb(code);

      ipcRenderer.on('minecraft:exit', listener);

      return () => ipcRenderer.removeListener('minecraft:exit', listener);

    },

    onCrash: (cb: (d: CrashDiagnosis) => void) => {

      const listener = (_: unknown, d: CrashDiagnosis) => cb(d);

      ipcRenderer.on('minecraft:crash', listener);

      return () => ipcRenderer.removeListener('minecraft:crash', listener);

    },

    onLaunchStart: (cb: (versionId: string) => void) => {

      const listener = (_: unknown, versionId: string) => cb(versionId);

      ipcRenderer.on('minecraft:launchStart', listener);

      return () => ipcRenderer.removeListener('minecraft:launchStart', listener);

    },

    onManifestUpdated: (cb: (list: InstalledVersionDetail[]) => void) => {

      const listener = (_: unknown, list: InstalledVersionDetail[]) => cb(list);

      ipcRenderer.on('minecraft:manifestUpdated', listener);

      return () => ipcRenderer.removeListener('minecraft:manifestUpdated', listener);

    },

  },
  bedrock: {
    versions: (): Promise<BedrockVersionInfo[]> => ipcRenderer.invoke('bedrock:versions'),
    installed: (): Promise<string[]> => ipcRenderer.invoke('bedrock:installed'),
    install: (versionId: string): Promise<boolean> => ipcRenderer.invoke('bedrock:install', versionId),
    uninstall: (versionId: string): Promise<boolean> => ipcRenderer.invoke('bedrock:uninstall', versionId),
    launch: (versionId: string, serial: string): Promise<number> => ipcRenderer.invoke('bedrock:launch', versionId, serial),
    openFolder: (versionId: string): Promise<string> => ipcRenderer.invoke('bedrock:openFolder', versionId),
    devices: (): Promise<{ serial: string; state: string; model?: string }[]> => ipcRenderer.invoke('bedrock:devices'),
    wsaInstalled: (): Promise<boolean> => ipcRenderer.invoke('bedrock:genymotionInstalled'),
    wsaInstall: (): Promise<boolean> => ipcRenderer.invoke('bedrock:genymotionStart'),
    wsaStart: (vmName?: string): Promise<string> => ipcRenderer.invoke('bedrock:genymotionStart', vmName),
    wsaCheckHyperV: (): Promise<{ enabled: boolean; missing: string[] }> => Promise.resolve({ enabled: true, missing: [] }),
    wsaCheckDeveloperMode: (): Promise<boolean> => Promise.resolve(true),
    genymotionInstalled: (): Promise<boolean> => ipcRenderer.invoke('bedrock:genymotionInstalled'),
    genymotionVms: (): Promise<{ name: string; uuid?: string; state?: string }[]> => ipcRenderer.invoke('bedrock:genymotionVms'),
    genymotionStart: (vmName?: string): Promise<string> => ipcRenderer.invoke('bedrock:genymotionStart', vmName),
    genymotionSelectedVm: (vmName?: string): Promise<string | null> => ipcRenderer.invoke('bedrock:genymotionSelectedVm', vmName),
    genymotionDownloadAndInstall: (): Promise<boolean> => ipcRenderer.invoke('bedrock:genymotionDownloadAndInstall'),
    cancelDownload: (): Promise<boolean> => ipcRenderer.invoke('bedrock:cancelDownload'),
    cancelWsaInstall: (): Promise<boolean> => ipcRenderer.invoke('bedrock:cancelGenymotionStart'),
    cancelGenymotionStart: (): Promise<boolean> => ipcRenderer.invoke('bedrock:cancelGenymotionStart'),
    trelEmuInfo: (): Promise<{ found: boolean; qemuExe?: string; imagePath?: string; adbPort?: number; memoryMb?: number; cpuCores?: number; hasSnapshot?: boolean; source?: 'downloaded' | 'portable' | 'bundled' | 'dev' | 'unknown'; root?: string; targetDir?: string; downloaderBusy?: boolean }> => ipcRenderer.invoke('bedrock:trelEmuInfo'),
    trelEmuStatus: (): Promise<boolean> => ipcRenderer.invoke('bedrock:trelEmuStatus'),
    trelEmuStart: (): Promise<{ serial: string; running: boolean }> => ipcRenderer.invoke('bedrock:trelEmuStart'),
    trelEmuStop: (): Promise<{ running: boolean }> => ipcRenderer.invoke('bedrock:trelEmuStop'),
    trelEmuDownload: (url?: string, sha1?: string): Promise<{ ok: boolean; target?: string; error?: string }> => ipcRenderer.invoke('bedrock:trelEmuDownload', url, sha1),
    trelEmuDownloadCancel: (): Promise<{ cancelled: boolean }> => ipcRenderer.invoke('bedrock:trelEmuDownloadCancel'),
    trelEmuDownloadState: (): Promise<{ state: string; targetDir: string }> => ipcRenderer.invoke('bedrock:trelEmuDownloadState'),
    onDownloadProgress: (cb: (p: { state: string; downloaded: number; total: number; ratio: number; speed: number; message: string; error?: string; resumedFrom?: number }) => void) => {
      const listener = (_: unknown, p: any) => cb(p);
      ipcRenderer.on('trelEmu:downloadProgress', listener);
      return () => ipcRenderer.removeListener('trelEmu:downloadProgress', listener);
    },
    onProgress: (cb: (p: DownloadProgress) => void) => {
      const listener = (_: unknown, p: DownloadProgress) => cb(p);
      ipcRenderer.on('bedrock:progress', listener);
      return () => ipcRenderer.removeListener('bedrock:progress', listener);
    },
  },
  servers: {
    list: (): Promise<ServerInstance[]> => ipcRenderer.invoke('servers:list'),
    /** Сохранённые удалённые серверы из servers.dat + живой пинг. */
    saved: (): Promise<SavedServerEntry[]> => ipcRenderer.invoke('servers:saved'),
    ping: (ip: string): Promise<PingResultEntry> => ipcRenderer.invoke('servers:ping', ip),
    /** Опубликовать одиночный мир как сервер. Возвращает сервер + адреса для друзей. */
    publishWorld: (worldName: string, versionId: string): Promise<{ instance: ServerInstance; addresses: Array<{ label: string; host: string; port: number }> }> =>
      ipcRenderer.invoke('servers:publishWorld', worldName, versionId),
    statuses: (): Promise<Record<string, ServerStatus>> => ipcRenderer.invoke('servers:statuses'),
    logBuffer: (id: string): Promise<string[]> => ipcRenderer.invoke('servers:logBuffer', id),
    create: (input: { name: string; versionId: string; memoryMb: number; properties?: Partial<ServerProperties> }): Promise<ServerInstance> =>
      ipcRenderer.invoke('servers:create', input),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('servers:delete', id),
    start: (id: string): Promise<void> => ipcRenderer.invoke('servers:start', id),
    stop: (id: string): Promise<void> => ipcRenderer.invoke('servers:stop', id),
    sendCommand: (id: string, command: string): Promise<void> =>
      ipcRenderer.invoke('servers:sendCommand', id, command),
    setProperties: (id: string, patch: Partial<ServerProperties>): Promise<ServerInstance> =>
      ipcRenderer.invoke('servers:setProperties', id, patch),
    rename: (id: string, name: string): Promise<ServerInstance> =>
      ipcRenderer.invoke('servers:rename', id, name),
    setMemory: (id: string, memoryMb: number): Promise<ServerInstance> =>
      ipcRenderer.invoke('servers:setMemory', id, memoryMb),
    openFolder: (id: string): Promise<string> => ipcRenderer.invoke('servers:openFolder', id),
    connectAddresses: (id: string): Promise<{ label: string; host: string; port: number }[]> =>
      ipcRenderer.invoke('servers:connectAddresses', id),
    onStatus: (cb: (id: string, status: ServerStatus) => void) => {
      const listener = (_: unknown, id: string, status: ServerStatus) => cb(id, status);
      ipcRenderer.on('servers:status', listener);
      return () => ipcRenderer.removeListener('servers:status', listener);
    },
    onLog: (cb: (id: string, line: string) => void) => {
      const listener = (_: unknown, id: string, line: string) => cb(id, line);
      ipcRenderer.on('servers:log', listener);
      return () => ipcRenderer.removeListener('servers:log', listener);
    },
    onCreateProgress: (cb: (p: ServerCreateProgress) => void) => {
      const listener = (_: unknown, p: ServerCreateProgress) => cb(p);
      ipcRenderer.on('servers:createProgress', listener);
      return () => ipcRenderer.removeListener('servers:createProgress', listener);
    },
  },

};



contextBridge.exposeInMainWorld('api', api);



export type Api = typeof api;