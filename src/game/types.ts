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

export type GameStatus = 'idle' | 'playing' | 'finished';

export type LaneOutcome = 'continue' | 'clear21' | 'clearFive' | 'bust';

export type GameState = {
  status: GameStatus;
  deck: Card[];
  activeCard: Card | null;
  lanes: Lane[];
  score: number;
  multiplier: number;
  busts: number;
  clearedLanes: number;
};

export type GameResultParams = {
  score?: number;
  highScore?: number;
  clearedLanes?: number;
  busts?: number;
};

export type MoveEventType =
  | 'placed'
  | 'cleared21'
  | 'clearedFiveCard'
  | 'bust';

export type MoveEvent = {
  id: string;
  type: MoveEventType;
  laneId: number;
  cardId: string;
  pointsAwarded: number;
  multiplierBefore: number;
  multiplierAfter: number;
  bustsAfter: number;
};
