export type MatchMode =
  | "tutorial"
  | "practice"
  | "casual_pvp"
  | "ranked_pvp"
  | "private_duel"
  | "daily_blaze";

export type MatchPhase =
  | "created"
  | "waiting"
  | "ready_check"
  | "countdown"
  | "active"
  | "resolving"
  | "completed"
  | "cancelled"
  | "forfeit"
  | "abandoned"
  | "invalidated";

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type PowerId =
  | "ember_shield"
  | "frost_lock"
  | "swap_spark"
  | "scorch_mark"
  | "wild_shift"
  | "redirect"
  | "cleanse"
  | "double_blaze";

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  deckCycle: number;
  sequenceIndex: number;
}

export interface LaneState {
  laneIndex: 0 | 1 | 2 | 3;
  cards: Card[];
  printedTotal: number;
  effectiveTotal: number;
  aceValues: Array<1 | 11>;
  status: "open" | "full" | "blazed" | "bust";
  statuses: StatusEffect[];
}

export interface StatusEffect {
  id: string;
  kind: "shield" | "frost_lock" | "scorch_mark" | "redirect" | "double_blaze";
  sourcePlayerId: string;
  targetPlayerId: string;
  targetLaneIndex?: 0 | 1 | 2 | 3;
  magnitude?: number;
  appliedAtServerMs: number;
  expiresAtServerMs: number;
}

export interface PlayerMatchState {
  playerId: string;
  lanes: [LaneState, LaneState, LaneState, LaneState];
  currentCard: Card | null;
  deckCursor: number;
  score: number;
  blazeEnergy: number;
  streakCount: number;
  streakMultiplier: 1 | 2 | 3 | 4;
  equippedPowers: [PowerId, PowerId, PowerId];
  powerCooldownEndsAt: Partial<Record<PowerId, number>>;
  connected: boolean;
}

export interface MatchState {
  matchId: string;
  mode: MatchMode;
  phase: MatchPhase;
  rulesVersion: string;
  seedCommitment: string;
  revision: number;
  startedAtServerMs: number | null;
  endsAtServerMs: number | null;
  players: [PlayerMatchState, PlayerMatchState];
}

export type ClientIntent =
  | {type:"match.ready"; clientActionId:string; expectedRevision:number}
  | {type:"card.place"; clientActionId:string; expectedRevision:number; laneIndex:0|1|2|3}
  | {type:"power.activate"; clientActionId:string; expectedRevision:number; powerId:PowerId; targetPlayerId?:string; targetLaneIndices?: Array<0|1|2|3>; selectedValue?:number}
  | {type:"match.forfeit"; clientActionId:string; expectedRevision:number}
  | {type:"match.rematch_vote"; clientActionId:string; expectedRevision:number; accept:boolean};

export interface ServerEnvelope<TType extends string = string, TPayload = unknown> {
  eventId: string;
  matchId: string;
  revision: number;
  serverTimeMs: number;
  type: TType;
  payload: TPayload;
}
