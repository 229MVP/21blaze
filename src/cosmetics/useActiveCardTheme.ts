import { useCosmeticStore } from '../store/useCosmeticStore';
import { selectCardStyle, useSettingsStore } from '../store/useSettingsStore';

/**
 * Prefer server-backed equipped cosmetic theme; fall back to local settings style.
 */
export function useActiveCardTheme(): string {
  const equipped = useCosmeticStore((state) => state.equippedCosmetics.cardTheme);
  const settingsStyle = useSettingsStore(selectCardStyle);

  if (equipped && equipped.length > 0) {
    return equipped;
  }
  if (settingsStyle === 'midnight') {
    return 'midnight_cards';
  }
  if (settingsStyle === 'blaze') {
    return 'blaze';
  }
  return 'classic_cards';
}
