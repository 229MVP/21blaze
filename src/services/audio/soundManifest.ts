/**
 * Typed bundled sound catalog for 21 Blaze.
 * Only include files that exist under assets/audio/ and are valid WAVs.
 */

export type BlazeSoundKey =
  | 'buttonTap'
  | 'cardDeal'
  | 'cardPlaced'
  | 'laneClear'
  | 'bust'
  | 'countdownTick'
  | 'countdownGo'
  | 'multiplierIncrease'
  | 'finalSecondsWarning'
  | 'newHighScore';

export const soundManifest = {
  buttonTap: require('../../../assets/audio/button-tap.wav'),
  cardDeal: require('../../../assets/audio/card-deal.wav'),
  cardPlaced: require('../../../assets/audio/card-placed.wav'),
  laneClear: require('../../../assets/audio/lane-clear.wav'),
  bust: require('../../../assets/audio/bust.wav'),
  countdownTick: require('../../../assets/audio/countdown-tick.wav'),
  countdownGo: require('../../../assets/audio/countdown-go.wav'),
  multiplierIncrease: require('../../../assets/audio/multiplier-increase.wav'),
  finalSecondsWarning: require('../../../assets/audio/final-seconds-warning.wav'),
  newHighScore: require('../../../assets/audio/new-high-score.wav'),
} as const satisfies Record<BlazeSoundKey, number>;

export const BLAZE_SOUND_KEYS = Object.keys(soundManifest) as BlazeSoundKey[];
