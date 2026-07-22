export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';

export type LaneId = 1 | 2 | 3 | 4;

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
};

export type Lane = {
  id: LaneId;
  cards: Card[];
};

export type GameOverReason = 'busts' | 'deckEmpty' | 'timeExpired';

export type MoveLogEntry = {
  sequence: number;
  laneId: number;
  elapsedMilliseconds: number;
};

export type OfficialMatchResult = {
  score: number;
  lanesCleared: number;
  cardsPlayed: number;
  busts: number;
  timeRemainingSeconds: number;
  gameOverReason: GameOverReason;
};

export type ReplaySuccess = {
  ok: true;
  result: OfficialMatchResult;
};

export type ReplayFailure = {
  ok: false;
  reason: string;
};

export type ReplayOutcome = ReplaySuccess | ReplayFailure;
