/**
 * Central typed registry for 21 Blaze UI-kit static assets.
 * Prefer these requires over ad-hoc paths inside components.
 */
export const blazeAssets = {
  logoMain: require('../../assets/branding/21-blaze-logo-512.png'),
  lavaBackground: require('../../assets/backgrounds/home-lava-portrait.webp'),
  gameplayEmbers: require('../../assets/backgrounds/gameplay-embers.webp'),
  gameplayEmbersSubtle: require('../../assets/backgrounds/gameplay-embers-subtle.webp'),
  emberOverlay: require('../../assets/effects/embers-overlay.webp'),
  countdownFireRingPoster: require('../../assets/animations/countdown-fire-ring-poster.webp'),
  fireStopwatch: require('../../assets/effects/fire-stopwatch-512.webp'),
  flamingCrown: require('../../assets/branding/flaming-crown-256.webp'),
} as const;

export type BlazeAssetKey = keyof typeof blazeAssets;
