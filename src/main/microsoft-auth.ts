import { BrowserWindow } from 'electron';
import axios, { AxiosRequestConfig } from 'axios';
import * as crypto from 'node:crypto';

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '00000000402b5328';
const REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';
const AUTHORIZE_URL = 'https://login.live.com/oauth20_authorize.srf';

export interface MicrosoftProfile {
  uuid: string;
  name: string;
  msRefreshToken?: string;
  owned: boolean;
}

export interface XblAuthResponse {
  Token: string;
  DisplayClaims?: { xui?: Array<{ uhs?: string; gtg?: string }> };
}

export interface XboxProfileResponse {
  profileUsers?: Array<{ settings?: Array<{ id: string; value: string }> }>;
}

export interface XstsAuthResponse {
  Token: string;
  DisplayClaims?: { xui?: Array<{ uhs?: string }> };
  XErr?: number;
}

function axiosConfig(proxy?: string): AxiosRequestConfig {
  const cfg: AxiosRequestConfig = { timeout: 15_000 };
  if (proxy) {
    const u = new URL(proxy);
    cfg.proxy = {
      protocol: u.protocol.replace(':', ''),
      host: u.hostname,
      port: parseInt(u.port) || 8080,
    };
    if (u.username) cfg.proxy.auth = { username: u.username, password: u.password || '' };
  }
  return cfg;
}

function openAuthWindow(): Promise<string> {
  return new Promise((resolve, reject) => {
    const authUrl =
      `${AUTHORIZE_URL}?client_id=${encodeURIComponent(CLIENT_ID)}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=${encodeURIComponent('XboxLive.signin offline_access openid')}` +
      `&prompt=select_account`;

    const win = new BrowserWindow({
      width: 480, height: 640, title: 'Microsoft Login',
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    let resolved = false;
    const cleanup = () => { resolved = true; try { if (!win.isDestroyed()) win.close(); } catch {} };

    win.webContents.on('will-redirect', (_event, url) => {
      if (resolved) return;
      try {
        const u = new URL(url);
        if (u.origin === 'https://login.live.com' && u.pathname === '/oauth20_desktop.srf') {
          const code = u.searchParams.get('code');
          cleanup();
          if (code) resolve(decodeURIComponent(code));
          else reject(new Error(`Microsoft login error: ${u.searchParams.get('error') || 'unknown'}`));
        }
      } catch {}
    });

    win.on('closed', () => { if (!resolved) reject(new Error('Login window was closed')); });
    win.loadURL(authUrl).catch((e) => { cleanup(); reject(new Error(`Failed to open login: ${e.message}`)); });
  });
}

async function msTokenFromCode(code: string, cfg: AxiosRequestConfig): Promise<{ accessToken: string; refreshToken: string; idToken?: string }> {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('code', code);
  params.append('grant_type', 'authorization_code');
  params.append('redirect_uri', REDIRECT_URI);

  const { data } = await axios.post(
    'https://login.live.com/oauth20_token.srf',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15_000, ...cfg },
  );
  return { accessToken: data.access_token, refreshToken: data.refresh_token || '', idToken: data.id_token };
}

async function msTokenFromRefresh(refreshToken: string, cfg: AxiosRequestConfig): Promise<{ accessToken: string; refreshToken: string }> {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('refresh_token', refreshToken);
  params.append('grant_type', 'refresh_token');
  params.append('redirect_uri', REDIRECT_URI);

  const { data } = await axios.post(
    'https://login.live.com/oauth20_token.srf',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15_000, ...cfg },
  );
  return { accessToken: data.access_token, refreshToken: data.refresh_token || refreshToken };
}

