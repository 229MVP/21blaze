import { xpRequiredForLevel } from '../config/progressionConfig';
import { DAILY_REWARD_CALENDAR } from '../progression/rewards';
import type {
  DailyMissionView,
  DailyMissionsStatus,
  DailyRewardDay,
  DailyRewardStatus,
  LevelUpReward,
  PlayerProgression,
  ProgressionTransactionView,
} from '../progression/types';
import { supabase } from '../lib/supabase';

const TIMEOUT_MS = 10000;

class ProgressionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProgressionServiceError';
  }
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ProgressionServiceError(`${label} timed out.`));
    }, TIMEOUT_MS);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return asString(value);
}

async function invoke<T>(
  name: string,
  body: Record<string, unknown>,
  validate: (value: unknown) => value is T,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke(name, { body }),
    name,
  );

  if (error) {
    throw new ProgressionServiceError(error.message || `${name} failed.`);
  }

  if (isRecord(data) && 'error' in data && !('ok' in data) && !('missions' in data) && !('isAvailable' in data)) {
    const message = data.error;
    throw new ProgressionServiceError(
      typeof message === 'string' ? message : `${name} failed.`,
    );
  }

  if (!validate(data)) {
    throw new ProgressionServiceError(`Invalid ${name} response.`);
  }

  return data;
}

function parseDailyRewardDay(value: unknown): DailyRewardDay | null {
  if (!isRecord(value)) {
    return null;
  }
  const day = asNumber(value.day);
  const blazeCoins = asNumber(value.blazeCoins ?? value.blaze_coins);
  const xp = asNumber(value.xp ?? value.xp_reward);
  if (day === null || blazeCoins === null || xp === null) {
    return null;
  }
  const cosmeticRaw = value.cosmeticId ?? value.cosmetic_id;
  return {
    day,
    blazeCoins,
    xp,
    cosmeticId: asNullableString(cosmeticRaw),
  };
}

function parseLevelReward(value: unknown): LevelUpReward | null {
  if (!isRecord(value)) {
    return null;
  }
  const level = asNumber(value.level);
  const blazeCoins = asNumber(value.blazeCoins ?? value.blaze_coins);
  if (level === null || blazeCoins === null) {
    return null;
  }
  return {
    level,
    blazeCoins,
    cosmeticId: asNullableString(value.cosmeticId ?? value.cosmetic_id),
    title: asNullableString(value.title),
  };
}

function parseProgression(value: unknown, fallbackUserId = ''): PlayerProgression | null {
  if (!isRecord(value)) {
    return null;
  }

  const userId =
    asString(value.userId) ??
    asString(value.user_id) ??
    (fallbackUserId || null);
  const level = asNumber(value.level);
  const totalXp = asNumber(value.totalXp ?? value.total_xp);
  const currentLevelXp = asNumber(value.currentLevelXp ?? value.current_level_xp);
  const highestLevelReached = asNumber(
    value.highestLevelReached ?? value.highest_level_reached,
  );
  const dailyStreak = asNumber(value.dailyStreak ?? value.daily_streak);
  const longestDailyStreak = asNumber(
    value.longestDailyStreak ?? value.longest_daily_streak,
  );

  if (
    userId === null ||
    level === null ||
    totalXp === null ||
    currentLevelXp === null ||
    highestLevelReached === null ||
    dailyStreak === null ||
    longestDailyStreak === null
  ) {
    return null;
  }

  const xpRequired =
    asNumber(value.xpRequiredForNextLevel ?? value.xp_required_for_next_level) ??
    xpRequiredForLevel(level);

  const isAvailable = asBoolean(
    value.isDailyRewardAvailable ?? value.is_daily_reward_available,
  );

  return {
    userId,
    level,
    totalXp,
    currentLevelXp,
    xpRequiredForNextLevel: xpRequired,
    highestLevelReached,
    dailyStreak,
    longestDailyStreak,
    lastDailyClaimAt: asNullableString(
      value.lastDailyClaimAt ?? value.last_daily_claim_at,
    ),
    nextDailyClaimAt: asNullableString(
      value.nextDailyClaimAt ?? value.next_daily_claim_at,
    ),
    isDailyRewardAvailable: isAvailable ?? false,
  };
}

