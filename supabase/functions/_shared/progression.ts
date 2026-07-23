import { calculateHandTotal } from './game/cardValues.ts';
import {
  FIVE_CARD_CLEAR_COUNT,
  TARGET_TOTAL,
} from './game/constants.ts';
import { createServerGameState, placeServerCard } from './game/gameEngine.ts';
import type { LaneId, MoveLogEntry } from './game/types.ts';
import { validateMoveLog } from './game/replayMatch.ts';
import type { createServiceClient } from './supabaseAdmin.ts';

export type AdminClient = ReturnType<typeof createServiceClient>;

export type MatchXpMode = 'solo' | 'casual' | 'ranked';

export const MATCH_XP: Record<MatchXpMode, number> = {
  solo: 50,
  casual: 75,
  ranked: 100,
};

const SOURCE_TYPE_BY_MODE: Record<MatchXpMode, string> = {
  solo: 'solo_match',
  casual: 'casual_duel',
  ranked: 'ranked_duel',
};

export type XpGrantResult = {
  xpGranted: number;
  levelBefore: number;
  levelAfter: number;
  levelsGained: number;
  currentLevelXp: number;
  xpRequiredForNextLevel: number;
  totalXpAfter: number;
  levelsCrossed: number[];
  rewardsGranted: unknown[];
  alreadyProcessed: boolean;
  transactionId: string | null;
};

export type MissionProgressResult = {
  applied: boolean;
  reason?: string;
  matchId?: string;
  missionDate?: string;
  updates: unknown[];
};

export type MatchProgressionSummary = {
  exactTwentyOneClears: number;
  fiveCardClears: number;
  totalLaneClears: number;
  maximumMultiplierReached: number;
  matchMode: MatchXpMode | 'unknown';
  matchCompleted: boolean;
  validCompletion: boolean;
};

export type PlayerProgressionRow = {
  user_id: string;
  level: number;
  total_xp: number;
  current_level_xp: number;
  highest_level_reached: number;
  daily_streak: number;
  longest_daily_streak: number;
  last_daily_claim_at: string | null;
  next_daily_claim_at: string | null;
  created_at: string;
  updated_at: string;
};

const MIN_DAILY_CLAIM_INTERVAL_MS = 20 * 60 * 60 * 1000;
const MAX_STREAK_CONTINUATION_MS = 48 * 60 * 60 * 1000;

const DAILY_REWARD_CALENDAR = [
  { day: 1, blazeCoins: 25, xp: 25, cosmeticId: null as string | null },
  { day: 2, blazeCoins: 30, xp: 30, cosmeticId: null },
  { day: 3, blazeCoins: 40, xp: 40, cosmeticId: null },
  { day: 4, blazeCoins: 50, xp: 50, cosmeticId: null },
  { day: 5, blazeCoins: 60, xp: 60, cosmeticId: null },
  { day: 6, blazeCoins: 75, xp: 75, cosmeticId: null },
  {
    day: 7,
    blazeCoins: 100,
    xp: 100,
    cosmeticId: 'seven_day_blaze_title',
  },
] as const;

export function streakDayFromStreak(newStreak: number): number {
  if (newStreak <= 0) {
    return 1;
  }
  return ((newStreak - 1) % 7) + 1;
}

export function dailyRewardForStreakDay(streakDay: number): {
  day: number;
  blazeCoins: number;
  xp: number;
  cosmeticId: string | null;
} {
  const cycle = ((Math.max(1, streakDay) - 1) % 7) + 1;
  const found = DAILY_REWARD_CALENDAR.find((entry) => entry.day === cycle);
  return found ?? DAILY_REWARD_CALENDAR[0];
}

export function nextUtcMidnightIso(fromMs = Date.now()): string {
  const date = new Date(fromMs);
  const next = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return new Date(next).toISOString();
}

export function matchXpIdempotencyKey(
  mode: MatchXpMode,
  matchId: string,
  userId: string,
): string {
  if (mode === 'solo') {
    return `progression:solo:${matchId}`;
  }
  return `progression:${mode}:${matchId}:${userId}`;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === 'number' && Number.isFinite(entry) ? entry : null))
    .filter((entry): entry is number => entry !== null);
}

export function parseXpGrantResult(raw: unknown): XpGrantResult {
  const row = raw && typeof raw === 'object'
    ? raw as Record<string, unknown>
    : {};

  return {
    xpGranted: asNumber(row.xp_granted),
    levelBefore: asNumber(row.level_before, 1),
    levelAfter: asNumber(row.level_after, 1),
    levelsGained: asNumber(row.levels_gained),
    currentLevelXp: asNumber(row.current_level_xp),
    xpRequiredForNextLevel: asNumber(row.xp_required_for_next_level),
    totalXpAfter: asNumber(row.total_xp_after),
    levelsCrossed: asNumberArray(row.levels_crossed),
    rewardsGranted: Array.isArray(row.rewards_granted) ? row.rewards_granted : [],
    alreadyProcessed: asBoolean(row.already_processed),
    transactionId: typeof row.transaction_id === 'string' ? row.transaction_id : null,
  };
}

