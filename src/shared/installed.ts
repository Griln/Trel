/**
 * Helpers for displaying the "effective" list of installed versions in the UI.
 *
 * On disk, every mod loader (Forge/Fabric/Quilt/NeoForge) stores a pair of folders:
 * the vanilla version itself (`1.21.11`) and the loader profile (`1.21.11-forge-…`).
 * The backend honestly returns both. But in the UI the user must not see the
 * "separate" vanilla next to its own loader — that confuses the counter of
 * installed versions.
 *
 * These functions return only the instances that are "visible in the UI": the loader
 * absorbs the base MC version, while ordinary vanilla installations are left as is.
 */

export interface InstalledDetailLike {
  id: string;
  baseMc: string;
  loader: string | null;
}

/** Which baseMc are already represented by a loader profile. */
export function moddedBaseSet(details: InstalledDetailLike[]): Set<string> {
  return new Set(details.filter((d) => d.loader).map((d) => d.baseMc));
}

/**
 * Returns only the instances that the UI should show as "versions
 * to launch". If a loader exists for the base MC — we hide the separate vanilla
 * entry (its jar and assets are still on disk and are used by the loader).
 */
export function effectiveInstalled<T extends InstalledDetailLike>(details: T[]): T[] {
  const modded = moddedBaseSet(details);
  return details.filter((d) => d.loader || !modded.has(d.id));
}

/** How many versions to show in any of the UI counters. */
export function effectiveInstalledCount(details: InstalledDetailLike[]): number {
  return effectiveInstalled(details).length;
}
