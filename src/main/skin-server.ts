import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import { MinecraftAccount } from '../shared/types';

/**
 * Полноценный локальный yggdrasil-совместимый auth-сервер.
 *
 * Используется вместе с authlib-injector чтобы Minecraft работал в
 * online-mode=true без внешних сервисов и без Microsoft-аккаунтов.
 *
 * Покрывает:
 *   - authserver.mojang.com    — аутентификация, рефреш, валидация
 *   - sessionserver.mojang.com — join/hasJoined, профили, текстуры
 *   - api.mojang.com           — lookup ника ↔ UUID
 *   - api.minecraftservices.com — publickeys, attributes, blocklist...
 *
 * Все аккаунты из локального accounts.json автоматически принимаются
 * без пароля — пользователь просто вводит ник, и лаунчер сам выпускает
 * accessToken и поднимает auth-сервер.
 */
export class SkinServer {
  private server: http.Server | null = null;
  private port = 0;
  private byUuidUndashed = new Map<string, MinecraftAccount>();
  private byName = new Map<string, MinecraftAccount>();
  /** LRU cache for skin PNG data, max 256 entries (~128 MB worst-case at 512KB each). */
  private skinByHash = new Map<string, Buffer>();
  private readonly SKIN_CACHE_MAX = 256;
  private hashByUuid = new Map<string, string>();
  private privateKeyPem = '';
  private publicKeyPem = '';
  private requestCounts = new Map<string, { count: number; resetAt: number }>();
  private readonly MAX_REQUESTS_PER_SEC = 50;
  /** accessToken → account uuid (для /authserver/validate и /refresh) */
  private tokenToUuid = new Map<string, string>();
  /** serverId → { username, uuid } (для связки join ↔ hasJoined) */
  private sessions = new Map<string, { username: string; uuid: string; at: number }>();

  setAccounts(list: MinecraftAccount[]) {
    const newUuids = new Set(list.map((a) => a.uuid.replace(/-/g, '').toLowerCase()));
    const newNames = new Set(list.map((a) => a.name.toLowerCase()));

    // Remove accounts that no longer exist (incremental update)
    for (const [uuid] of this.byUuidUndashed) {
      if (!newUuids.has(uuid)) {
        const oldHash = this.hashByUuid.get(uuid);
        if (oldHash) { this.skinByHash.delete(oldHash); this.hashByUuid.delete(uuid); }
        this.byUuidUndashed.delete(uuid);
      }
    }
    for (const [name] of this.byName) {
      if (!newNames.has(name)) this.byName.delete(name);
    }
    // Clean tokens of removed accounts
    for (const [token, uuid] of this.tokenToUuid) {
      if (!newUuids.has(uuid)) this.tokenToUuid.delete(token);
    }

    // Update/add accounts
    for (const a of list) {
      const undashed = a.uuid.replace(/-/g, '').toLowerCase();
      const existing = this.byUuidUndashed.get(undashed);
      // Only recompute skin hash if skin actually changed
      const skinChanged = !existing || existing.skin !== a.skin;
      this.byUuidUndashed.set(undashed, a);
      this.byName.set(a.name.toLowerCase(), a);
      if (a.accessToken) {
        this.tokenToUuid.set(a.accessToken, undashed);
      }
      if (a.skin && skinChanged) {
        const oldHash = this.hashByUuid.get(undashed);
        if (oldHash) { this.skinByHash.delete(oldHash); }
        const m = /^data:image\/png;base64,(.+)$/.exec(a.skin);
        if (m && m[1].length <= 512_000) {
          const buf = Buffer.from(m[1], 'base64');
          const hash = crypto.createHash('sha256').update(buf).digest('hex');
          // LRU eviction for skin cache
          if (this.skinByHash.size >= this.SKIN_CACHE_MAX && !this.skinByHash.has(hash)) {
            const firstKey = this.skinByHash.keys().next().value;
            if (firstKey !== undefined) this.skinByHash.delete(firstKey);
          }
          this.skinByHash.set(hash, buf);
          this.hashByUuid.set(undashed, hash);
        }
      } else if (!a.skin) {
        const oldHash = this.hashByUuid.get(undashed);
        if (oldHash) { this.skinByHash.delete(oldHash); this.hashByUuid.delete(undashed); }
      }
    }
  }

  isRunning() { return !!this.server; }

  apiUrl(): string {
    return `http://127.0.0.1:${this.port}/`;
  }

