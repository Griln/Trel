/**
 * Bundled "legacy" Minecraft versions — the ones missing from the Mojang manifest
 * (Cave Game Tech Test, early pre-Classic). They live in resources/legacy/<id>/
 * next to the app (in dev — in the sources, in production — in process.resourcesPath/legacy).
 *
 * Layout for each version:
 *   <id>/<id>.jar
 *   <id>/natives/*    — native LWJGL/OpenAL libraries for all platforms
 *
 * On the first launch install() copies the jar to gameDir/versions/<id>/<id>.jar
 * and unpacks the natives into gameDir/versions/<id>/natives/.
 *
 * Launching these versions bypasses @xmcl/core: they have neither a vanilla-format
 * version.json nor entries in the manifest — we simply start
 *   java -cp <jar> -Djava.library.path=<natives> <mainClass>
 *
 * Adding a new legacy version:
 *   1) Put the jar + natives into resources/legacy/<new-id>/
 *   2) Add an entry to LEGACY_VERSIONS below
 *   3) Define the keys in src/renderer/i18n/{ru,en}.ts:
 *      legacy.<id>.name, legacy.<id>.desc
 */
import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';

export interface LegacyVersion {
  id: string;
  /** Type in the Mojang manifest style — so that the UI paints the "alpha" pill etc. */
  type: 'old_alpha';
  /** ISO date — for sorting and display. */
  releaseTime: string;
  /** Main-Class for java -cp. */
  mainClass: string;
  /** Description badge — this will be an i18n key; the renderer substitutes the locale itself. */
  i18nName: string;
  i18nDesc: string;
}

/** Catalog of legacy versions shipped with the launcher. */
export const LEGACY_VERSIONS: LegacyVersion[] = [
  {
    id: 'rd-131655',
    type: 'old_alpha',
    releaseTime: '2009-05-13T13:16:55+00:00',
    mainClass: 'com.mojang.rubydung.RubyDung',
    i18nName: 'legacy.rd-131655.name',
    i18nDesc: 'legacy.rd-131655.desc',
  },
];

/**
 * Path to the bundled resources. In dev — relative to cwd (the sources), in production —
 * next to the .exe (process.resourcesPath/legacy).
 */
function bundledRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'legacy');
  }
  // dev: we run `electron .` from the project root
  return path.join(app.getAppPath(), 'resources', 'legacy');
}

export function isLegacyVersion(id: string): boolean {
  return LEGACY_VERSIONS.some((v) => v.id === id);
}

export function getLegacyVersion(id: string): LegacyVersion | undefined {
  return LEGACY_VERSIONS.find((v) => v.id === id);
}

/**
 * Install a bundled version into gameDir/versions/<id>/.
 * Idempotent: if the jar is already in place — it does nothing.
 * Returns the path to the version directory.
 */