function parseMission(value: unknown): DailyMissionView | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asString(value.id);
  const templateId =
    asString(value.templateId ?? value.template_id ?? value.mission_template_id) ??
    'unknown';
  const name =
    asString(value.name) ??
    asString(value.mission_template_id) ??
    'Mission';
  const description = asString(value.description) ?? '';
  const categoryRaw = asString(value.category);
  const category: DailyMissionView['category'] =
    categoryRaw === 'participation' ||
    categoryRaw === 'skill' ||
    categoryRaw === 'mode'
      ? categoryRaw
      : 'participation';
  const progress = asNumber(value.progress);
  const targetValue = asNumber(value.targetValue ?? value.target_value);
  const xpReward = asNumber(value.xpReward ?? value.xp_reward);
  const blazeCoinReward = asNumber(
    value.blazeCoinReward ?? value.blaze_coin_reward,
  );

  if (
    !id ||
    progress === null ||
    targetValue === null ||
    xpReward === null ||
    blazeCoinReward === null
  ) {
    return null;
  }

  const completedAt = asNullableString(value.completedAt ?? value.completed_at);
  const claimedAt = asNullableString(value.claimedAt ?? value.claimed_at);
  const isComplete =
    asBoolean(value.isComplete ?? value.is_complete) ??
    (completedAt !== null || progress >= targetValue);
  const isClaimed =
    asBoolean(value.isClaimed ?? value.is_claimed) ?? claimedAt !== null;

  return {
    id,
    templateId,
    name,
    description,
    category,
    progress,
    targetValue,
    xpReward,
    blazeCoinReward,
    completedAt,
    claimedAt,
    isComplete,
    isClaimed,
  };
}

function isDailyRewardStatus(value: unknown): value is DailyRewardStatus {
  if (!isRecord(value)) {
    return false;
  }
  const isAvailable = asBoolean(value.isAvailable ?? value.is_available);
  const currentStreak = asNumber(value.currentStreak ?? value.current_streak);
  const longestStreak = asNumber(value.longestStreak ?? value.longest_streak);
  const nextStreakDay = asNumber(value.nextStreakDay ?? value.next_streak_day);
  const currentReward = parseDailyRewardDay(
    value.currentReward ?? value.current_reward,
  );
  const calendarRaw = value.calendar ?? value.rewardCalendar ?? value.reward_calendar;
  if (
    isAvailable === null ||
    currentStreak === null ||
    longestStreak === null ||
    nextStreakDay === null ||
    !currentReward ||
    !Array.isArray(calendarRaw)
  ) {
    return false;
  }
  return calendarRaw.every((entry) => parseDailyRewardDay(entry) !== null);
}

function normalizeDailyRewardStatus(value: unknown): DailyRewardStatus {
  if (!isDailyRewardStatus(value)) {
    throw new ProgressionServiceError('Invalid daily reward status.');
  }
  const record = value as Record<string, unknown>;
  const calendarRaw = (record.calendar ??
    record.rewardCalendar ??
    record.reward_calendar) as unknown[];
  const calendar = calendarRaw
    .map((entry) => parseDailyRewardDay(entry))
    .filter((entry): entry is DailyRewardDay => entry !== null);

  return {
    isAvailable: Boolean(record.isAvailable ?? record.is_available),
    currentStreak: Number(record.currentStreak ?? record.current_streak),
    longestStreak: Number(record.longestStreak ?? record.longest_streak),
    nextStreakDay: Number(record.nextStreakDay ?? record.next_streak_day),
    nextClaimAt: asNullableString(record.nextClaimAt ?? record.next_claim_at),
    currentReward: parseDailyRewardDay(
      record.currentReward ?? record.current_reward,
    )!,
    calendar: calendar.length > 0 ? calendar : [...DAILY_REWARD_CALENDAR],
  };
}

function isDailyMissionsStatus(value: unknown): value is DailyMissionsStatus {
  if (!isRecord(value)) {
    return false;
  }
  const missionsRaw = value.missions;
  const resetAt = asString(value.resetAt ?? value.reset_at);
  if (!Array.isArray(missionsRaw) || !resetAt) {
    return false;
  }
  return missionsRaw.every((entry) => parseMission(entry) !== null);
}

function normalizeDailyMissionsStatus(value: unknown): DailyMissionsStatus {
  if (!isDailyMissionsStatus(value)) {
    throw new ProgressionServiceError('Invalid daily missions status.');
  }
  const record = value as Record<string, unknown>;
  const missions = (record.missions as unknown[])
    .map((entry) => parseMission(entry))
    .filter((entry): entry is DailyMissionView => entry !== null);
  return {
    missions,
    resetAt: String(record.resetAt ?? record.reset_at),
    claimableCount:
      asNumber(record.claimableCount ?? record.claimable_count) ??
      missions.filter((m) => m.isComplete && !m.isClaimed).length,
  };
}

export type DailyRewardClaimResult = {
  ok: boolean;
  alreadyClaimed: boolean;
  reward: DailyRewardDay;
  progression: PlayerProgression;
  blazeCoinsGranted: number;
  xpGranted: number;
  levelsCrossed: number[];
  rewardsGranted: LevelUpReward[];
  streakContinued: boolean;
  streakReset: boolean;
  status: DailyRewardStatus | null;
};