  async start(): Promise<string> {
    if (this.server) return this.apiUrl();
    if (!this.privateKeyPem) {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      this.privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      this.publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    }
    this.server = http.createServer((req, res) => this.handle(req, res));
    this.server.on('error', () => {});
    this.server.on('connection', (socket) => {
      const remote = socket.remoteAddress || '';
      if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
        socket.destroy();
      }
    });
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject);
      this.server!.listen(0, '127.0.0.1', () => {
        this.port = (this.server!.address() as AddressInfo).port;
        resolve();
      });
    });
    return this.apiUrl();
  }

  stop() {
    if (this.server) {
      try { this.server.close(); } catch {}
      this.server = null;
      this.port = 0;
    }
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse) {
    req.setTimeout(10_000, () => { res.writeHead(408); res.end(); });

    let url: URL;
    try {
      url = new URL(req.url || '/', `http://${req.headers.host}`);
    } catch {
      res.writeHead(400); res.end(); return;
    }
    const remote = req.socket.remoteAddress || '';
    if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
      res.writeHead(403); res.end(); return;
    }
    const now = Date.now();
    const rc = this.requestCounts.get(remote);
    if (rc && now < rc.resetAt) {
      if (rc.count >= this.MAX_REQUESTS_PER_SEC) { res.writeHead(429); res.end(); return; }
      rc.count++;
    } else {
      this.requestCounts.set(remote, { count: 1, resetAt: now + 1000 });
    }
    if (this.requestCounts.size > 100) {
      for (const [k, v] of this.requestCounts) { if (now > v.resetAt) this.requestCounts.delete(k); }
    }
    // Чистим старые сессии (старше 5 минут)
    for (const [sid, s] of this.sessions) { if (now - s.at > 300_000) this.sessions.delete(sid); }

    const CORS = { 'Access-Control-Allow-Origin': 'http://127.0.0.1', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    const send = (status: number, body: string | Buffer, ct = 'application/json; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': ct, ...CORS });
      res.end(body);
    };
    const sendJson = (status: number, obj: unknown) => send(status, JSON.stringify(obj));
    const empty = () => { res.writeHead(204); res.end(); };

    const MAX_BODY = 64 * 1024;
    const readBody = (): Promise<string> => new Promise((resolve, reject) => {
      let body = '';
      let lastChunkTime = Date.now();
      const BODY_TIMEOUT_MS = 30000;
      const timer = setTimeout(() => {
        req.destroy();
        reject(new Error('Request body read timeout (slowloris protection)'));
      }, BODY_TIMEOUT_MS);
      req.on('data', (chunk: Buffer) => {
        lastChunkTime = Date.now();
        body += chunk.toString();
        if (body.length > MAX_BODY) {
          clearTimeout(timer);
          req.destroy();
          reject(new Error('Body too large'));
        }
      });
      req.on('end', () => { clearTimeout(timer); resolve(body); });
      req.on('error', (e) => { clearTimeout(timer); reject(e); });
      req.on('close', () => { clearTimeout(timer); });
    });

    const p = url.pathname;

    // ─── Root meta ────────────────────────────────────────────────────────
    if (p === '/' || p === '') {
      return sendJson(200, {
        meta: {
          serverName: 'Trel Launcher',
          implementationName: 'trel-launcher-skin-server',
          implementationVersion: '1.0',
          'feature.non_email_login': true,
          'feature.no_mojang_namespace': true,
          'feature.username_check': false,
          links: { homepage: '', register: '' },
        },
        skinDomains: ['127.0.0.1', 'localhost', '.localhost'],
        signaturePublickey: this.publicKeyPem,
      });
    }

    // ─── authserver.mojang.com ───────────────────────────────────────────
    // /authserver/authenticate — вход. Принимаем любой локальный аккаунт без пароля.
    if (p === '/authserver/authenticate' && req.method === 'POST') {
      readBody().then((body) => {
        try {
          const data = JSON.parse(body);
          const user = data.username?.toString() || '';
          const clientToken = data.clientToken?.toString() || crypto.randomBytes(16).toString('hex');
          const acc = this.byName.get(user.toLowerCase());
          if (!acc) {
            return sendJson(403, { error: 'ForbiddenOperationException', errorMessage: 'Invalid credentials. Invalid username or password.' });
          }
          const accessToken = acc.accessToken || crypto.randomBytes(32).toString('hex');
          const undashed = acc.uuid.replace(/-/g, '').toLowerCase();
          this.tokenToUuid.set(accessToken, undashed);
          const profile = { id: undashed, name: acc.name };
          sendJson(200, {
            accessToken,
            clientToken,
            availableProfiles: [profile],
            selectedProfile: profile,
            user: { id: undashed, properties: [] },
          });
        } catch {
          sendJson(403, { error: 'ForbiddenOperationException', errorMessage: 'Invalid credentials.' });
        }
      }).catch(() => sendJson(500, { error: 'Internal error' }));
      return;
    }

    // /authserver/refresh — обновление токена
    if (p === '/authserver/refresh' && req.method === 'POST') {
      readBody().then((body) => {
        try {
          const data = JSON.parse(body);
          const oldToken = data.accessToken?.toString() || '';
          const clientToken = data.clientToken?.toString() || crypto.randomBytes(16).toString('hex');
          const uuid = this.tokenToUuid.get(oldToken);
          if (!uuid) {
            return sendJson(403, { error: 'ForbiddenOperationException', errorMessage: 'Invalid token.' });
          }
          const acc = this.byUuidUndashed.get(uuid);
          if (!acc) {
            return sendJson(403, { error: 'ForbiddenOperationException', errorMessage: 'Invalid token.' });
          }
          const newToken = crypto.randomBytes(32).toString('hex');
          this.tokenToUuid.delete(oldToken);
          this.tokenToUuid.set(newToken, uuid);
          const profile = { id: uuid, name: acc.name };
          sendJson(200, {
            accessToken: newToken,
            clientToken,
            selectedProfile: profile,
            user: { id: uuid, properties: [] },
          });
        } catch {
          sendJson(403, { error: 'ForbiddenOperationException', errorMessage: 'Invalid token.' });
        }
      }).catch(() => sendJson(500, { error: 'Internal error' }));
      return;
    }

    // /authserver/validate — проверка токена
    if (p === '/authserver/validate' && req.method === 'POST') {
      readBody().then((body) => {
        try {
          const data = JSON.parse(body);
          const token = data.accessToken?.toString() || '';
          if (this.tokenToUuid.has(token)) return empty();
          sendJson(403, { error: 'ForbiddenOperationException', errorMessage: 'Invalid token.' });
        } catch {
          sendJson(403, { error: 'ForbiddenOperationException', errorMessage: 'Invalid token.' });
        }
      }).catch(() => sendJson(500, { error: 'Internal error' }));
      return;
    }

    // /authserver/signout — выход. Просто принимаем.
    if (p === '/authserver/signout' && req.method === 'POST') {
      readBody().then(() => empty()).catch(() => empty());
      return;
    }

    // ─── sessionserver.mojang.com ─────────────────────────────────────────
    let m = /^(?:\/sessionserver)?\/session\/minecraft\/profile\/([a-f0-9-]+)$/i.exec(p);
    if (m) {
      const uuid = m[1].replace(/-/g, '').toLowerCase();
      const acc = this.byUuidUndashed.get(uuid);
      if (!acc) return empty();
      return sendJson(200, this.profileResponse(acc));
    }

    // /session/minecraft/join — клиент сообщает что заходит на сервер.
    if (/^(?:\/sessionserver)?\/session\/minecraft\/join$/.test(p) && req.method === 'POST') {
      readBody().then((body) => {
        try {
          const data = JSON.parse(body);
          const serverId = data.serverId?.toString() || '';
          const user = this.tokenToUuid.get(data.accessToken?.toString() || '');
          if (serverId && user) {
            const acc = this.byUuidUndashed.get(user);
            if (acc) {
              this.sessions.set(serverId, { username: acc.name, uuid: user, at: Date.now() });
            }
          }
        } catch {}
        empty();
      }).catch(() => empty());
      return;
    }

    // /session/minecraft/hasJoined — сервер проверяет игрока.
    if (/^(?:\/sessionserver)?\/session\/minecraft\/hasJoined$/.test(p)) {
      const username = url.searchParams.get('username');
      const serverId = url.searchParams.get('serverId');
      // Сначала ищем по сессии (join ↔ hasJoined связка)
      if (serverId) {
        const sess = this.sessions.get(serverId);
        if (sess && (!username || sess.username.toLowerCase() === username.toLowerCase())) {
          const acc = this.byUuidUndashed.get(sess.uuid);
          if (acc) {
            this.sessions.delete(serverId);
            return sendJson(200, this.profileResponse(acc));
          }
        }
      }
      // Фолбек: поиск по имени (для совместимости)
      if (username) {
        const acc = this.byName.get(username.toLowerCase());
        if (acc) return sendJson(200, this.profileResponse(acc));
      }
      return empty();
    }

    // ─── api.mojang.com ───────────────────────────────────────────────────
    m = /^(?:\/api)?\/users\/profiles\/minecraft\/(.+)$/.exec(p);
    if (m) {
      const acc = this.byName.get(decodeURIComponent(m[1]).toLowerCase());
      if (!acc) return empty();
      return sendJson(200, { id: acc.uuid.replace(/-/g, ''), name: acc.name });
    }

    if (/^(?:\/api)?\/profiles\/minecraft$/.test(p) && req.method === 'POST') {
      readBody().then((body) => {
        try {
          const names = JSON.parse(body) as string[];
          const out = (Array.isArray(names) ? names.slice(0, 64) : [])
            .map((n) => this.byName.get(String(n).toLowerCase()))
            .filter((a): a is MinecraftAccount => !!a)
            .map((a) => ({ id: a.uuid.replace(/-/g, ''), name: a.name }));
          sendJson(200, out);
        } catch {
          sendJson(200, []);
        }
      }).catch(() => sendJson(200, []));
      return;
    }

    if (/^(?:\/api)?\/user\/profiles\/[a-f0-9-]+\/names$/i.test(p)) {
      const m2 = /\/profiles\/([a-f0-9-]+)\/names$/i.exec(p);
      if (m2) {
        const acc = this.byUuidUndashed.get(m2[1].replace(/-/g, '').toLowerCase());
        if (acc) return sendJson(200, [{ name: acc.name }]);
      }
      return sendJson(200, []);
    }

    if (p === '/blockedservers' || p === '/api/blockedservers') {
      return send(200, '');
    }

    // ─── api.minecraftservices.com ────────────────────────────────────────
    if (/^(?:\/minecraftservices)?\/player\/attributes$/.test(p)) {
      return sendJson(200, {
        privileges: {
          onlineChat: { enabled: true },
          multiplayerServer: { enabled: true },
          multiplayerRealms: { enabled: false },
          telemetry: { enabled: false },
        },
        profanityFilterPreferences: { profanityFilterOn: false },
        banStatus: { bannedScopes: {} },
      });
    }

    if (/^(?:\/minecraftservices)?\/publickeys$/.test(p)) {
      return sendJson(200, {
        profilePropertyKeys: [{ publicKey: this.publicKeyPem.replace(/-----[^-]+-----|\s/g, '') }],
        playerCertificateKeys: [{ publicKey: this.publicKeyPem.replace(/-----[^-]+-----|\s/g, '') }],
      });
    }

    if (/^(?:\/minecraftservices)?\/player\/certificates$/.test(p) && req.method === 'POST') {
      readBody().then(() => empty()).catch(() => empty());
      return;
    }

    if (/^(?:\/minecraftservices)?\/privacy\/blocklist$/.test(p)) {
      return sendJson(200, { blockedProfiles: [] });
    }

    if (/^(?:\/minecraftservices)?\/entitlements\/license$/.test(p)
        || /^(?:\/minecraftservices)?\/entitlements\/mcstore$/.test(p)) {
      return sendJson(200, {
        items: [
          { name: 'product_minecraft', signature: '' },
          { name: 'game_minecraft', signature: '' },
        ],
        signature: '',
        keyId: '',
      });
    }

    if (/^(?:\/minecraftservices)?\/known_packs$/.test(p)) {
      return sendJson(200, []);
    }

    if (/^(?:\/minecraftservices)?\/minecraft\/profile$/.test(p)) {
      const auth = (req.headers['authorization'] as string) || '';
      const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1];
      let acc: MinecraftAccount | undefined;
      if (token) {
        const u = this.tokenToUuid.get(token);
        if (u) acc = this.byUuidUndashed.get(u);
      }
      if (!acc) acc = this.byUuidUndashed.values().next().value as MinecraftAccount | undefined;
      if (!acc) return empty();
      const undashed = acc.uuid.replace(/-/g, '');
      return sendJson(200, {
        id: undashed,
        name: acc.name,
        skins: [],
        capes: [],
      });
    }

    // ─── PNG-текстура ─────────────────────────────────────────────────────
    m = /^\/textures\/([a-f0-9]{64})\.png$/i.exec(p);
    if (m) {
      const hash = m[1].toLowerCase();
      const buf = this.skinByHash.get(hash);
      if (!buf) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      res.end(buf);
      return;
    }

    // eslint-disable-next-line no-console
    console.warn(`[skin-server] unhandled ${req.method ?? 'GET'} ${p}`);
    sendJson(200, {});
  }

  private profileResponse(acc: MinecraftAccount) {
    const undashedUuid = acc.uuid.replace(/-/g, '').toLowerCase();
    const textures: Record<string, unknown> = {};
    if (acc.skin) {
      const hash = this.hashByUuid.get(undashedUuid);
      if (hash) {
        const skin: Record<string, unknown> = {
          url: `http://127.0.0.1:${this.port}/textures/${hash}.png`,
        };
        if (acc.skinModel === 'slim') {
          skin.metadata = { model: 'slim' };
        }
        textures.SKIN = skin;
      }
    }
    const texturesObj = {
      timestamp: Date.now(),
      profileId: undashedUuid,
      profileName: acc.name,
      textures,
    };
    const texturesB64 = Buffer.from(JSON.stringify(texturesObj)).toString('base64');
    const signature = crypto.sign('RSA-SHA1', Buffer.from(texturesB64, 'utf-8'), this.privateKeyPem)
      .toString('base64');
    return {
      id: undashedUuid,
      name: acc.name,
      properties: [{ name: 'textures', value: texturesB64, signature }],
    };
  }
}
