import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

import { getAssetEntry, VISUAL_ASSET_MANIFEST } from '../assets/manifest/visualAssetManifest';
import { isAssetSupportedOnPlatform, type VisualAssetEntry } from '../assets/manifest/types';
import { trackEvent } from '../monetization/analytics';
import { withTimeout } from '../startup/runOptionalStartupTasks';

/** Version 1.2.0 startup hotfix — a hung native asset download must
 * eventually resolve to 'failed' rather than leave `loadVisualAsset`'s
 * promise (and therefore anything awaiting `preloadThemeAssets`)
 * unresolved forever. Generous enough for a real download on a slow
 * connection, short enough that nothing ever "hangs indefinitely". */
const ASSET_DOWNLOAD_TIMEOUT_MS = 5000;

/**
 * Version 1.2A — preloads the assets required by the player's currently
 * equipped theme (plus whatever is being previewed in the Locker), and
 * tracks load status so `resolvePlayerVisualTheme()` callers can treat a
 * failed asset as unavailable and fall back to classic. Never blocks app
 * startup — nothing here is awaited from `App.tsx`.
 */

export type AssetLoadStatus = 'idle' | 'loading' | 'loaded' | 'failed';

const statusById = new Map<string, AssetLoadStatus>();
const inFlightById = new Map<string, Promise<AssetLoadStatus>>();

// Version 1.2B — lightweight change notification so
// `useResolvedVisualTheme()` can react to a REAL asset load failure and
// actually fall back to classic for that category, instead of the
// `unavailableThemeIds` parameter (built in 1.2A) never being populated.
let failureVersion = 0;
const failureListeners = new Set<() => void>();

function markFailed(id: string): void {
  statusById.set(id, 'failed');
  failureVersion += 1;
  // Safe: `id` is a public asset-manifest id, never player-identifying data.
  trackEvent('theme_asset_load_failed', { assetId: id });
  for (const listener of failureListeners) {
    listener();
  }
}

export function subscribeToAssetFailures(listener: () => void): () => void {
  failureListeners.add(listener);
  return () => {
    failureListeners.delete(listener);
  };
}

export function getAssetFailureVersion(): number {
  return failureVersion;
}

function isSupportedOnThisPlatform(entry: VisualAssetEntry): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android' && Platform.OS !== 'web') {
    return true; // unknown platform — do not block
  }
  return isAssetSupportedOnPlatform(entry, Platform.OS);
}

export function getAssetLoadStatus(id: string): AssetLoadStatus {
  return statusById.get(id) ?? 'idle';
}

/**
 * Loads one manifest entry. Code-driven entries (no image file) resolve
 * to `'loaded'` immediately. Never throws — a failure resolves to
 * `'failed'` so callers can fall back safely instead of catching.
 */
export async function loadVisualAsset(id: string): Promise<AssetLoadStatus> {
  const cached = statusById.get(id);
  if (cached === 'loaded' || cached === 'failed') {
    return cached;
  }
  const inFlight = inFlightById.get(id);
  if (inFlight) {
    return inFlight;
  }

  const entry = getAssetEntry(id);
  if (!entry) {
    markFailed(id);
    if (__DEV__) {
      console.warn(`[visualAssetLoader] Unknown asset id "${id}" — treating as failed/missing.`);
    }
    return 'failed';
  }

  if (entry.isCodeDriven || !entry.source) {
    statusById.set(id, 'loaded');
    return 'loaded';
  }

  if (!isSupportedOnThisPlatform(entry)) {
    markFailed(id);
    return 'failed';
  }

  statusById.set(id, 'loading');
  const promise = (async (): Promise<AssetLoadStatus> => {
    try {
      // `Asset.fromModule(...).downloadAsync()` is the standard Expo way
      // to eagerly decode a bundled image ahead of first render, without
      // any native calls on unsupported web paths (Asset already no-ops
      // safely on web for bundled modules). Bounded by a finite timeout
      // so a hung native download can never leave this unresolved.
      const outcome = await withTimeout(
        () => Asset.fromModule(entry.source as number).downloadAsync(),
        ASSET_DOWNLOAD_TIMEOUT_MS,
      );
      if (outcome.status !== 'fulfilled') {
        markFailed(id);
        if (__DEV__) {
          console.warn(`[visualAssetLoader] Preload for asset "${id}" ${outcome.status}.`);
        }
        return 'failed';
      }
      statusById.set(id, 'loaded');
      return 'loaded';
    } finally {
      inFlightById.delete(id);
    }
  })();

  inFlightById.set(id, promise);
  return promise;
}

/** Preloads a list of manifest ids, never rejecting even if some fail. */
export async function preloadVisualAssets(ids: readonly string[]): Promise<void> {
  await Promise.all(ids.map((id) => loadVisualAsset(id)));
}

/** Convenience: preload only the ids a resolved theme actually requires. */
export async function preloadThemeAssets(requiredAssets: readonly string[]): Promise<void> {
  await preloadVisualAssets(requiredAssets);
}

/**
 * Version 1.2B — preload tiers (spec section 20 / docs/V1_2B_EFFECT_TIMING_SPEC.md):
 *   'launch'         -> critical + high priority only (equipped card face/
 *                        back/arena/lane essentials + critical profile
 *                        frame assets) — called from Home on mount.
 *   'before_gameplay' -> the full requiredAssets set (adds any remaining
 *                        normal/low priority pieces) — called from
 *                        GameScreen on mount; a no-op re-download for
 *                        anything the launch tier already cached.
 * Ids already 'loaded'/'failed'/in-flight are always skipped (see
 * `loadVisualAsset`), so calling both tiers back-to-back never duplicates
 * a request.
 */
const PRIORITY_RANK: Record<VisualAssetEntry['preloadPriority'], number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
  lazy: 0,
};

function idsAtOrAbovePriority(ids: readonly string[], minPriority: VisualAssetEntry['preloadPriority']): string[] {
  const minRank = PRIORITY_RANK[minPriority];
  return ids.filter((id) => {
    const entry = getAssetEntry(id);
    if (!entry) {
      return false;
    }
    return PRIORITY_RANK[entry.preloadPriority] >= minRank;
  });
}

/** Launch tier: only critical/high priority assets among `requiredAssets`. */
export async function preloadLaunchCriticalThemeAssets(requiredAssets: readonly string[]): Promise<void> {
  await preloadVisualAssets(idsAtOrAbovePriority(requiredAssets, 'high'));
}

/**
 * Lazy tier: preloads ids that are NOT part of the player's currently
 * equipped theme (e.g. unowned Locker preview art, alternate/unequipped
 * theme swatches). Callers pass the full candidate id list; already
 * equipped/loaded ids are naturally skipped by the loader's cache.
 */
export async function preloadLazyVisualAssets(ids: readonly string[]): Promise<void> {
  await preloadVisualAssets(ids);
}

/**
 * Ids (from `requiredAssets`) whose load previously failed — feed this
 * into `resolvePlayerVisualTheme({ unavailableThemeIds })`-style logic
 * so a broken/missing optional asset never blocks gameplay or crashes.
 */
export function getFailedAssetIds(): string[] {
  return Array.from(statusById.entries())
    .filter(([, status]) => status === 'failed')
    .map(([id]) => id);
}

export function getMissingAssetCount(): number {
  return getFailedAssetIds().length;
}

export function __resetVisualAssetLoaderForTests(): void {
  statusById.clear();
  inFlightById.clear();
  failureVersion = 0;
  failureListeners.clear();
}

export { VISUAL_ASSET_MANIFEST };