export type DailyMissionClaimResult = {
  ok: boolean;
  alreadyClaimed: boolean;
  mission: DailyMissionView;
  progression: PlayerProgression;
  blazeCoinsGranted: number;
  xpGranted: number;
  levelsCrossed: number[];
  rewardsGranted: LevelUpReward[];
  missions: DailyMissionsStatus | null;
};

function parseLevelsCrossed(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asNumber(entry))
    .filter((entry): entry is number => entry !== null);
}

function parseRewardsGranted(value: unknown): LevelUpReward[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => parseLevelReward(entry))
    .filter((entry): entry is LevelUpReward => entry !== null);
}

function isClaimRewardPayload(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  if (value.ok === false) {
    return true;
  }
  if (isRecord(value.result)) {
    return true;
  }
  return (
    parseDailyRewardDay(value.reward ?? value.currentReward) !== null ||
    parseProgression(value.progression) !== null
  );
}

function isClaimMissionPayload(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  if (value.ok === false) {
    return true;
  }
  if (isRecord(value.result)) {
    return true;
  }
  return parseMission(value.mission) !== null || parseProgression(value.progression) !== null;
}

function unwrapClaimResult(data: Record<string, unknown>): Record<string, unknown> {
  if (isRecord(data.result)) {
    return data.result;
  }
  return data;
}

function parseXpResult(value: unknown): {
  xpGranted: number;
  levelsCrossed: number[];
  rewardsGranted: LevelUpReward[];
  levelBefore: number | null;
  levelAfter: number | null;
} {
  if (!isRecord(value)) {
    return {
      xpGranted: 0,
      levelsCrossed: [],
      rewardsGranted: [],
      levelBefore: null,
      levelAfter: null,
    };
  }
  return {
    xpGranted: asNumber(value.xpGranted ?? value.xp_granted) ?? 0,
    levelsCrossed: parseLevelsCrossed(value.levelsCrossed ?? value.levels_crossed),
    rewardsGranted: parseRewardsGranted(value.rewardsGranted ?? value.rewards_granted),
    levelBefore: asNumber(value.levelBefore ?? value.level_before),
    levelAfter: asNumber(value.levelAfter ?? value.level_after),
  };
}

export async function loadPlayerProgression(): Promise<PlayerProgression | null> {
  const { data, error } = await withTimeout(
    Promise.resolve(
      supabase
        .from('player_progression')
        .select(
          'user_id, level, total_xp, current_level_xp, highest_level_reached, daily_streak, longest_daily_streak, last_daily_claim_at, next_daily_claim_at',
        )
        .maybeSingle(),
    ),
    'player_progression',
  );

  if (error) {
    throw new ProgressionServiceError(error.message || 'Unable to load progression.');
  }
  if (!data) {
    return null;
  }

  const parsed = parseProgression(data);
  if (!parsed) {
    throw new ProgressionServiceError('Invalid progression row.');
  }
  return parsed;
}

export async function loadDailyRewardStatus(): Promise<DailyRewardStatus> {
  const data = await invoke('daily-reward', { action: 'status' }, isDailyRewardStatus);
  return normalizeDailyRewardStatus(data);
}

export async function claimDailyReward(): Promise<DailyRewardClaimResult> {
  const data = await invoke('daily-reward', { action: 'claim' }, isClaimRewardPayload);

  if (data.ok === false) {
    const message = asString(data.error) ?? asString(data.message) ?? 'Reward not available.';
    throw new ProgressionServiceError(message);
  }

  const result = unwrapClaimResult(data);
  const reward =
    parseDailyRewardDay(result.reward ?? result.currentReward) ??
    DAILY_REWARD_CALENDAR[0]!;
  const progression = parseProgression(result.progression);
  if (!progression) {
    throw new ProgressionServiceError('Invalid claim response progression.');
  }

  const xpResult = parseXpResult(result.xp_result ?? result.xpResult);
  const statusRaw = data.status ?? data.dailyRewardStatus ?? result.status;
  const status =
    statusRaw && isDailyRewardStatus(statusRaw)
      ? normalizeDailyRewardStatus(statusRaw)
      : null;

  return {
    ok: true,
    alreadyClaimed: Boolean(
      result.alreadyClaimed ??
        result.already_claimed ??
        result.already_processed,
    ),
    reward,
    progression: {
      ...progression,
      isDailyRewardAvailable: status?.isAvailable ?? false,
      dailyStreak:
        asNumber(result.new_streak) ??
        status?.currentStreak ??
        progression.dailyStreak,
      longestDailyStreak: status?.longestStreak ?? progression.longestDailyStreak,
      nextDailyClaimAt:
        asNullableString(result.next_claim_at ?? result.nextClaimAt) ??
        status?.nextClaimAt ??
        progression.nextDailyClaimAt,
    },
    blazeCoinsGranted:
      asNumber(result.blazeCoinsGranted ?? result.blaze_coins_granted) ??
      reward.blazeCoins,
    xpGranted:
      asNumber(result.xpGranted ?? result.xp_granted) ??
      xpResult.xpGranted ??
      reward.xp,
    levelsCrossed:
      xpResult.levelsCrossed.length > 0
        ? xpResult.levelsCrossed
        : parseLevelsCrossed(result.levelsCrossed ?? result.levels_crossed),
    rewardsGranted:
      xpResult.rewardsGranted.length > 0
        ? xpResult.rewardsGranted
        : parseRewardsGranted(result.rewardsGranted ?? result.rewards_granted),
    streakContinued: Boolean(
      result.streakContinued ?? result.streak_continued ?? result.continues_streak,
    ),
    streakReset: Boolean(
      result.streakReset ?? result.streak_reset ?? result.resets_streak,
    ),
    status,
  };
}

