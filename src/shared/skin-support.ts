/**
 * Поддерживает ли версия Minecraft authlib-injector (= кастомный скин внутри
 * игры через наш локальный yggdrasil-сервер).
 *
 * authlib-injector подменяет URL Mojang sessionserver. Это имеет смысл только
 * для версий, которые этот sessionserver запрашивают: 1.6+ и все современные
 * мод-лоадеры (Forge/Fabric/Quilt/NeoForge, инстанцированные на 1.6+).
 *
 * Для всего что выглядит как pre-1.6 (rd-*, c0.*, in-*, inf-*, alpha 1.x,
 * beta b1.*, релизы 1.0–1.5) скин в самой игре не появится — там либо вообще
 * нет понятия скинов, либо сессии Mojang используются по-старому.
 *
 * Используется и в main (решить: добавлять `-javaagent` или нет), и в
 * renderer (отметить такие версии в UI как «без поддержки скинов»).
 *
 * @param versionId  id установленной/каталожной версии (rd-132211, 1.20.1, 1.20.1-forge-47.2.0, …)
 * @param baseMc     базовая MC-версия для loader-профилей (`json.inheritsFrom`).
 *                   Для чистой ванили и каталога можно передать `undefined`.
 */
export function supportsCustomSkin(versionId: string, baseMc?: string | null): boolean {
  const ref = baseMc || versionId;

  // Pre-Classic / Classic / Indev / Infdev / Alpha / Beta — точно нет
  if (/^(rd-|c0\.|in-|inf-|a1\.|b1\.|a-|b-)/i.test(ref)) return false;

  // Семантический парсер «1.X[.Y]».  Если не парсится (snapshot, fool day и т.п.) —
  // консервативно считаем «поддерживается»: все основные snapshot-каналы новее 1.6.
  // Weekly snapshots: 11w*, 12w*, 13w01a–13w15b — pre-1.6, не поддерживают.
  // 13w16a и новее — 1.6+, скины есть.
  const sw = /^(\d{2})w(\d{2})[a-z]?$/i.exec(ref);
  if (sw) {
    const year = parseInt(sw[1], 10);
    const week = parseInt(sw[2], 10);
    if (year < 13 || (year === 13 && week < 16)) return false;
    return true;
  }

  const m = /^1\.(\d+)(?:\.(\d+))?/.exec(ref);
  if (!m) {
    // Современные snapshot/PR-айди (`1.21-pre1`, `1.21-rc1`, …) — поддерживают.
    return true;
  }
  const minor = parseInt(m[1], 10);
  return minor >= 6;
}
