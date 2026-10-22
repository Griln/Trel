/**
 * Helpers for validating identifiers that arrive from the renderer over IPC.
 *
 * The renderer is not a trusted source: any compromise (XSS in a
 * data-URL, third-party content, etc.) can send `..` or an
 * absolute path over IPC and make us wipe an arbitrary folder. Therefore
 * before any FS operation with an id we must check that it consists only
 * of characters we generate ourselves / receive from Mojang.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Validates a Minecraft version id (rd-132211, 1.21.1, 1.21.1-forge-47.2.0,
 * fabric-loader-0.15.7-1.21.1, neoforge-21.1.10, snapshot-23w14a, etc.).
 * Letters, digits, dots, dashes and underscores are allowed.
 */
const WIN_RESERVED = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

export function isSafeVersionId(id: unknown): id is string {
  if (typeof id !== 'string' || id.length === 0 || id.length >= 128) return false;
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return false;
  if (id === '.' || id === '..') return false;
  if (/^\.+$/.test(id)) return false;
  // Leading -/. break CLI calls and hide folders; Windows silently trims
  // trailing dots/spaces (name collisions). WIN_RESERVED applies everywhere,
  // not just on win32: versions travel between OSes through backups and cloud.
  if (id.startsWith('-') || id.startsWith('.')) return false;
  if (/[. ]$/.test(id)) return false;
  if (WIN_RESERVED.has(id.toLowerCase())) return false;
  return true;
}

/** Throws an Error if the id is invalid — handy in IPC handlers. */
export function assertSafeVersionId(id: unknown, label = 'versionId'): asserts id is string {
  if (!isSafeVersionId(id)) {
    throw new Error(`Invalid ${label}: must be alnum + . _ -`);
  }
}

/**
 * Validates a server id (`crypto.randomBytes(6).toString('hex')` = 12 hex chars).
 */
export function isSafeServerId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-f0-9]{12}$/.test(id);
}

export function assertSafeServerId(id: unknown): asserts id is string {
  if (!isSafeServerId(id)) {
    throw new Error('Invalid serverId');
  }
}

/**
 * Validates a world name. Accepts synthetic `~legacy:` ids (for loose files)
 * and regular world folder names (Minecraft allows quite a lot, but we
 * restrict it to a sane set).
 *
 * The main rule — no `..`, `/`, `\` in the regular part. Synthetic `~legacy:`
 * ids are validated separately in `WorldService.resolveWorld` by comparing
 * them against the actual roots.
 */
export function isSafeWorldName(name: unknown): name is string {
  if (typeof name !== 'string' || name.length === 0 || name.length > 200) return false;
  if (name.startsWith('~legacy:')) {
    // Synthetic id — contains rootKey and an optional fileName, both are
    // produced via replace(/[\\/:]/g, '_'), so they contain no slashes or
    // colons themselves. Letters/digits/dots/_/-/: are allowed.
    return /^~legacy:[A-Za-z0-9._:-]+$/.test(name);
  }
  // Regular names: forbid path separators and `..`
  if (name.includes('/') || name.includes('\\')) return false;
  if (name === '.' || name === '..') return false;
  // Forbid NUL and control chars
  if (/[\x00-\x1f]/.test(name)) return false;
  // CON/NUL and trailing dots break on Windows — we check everywhere,
  // worlds travel between OSes via backups and cloud storage.
  if (WIN_RESERVED.has(name.toLowerCase().split('.')[0])) return false;
  if (/[. ]$/.test(name)) return false;
  return true;
}

export function assertSafeWorldName(name: unknown): asserts name is string {
  if (!isSafeWorldName(name)) {
    throw new Error('Invalid world name');
  }
}

/**
 * Guarantees that the resolved path really lies inside `root`.
 * Returns true when it is safe. Use before any `fs.rmSync`/`fs.writeFile`
 * on paths built from user input.
 */
function resolveNearest(pathStr: string): string | null {
  let current = path.resolve(pathStr);
  for (let i = 0; i < 32; i++) {
    try { return fs.realpathSync(current); } catch {}
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

export function isInsideDir(child: string, root: string): boolean {
  const resolvedChild = resolveNearest(child);
  const resolvedRoot = resolveNearest(root);
  if (!resolvedChild || !resolvedRoot) return false;
  const sep = path.sep;
  return (
    resolvedChild === resolvedRoot ||
    resolvedChild.startsWith(resolvedRoot + sep)
  );
}
