/**
 * Whether a Minecraft version supports authlib-injector (= a custom skin inside
 * the game through our local yggdrasil server).
 *
 * authlib-injector replaces the URL of the Mojang sessionserver. This only makes sense
 * for the versions that request that sessionserver: 1.6+ and all modern
 * mod loaders (Forge/Fabric/Quilt/NeoForge, instantiated on 1.6+).
 *
 * For everything that looks like pre-1.6 (rd-*, c0.*, in-*, inf-*, alpha 1.x,
 * beta b1.*, releases 1.0–1.5) the skin will not show up in the game itself — there
 * is either no notion of skins at all, or the Mojang sessions are used the old way.
 *
 * Used both in main (decide whether to add `-javaagent` or not) and in the
 * renderer (mark such versions in the UI as "no skin support").
 *
 * @param versionId  the id of the installed/catalogued version (rd-132211, 1.20.1, 1.20.1-forge-47.2.0, …)
 * @param baseMc     the base MC version for loader profiles (`json.inheritsFrom`).
 *                   For plain vanilla and the catalogue you can pass `undefined`.
 */
export function supportsCustomSkin(versionId: string, baseMc?: string | null): boolean {
  const ref = baseMc || versionId;

  // Pre-Classic / Classic / Indev / Infdev / Alpha / Beta — definitely not
  if (/^(rd-|c0\.|in-|inf-|a1\.|b1\.|a-|b-)/i.test(ref)) return false;

  // A semantic parser for "1.X[.Y]".  If it does not parse (snapshot, fool day, etc.) —
  // we conservatively treat it as "supported": all the main snapshot channels are newer than 1.6.
  // Weekly snapshots: 11w*, 12w*, 13w01a–13w15b — pre-1.6, not supported.
  // 13w16a and newer — 1.6+, skins are available.
  const sw = /^(\d{2})w(\d{2})[a-z]?$/i.exec(ref);
  if (sw) {
    const year = parseInt(sw[1], 10);
    const week = parseInt(sw[2], 10);
    if (year < 13 || (year === 13 && week < 16)) return false;
    return true;
  }

  const m = /^1\.(\d+)(?:\.(\d+))?/.exec(ref);
  if (!m) {
    // Modern snapshot/PR ids (`1.21-pre1`, `1.21-rc1`, …) — supported.
    return true;
  }
  const minor = parseInt(m[1], 10);
  return minor >= 6;
}
