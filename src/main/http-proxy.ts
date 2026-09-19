/**
 * Глобальный HTTP-прокси для всех скачиваний лаунчера (axios defaults).
 * Для наших широт — must have: без прокси часть CDN просто не отвечает.
 * SOCKS не поддерживаем (axios из коробки — только http/https proxy);
 * сырые TCP (пинг серверов, game traffic) идут напрямую.
 */
import axios from 'axios';

export interface ParsedProxy { host: string; port: number; auth?: { username: string; password: string } }

/** Строгая разборка proxyUrl: http(s)://[user:pass@]host:port, без путей. */
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
/** Включён ли сейчас прокси (кастомные агенты его игнорят — см. agentsForDownload). */
export function isProxyActive(): boolean { return proxyActive; }

/**
 * Агенты для скачивания: keepalive-агенты axios НЕ умеют в прокси-туннель,
 * поэтому при включённом прокси отдаём пусто (дефолтные агенты + proxy-конфиг
 * axios разруливает сам). Без прокси — keepalive как раньше.
 */
export function agentsForDownload(): { httpAgent?: unknown; httpsAgent?: unknown } {
  if (proxyActive) return {};
  // Ленивый require чтобы не тянуть http/https в импортеры модуля.
  const http = require('node:http') as typeof import('node:http');
  const https = require('node:https') as typeof import('node:https');
  return {
    httpAgent: new http.Agent({ keepAlive: true, maxSockets: 64, maxFreeSockets: 32, timeout: 60000 }),
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 64, maxFreeSockets: 32, timeout: 60000 }),
  };
}

/** Применяет прокси ко всем axios-запросам процесса (или снимает). */
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

/** Проверка прокси: быстрый GET манифеста Mojang через него. */
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

/* ─── Очередь скачиваний: слоты + пауза ─── */

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

/** Занимает слот очереди (макс. 3 параллельных скачивания на весь лаунчер). */
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
    // Пауза могла встать пока слоты заняты — будим очередь при снятии.
    if (!downloadsPaused) {
      for (const pw of [...pauseWaiters]) { pauseWaiters.delete(pw); pw(); }
    }
  };
}