export function installLegacy(gameDir: string, id: string): string {
  const v = getLegacyVersion(id);
  if (!v) throw new Error(`Legacy version not bundled: ${id}`);

  const versionDir = path.join(gameDir, 'versions', id);
  const targetJar = path.join(versionDir, `${id}.jar`);
  const targetNatives = path.join(versionDir, 'natives');

  if (fs.existsSync(targetJar) && fs.existsSync(targetNatives)) {
    return versionDir;
  }

  const srcDir = path.join(bundledRoot(), id);
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Bundled legacy assets missing at ${srcDir}`);
  }

  fs.mkdirSync(versionDir, { recursive: true });

  // jar
  if (!fs.existsSync(targetJar)) {
    fs.copyFileSync(path.join(srcDir, `${id}.jar`), targetJar);
  }

  // natives (multi-platform set) — shared by all legacy builds
  // (LWJGL 2.x + OpenAL for win/lin/mac). They live in resources/legacy/_shared-natives/.
  if (!fs.existsSync(targetNatives)) {
    fs.mkdirSync(targetNatives, { recursive: true });
    const srcNatives = path.join(srcDir, '../_shared-natives');
    let resolvedSrc: string;
    try { resolvedSrc = fs.realpathSync(srcNatives); } catch { resolvedSrc = path.resolve(srcNatives); }
    for (const entry of fs.readdirSync(srcNatives)) {
      // Validate filename: no traversal, no null bytes
      if (entry.includes('..') || entry.includes('\0') || entry.includes('/') || entry.includes('\\')) continue;
      const srcFile = path.join(srcNatives, entry);
      // Skip symlinks/junctions via realpath boundary validation
      try {
        const resolved = fs.realpathSync(srcFile);
        if (!resolved.startsWith(resolvedSrc + path.sep)) continue;
      } catch { continue; }
      fs.copyFileSync(srcFile, path.join(targetNatives, entry));
    }
  }

  // Minimal "marker" version.json — so that installedVersionIds()
  // finds the version (it currently only looks for the jar, but having a json
  // does no harm in case of future filters).
  const jsonPath = path.join(versionDir, `${id}.json`);
  if (!fs.existsSync(jsonPath)) {
    fs.writeFileSync(jsonPath, JSON.stringify({
      id,
      type: v.type,
      releaseTime: v.releaseTime,
      mainClass: v.mainClass,
      __legacyBundled: true,
    }, null, 2));
  }

  return versionDir;
}

/**
 * Launch a bundled version. Returns a ChildProcess — the caller hooks up the
 * stdout/stderr/exit handlers itself, just like for a regular `launch()`.
 *
 * Window and memory parameters come from the common launcher settings.
 */
export function launchLegacy(opts: {
  gameDir: string;
  id: string;
  javaPath: string;
  maxRamMb: number;
  /** Reserved — not used by the current legacy builds. */
  width: number;
  height: number;
  fullscreen: boolean;
  playerName: string;
}): ChildProcess {
  const v = getLegacyVersion(opts.id);
  if (!v) throw new Error(`Legacy version not found: ${opts.id}`);
  if (!opts.javaPath || opts.javaPath.includes('\0')) throw new Error('Invalid javaPath');
  // The binary must exist: otherwise spawn throws ENOENT asynchronously and kills
  // the process without a diagnosis. The exec bit — against being replaced by a text file.
  try {
    const st = fs.statSync(opts.javaPath);
    if (!st.isFile()) throw new Error('Invalid javaPath');
    if (process.platform !== 'win32' && (st.mode & 0o111) === 0) throw new Error('javaPath is not executable');
  } catch (e) {
    if ((e as Error).message.startsWith('Invalid javaPath') || (e as Error).message.startsWith('javaPath')) throw e;
    throw new Error('Invalid javaPath: ' + opts.javaPath);
  }
  if (!v.mainClass || v.mainClass.includes('\0') || v.mainClass.includes(' ')) throw new Error('Invalid mainClass');

  const versionDir = installLegacy(opts.gameDir, opts.id);
  const jar = path.join(versionDir, `${opts.id}.jar`);
  const natives = path.join(versionDir, 'natives');

  // These early builds are applet-like, without official arguments.
  // They only need classpath + library.path. The player name, window size and
  // fullscreen are not supported at the JVM-args level in Cave Game Tech Test —
  // the window always starts fixed, but we keep the fields in the API in case
  // of future legacy versions (Indev, Classic 0.30) that do read them.
  const safeRam = Number.isFinite(opts.maxRamMb) && opts.maxRamMb > 0 && opts.maxRamMb <= 65536
    ? opts.maxRamMb : 1024;
  const args: string[] = [
    `-Xmx${safeRam}M`,
    `-Djava.library.path=${natives}`,
    '-cp', jar,
    v.mainClass,
  ];

  const child = spawn(opts.javaPath, args, {
    cwd: opts.gameDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  // Without an error handler a spawn failure (Java removed between the check and
  // the start) threw an unhandled exception. We record it on the object.
  child.on('error', (e) => {
    (child as unknown as { spawnError?: Error }).spawnError = e;
    console.error('[legacy] spawn failed:', e.message);
  });
  // Orphaned legacy processes after the launcher exits: we kill them right after.
  const killOnExit = () => { try { child.kill(); } catch {} };
  process.once('exit', killOnExit);
  child.on('close', () => { process.removeListener('exit', killOnExit); });

  return child;
}
