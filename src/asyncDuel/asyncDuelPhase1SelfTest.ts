import {
  compareAsyncDuelResults,
  isAsyncDuelTransitionAllowed,
} from './asyncDuelComparator';
import { ASYNC_DUEL_CONFIG } from './asyncDuelConfig';
import {
  asyncDuelDeckFingerprint,
  createAsyncDuelDeck,
} from './createAsyncDuelDeck';
import { ASYNC_DUEL_RESUME_POLICY } from './asyncDuelResumePolicy';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Async Duel Phase 1 self-test failed: ${message}`);
  }
}

function base(score: number, extras?: Partial<Parameters<typeof compareAsyncDuelResults>[0]>) {
  return {
    score,
    exact21Count: 0,
    fiveCardClearCount: 0,
    bustCount: 0,
    completionMs: 90_000,
    ...extras,
  };
}

export function runAsyncDuelPhase1SelfTests(): void {
  // Config registry centralized
  assert(ASYNC_DUEL_CONFIG.rulesVersion === '1', 'rules version');
  assert(ASYNC_DUEL_CONFIG.durationSeconds === 120, 'duration');
  assert(ASYNC_DUEL_CONFIG.bustLimit === 3, 'bust limit');
  assert(ASYNC_DUEL_CONFIG.active === true, 'active');

  // Deterministic deck — same seed → same order
  const seedA = '21blaze-async-v1:test-seed-aaaa';
  const seedB = '21blaze-async-v1:test-seed-bbbb';
  const deck1 = createAsyncDuelDeck(seedA).map((c) => c.id);
  const deck2 = createAsyncDuelDeck(seedA).map((c) => c.id);
  const deckOther = createAsyncDuelDeck(seedB).map((c) => c.id);
  assert(deck1.length === 52, 'full deck');
  assert(deck1.every((id, i) => id === deck2[i]), 'identical decks for same seed');
  assert(deck1.some((id, i) => id !== deckOther[i]), 'different seeds differ');
  assert(
    asyncDuelDeckFingerprint(seedA) === asyncDuelDeckFingerprint(seedA),
    'fingerprint stable',
  );

  // State machine
  assert(
    isAsyncDuelTransitionAllowed('challenger_playing', 'awaiting_opponent'),
    'challenger complete transition',
  );
  assert(
    isAsyncDuelTransitionAllowed('awaiting_opponent', 'opponent_playing'),
    'opponent start transition',
  );
  assert(
    isAsyncDuelTransitionAllowed('opponent_playing', 'completed'),
    'settlement transition',
  );
  assert(
    !isAsyncDuelTransitionAllowed('awaiting_opponent', 'completed'),
    'cannot skip opponent play',
  );
  assert(
    !isAsyncDuelTransitionAllowed('completed', 'awaiting_opponent'),
    'terminal locked',
  );
  assert(
    isAsyncDuelTransitionAllowed('challenger_playing', 'cancelled'),
    'cancel before complete',
  );
  assert(
    !isAsyncDuelTransitionAllowed('awaiting_opponent', 'cancelled'),
    'no cancel after publish',
  );

  // Comparator — score
  let settlement = compareAsyncDuelResults(base(15000), base(14000), {
    challengerId: 'c',
    opponentId: 'o',
  });
  assert(settlement.outcome === 'challenger_win', 'higher score wins');
  assert(settlement.winnerUserId === 'c', 'winner is challenger');
  assert(settlement.decidingField === 'score', 'deciding score');

  settlement = compareAsyncDuelResults(base(10000), base(12000), {
    challengerId: 'c',
    opponentId: 'o',
  });
  assert(settlement.outcome === 'opponent_win', 'opponent higher score');

  // Exact 21 tie-break
  settlement = compareAsyncDuelResults(
    base(10000, { exact21Count: 3 }),
    base(10000, { exact21Count: 2 }),
    { challengerId: 'c', opponentId: 'o' },
  );
  assert(settlement.decidingField === 'exact_21', 'exact 21 decides');
  assert(settlement.outcome === 'challenger_win', 'more exact 21 wins');

  // Five-card
  settlement = compareAsyncDuelResults(
    base(10000, { fiveCardClearCount: 1 }),
    base(10000, { fiveCardClearCount: 2 }),
    { challengerId: 'c', opponentId: 'o' },
  );
  assert(settlement.decidingField === 'five_card_clear', 'five card decides');
  assert(settlement.outcome === 'opponent_win', 'more five-card wins');

  // Busts (fewer wins)
  settlement = compareAsyncDuelResults(
    base(10000, { bustCount: 1 }),
    base(10000, { bustCount: 2 }),
    { challengerId: 'c', opponentId: 'o' },
  );
  assert(settlement.decidingField === 'bust_count', 'busts decide');
  assert(settlement.outcome === 'challenger_win', 'fewer busts wins');

  // Completion time (faster wins)
  settlement = compareAsyncDuelResults(
    base(10000, { completionMs: 80_000 }),
    base(10000, { completionMs: 90_000 }),
    { challengerId: 'c', opponentId: 'o' },
  );
  assert(settlement.decidingField === 'completion_ms', 'time decides');
  assert(settlement.outcome === 'challenger_win', 'faster wins');

  // Full tie
  settlement = compareAsyncDuelResults(base(10000), base(10000), {
    challengerId: 'c',
    opponentId: 'o',
  });
  assert(settlement.outcome === 'tie', 'identical is tie');
  assert(settlement.winnerUserId === null, 'tie has no winner');
  assert(settlement.decidingField === 'tie', 'tie field');

  // Client cannot invent winner — comparator is pure; no XP/coins in Phase 1
  assert(ASYNC_DUEL_RESUME_POLICY.completionIdempotent, 'completion idempotent policy');
  assert(
    ASYNC_DUEL_RESUME_POLICY.seedDisclosure === 'only_on_own_attempt_start',
    'seed policy',
  );

  // Self-challenge / spam rules exist in config (enforced server-side)
  assert(ASYNC_DUEL_CONFIG.maxPendingOutgoing >= 1, 'pending limit configured');
  assert(ASYNC_DUEL_CONFIG.maxActiveBetweenPair === 1, 'pair limit');

  // No reward hooks in Phase 1 module surface
  assert(
    !('xpReward' in ASYNC_DUEL_CONFIG) && !('coinReward' in ASYNC_DUEL_CONFIG),
    'no Phase 1 reward fields',
  );
}

runAsyncDuelPhase1SelfTests();
