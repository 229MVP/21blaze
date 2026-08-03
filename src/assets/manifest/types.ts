import type { ImageSourcePropType } from 'react-native';

/**
 * Version 1.2A — typed asset manifest. Every entry describes exactly one
 * static, Metro-bundlable asset (`source` is always a literal `require(...)`
 * result assigned directly in `visualAssetManifest.ts`) or is explicitly
 * marked `isCodeDriven` (a gradient/View-based visual with no image file
 * at all, e.g. today's classic card faces). Never resolve `source` from a
 * dynamically-built string path — Metro cannot statically analyze that.
 */

export type VisualAssetType =
  | 'card_face_texture'
  | 'card_back_texture'
  | 'arena_background'
  | 'board_overlay'
  | 'lane_overlay'
  | 'particle_sprite'
  | 'victory_overlay'
  | 'profile_frame'
  | 'icon'
  | 'sound_effect';

export type AssetPreloadPriority = 'critical' | 'high' | 'normal' | 'low' | 'lazy';

export type AssetPlatform = 'ios' | 'android' | 'web';

export type VisualAssetEntry = {
  id: string;
  type: VisualAssetType;
  /** Static `require(...)` result, or `null` when `isCodeDriven` is true. */
  source: ImageSourcePropType | null;
  /**
   * True for gradient/View-rendered visuals with no backing image file
   * (e.g. the current classic card faces/backs, most Version 1.1B
   * cosmetics). `source` must be `null` when this is true.
   */
  isCodeDriven: boolean;
  width: number | null;
  height: number | null;
  /** Reference pixel-density scale this asset was authored at (1, 2, or 3). */
  scale: number | null;
  aspectRatio: number | null;
  /** Rough decoded-memory estimate in bytes, for preload budget decisions. */
  estimatedMemoryBytes: number;
  preloadPriority: AssetPreloadPriority;
  /** Another manifest id to use if this asset is missing/fails to load. */
  fallbackAssetId: string | null;
  supportsDarkBackground: boolean;
  supportsLightBackground: boolean;
  /** Another manifest id to prefer when Reduced Motion is enabled, if this asset implies motion. */
  reducedMotionAlternativeAssetId: string | null;
  platformSupport: readonly AssetPlatform[];
  assetVersion: number;
};

export const ALL_PLATFORMS: readonly AssetPlatform[] = ['ios', 'android', 'web'] as const;

/** Pure — no `Platform` import, so this is safe to unit test under plain Node. */
export function isAssetSupportedOnPlatform(
  entry: Pick<VisualAssetEntry, 'platformSupport'>,
  platform: AssetPlatform,
): boolean {
  return entry.platformSupport.includes(platform);
}
