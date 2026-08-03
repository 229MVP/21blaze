import type { ImageSourcePropType } from 'react-native';

import { VISUAL_ASSET_METADATA } from './visualAssetManifestData';
import type { VisualAssetEntry } from './types';

/**
 * Version 1.2A — the RN-facing asset manifest. Attaches real, statically
 * bundlable `require(...)` sources to the pure metadata in
 * `visualAssetManifestData.ts`. Every `source` below is a literal
 * `require(...)` call so Metro can statically discover and bundle it —
 * never build a require path from a variable or template string.
 *
 * Reuses the existing `src/assets/blazeAssets.ts` files directly rather
 * than duplicating or moving them (see docs/V1_2A_ASSET_HANDOFF_SPEC.md
 * "Migration notes").
 */
const ASSET_SOURCES: Record<string, ImageSourcePropType> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  classic_arena_home_asset: require('../../../assets/backgrounds/home-lava-portrait.webp'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  classic_arena_gameplay_asset: require('../../../assets/backgrounds/gameplay-embers.webp'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  classic_arena_gameplay_subtle_asset: require('../../../assets/backgrounds/gameplay-embers-subtle.webp'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ember_overlay_particle_asset: require('../../../assets/effects/embers-overlay.webp'),
};

export const VISUAL_ASSET_MANIFEST: readonly VisualAssetEntry[] = VISUAL_ASSET_METADATA.map(
  (meta) => ({
    ...meta,
    source: meta.isCodeDriven ? null : (ASSET_SOURCES[meta.id] ?? null),
  }),
);

export function getAssetEntry(id: string): VisualAssetEntry | undefined {
  return VISUAL_ASSET_MANIFEST.find((entry) => entry.id === id);
}
