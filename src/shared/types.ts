export interface MinecraftAccount {
  type: 'offline' | 'online';
  name: string;
  uuid: string;
  /**
   * A custom skin as a data-URL (PNG, 64×64 or legacy 64×32).
   * Used to display the avatar/preview inside the launcher.
   * In offline mode the game itself will NOT show its skin in the textures —
   * for that you need either a skin loader mod or a local yggdrasil server.
   */
  skin?: string;
  /** Skin model: classic (Steve, 4px arms) or slim (Alex, 3px arms). */
  skinModel?: 'classic' | 'slim';
  /** For online accounts: the accessToken for yggdrasil authentication. */
  accessToken?: string;
  /** Microsoft refresh token — to re-fetch the profile after buying the game. */
  msRefreshToken?: string;
  /** For Microsoft accounts: true if the Minecraft license was bought, false if not. */
  owned?: boolean;
}

export interface VersionInfo {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  releaseTime: string;
  url: string;
}

export interface BedrockVersionInfo {
  id: string;
  type: 'bedrock';
  releaseTime: string;
  /** WP post ID used to resolve download link. */
  postId: number;
  /** page slug (minecraft-be-1-26-3 etc.) */
  slug: string;
}

export interface LaunchOptions {
  versionId: string;
  account: MinecraftAccount;
  memoryMb: number;
}

export interface LauncherSettings {
  gameDir: string;
  memoryMb: number;
  javaPath?: string;
  lastVersionId?: string;
  lastVersionEdition?: 'java' | 'bedrock';
  /** The active UI theme. Defaults to 'mono'. */
  theme?: ThemeId;
  jvmArgs?: string;
  gameWidth?: number;
  gameHeight?: number;
  fullscreen?: boolean;
  showSnapshots?: boolean;
  closeOnLaunch?: boolean;
  lockOnLaunch?: boolean;
  prevGameDir?: string;
  showIntro?: boolean;
  /** Auto-hide of the left panel after 5 seconds of inactivity on the tab. */
  autoHideSidebar?: boolean;
  locale?: 'ru' | 'en';
  showConsole?: boolean;
  preCommand?: string;
  postCommand?: string;
  /** HTTP(S) proxy for all downloads: http(s)://[user:pass@]host:port. */
  proxyUrl?: string;
  /** The performance preset applied last (informational). */
  perfPreset?: 'potato' | 'balanced' | 'ultra';
  /** Auto-backup of the worlds before launching (no more than once a day). */
  autoBackup?: boolean;
  /** Pinned builds (version ids at the top of the lists). */
  pinnedVersions?: string[];
}

/** The list of UI themes. Matches the data-theme attributes in styles.css. */
export type ThemeId = 'mono' | 'eclipse' | 'voxel';

export const THEME_IDS: ThemeId[] = ['mono', 'eclipse', 'voxel'];

/** The default for new installations and for a corrupted settings.json. */
export const DEFAULT_THEME: ThemeId = 'mono';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface ServerProperties {
  motd: string;
  /** The world folder name (level-name). Empty = the vanilla world of the server. */
  levelName?: string;
  serverPort: number;
  maxPlayers: number;
  gamemode: 'survival' | 'creative' | 'adventure' | 'spectator';
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  pvp: boolean;
  onlineMode: boolean;
  whiteList: boolean;
  spawnProtection: number;
}

export interface ServerInstance {
  id: string;
  name: string;
  versionId: string;
  createdAt: string;
  memoryMb: number;
  properties: ServerProperties;
}

export type ContentKind = 'mod' | 'shader' | 'resourcepack' | 'texturepack';

export interface ContentItem {
  name: string;
  displayName: string;
  kind: ContentKind;
  path: string;
  size: number;
  enabled: boolean;
  isFolder: boolean;
  description?: string;
  meta?: {
    title?: string;
    version?: string;
    loader?: string;
    authors?: string[];
    minecraft?: string;
    dependencies?: string[];
    warnings?: string[];
  };
}

export type Page = 'home' | 'browse' | 'installed' | 'worlds' | 'content' | 'modpacks' | 'servers' | 'screenshots' | 'stats' | 'skin' | 'accounts' | 'settings' | 'import' | 'diagnostics';

export type Locale = 'ru' | 'en';

export const CONTENT_FOLDERS = ['mods', 'shaderpacks', 'resourcepacks', 'texturepacks'] as const;
export type ContentFolder = typeof CONTENT_FOLDERS[number];

export interface DownloadProgress {
  stage: string;
  current: number;
  total: number;
  percent: number;
  /**
   * The number of bytes downloaded in the current stage / the whole process. Used in the UI to
   * show "56.4 / 312 MB" together with the percentage. Optional — the old stages
   * without an exact byte count (like "Extracting natives") leave it empty.
   */
  bytesDownloaded?: number;
  /** The total expected size in bytes. See bytesDownloaded. */
  bytesTotal?: number;
}