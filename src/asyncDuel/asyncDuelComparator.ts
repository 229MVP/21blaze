import type {
  AsyncDuelDecidingField,
  AsyncDuelOutcome,
  AsyncDuelSettlement,
  AsyncDuelStatus,
} from './asyncDuelTypes';

/**
 * Centralized pure Async Duel result comparator.
 * Must stay in sync with `public.compare_async_duel_results` (migration 0015).
 * Client uses this for display/tests only — server settles the official winner.
 */

export type AsyncDuelComparableResult = {
  score: number;
  exact21Count: number;
  fiveCardClearCount: number;
  bustCount: number;
  completionMs: number;
};

const TERMINAL: ReadonlySet<AsyncDuelStatus> = new Set([
  'completed',
  'declined',
  'expired',
  'cancelled',
  'invalid',
]);

const ALLOWED: ReadonlyArray<readonly [AsyncDuelStatus, AsyncDuelStatus]> = [
  ['challenger_playing', 'awaiting_opponent'],
  ['challenger_playing', 'cancelled'],
  ['challenger_playing', 'expired'],
  ['challenger_playing', 'invalid'],
  ['awaiting_opponent', 'opponent_playing'],
  ['awaiting_opponent', 'declined'],
  ['awaiting_opponent', 'expired'],
  ['awaiting_opponent', 'invalid'],
  ['opponent_playing', 'completed'],
  ['opponent_playing', 'expired'],
  ['opponent_playing', 'invalid'],
];

export function isAsyncDuelTransitionAllowed(
  from: AsyncDuelStatus,
  to: AsyncDuelStatus,
): boolean {
  if (from === to) {
    return true;
  }
  if (TERMINAL.has(from)) {
    return false;
  }
  return ALLOWED.some(([a, b]) => a === from && b === to);
}

export function compareAsyncDuelResults(
  challenger: AsyncDuelComparableResult,
  opponent: AsyncDuelComparableResult,
  ids?: { challengerId: string; opponentId: string },
): AsyncDuelSettlement {
  const decide = (
    outcome: AsyncDuelOutcome,
    decidingField: AsyncDuelDecidingField,
  ): AsyncDuelSettlement => ({
    outcome,
    decidingField,
    winnerUserId:
      outcome === 'challenger_win'
        ? ids?.challengerId ?? null
        : outcome === 'opponent_win'
          ? ids?.opponentId ?? null
          : null,
  });

  if (challenger.score !== opponent.score) {
    return decide(
      challenger.score > opponent.score ? 'challenger_win' : 'opponent_win',
      'score',
    );
  }
  if (challenger.exact21Count !== opponent.exact21Count) {
    return decide(
      challenger.exact21Count > opponent.exact21Count
        ? 'challenger_win'
        : 'opponent_win',
      'exact_21',
    );
  }
  if (challenger.fiveCardClearCount !== opponent.fiveCardClearCount) {
    return decide(
      challenger.fiveCardClearCount > opponent.fiveCardClearCount
        ? 'challenger_win'
        : 'opponent_win',
      'five_card_clear',
    );
  }
  if (challenger.bustCount !== opponent.bustCount) {
    return decide(
      challenger.bustCount < opponent.bustCount ? 'challenger_win' : 'opponent_win',
      'bust_count',
    );
  }
  if (challenger.completionMs !== opponent.completionMs) {
    return decide(
      challenger.completionMs < opponent.completionMs
        ? 'challenger_win'
        : 'opponent_win',
      'completion_ms',
    );
  }
  return decide('tie', 'tie');
}
