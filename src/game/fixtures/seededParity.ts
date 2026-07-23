import type { MoveLogEntry } from '../../online/types';

/** Shared client/server parity fixture seed. */
export const FIXTURE_SEED = 1_742_211;

/**
 * First 10 card IDs for FIXTURE_SEED using Mulberry32 + Fisher–Yates
 * over the ordered deck (suits × ranks as defined in constants).
 */
export const FIXTURE_FIRST_TEN_CARD_IDS = [
  '6-spades',
  'A-hearts',
  '5-hearts',
  '10-spades',
  'K-hearts',
  '3-hearts',
  '3-diamonds',
  '8-spades',
  '8-clubs',
  '10-hearts',
] as const;

/** Ends in three busts for FIXTURE_SEED. Official score is 0. */
export const FIXTURE_BUST_MOVES: MoveLogEntry[] = [
  { sequence: 1, laneId: 1, elapsedMilliseconds: 500 },
  { sequence: 2, laneId: 2, elapsedMilliseconds: 1000 },
  { sequence: 3, laneId: 3, elapsedMilliseconds: 1500 },
  { sequence: 4, laneId: 4, elapsedMilliseconds: 2000 },
  { sequence: 5, laneId: 1, elapsedMilliseconds: 2500 },
  { sequence: 6, laneId: 2, elapsedMilliseconds: 3000 },
  { sequence: 7, laneId: 3, elapsedMilliseconds: 3500 },
  { sequence: 8, laneId: 4, elapsedMilliseconds: 4000 },
  { sequence: 9, laneId: 1, elapsedMilliseconds: 4500 },
  { sequence: 10, laneId: 2, elapsedMilliseconds: 5000 },
  { sequence: 11, laneId: 3, elapsedMilliseconds: 5500 },
  { sequence: 12, laneId: 4, elapsedMilliseconds: 6000 },
  { sequence: 13, laneId: 1, elapsedMilliseconds: 6500 },
  { sequence: 14, laneId: 2, elapsedMilliseconds: 7000 },
  { sequence: 15, laneId: 3, elapsedMilliseconds: 7500 },
];

export const FIXTURE_BUST_RESULT = {
  score: 0,
  lanesCleared: 0,
  cardsPlayed: 15,
  busts: 3,
  timeRemainingSeconds: 113,
  gameOverReason: 'busts' as const,
};
