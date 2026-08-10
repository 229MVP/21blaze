/**
 * First-time Live PvP explanation acknowledgment (local only).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'live_pvp_intro_acknowledged_v1';

export async function hasAcknowledgedLivePvpIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function acknowledgeLivePvpIntro(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // non-blocking
  }
}
