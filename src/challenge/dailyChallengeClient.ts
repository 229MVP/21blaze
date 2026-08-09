/**
 * Version 1.3 — canonical Daily Challenge client contract (Phase 2 UI entry point).
 *
 * Flow: Expo Client → authenticated Supabase RPC → daily_challenges →
 * daily_challenge_attempts → deterministic game → secure completion.
 *
 * UI layers should import from here — not Edge Functions or raw RPC names.
 */
import {
  completeDailyChallengeRanked,
  DailyChallengeFoundationError,
  getTodayDailyChallenge as fetchTodayDailyChallenge,
  startDailyChallengeRanked,
} from './dailyChallengeFoundationService';
import type {
  DailyChallenge,
  DailyChallengeCompletion,
  DailyChallengeStartResult,
} from './dailyChallengeTypes';

export { DailyChallengeFoundationError as DailyChallengeClientError };

export type CompleteDailyChallengeInput = {
  attemptId: string;
  score: number;
  exact21Count: number;
  fiveCardClearCount: number;
  bustCount: number;
  cardsPlayed: number;
  completionMs: number;
  rulesVersion: string;
};

/** Today's UTC challenge metadata (no authoritative seed). */
export async function getTodayDailyChallenge(): Promise<DailyChallenge> {
  return fetchTodayDailyChallenge();
}

/** Start or resume the authenticated user's ranked attempt for today UTC. */
export async function startDailyChallenge(): Promise<
  DailyChallengeStartResult | { error: string }
> {
  return startDailyChallengeRanked();
}

/** Complete a ranked attempt once; idempotent when already completed. */
export async function completeDailyChallenge(
  input: CompleteDailyChallengeInput,
): Promise<DailyChallengeCompletion> {
  return completeDailyChallengeRanked(input);
}
