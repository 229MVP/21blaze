import { createShuffledDeck } from '../game/deck';
import { createDailyChallengeDeck } from '../game/challenge/createDailyChallengeDeck';
import {
  createInitialGameState,
  createInitialGameStateFromAuthoritativeSeed,
} from '../game/gameEngine';
import { deriveAuthoritativeSeed } from './seedDerivation';
import { deriveDailyChallengeUiStatus } from './dailyChallengePolicy';
import {
  formatUtcResetCountdown,
  millisecondsUntilUtcChallengeReset,
} from './utcResetCountdown';
import { getUtcChallengeDate } from './utcChallengeDate';
import { createDailyChallengeConfig } from '../game/challenge/createDailyChallenge';
import { evaluateRankedStartGate } from './dailyChallengeAttemptLogic';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Daily Challenge Phase 2 self-test failed: ${message}`);
  }
}

export function runDailyChallengePhase2SelfTests(): void {
  const date = '2026-08-05';
  const seed = deriveAuthoritativeSeed(date);
  const config = createDailyChallengeConfig(date);
  const challengeId = config.challengeId;

  assert(
    deriveDailyChallengeUiStatus({
      challenge: config,
      rankedAttempt: null,
      activeSession: null,
      offline: false,
      errorMessage: null,
      authOnline: true,
    }) === 'available',
    'available challenge displays',
  );

  assert(
    deriveDailyChallengeUiStatus({
      challenge: config,
      rankedAttempt: null,
      activeSession: null,
      offline: false,
      errorMessage: null,
      authOnline: false,
    }) === 'sign_in_required',
    'signed-out user receives sign-in state',
  );

  const doubleTapFirst = evaluateRankedStartGate(null, {
    id: challengeId,
    challengeDate: date,
    rulesVersion: '1',
    status: 'active',
  });
  const doubleTapSecond = evaluateRankedStartGate(
    { status: 'started', userId: 'user-a', challengeId },
    { id: challengeId, challengeDate: date, rulesVersion: '1', status: 'active' },
  );
  assert(doubleTapFirst === 'OK', 'start gate allows first ranked attempt');
  assert(doubleTapSecond === 'RESUME', 'double tap creates one server attempt policy');

  const deck1 = createDailyChallengeDeck(seed).map((card) => card.id);
  const deck2 = createDailyChallengeDeck(seed).map((card) => card.id);
  assert(
    deck1.every((id, index) => id === deck2[index]),
    'returned seed generates deterministic deck',
  );

  const soloDeck = createShuffledDeck(() => 0.5);
  const soloDeck2 = createShuffledDeck(() => 0.25);
  assert(
    soloDeck.some((card, index) => card.id !== soloDeck2[index]?.id),
    'solo still uses normal shuffle',
  );

  const dailyState = createInitialGameStateFromAuthoritativeSeed(seed);
  const dailyAgain = createInitialGameStateFromAuthoritativeSeed(seed);
  assert(
    dailyState.deck.every((card, index) => card.id === dailyAgain.deck[index]?.id),
    'daily ranked uses seeded shuffle',
  );

  assert(
    createInitialGameState().deck[0]?.id !== dailyState.deck[0]?.id ||
      createInitialGameState().deck.length !== dailyState.deck.length,
    'solo initial deck differs from daily seeded deck path',
  );

  const practiceDeck1 = createDailyChallengeDeck(seed).map((card) => card.id);
  const practiceDeck2 = createDailyChallengeDeck(seed).map((card) => card.id);
  assert(
    practiceDeck1.every((id, index) => id === practiceDeck2[index]),
    'practice always starts same deck',
  );

  assert(
    millisecondsUntilUtcChallengeReset(Date.parse('2026-08-05T12:00:00.000Z')) > 0,
    'UTC reset countdown is positive before midnight',
  );
  const countdown = formatUtcResetCountdown(Date.parse('2026-08-05T23:59:30.000Z'));
  assert(/^\d{2}:\d{2}:\d{2}$/.test(countdown), 'UTC reset formats as HH:MM:SS');

  const tomorrow = getUtcChallengeDate(Date.parse('2026-08-06T00:00:01.000Z'));
  assert(tomorrow !== date, 'UTC date change produces new challenge day');

  assert(
    deriveDailyChallengeUiStatus({
      challenge: config,
      rankedAttempt: { id: 'a1', status: 'started' } as never,
      activeSession: {
        attemptId: 'a1',
        attemptType: 'ranked',
        authoritativeSeed: seed,
        challengeId,
        challengeDate: date,
        rulesVersion: '1',
        deckVersion: '1',
        durationSeconds: 120,
        bustLimit: 3,
        serverStartTime: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      },
      offline: false,
      errorMessage: null,
      authOnline: true,
    }) === 'in_progress',
    'in-progress attempt does not create duplicate UI state',
  );

  assert(
    deriveDailyChallengeUiStatus({
      challenge: config,
      rankedAttempt: { status: 'completed', verifiedScore: 12480 } as never,
      activeSession: null,
      offline: false,
      errorMessage: null,
      authOnline: true,
    }) === 'completed',
    'completed state displays official score context',
  );

  assert(
    deriveDailyChallengeUiStatus({
      challenge: null,
      rankedAttempt: null,
      activeSession: null,
      offline: true,
      errorMessage: 'offline',
      authOnline: true,
    }) === 'offline',
    'offline ranked start is blocked safely',
  );

  assert(
    deriveDailyChallengeUiStatus({
      challenge: config,
      rankedAttempt: null,
      activeSession: null,
      offline: true,
      errorMessage: 'offline',
      authOnline: true,
    }) !== 'error',
    'daily API failure with cached challenge does not break availability policy',
  );
}

runDailyChallengePhase2SelfTests();
console.log('Daily Challenge Phase 2 self-tests passed.');