export function parseMissionProgressResult(raw: unknown): MissionProgressResult {
  const row = raw && typeof raw === 'object'
    ? raw as Record<string, unknown>
    : {};

  return {
    applied: asBoolean(row.applied),
    reason: typeof row.reason === 'string' ? row.reason : undefined,
    matchId: typeof row.match_id === 'string' ? row.match_id : undefined,
    missionDate: typeof row.mission_date === 'string' ? row.mission_date : undefined,
    updates: Array.isArray(row.updates) ? row.updates : [],
  };
}

/**
 * Replays placements to derive mission-facing clear / multiplier stats.
 */
export function buildMatchSummaryFromReplay(
  seed: number,
  moves: MoveLogEntry[],
  options: {
    matchMode: MatchXpMode | 'unknown';
    matchCompleted?: boolean;
    validCompletion?: boolean;
  },
): MatchProgressionSummary {
  let state = createServerGameState(seed);
  let exactTwentyOneClears = 0;
  let fiveCardClears = 0;
  let maximumMultiplierReached = state.multiplier;

  for (const move of moves) {
    if (state.finished || state.activeCard === null) {
      break;
    }

    const laneBefore = state.lanes.find((lane) => lane.id === move.laneId);
    const cardsBefore = laneBefore?.cards.length ?? 0;
    const next = placeServerCard(state, move.laneId as LaneId);

    if (next.clearedLanes > state.clearedLanes) {
      // Reconstruct the hand that cleared by inspecting pre-clear lane length + card.
      const handSize = cardsBefore + 1;
      const probeLane = state.lanes.map((lane) =>
        lane.id === move.laneId && state.activeCard
          ? { ...lane, cards: [...lane.cards, state.activeCard] }
          : lane
      );
      const clearedLane = probeLane.find((lane) => lane.id === move.laneId);
      const total = clearedLane ? calculateHandTotal(clearedLane.cards) : 0;

      if (total === TARGET_TOTAL) {
        exactTwentyOneClears += 1;
      } else if (handSize >= FIVE_CARD_CLEAR_COUNT) {
        fiveCardClears += 1;
      }
    }

    maximumMultiplierReached = Math.max(maximumMultiplierReached, next.multiplier);
    state = next;
  }

  return {
    exactTwentyOneClears,
    fiveCardClears,
    totalLaneClears: state.clearedLanes,
    maximumMultiplierReached,
    matchMode: options.matchMode,
    matchCompleted: options.matchCompleted ?? true,
    validCompletion: options.validCompletion ?? true,
  };
}

/**
 * Build a mission summary from already-verified score fields when a full
 * replay is unavailable. Skill missions that need exact/five/max multiplier
 * may under-count until a replay is provided.
 */
export function buildMatchSummaryFromVerifiedFields(input: {
  lanesCleared: number;
  exactTwentyOneClears?: number;
  fiveCardClears?: number;
  maximumMultiplierReached?: number;
  matchMode: MatchXpMode | 'unknown';
  matchCompleted?: boolean;
  validCompletion?: boolean;
}): MatchProgressionSummary {
  return {
    exactTwentyOneClears: Math.max(0, input.exactTwentyOneClears ?? 0),
    fiveCardClears: Math.max(0, input.fiveCardClears ?? 0),
    totalLaneClears: Math.max(0, input.lanesCleared),
    maximumMultiplierReached: Math.max(0, input.maximumMultiplierReached ?? 0),
    matchMode: input.matchMode,
    matchCompleted: input.matchCompleted ?? true,
    validCompletion: input.validCompletion ?? true,
  };
}

export function tryBuildMatchSummaryFromMoveLog(
  seed: number,
  moveLog: unknown,
  options: {
    matchMode: MatchXpMode | 'unknown';
    matchCompleted?: boolean;
    validCompletion?: boolean;
    lanesClearedFallback?: number;
  },
): MatchProgressionSummary {
  const validated = validateMoveLog(moveLog);
  if (!validated.ok) {
    return buildMatchSummaryFromVerifiedFields({
      lanesCleared: options.lanesClearedFallback ?? 0,
      matchMode: options.matchMode,
      matchCompleted: options.matchCompleted,
      validCompletion: options.validCompletion,
    });
  }

  return buildMatchSummaryFromReplay(seed, validated.moves, options);
}

export async function grantMatchXp(
  admin: AdminClient,
  userId: string,
  mode: MatchXpMode,
  matchId: string,
): Promise<XpGrantResult | null> {
  const xpAmount = MATCH_XP[mode];
  const idempotencyKey = matchXpIdempotencyKey(mode, matchId, userId);

  const { data, error } = await admin.rpc('grant_player_xp', {
    p_target_user_id: userId,
    p_xp_amount: xpAmount,
    p_source_type: SOURCE_TYPE_BY_MODE[mode],
    p_source_id: matchId,
    p_idempotency_key: idempotencyKey,
    p_metadata: {
      mode,
      match_id: matchId,
      xp: xpAmount,
    },
  });

  if (error) {
    return null;
  }

  return parseXpGrantResult(data);
}

