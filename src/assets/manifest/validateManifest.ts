import type { VisualAssetMetadata } from './visualAssetManifestData';

/**
 * Version 1.2A — pure manifest validation helpers, shared by
 * `scripts/validate-visual-assets.mjs` and the unit tests
 * (`src/themes/v1_2aVisualThemeSelfTest.ts`) so both exercise the exact
 * same logic instead of two hand-maintained copies.
 */

export function findDuplicateAssetIds(
  entries: readonly Pick<VisualAssetMetadata, 'id'>[],
): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
}

export type MissingFallbackReference = { id: string; missingFallbackId: string };

export function findMissingFallbackReferences(
  entries: readonly Pick<VisualAssetMetadata, 'id' | 'fallbackAssetId'>[],
): MissingFallbackReference[] {
  const idSet = new Set(entries.map((entry) => entry.id));
  const missing: MissingFallbackReference[] = [];
  for (const entry of entries) {
    if (entry.fallbackAssetId != null && !idSet.has(entry.fallbackAssetId)) {
      missing.push({ id: entry.id, missingFallbackId: entry.fallbackAssetId });
    }
  }
  return missing;
}

export type MissingThemeAssetReference = { themeId: string; category: string; missingAssetId: string };

/**
 * Version 1.2B — shared by `scripts/validate-visual-assets.mjs` and the
 * unit tests: an enabled theme definition whose `requiredAssets` lists an
 * id that does not exist in the manifest at all (a broken reference the
 * asset validator must fail loudly on, per the Version 1.2C release
 * gate — never silently ignored).
 */
export function findThemesRequiringMissingAssets(
  themeDefs: readonly { themeId: string; category: string; isEnabled: boolean; requiredAssets: readonly string[] }[],
  assetEntries: readonly Pick<VisualAssetMetadata, 'id'>[],
): MissingThemeAssetReference[] {
  const idSet = new Set(assetEntries.map((entry) => entry.id));
  const missing: MissingThemeAssetReference[] = [];
  for (const def of themeDefs) {
    if (!def.isEnabled) {
      continue;
    }
    for (const assetId of def.requiredAssets) {
      if (!idSet.has(assetId)) {
        missing.push({ themeId: def.themeId, category: def.category, missingAssetId: assetId });
      }
    }
  }
  return missing;
}