async function msTokenToXbl(accessToken: string, cfg: AxiosRequestConfig): Promise<{ xblToken: string; uhs: string; gamertag?: string }> {
  const { data } = await axios.post<XblAuthResponse>(
    'https://user.auth.xboxlive.com/user/authenticate',
    {
      Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${accessToken}` },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    },
    { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15_000, ...cfg },
  );
  const xui = data.DisplayClaims?.xui?.[0];
  let gamertag = xui?.gtg;

  // If gamertag not in XBL response, fetch it from Xbox profile API
  if (!gamertag && data.Token) {
    try {
      const { data: profile } = await axios.get<XboxProfileResponse>(
        'https://profile.xboxlive.com/users/me/profile/settings?settings=Gamertag',
        {
          headers: {
            Authorization: `XBL3.0 x=${xui?.uhs || ''};${data.Token}`,
            'x-xbl-contract-version': '3',
            Accept: 'application/json',
          },
          timeout: 10_000,
          ...cfg,
        });
      gamertag = profile?.profileUsers?.[0]?.settings?.find((s) => s.id === 'Gamertag')?.value;
    } catch {}
  }

  return { xblToken: data.Token, uhs: xui?.uhs || '', gamertag };
}

async function xblToXsts(xblToken: string, cfg: AxiosRequestConfig): Promise<{ xstsToken: string; uhs: string }> {
  const { data } = await axios.post<XstsAuthResponse>(
    'https://xsts.auth.xboxlive.com/xsts/authorize',
    {
      Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    },
    { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 15_000, ...cfg },
  );
  if (data.XErr) {
    const map: Record<number, string> = {
      2148916233: 'Account has no Xbox Live profile. Create a gamertag at xbox.com first.',
      2148916235: 'Xbox Live is not available in your country.',
      2148916236: 'Adult verification required for Xbox Live.',
      2148916237: 'Child accounts need parental consent for Xbox Live.',
      2148916238: 'Child account — add to a family group at xbox.com.',
    };
    throw new Error(map[data.XErr] || `XSTS error ${data.XErr}`);
  }
  return { xstsToken: data.Token, uhs: data.DisplayClaims?.xui?.[0]?.uhs || '' };
}

async function xstsToMcProfile(xstsToken: string, xstsUhs: string, cfg: AxiosRequestConfig): Promise<{ uuid: string; name: string; owned: boolean }> {
  const { data: mcAuth } = await axios.post(
    'https://api.minecraftservices.com/authentication/login_with_xbox',
    { identityToken: `XBL3.0 x=${xstsUhs};${xstsToken}` },
    { timeout: 15_000, ...cfg },
  );
  if (!mcAuth.access_token) throw new Error('Minecraft auth: no token');

  try {
    const { data: profile } = await axios.get(
      'https://api.minecraftservices.com/minecraft/profile',
      { headers: { Authorization: `Bearer ${mcAuth.access_token}` }, timeout: 15_000, ...cfg },
    );
    const s = profile.id.replace(/-/g, '');
    const uuid = `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
    return { uuid, name: profile.name, owned: true };
  } catch (e: any) {
    if (e.response?.status === 404) {
      const hash = require('node:crypto').createHash('md5').update('XboxUser:' + xstsUhs).digest();
      hash[6] = (hash[6] & 0x0f) | 0x30;
      hash[8] = (hash[8] & 0x3f) | 0x80;
      const hex = hash.toString('hex');
      const uuid = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
      return { uuid, name: '', owned: false };
    }
    throw e;
  }
}

/** Decode JWT payload (base64url → base64 → JSON). */
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  } catch { return null; }
}

function formatUuid(undashed: string): string {
  const s = undashed.replace(/-/g, '');
  if (s.length !== 32) throw new Error(`Invalid UUID: ${s.length} chars`);
  return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}

async function doAuth(msAccessToken: string, cfg: AxiosRequestConfig): Promise<MicrosoftProfile> {
  const xbl = await msTokenToXbl(msAccessToken, cfg);
  if (!xbl.xblToken || !xbl.uhs) throw new Error('Xbox Live auth failed: no token');

  const xsts = await xblToXsts(xbl.xblToken, cfg);
  if (!xsts.xstsToken || !xsts.uhs) throw new Error('XSTS auth failed: no token');

  const mc = await xstsToMcProfile(xsts.xstsToken, xsts.uhs, cfg);

  const name = mc.owned ? mc.name : (xbl.gamertag || `User-${xbl.uhs.slice(0, 8)}`);
  return { uuid: mc.uuid, name, msRefreshToken: undefined, owned: mc.owned };
}