export async function applyMissionProgressFromMatch(
  admin: AdminClient,
  userId: string,
  matchId: string,
  summary: MatchProgressionSummary,
  options?: {
    allowLiveDuel?: boolean;
    allowRanked?: boolean;
  },
): Promise<MissionProgressResult | null> {
  const { data, error } = await admin.rpc('apply_mission_progress_from_match', {
    p_user_id: userId,
    p_match_id: matchId,
    p_match_mode: summary.matchMode,
    p_exact_twenty_one_clears: summary.exactTwentyOneClears,
    p_five_card_clears: summary.fiveCardClears,
    p_total_lane_clears: summary.totalLaneClears,
    p_maximum_multiplier_reached: summary.maximumMultiplierReached,
    p_match_completed: summary.matchCompleted,
    p_valid_completion: summary.validCompletion,
    p_allow_live_duel: options?.allowLiveDuel ?? true,
    p_allow_ranked: options?.allowRanked ?? true,
  });

  if (error) {
    return null;
  }

  return parseMissionProgressResult(data);
}

export type DailyRewardAvailability = {
  isAvailable: boolean;
  reason: 'available' | 'too_soon' | 'missing_progression';
  currentStreak: number;
  longestStreak: number;
  nextStreakDay: number;
  nextClaimAt: string | null;
  continuesStreak: boolean;
  resetsStreak: boolean;
  currentReward: {
    day: number;
    blazeCoins: number;
    xp: number;
    cosmeticId: string | null;
  };
  calendar: Array<{
    day: number;
    blazeCoins: number;
    xp: number;
    cosmeticId: string | null;
  }>;
  progression: PlayerProgressionRow | null;
};

export function computeDailyRewardAvailability(
  progression: PlayerProgressionRow | null,
  nowMs = Date.now(),
): DailyRewardAvailability {
  const calendar = DAILY_REWARD_CALENDAR.map((entry) => ({
    day: entry.day,
    blazeCoins: entry.blazeCoins,
    xp: entry.xp,
    cosmeticId: entry.cosmeticId,
  }));

  if (!progression) {
    const reward = dailyRewardForStreakDay(1);
    return {
      isAvailable: true,
      reason: 'available',
      currentStreak: 0,
      longestStreak: 0,
      nextStreakDay: 1,
      nextClaimAt: null,
      continuesStreak: false,
      resetsStreak: false,
      currentReward: reward,
      calendar,
      progression: null,
    };
  }

  const lastClaimAtMs = progression.last_daily_claim_at
    ? Date.parse(progression.last_daily_claim_at)
    : NaN;
  const hasLastClaim = Number.isFinite(lastClaimAtMs);

  if (hasLastClaim && nowMs < lastClaimAtMs + MIN_DAILY_CLAIM_INTERVAL_MS) {
    const nextClaimAt =
      progression.next_daily_claim_at ??
      new Date(lastClaimAtMs + MIN_DAILY_CLAIM_INTERVAL_MS).toISOString();
    const previewDay = streakDayFromStreak(progression.daily_streak + 1);
    return {
      isAvailable: false,
      reason: 'too_soon',
      currentStreak: progression.daily_streak,
      longestStreak: progression.longest_daily_streak,
      nextStreakDay: previewDay,
      nextClaimAt,
      continuesStreak: false,
      resetsStreak: false,
      currentReward: dailyRewardForStreakDay(previewDay),
      calendar,
      progression,
    };
  }

  let continuesStreak = false;
  let resetsStreak = false;
  let newStreak = 1;

  if (!hasLastClaim) {
    newStreak = 1;
  } else if (nowMs <= lastClaimAtMs + MAX_STREAK_CONTINUATION_MS) {
    continuesStreak = true;
    newStreak = progression.daily_streak + 1;
  } else {
    resetsStreak = true;
    newStreak = 1;
  }

  const streakDay = streakDayFromStreak(newStreak);
  return {
    isAvailable: true,
    reason: 'available',
    currentStreak: progression.daily_streak,
    longestStreak: progression.longest_daily_streak,
    nextStreakDay: streakDay,
    nextClaimAt: progression.next_daily_claim_at,
    continuesStreak,
    resetsStreak,
    currentReward: dailyRewardForStreakDay(streakDay),
    calendar,
    progression,
  };
}

export async function ensureProgressionRow(
  admin: AdminClient,
  userId: string,
): Promise<PlayerProgressionRow | null> {
  const { data: existing } = await admin
    .from('player_progression')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return existing as PlayerProgressionRow;
  }

  const { error } = await admin.rpc('ensure_player_progression', {
    p_user_id: userId,
  });

  if (error) {
    return null;
  }

  const { data } = await admin
    .from('player_progression')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return data ? (data as PlayerProgressionRow) : null;
}
