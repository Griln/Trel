export interface MinecraftAccount {
  type: 'offline';
  name: string;
  uuid: string;
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

export interface Instance {
  id: string;
  name: string;
  versionId: string;
  loader: 'vanilla' | 'fabric' | 'forge' | 'quilt';
  loaderVersion?: string;
  createdAt: string;
}

export interface LauncherSettings {
  gameDir: string;
  memoryMb: number;
  javaPath?: string;
  lastVersionId?: string;
}

export interface DownloadProgress {
  stage: string;
  current: number;
  total: number;
  percent: number;
}