export async function loadDailyMissions(): Promise<DailyMissionsStatus> {
  const data = await invoke('daily-missions', { action: 'list' }, isDailyMissionsStatus);
  return normalizeDailyMissionsStatus(data);
}

export async function claimDailyMission(
  missionId: string,
): Promise<DailyMissionClaimResult> {
  if (!missionId || typeof missionId !== 'string') {
    throw new ProgressionServiceError('Mission id is required.');
  }

  const data = await invoke(
    'daily-missions',
    { action: 'claim', missionId, playerMissionId: missionId },
    isClaimMissionPayload,
  );

  if (data.ok === false) {
    const message = asString(data.error) ?? asString(data.message) ?? 'Unable to claim mission.';
    throw new ProgressionServiceError(message);
  }

  const result = unwrapClaimResult(data);
  const mission = parseMission(result.mission);
  const progression = parseProgression(result.progression);
  if (!mission || !progression) {
    throw new ProgressionServiceError('Invalid mission claim response.');
  }

  const xpResult = parseXpResult(result.xp_result ?? result.xpResult);
  const missionsRaw = data.missions ?? data.dailyMissions ?? result.missions;
  const missions =
    missionsRaw && isDailyMissionsStatus(missionsRaw)
      ? normalizeDailyMissionsStatus(missionsRaw)
      : null;

  return {
    ok: true,
    alreadyClaimed: Boolean(
      result.alreadyClaimed ??
        result.already_claimed ??
        result.already_processed,
    ),
    mission: {
      ...mission,
      isClaimed: true,
      claimedAt: mission.claimedAt ?? new Date().toISOString(),
    },
    progression,
    blazeCoinsGranted:
      asNumber(result.blazeCoinsGranted ?? result.blaze_coins_granted) ??
      mission.blazeCoinReward,
    xpGranted:
      asNumber(result.xpGranted ?? result.xp_granted) ??
      xpResult.xpGranted ??
      mission.xpReward,
    levelsCrossed:
      xpResult.levelsCrossed.length > 0
        ? xpResult.levelsCrossed
        : parseLevelsCrossed(result.levelsCrossed ?? result.levels_crossed),
    rewardsGranted:
      xpResult.rewardsGranted.length > 0
        ? xpResult.rewardsGranted
        : parseRewardsGranted(result.rewardsGranted ?? result.rewards_granted),
    missions,
  };
}

export async function loadProgressionHistory(
  limit = 20,
  _cursor?: string | null,
): Promise<ProgressionTransactionView[]> {
  void _cursor;
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const { data, error } = await withTimeout(
    Promise.resolve(
      supabase
        .from('progression_transactions')
        .select(
          'id, transaction_type, xp_amount, level_before, level_after, total_xp_after, source_type, source_id, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(safeLimit),
    ),
    'progression_transactions',
  );

  if (error) {
    throw new ProgressionServiceError(error.message || 'Unable to load progression history.');
  }
  if (!data) {
    return [];
  }

  const rows: ProgressionTransactionView[] = [];
  for (const row of data) {
    if (!isRecord(row)) {
      continue;
    }
    const id = asString(row.id);
    const transactionType = asString(row.transaction_type);
    const xpAmount = asNumber(row.xp_amount);
    const levelBefore = asNumber(row.level_before);
    const levelAfter = asNumber(row.level_after);
    const totalXpAfter = asNumber(row.total_xp_after);
    const sourceType = asString(row.source_type);
    const createdAt = asString(row.created_at);
    if (
      !id ||
      !transactionType ||
      xpAmount === null ||
      levelBefore === null ||
      levelAfter === null ||
      totalXpAfter === null ||
      !sourceType ||
      !createdAt
    ) {
      continue;
    }
    rows.push({
      id,
      transactionType: transactionType as ProgressionTransactionView['transactionType'],
      xpAmount,
      levelBefore,
      levelAfter,
      totalXpAfter,
      sourceType,
      sourceId: asNullableString(row.source_id),
      createdAt,
    });
  }
  return rows;
}

export { ProgressionServiceError };
