/**
 * Bundled "legacy" Minecraft versions — те, которых нет в манифесте Mojang
 * (Cave Game Tech Test, ранний pre-Classic). Лежат в resources/legacy/<id>/
 * рядом с приложением (в dev — в исходниках, в продакшене — в process.resourcesPath/legacy).
 *
 * Структура для каждой версии:
 *   <id>/<id>.jar
 *   <id>/natives/*    — нативные библиотеки LWJGL/OpenAL для всех платформ
 *
 * При первом запуске install() копирует jar в gameDir/versions/<id>/<id>.jar
 * и распаковывает natives в gameDir/versions/<id>/natives/.
 *
 * Запуск этих версий обходит @xmcl/core: у них нет ни ванильного формата
 * version.json, ни записей в манифесте — мы просто стартуем
 *   java -cp <jar> -Djava.library.path=<natives> <mainClass>
 *
 * Добавить новую legacy-версию:
 *   1) Положить jar + natives в resources/legacy/<new-id>/
 *   2) Добавить запись в LEGACY_VERSIONS ниже
 *   3) Прописать ключи в src/renderer/i18n/{ru,en}.ts:
 *      legacy.<id>.name, legacy.<id>.desc
 */
import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';

export interface LegacyVersion {
  id: string;
  /** Type в стиле Mojang manifest — чтобы UI красил пилюлю «alpha» и т.п. */
  type: 'old_alpha';
  /** ISO date — для сортировки и отображения. */
  releaseTime: string;
  /** Main-Class для java -cp. */
  mainClass: string;
  /** Описание-плашка — это будет ключ i18n; renderer сам подставит локаль. */
  i18nName: string;
  i18nDesc: string;
}

/** Каталог legacy-версий, поставляемых вместе с лаунчером. */
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
 * Путь к bundled-ресурсам. В dev — относительно cwd (исходники), в продакшене —
 * рядом с .exe (process.resourcesPath/legacy).
 */
function bundledRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'legacy');
  }
  // dev: запускаем `electron .` из корня проекта
  return path.join(app.getAppPath(), 'resources', 'legacy');
}

export function isLegacyVersion(id: string): boolean {
  return LEGACY_VERSIONS.some((v) => v.id === id);
}

export function getLegacyVersion(id: string): LegacyVersion | undefined {
  return LEGACY_VERSIONS.find((v) => v.id === id);
}

/**
 * Установить bundled-версию в gameDir/versions/<id>/.
 * Идемпотентно: если jar уже на месте — ничего не делает.
 * Возвращает путь к каталогу версии.
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

  // natives (мульти-платформенный набор) — общие для всех legacy-сборок
  // (LWJGL 2.x + OpenAL для win/lin/mac). Лежат в resources/legacy/_shared-natives/.
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

  // Минимальный «маркерный» version.json — чтобы installedVersionIds()
  // нашёл версию (он сейчас смотрит только на наличие jar, но иметь json
  // на случай будущих фильтров не повредит).
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
 * Запустить bundled-версию. Возвращает ChildProcess — caller сам подцепит
 * обработчики stdout/stderr/exit, как и для обычного `launch()`.
 *
 * Параметры окна и память берутся из общих настроек лаунчера.
 */
export function launchLegacy(opts: {
  gameDir: string;
  id: string;
  javaPath: string;
  maxRamMb: number;
  /** Резерв — не используется текущими legacy-сборками. */
  width: number;
  height: number;
  fullscreen: boolean;
  playerName: string;
}): ChildProcess {
  const v = getLegacyVersion(opts.id);
  if (!v) throw new Error(`Legacy version not found: ${opts.id}`);
  if (!opts.javaPath || opts.javaPath.includes('\0')) throw new Error('Invalid javaPath');
  if (!v.mainClass || v.mainClass.includes('\0') || v.mainClass.includes(' ')) throw new Error('Invalid mainClass');

  const versionDir = installLegacy(opts.gameDir, opts.id);
  const jar = path.join(versionDir, `${opts.id}.jar`);
  const natives = path.join(versionDir, 'natives');

  // Эти ранние сборки — applet-like, без официальных аргументов.
  // Им достаточно classpath + library.path. Имя игрока, размер окна и
  // fullscreen у Cave Game Tech Test не поддерживаются на уровне JVM-args —
  // окно всегда стартует фиксированным, но мы оставляем поля в API на
  // случай будущих legacy-версий (Indev, Classic 0.30) которые их читают.
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

  return child;
}
