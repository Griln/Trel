import * as crypto from 'node:crypto';
import { MinecraftAccount } from '../shared/types';

export class AuthService {
  createGuest(name: string): MinecraftAccount {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Name cannot be empty');
    if (!/^[A-Za-z0-9_]{1,16}$/.test(trimmed)) {
      throw new Error('Name must be 1-16 chars: letters, digits, underscore');
    }
    // Offline UUID derived from name using MD5 (same algorithm as vanilla offline mode).
    // Vanilla lowercases the name before hashing — match it so world progress syncs.
    // MD5 is used for Mojang compatibility, not for cryptographic security.
    const hash = crypto.createHash('md5').update('OfflinePlayer:' + trimmed.toLowerCase()).digest();
    hash[6] = (hash[6] & 0x0f) | 0x30;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = hash.toString('hex');
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    const accessToken = crypto.randomBytes(32).toString('hex');
    return {
      type: 'offline',
      name: trimmed,
      uuid,
      accessToken,
    };
  }

  /**
   * Создаёт онлайн-аккаунт с настоящим UUID/именем от Microsoft.
   * accessToken генерится локально — skin-server сам выпускает токены.
   */
  createMicrosoft(uuid: string, name: string, refreshToken?: string, owned?: boolean): MinecraftAccount {
    return {
      type: 'online',
      name,
      uuid,
      accessToken: crypto.randomBytes(32).toString('hex'),
      msRefreshToken: refreshToken,
      owned,
    };
  }
}
