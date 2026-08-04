import { isV1_1LockerEnabled } from '../config/featureFlags';
import { useCosmeticStore } from '../store/useCosmeticStore';
import { selectCardStyle, useSettingsStore } from '../store/useSettingsStore';

/**
 * Prefer server-backed equipped cosmetic theme; fall back to local settings style.
 * Version 1.1B "Blaze Locker" — when a card_face cosmetic is equipped (e.g.
 * `midnight_card_style`), it takes precedence over the legacy full-theme
 * `cardTheme` field so the same active-card rendering surface reflects the
 * new per-slot cosmetic without any gameplay screen redesign.
 */
export function useActiveCardTheme(): string {
  const equippedTheme = useCosmeticStore((state) => state.equippedCosmetics.cardTheme);
  const equippedFace = useCosmeticStore((state) => state.equippedCosmetics.cardFace);
  const settingsStyle = useSettingsStore(selectCardStyle);

  if (isV1_1LockerEnabled() && equippedFace === 'midnight_card_style') {
    return 'midnight_cards';
  }
  if (equippedTheme && equippedTheme.length > 0) {
    return equippedTheme;
  }
  if (settingsStyle === 'midnight') {
    return 'midnight_cards';
  }
  if (settingsStyle === 'blaze') {
    return 'blaze';
  }
  return 'classic_cards';
}
