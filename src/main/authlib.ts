import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import axios from 'axios';

/**
 * authlib-injector — стандартный Java-агент, который перехватывает обращения
 * Minecraft-клиента к Mojang API и перенаправляет их на наш локальный URL.
 * Без него offline-Minecraft рисует случайный default-Alex по UUID.
 *
 * Источник: https://authlib-injector.yushi.moe/ (open source, GPL-3).
 * Скачиваем один раз, кэшируем в <launcherDir>/cache/authlib-injector.jar.
 */

const ALLOWED_HOSTS = new Set([
  'authlib-injector.yushi.moe',
  'github.com',
  'objects.githubusercontent.com',
]);

const KNOWN_RELEASE_SHAS: Record<string, string> = {
  'v1.2.5': '3f9df1cc2e3c9e57ebcd97e3c41afac263a9a37f67f4eab8462d7a7ae816fd2e',
};

function isUrlAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return ALLOWED_HOSTS.has(u.hostname);
  } catch { return false; }
}

export class AuthlibInjector {
  constructor(private launcherDir: string) {}

  jarPath(): string {
    return path.join(this.launcherDir, 'cache', 'authlib-injector.jar');
  }

  /** Скачивает агент если его ещё нет. Возвращает абсолютный путь. */
  async ensure(): Promise<string> {
    const out = this.jarPath();

    // Проверяем существующий jar: он должен быть >50KB и НЕ битый.
    if (fs.existsSync(out)) {
      try {
        const buf = fs.readFileSync(out);
        if (buf.length > 50_000 && buf[0] === 0x50 && buf[1] === 0x4b) return out;
      } catch {}
      try { fs.unlinkSync(out); } catch {}
    }

    fs.mkdirSync(path.dirname(out), { recursive: true });

    let downloadUrl: string | null = null;
    let expectedSha: string | null = null;
    let tag: string | null = null;

    try {
      const { data } = await axios.get(
        'https://authlib-injector.yushi.moe/artifact/latest.json',
        { timeout: 15_000 },
      );
      if (data && typeof data.download_url === 'string' && isUrlAllowed(data.download_url)) {
        downloadUrl = data.download_url;
        tag = typeof data.tag_name === 'string' ? data.tag_name : null;
      }
    } catch {}

    if (!downloadUrl) {
      tag = 'v1.2.5';
      downloadUrl = 'https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar';
    }

    if (tag && KNOWN_RELEASE_SHAS[tag]) {
      expectedSha = KNOWN_RELEASE_SHAS[tag];
    } else if (tag) {
      // Unknown tag — fall back to the pinned release
      console.warn(`[authlib] Unknown release tag "${tag}" — falling back to pinned v1.2.5`);
      tag = 'v1.2.5';
      downloadUrl = 'https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar';
      expectedSha = KNOWN_RELEASE_SHAS['v1.2.5'];
    }

    const resp = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 60_000,
      maxRedirects: 5,
    });

    const data = Buffer.from(resp.data);

    // Проверка SHA-256 если известен
    if (expectedSha) {
      const actual = crypto.createHash('sha256').update(data).digest('hex');
      if (actual.toLowerCase() !== expectedSha.toLowerCase()) {
        throw new Error(`authlib-injector checksum mismatch: expected ${expectedSha}, got ${actual}`);
      }
    }

    // Базовая проверка: это должен быть jar (начинается с PK)
    if (data.length < 50_000 || data[0] !== 0x50 || data[1] !== 0x4b) {
      throw new Error('Downloaded authlib-injector does not look like a valid JAR');
    }

    // Атомарная запись: temp + rename
    const tmp = out + '.trel_tmp';
    fs.writeFileSync(tmp, data);
    try { fs.renameSync(tmp, out); }
    catch { fs.copyFileSync(tmp, out); fs.unlinkSync(tmp); }

    return out;
  }
}
