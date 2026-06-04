import { contextBridge, ipcRenderer } from 'electron';

import type { LaunchOptions, LauncherSettings, MinecraftAccount, VersionInfo, DownloadProgress, ServerStatus, ServerProperties, ServerInstance, ContentKind, ContentItem } from '../shared/types';



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

  loader: LoaderType | null;

  loaderVersion: string | null;

}



export type { ServerStatus, ServerProperties, ServerInstance };

export interface ServerCreateProgress {
  stage: string;
  percent: number;
}

const api = {

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

    openFolder: (name?: string): Promise<string> => ipcRenderer.invoke('worlds:openFolder', name),

  },


  importer: {
    detect: (): Promise<any[]> => ipcRenderer.invoke('import:detect'),
    perform: (plan: { sourceId: string; sourceRootDir?: string; categories: string[]; deduplicate?: boolean }): Promise<any> =>
      ipcRenderer.invoke('import:perform', plan),
    detectCache: (sourceDir: string): Promise<any> =>
      ipcRenderer.invoke('import:detectCache', sourceDir),
    performCache: (plan: { sourceDir: string; categories: string[] }): Promise<any> =>
      ipcRenderer.invoke('import:performCache', plan),
    detectFromDir: (dir: string): Promise<any> =>
      ipcRenderer.invoke('import:detectFromDir', dir),
    onProgress: (cb: (p: { current: number; total: number; stage: string }) => void) => {
      const listener = (_: unknown, p: { current: number; total: number; stage: string }) => cb(p);
      ipcRenderer.on('import:progress', listener);
      return () => ipcRenderer.removeListener('import:progress', listener);
    },
    onCacheProgress: (cb: (p: { current: number; total: number; stage: string }) => void) => {
      const listener = (_: unknown, p: { current: number; total: number; stage: string }) => cb(p);
      ipcRenderer.on('import:cacheProgress', listener);
      return () => ipcRenderer.removeListener('import:cacheProgress', listener);
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

  content: {

    list: (kind: ContentKind, versionId?: string): Promise<ContentItem[]> =>

      ipcRenderer.invoke('content:list', kind, versionId),

    delete: (kind: ContentKind, name: string, versionId?: string): Promise<boolean> =>

      ipcRenderer.invoke('content:delete', kind, name, versionId),

    toggle: (kind: ContentKind, name: string, versionId?: string): Promise<boolean> =>

      ipcRenderer.invoke('content:toggle', kind, name, versionId),

    openFolder: (kind: ContentKind, versionId?: string): Promise<string> =>

      ipcRenderer.invoke('content:openFolder', kind, versionId),

    add: (kind: ContentKind, versionId?: string): Promise<{ copied: number; errors: string[] }> =>

      ipcRenderer.invoke('content:add', kind, versionId),

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
  servers: {
    list: (): Promise<ServerInstance[]> => ipcRenderer.invoke('servers:list'),
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

