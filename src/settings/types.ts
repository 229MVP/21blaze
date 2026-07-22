export type CardStyle = 'classic' | 'blaze' | 'midnight';

export type PreferredRegion =
  | 'us-east'
  | 'us-central'
  | 'us-west'
  | 'europe'
  | 'asia-pacific'
  | 'unknown';

export type GameSettings = {
  soundEffectsEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  tutorialHintsEnabled: boolean;
  reducedMotionEnabled: boolean;
  cardStyle: CardStyle;
  preferredRegion: PreferredRegion;
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  soundEffectsEnabled: true,
  musicEnabled: false,
  hapticsEnabled: true,
  tutorialHintsEnabled: true,
  reducedMotionEnabled: false,
  cardStyle: 'classic',
  preferredRegion: 'unknown',
};

export const CARD_STYLE_LABELS: Record<CardStyle, string> = {
  classic: 'Classic',
  blaze: 'Blaze',
  midnight: 'Midnight',
};

export const CARD_STYLES: CardStyle[] = ['classic', 'blaze', 'midnight'];
