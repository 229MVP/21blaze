import type { LaneId, Rank, Suit } from './types';

export const APP_NAME = '21 Blaze';
export const APP_TAGLINE = 'Build Your Streak. Beat 21.';
export const APP_VERSION = '1.0.0';
/** Client/server game-rule compatibility key for Quick Match. */
export const GAME_RULES_VERSION = '1.0.0';

export const MAX_BUSTS = 3;
export const LANE_COUNT = 4;
export const MAX_MULTIPLIER = 5;
export const TARGET_TOTAL = 21;
export const FIVE_CARD_CLEAR_COUNT = 5;

export const SCORE_CLEAR_21 = 100;
export const SCORE_CLEAR_FIVE = 150;

export const GAME_DURATION_SECONDS = 120;
export const FINAL_WARNING_SECONDS = 10;
export const START_COUNTDOWN_SECONDS = 3;

export const LANE_IDS: LaneId[] = [1, 2, 3, 4];

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

export const RANKS: Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};
