import * as fs from 'node:fs';
import * as path from 'node:path';
import * as net from 'node:net';
import nbt from 'prismarine-nbt';

export interface SavedServer {
  name: string;
  ip: string;   // host or host:port
}

export interface PingResult {
  online: boolean;
  players?: { online: number; max: number };
  version?: string;
  motd?: string;
  favicon?: string;   // data:image/png;base64,...
  latencyMs?: number;
  error?: string;
}

// ---------- pure varint helpers (testable) ----------

export function encodeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) b |= 0x80;
    bytes.push(b);
  } while (v !== 0);
  return Buffer.from(bytes);
}

/** Decode a varint from buf at offset. Returns value and bytes consumed. */
export function decodeVarInt(buf: Buffer, offset = 0): { value: number; size: number } {
  let value = 0;
  let size = 0;
  let b: number;
  do {
    if (offset + size >= buf.length) throw new Error('varint: out of bounds');
    b = buf[offset + size];
    value |= (b & 0x7f) << (7 * size);
    size++;
    if (size > 5) throw new Error('varint: too big');
  } while (b & 0x80);
  return { value: value >>> 0, size };
}

function packetWithId(id: number, payload: Buffer): Buffer {
  const body = Buffer.concat([encodeVarInt(id), payload]);
  return Buffer.concat([encodeVarInt(body.length), body]);
}

function writeString(s: string): Buffer {
  const b = Buffer.from(s, 'utf-8');
  return Buffer.concat([encodeVarInt(b.length), b]);
}

/** Parse "host" or "host:port" → { host, port }. Default port 25565. */
export function splitAddress(ip: string): { host: string; port: number } {
  const trimmed = (ip || '').trim();
  const idx = trimmed.lastIndexOf(':');
  if (idx > 0 && !trimmed.includes('::')) {
    const host = trimmed.slice(0, idx);
    const port = parseInt(trimmed.slice(idx + 1), 10);
    if (Number.isFinite(port) && port > 0) return { host, port };
  }
  return { host: trimmed, port: 25565 };
}

/** Extract a readable MOTD string from the status JSON's description field. */
function rawMotd(desc: unknown): string {
  if (typeof desc === 'string') return desc;
  if (!desc || typeof desc !== 'object') return '';
  const d = desc as Record<string, unknown>;
  let out = typeof d.text === 'string' ? d.text : '';
  if (Array.isArray(d.extra)) {
    for (const e of d.extra) out += rawMotd(e);
  }
  return out;
}

/** Extract a readable MOTD string from the status JSON's description field. */
export function extractMotd(desc: unknown): string {
  return rawMotd(desc).replace(/\u00a7./g, '').trim(); // strip § color codes
}

export class ServerPingService {
  constructor(private gameDir: string) {}
  setGameDir(dir: string) { this.gameDir = dir; }

  async listServers(): Promise<SavedServer[]> {
    const file = path.join(this.gameDir, 'servers.dat');
    try {
      const buf = fs.readFileSync(file);
      const { parsed } = await nbt.parse(buf);
      const simplified = nbt.simplify(parsed) as { servers?: { name?: string; ip?: string }[] };
      const arr = Array.isArray(simplified.servers) ? simplified.servers : [];
      return arr
        .filter((e) => e && typeof e.ip === 'string' && e.ip)
        .map((e) => ({ name: e.name || e.ip!, ip: e.ip! }));
    } catch {
      return [];
    }
  }

  ping(ip: string, timeoutMs = 5000): Promise<PingResult> {
    const { host, port } = splitAddress(ip);
    return new Promise<PingResult>((resolve) => {
      const started = Date.now();
      let buffer = Buffer.alloc(0);
      let done = false;
      const finish = (r: PingResult) => { if (!done) { done = true; try { socket.destroy(); } catch { /* */ } resolve(r); } };

      const socket = net.createConnection({ host, port }, () => {
        // Handshake: protocol version 0 (-1 unsupported by varint), host, port (ushort), next state 1 = status
        const portBuf = Buffer.alloc(2); portBuf.writeUInt16BE(port, 0);
        const hsPayload = Buffer.concat([encodeVarInt(0), writeString(host), portBuf, encodeVarInt(1)]);
        socket.write(packetWithId(0x00, hsPayload));
        // Status request (empty)
        socket.write(packetWithId(0x00, Buffer.alloc(0)));
      });
      socket.setTimeout(timeoutMs);

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        try {
          const lenInfo = decodeVarInt(buffer, 0);
          const total = lenInfo.size + lenInfo.value;
          if (buffer.length < total) return; // wait for more
          let off = lenInfo.size;
          const idInfo = decodeVarInt(buffer, off); off += idInfo.size;
          const strLen = decodeVarInt(buffer, off); off += strLen.size;
          const json = buffer.slice(off, off + strLen.value).toString('utf-8');
          const data = JSON.parse(json);
          finish({
            online: true,
            latencyMs: Date.now() - started,
            players: data.players ? { online: data.players.online ?? 0, max: data.players.max ?? 0 } : undefined,
            version: data.version?.name,
            motd: extractMotd(data.description),
            favicon: typeof data.favicon === 'string' ? data.favicon : undefined,
          });
        } catch { /* keep buffering */ }
      });
      socket.on('timeout', () => finish({ online: false, error: 'timeout' }));
      socket.on('error', (e) => finish({ online: false, error: e.message }));
      socket.on('close', () => finish({ online: false, error: 'closed' }));
    });
  }
}