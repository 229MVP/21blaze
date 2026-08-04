import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Version 1.1C (extended in Version 1.2C) — one-time "What's New" message
 * tracking. Keyed by version string so a future release can introduce
 * its own message without touching this key, and so this never
 * reappears for a player who has already acknowledged it, even across
 * app restarts. Bumping `WHATS_NEW_VERSION` to '1.2' means every
 * upgrading player sees the new Ember Blaze message exactly once, even
 * if they already acknowledged the Version 1.1 message under the old
 * key — the old key is left untouched (never deleted), so no other
 * upgrade-preserved state is affected.
 */
const WHATS_NEW_VERSION = '1.2';
const STORAGE_KEY = `21blaze.whatsNewSeen.v${WHATS_NEW_VERSION}`;

export async function hasSeenWhatsNew(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw === '1';
  } catch {
    // Fail safe: never block Home rendering on a storage error, and never
    // repeatedly show the message due to a transient read failure —
    // treat an unreadable flag as already seen.
    return true;
  }
}

export async function markWhatsNewSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore — worst case the message may show again next launch
  }
}