/**
 * Первичный вход: открыть окно → получить профиль.
 */
export async function authenticateMicrosoft(): Promise<MicrosoftProfile> {
  const cfg = axiosConfig();

  let code: string;
  try { code = await openAuthWindow(); }
  catch (e) { throw new Error(`[1/5] Login: ${(e as Error).message}`); }

  let ms: { accessToken: string; refreshToken: string; idToken?: string };
  try { ms = await msTokenFromCode(code, cfg); }
  catch (e: any) { throw new Error(`[2/5] MS token: ${e.response?.data?.error_description || e.message}`); }

  let xbl: { xblToken: string; uhs: string; gamertag?: string };
  try { xbl = await msTokenToXbl(ms.accessToken, cfg); }
  catch (e: any) { throw new Error(`[3/5] Xbox: ${e.response?.status || ''} ${e.response?.data?.Message || e.message}`); }

  let xsts: { xstsToken: string; uhs: string };
  try { xsts = await xblToXsts(xbl.xblToken, cfg); }
  catch (e: any) {
    if (e.message.includes('Xbox') || e.message.includes('XSTS') || e.message.includes('child') || e.message.includes('adult')) throw e;
    throw new Error(`[4/5] XSTS: ${e.response?.status || ''} ${e.message}`);
  }

  let mc: { uuid: string; name: string; owned: boolean };
  try { mc = await xstsToMcProfile(xsts.xstsToken, xsts.uhs, cfg); }
  catch (e: any) {
    const s = e.response?.status;
    if (s === 503) throw new Error('[5/5] Сервера Mojang недоступны (503). Попробуйте позже. / Mojang servers down. Try later.');
    throw new Error(`[5/5] Minecraft: ${s || ''} ${e.response?.data?.error || e.message}`);
  }

  // Name priority: Minecraft > gamertag > id_token email/name > fallback
  let name = mc.owned ? mc.name : '';
  if (!name) name = xbl.gamertag || '';
  if (!name && ms.idToken) {
    const jwt = decodeJwtPayload(ms.idToken);
    name = jwt?.email || jwt?.name || jwt?.preferred_username || '';
  }
  if (!name) name = `User-${xbl.uhs.slice(0, 8)}`;
  return { uuid: mc.uuid, name, msRefreshToken: ms.refreshToken, owned: mc.owned };
}

/**
 * Обновление: по сохранённому refresh_token переполучить профиль.
 * Вызывается когда юзер купил лицензию и хочет обновить аккаунт.
 */
export async function refreshMicrosoftToken(refreshToken: string): Promise<MicrosoftProfile> {
  const cfg = axiosConfig();

  const ms = await msTokenFromRefresh(refreshToken, cfg);
  if (!ms.accessToken) throw new Error('Failed to refresh Microsoft token');

  const xbl = await msTokenToXbl(ms.accessToken, cfg);
  if (!xbl.xblToken || !xbl.uhs) throw new Error('Xbox Live auth failed');

  const xsts = await xblToXsts(xbl.xblToken, cfg);
  if (!xsts.xstsToken || !xsts.uhs) throw new Error('XSTS auth failed');

  const mc = await xstsToMcProfile(xsts.xstsToken, xsts.uhs, cfg);

  // Если лицензии нет — сохраняем профиль как есть, чтобы пользователь
  // мог обновить статус позже без повторного входа.
  let name = mc.owned ? mc.name : '';
  if (!name) name = xbl.gamertag || '';
  if (!name) name = `User-${xbl.uhs.slice(0, 8)}`;

  return {
    uuid: mc.uuid,
    name,
    msRefreshToken: ms.refreshToken,
    owned: mc.owned,
  };
}
