/**
 * Version 1.4 Phase 2 — Async Duel playable UX self-tests.
 * Pure domain checks (presentation, session, errors, deck parity).
 * Run: npm run test:async-duel-phase2
 */

import { mapAsyncDuelErrorMessage } from './asyncDuelErrorMap';
import {
  asyncDuelDecidingLabel,
  asyncDuelPerspective,
  asyncDuelPerspectiveForUser,
  asyncDuelPerspectiveTitle,
  mapAsyncDuelFacingStatus,
} from './asyncDuelPresentation';
import type { AsyncDuelSession } from './asyncDuelSession';
import {
  asyncDuelDeckFingerprint,
  createAsyncDuelDeck,
} from './createAsyncDuelDeck';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Async Duel Phase 2 self-test failed: ${message}`);
  }
}

function assertSessionShape(session: AsyncDuelSession): void {
  const keys = Object.keys(session).sort();
  for (const forbidden of [
    'winner',
    'outcome',
    'reward',
    'xp',
    'coins',
    'email',
  ]) {
    assert(!keys.includes(forbidden), `session must not include ${forbidden}`);
  }
  assert(typeof session.duelId === 'string', 'duelId');
  assert(typeof session.attemptId === 'string', 'attemptId');
  assert(
    session.participantRole === 'challenger' ||
      session.participantRole === 'opponent',
    'role',
  );
  assert(typeof session.authoritativeSeed === 'string', 'seed');
  assert(session.authoritativeSeed.length > 0, 'seed non-empty');
}

export function runAsyncDuelPhase2SelfTests(): void {
  // Presentation adapter — role perspective
  assert(
    asyncDuelPerspective('challenger_win', 'challenger') === 'victory',
    'challenger victory',
  );
  assert(
    asyncDuelPerspective('challenger_win', 'opponent') === 'defeat',
    'challenger_win is defeat for opponent',
  );
  assert(
    asyncDuelPerspective('opponent_win', 'opponent') === 'victory',
    'opponent victory',
  );
  assert(
    asyncDuelPerspective('opponent_win', 'challenger') === 'defeat',
    'opponent_win is defeat for challenger',
  );
  assert(asyncDuelPerspective('tie', 'challenger') === 'tie', 'tie challenger');
  assert(asyncDuelPerspective('tie', 'opponent') === 'tie', 'tie opponent');
  assert(asyncDuelPerspective(null, 'challenger') === null, 'null outcome');

  // Winner-id perspective (history cards)
  assert(
    asyncDuelPerspectiveForUser({
      outcome: 'challenger_win',
      winnerUserId: 'user-a',
      currentUserId: 'user-a',
    }) === 'victory',
    'winner id victory',
  );
  assert(
    asyncDuelPerspectiveForUser({
      outcome: 'challenger_win',
      winnerUserId: 'user-a',
      currentUserId: 'user-b',
    }) === 'defeat',
    'non-winner defeat',
  );
  assert(
    asyncDuelPerspectiveForUser({
      outcome: 'tie',
      winnerUserId: null,
      currentUserId: 'user-a',
    }) === 'tie',
    'tie via user helper',
  );

  assert(asyncDuelPerspectiveTitle('victory') === 'VICTORY', 'title victory');
  assert(asyncDuelPerspectiveTitle('defeat') === 'DEFEAT', 'title defeat');
  assert(asyncDuelPerspectiveTitle('tie') === 'TIE', 'title tie');

  // Tie-break labels match Phase 1 comparator fields exactly
  assert(asyncDuelDecidingLabel('score') === 'Higher score', 'score label');
  assert(asyncDuelDecidingLabel('exact_21') === 'More Exact 21s', 'exact21');
  assert(
    asyncDuelDecidingLabel('five_card_clear') === 'More Five-Card Clears',
    'fcc',
  );
  assert(asyncDuelDecidingLabel('bust_count') === 'Fewer busts', 'busts');
  assert(
    asyncDuelDecidingLabel('completion_ms') === 'Faster valid completion',
    'time',
  );
  assert(
    asyncDuelDecidingLabel('tie') === 'All tie-breakers equal',
    'full tie',
  );
  assert(
    asyncDuelDecidingLabel('unknown_field') === 'All tie-breakers equal',
    'unknown safe',
  );

  // Facing status map
  assert(
    mapAsyncDuelFacingStatus({
      status: 'awaiting_opponent',
      participantRole: 'opponent',
    }) === 'YOUR TURN',
    'inbox your turn',
  );
  assert(
    mapAsyncDuelFacingStatus({
      status: 'awaiting_opponent',
      participantRole: 'challenger',
    }) === 'WAITING FOR OPPONENT',
    'challenger waiting',
  );
  assert(
    mapAsyncDuelFacingStatus({
      status: 'challenger_playing',
      participantRole: 'challenger',
    }) === 'PLAYING',
    'challenger playing',
  );
  assert(
    mapAsyncDuelFacingStatus({ status: 'completed', participantRole: 'opponent' }) ===
      'COMPLETED',
    'completed',
  );
  assert(
    mapAsyncDuelFacingStatus({ status: 'expired', participantRole: 'opponent' }) ===
      'EXPIRED',
    'expired',
  );

  // Error map — player-safe, no SQL/UUID leakage in messages
  const codes = [
    'SELF_CHALLENGE',
    'PLAYER_NOT_FOUND',
    'PLAYER_NOT_ELIGIBLE',
    'ACTIVE_DUEL_LIMIT',
    'DUPLICATE_ACTIVE_DUEL',
    'ALREADY_STARTED',
    'ALREADY_COMPLETED',
    'DECLINED',
    'EXPIRED',
    'INVALID_DUEL_STATE',
  ] as const;
  for (const code of codes) {
    const msg = mapAsyncDuelErrorMessage(code);
    assert(msg.length > 0, `${code} message`);
    assert(!/uuid|sql|rpc|postgres|exception/i.test(msg), `${code} no internals`);
  }
  assert(
    mapAsyncDuelErrorMessage('SELF_CHALLENGE') ===
      'You cannot challenge yourself.',
    'self challenge copy',
  );
  assert(
    mapAsyncDuelErrorMessage('NOT_A_REAL_CODE') ===
      'Something went wrong. Please try again.',
    'unknown fallback',
  );

  // Identical gameplay conditions — same seed → same deck fingerprint
  const sharedSeed = '21blaze-async-v1:phase2-parity-seed';
  const challengerDeck = createAsyncDuelDeck(sharedSeed).map((c) => c.id);
  const opponentDeck = createAsyncDuelDeck(sharedSeed).map((c) => c.id);
  assert(
    challengerDeck.every((id, i) => id === opponentDeck[i]),
    'challenger/opponent deck order match',
  );
  assert(
    asyncDuelDeckFingerprint(sharedSeed) ===
      asyncDuelDeckFingerprint(sharedSeed),
    'fingerprint stable across calls',
  );
  // Rerender / retry must not reshuffle
  assert(
    createAsyncDuelDeck(sharedSeed)[0]?.id === challengerDeck[0],
    'first card stable',
  );

  // Session descriptor shape — playable fields only
  const session: AsyncDuelSession = {
    duelId: 'd1',
    attemptId: 'a1',
    participantRole: 'challenger',
    authoritativeSeed: sharedSeed,
    rulesVersion: '1',
    deckVersion: '1',
    durationSeconds: 120,
    bustLimit: 3,
    serverStartTime: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    opponentDisplayName: 'AceHunter',
    targetScore: null,
  };
  assertSessionShape(session);

  const opponentSession: AsyncDuelSession = {
    ...session,
    participantRole: 'opponent',
    attemptId: 'a2',
    targetScore: 14820,
  };
  assertSessionShape(opponentSession);
  assert(
    opponentSession.authoritativeSeed === session.authoritativeSeed,
    'shared seed',
  );
  assert(
    opponentSession.durationSeconds === session.durationSeconds,
    'shared duration',
  );
  assert(opponentSession.bustLimit === session.bustLimit, 'shared bust');
  assert(
    opponentSession.rulesVersion === session.rulesVersion,
    'shared rules',
  );
  assert(opponentSession.deckVersion === session.deckVersion, 'shared deck ver');
}

runAsyncDuelPhase2SelfTests();
console.log('Async Duel Phase 2 self-tests passed.');
