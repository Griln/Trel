export interface MinecraftAccount {
  type: 'offline' | 'online';
  name: string;
  uuid: string;
  /**
   * Кастомный скин в виде data-URL (PNG, 64×64 или 64×32 legacy).
   * Используется для отображения аватара/превью внутри лаунчера.
   * В offline-режиме сама игра свой скин в текстурах НЕ покажет —
   * для этого нужен либо мод-скин-лоадер, либо локальный yggdrasil-сервер.
   */
  skin?: string;
  /** Модель скина: classic (Steve, 4px руки) или slim (Alex, 3px руки). */
  skinModel?: 'classic' | 'slim';
  /** Для online-аккаунтов: accessToken для yggdrasil-аутентификации. */
  accessToken?: string;
  /** Токен обновления Microsoft — чтобы переполучить профиль после покупки игры. */
  msRefreshToken?: string;
  /** Для Microsoft-аккаунтов: true если куплена лицензия Minecraft, false если нет. */
  owned?: boolean;
}

export interface VersionInfo {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  releaseTime: string;
  url: string;
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
  /** Активная тема UI. По умолчанию — 'mono'. */
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
  locale?: 'ru' | 'en' | 'zh' | 'es' | 'de';
  showConsole?: boolean;
  preCommand?: string;
  postCommand?: string;
}

/** Список тем UI. Совпадает с data-theme атрибутами в styles.css. */
export type ThemeId = 'mono' | 'eclipse' | 'voxel';

export const THEME_IDS: ThemeId[] = ['mono', 'eclipse', 'voxel'];

/** Дефолт для новых установок и для повреждённого settings.json. */
export const DEFAULT_THEME: ThemeId = 'mono';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface ServerProperties {
  motd: string;
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
}

export type Page = 'home' | 'browse' | 'installed' | 'worlds' | 'content' | 'servers' | 'skin' | 'accounts' | 'settings' | 'import';

export type Locale = 'ru' | 'en' | 'zh' | 'es' | 'de';

export const CONTENT_FOLDERS = ['mods', 'shaderpacks', 'resourcepacks', 'texturepacks'] as const;
export type ContentFolder = typeof CONTENT_FOLDERS[number];

export interface DownloadProgress {
  stage: string;
  current: number;
  total: number;
  percent: number;
  /**
   * Скачано байт на текущем этапе/общем процессе. Используется в UI для
   * показа «56.4 / 312 МБ» вместе с процентом. Опционально — старые этапы
   * без точного учёта байтов (типа «Extracting natives») оставляют пустым.
   */
  bytesDownloaded?: number;
  /** Общий ожидаемый объём в байтах. См. bytesDownloaded. */
  bytesTotal?: number;
}
