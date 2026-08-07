import { supabase } from '../lib/supabase';
import type {
  DailyChallenge,
  DailyChallengeCompletion,
  DailyChallengeStartResult,
} from './dailyChallengeTypes';
import {
  isDailyChallengeStartError,
  parseDailyChallengeStartResult,
} from './dailyChallengeAttemptLogic';

export class DailyChallengeFoundationError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'DailyChallengeFoundationError';
    this.code = code;
  }
}

function mapTodayChallengeRow(value: Record<string, unknown>): DailyChallenge {
  return {
    id: String(value.id),
    challengeDate: String(value.challengeDate),
    rulesVersion: String(value.rulesVersion),
    deckVersion: String(value.deckVersion),
    durationSeconds: Number(value.durationSeconds),
    bustLimit: Number(value.bustLimit),
    status: value.status as DailyChallenge['status'],
  };
}

function mapCompletionRow(value: Record<string, unknown>): DailyChallengeCompletion {
  return {
    alreadyCompleted: Boolean(value.alreadyCompleted),
    attemptId: String(value.attemptId),
    score: Number(value.score),
    exact21Count: Number(value.exact21Count),
    fiveCardClearCount: Number(value.fiveCardClearCount),
    bustCount: Number(value.bustCount),
    completionMs: Number(value.completionMs),
    rulesVersion: String(value.rulesVersion),
    verificationStatus:
      typeof value.verificationStatus === 'string' ? value.verificationStatus : undefined,
  };
}

/**
 * Reads today's UTC challenge metadata without exposing the authoritative seed.
 * Seed is returned only from `startDailyChallengeRanked()`.
 */
export async function getTodayDailyChallenge(): Promise<DailyChallenge> {
  const { data, error } = await supabase.rpc('get_today_daily_challenge');

  if (error) {
    throw new DailyChallengeFoundationError(error.message, error.code);
  }

  if (!data || typeof data !== 'object') {
    throw new DailyChallengeFoundationError('invalid_today_challenge_response');
  }

  return mapTodayChallengeRow(data as Record<string, unknown>);
}

export async function startDailyChallengeRanked(): Promise<
  DailyChallengeStartResult | { error: string }
> {
  const { data, error } = await supabase.rpc('start_daily_challenge');

  if (error) {
    throw new DailyChallengeFoundationError(error.message, error.code);
  }

  if (isDailyChallengeStartError(data)) {
    return { error: data.error };
  }

  return parseDailyChallengeStartResult(data);
}

export async function completeDailyChallengeRanked(input: {
  attemptId: string;
  score: number;
  exact21Count: number;
  fiveCardClearCount: number;
  bustCount: number;
  cardsPlayed: number;
  completionMs: number;
  rulesVersion: string;
}): Promise<DailyChallengeCompletion> {
  const { data, error } = await supabase.rpc('complete_daily_challenge', {
    p_attempt_id: input.attemptId,
    p_score: input.score,
    p_exact_21_count: input.exact21Count,
    p_five_card_clear_count: input.fiveCardClearCount,
    p_bust_count: input.bustCount,
    p_cards_played: input.cardsPlayed,
    p_completion_ms: input.completionMs,
    p_rules_version: input.rulesVersion,
  });

  if (error) {
    throw new DailyChallengeFoundationError(error.message, error.code);
  }

  if (!data || typeof data !== 'object') {
    throw new DailyChallengeFoundationError('invalid_complete_daily_challenge_response');
  }

  return mapCompletionRow(data as Record<string, unknown>);
}
