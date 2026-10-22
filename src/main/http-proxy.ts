/**
 * Global HTTP proxy for all launcher downloads (axios defaults).
 * For our latitudes this is a must have: without a proxy some CDNs simply
 * do not respond.
 * SOCKS is not supported (axios supports http/https proxies out of the box);
 * raw TCP (server pings, game traffic) goes directly.
 */
import axios from 'axios';

export interface ParsedProxy { host: string; port: number; auth?: { username: string; password: string } }

/** Strict parsing of proxyUrl: http(s)://[user:pass@]host:port, no paths. */
export function parseProxyUrl(raw: string): ParsedProxy | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.pathname !== '/' && u.pathname !== '') return null;
    if (!u.hostname || u.hostname.includes(' ')) return null;
    const port = u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    const out: ParsedProxy = { host: u.hostname, port };
    if (u.username) out.auth = { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password || '') };
    return out;
  } catch {
    return null;
  }
}

let proxyActive = false;
/** Whether the proxy is currently enabled (custom agents ignore it — see agentsForDownload). */
export function isProxyActive(): boolean { return proxyActive; }

/**
 * Download agents: axios keepalive agents CANNOT tunnel through a proxy,
 * so with the proxy enabled we return an empty object (default agents plus the
 * proxy config, which axios handles on its own). Without a proxy — keepalive
 * as before.
 */
export function agentsForDownload(): { httpAgent?: unknown; httpsAgent?: unknown } {
  if (proxyActive) return {};
  // Lazy require so that http/https are not pulled into the module importers.
  const http = require('node:http') as typeof import('node:http');
  const https = require('node:https') as typeof import('node:https');
  return {
    httpAgent: new http.Agent({ keepAlive: true, maxSockets: 64, maxFreeSockets: 32, timeout: 60000 }),
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 64, maxFreeSockets: 32, timeout: 60000 }),
  };
}

/** Applies the proxy to all axios requests of the process (or clears it). */
export function applyGlobalProxy(proxyUrl?: string): boolean {
  if (!proxyUrl || !proxyUrl.trim()) {
    axios.defaults.proxy = false;
    proxyActive = false;
    return true;
  }
  const p = parseProxyUrl(proxyUrl);
  if (!p) return false;
  axios.defaults.proxy = { host: p.host, port: p.port, ...(p.auth ? { auth: p.auth } : {}) };
  proxyActive = true;
  return true;
}

/** Proxy check: a quick GET of the Mojang manifest through it. */
export async function testProxy(proxyUrl: string, timeoutMs = 12000): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const p = parseProxyUrl(proxyUrl);
  if (!p) return { ok: false, error: 'Bad proxy URL (need http(s)://host:port)' };
  const started = Date.now();
  try {
    const { data } = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json', {
      timeout: timeoutMs,
      proxy: { host: p.host, port: p.port, ...(p.auth ? { auth: p.auth } : {}) },
    });
    if (!data || typeof data !== 'object') throw new Error('Bad response');
    return { ok: true, latencyMs: Date.now() - started };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── Download queue: slots + pause ─── */

const MAX_DOWNLOAD_SLOTS = 3;
let activeSlots = 0;
const slotWaiters: Array<() => void> = [];
let downloadsPaused = false;
const pauseWaiters = new Set<() => void>();

export function setDownloadsPaused(paused: boolean): void {
  downloadsPaused = paused;
  if (!paused) {
    for (const w of [...pauseWaiters]) { pauseWaiters.delete(w); w(); }
  }
}
export function isDownloadsPaused(): boolean { return downloadsPaused; }
export function downloadQueueStatus(): { active: number; queued: number; paused: boolean } {
  return { active: activeSlots, queued: slotWaiters.length, paused: downloadsPaused };
}

export async function respectDownloadPause(): Promise<void> {
  while (downloadsPaused) {
    await new Promise<void>((r) => pauseWaiters.add(r));
  }
}

/** Takes a queue slot (max. 3 parallel downloads for the whole launcher). */
export async function acquireDownloadSlot(): Promise<() => void> {
  await respectDownloadPause();
  while (activeSlots >= MAX_DOWNLOAD_SLOTS) {
    await new Promise<void>((r) => slotWaiters.push(r));
  }
  activeSlots++;
  return () => {
    activeSlots--;
    const w = slotWaiters.shift();
    if (w) w();
    // The pause may have been set while the slots were busy — wake the queue on resume.
    if (!downloadsPaused) {
      for (const pw of [...pauseWaiters]) { pauseWaiters.delete(pw); pw(); }
    }
  };
}
