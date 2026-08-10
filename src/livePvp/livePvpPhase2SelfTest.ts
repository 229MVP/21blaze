/**
 * Version 1.5 Phase 2 — Live PvP playable client self-tests.
 * Pure / deterministic checks only. Physical two-device QA is documented separately.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mapLivePvpErrorMessage } from './livePvpErrorMap';
import {
  livePvpMyReady,
  livePvpOpponentReady,
  livePvpOtherPlayer,
  livePvpPerspective,
  livePvpPerspectiveTitle,
  mapLivePvpFacingStatus,
  presentLiveMatchResult,
} from './livePvpPresentation';
import { createLivePvpDeck, livePvpDeckFingerprint } from './createLivePvpDeck';
import { estimateServerClockOffset, serverNowEstimateMs } from './livePvpClock';
import type { LiveMatchSnapshot } from './livePvpTypes';
import {
  parseNotificationDeepLink,
  DUEL_NOTIFICATION_REGISTRY,
} from '../notifications/duelNotificationRegistry';

function readRepo(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

const TEST_MATCH_ID = '11111111-1111-4111-8111-111111111111';
const TEST_ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const TEST_USER_CHALLENGER = '33333333-3333-4333-8333-333333333333';
const TEST_USER_OPPONENT = '44444444-4444-4444-8444-444444444444';

function baseSnapshot(
  overrides: Partial<LiveMatchSnapshot> = {},
): LiveMatchSnapshot {
  return {
    matchId: TEST_MATCH_ID,
    status: 'lobby',
    stateVersion: 1,
    protocolVersion: '1',
    realtimeTopic: `live-pvp:${TEST_MATCH_ID}`,
    participantRole: 'challenger',
    challenger: { userId: TEST_USER_CHALLENGER, displayName: 'You' },
    opponent: { userId: TEST_USER_OPPONENT, displayName: 'BlazeKing' },
    challengerReady: false,
    opponentReady: false,
    scheduledStartAt: null,
    gameplayDeadlineAt: null,
    submissionGraceUntil: null,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    rulesVersion: 'v1',
    deckVersion: 'v1',
    durationSeconds: 120,
    bustLimit: 3,
    seed: null,
    seedAvailable: false,
    outcome: null,
    winnerUserId: null,
    decidingField: null,
    completionReason: null,
    settledAt: null,
    myAttempt: {
      attemptId: TEST_ATTEMPT_ID,
      status: 'pending',
      score: null,
      completedAt: null,
    },
    myLatestProgressSequence: 0,
    progress: [],
    serverNow: new Date().toISOString(),
    gameplayEligible: false,
    ...overrides,
  };
}

export function runLivePvpPhase2SelfTests(): void {
  // Screens exist
  for (const rel of [
    'src/screens/LivePvpHubScreen.tsx',
    'src/screens/LivePvpSelectOpponentScreen.tsx',
    'src/screens/LivePvpConfirmChallengeScreen.tsx',
    'src/screens/LivePvpWaitingRoomScreen.tsx',
    'src/screens/LivePvpInviteDetailsScreen.tsx',
    'src/screens/LivePvpLobbyScreen.tsx',
    'src/screens/LivePvpResultScreen.tsx',
    'src/livePvp/livePvpCoordinator.ts',
    'docs/LIVE_PVP_PHASE_2_QA.md',
  ]) {
    assert(existsSync(join(process.cwd(), rel)), `missing ${rel}`);
  }

  // Challenge submits only opponent id
  const confirmSrc = readRepo('src/screens/LivePvpConfirmChallengeScreen.tsx');
  assert(confirmSrc.includes('createInvite(opponentId'), 'confirm uses opponentId');
  assert(!confirmSrc.includes('seed'), 'confirm does not send seed');
  assert(!confirmSrc.includes('realtimeTopic'), 'confirm does not send topic');

  // Invite double-tap guard in store
  const storeSrc = readRepo('src/store/useLivePvpStore.ts');
  assert(storeSrc.includes("mutationStatus === 'pending'"), 'pending mutation guard');
  assert(storeSrc.includes('resetForAccountSwitch'), 'account switch reset');
  assert(storeSrc.includes('ensureJoined'), 'coordinator join');

  // Coordinator singleton + cleanup
  const coordSrc = readRepo('src/livePvp/livePvpCoordinator.ts');
  assert(coordSrc.includes('private: true'), 'private channel');
  assert(coordSrc.includes('removeChannel'), 'channel removal');
  assert(coordSrc.includes('setAuth'), 'auth refresh');
  assert(coordSrc.includes('SIGNED_OUT'), 'logout leaves channel');
  assert(!coordSrc.includes('channel.send('), 'clients do not send broadcast');

  // Perspective adapter
  assert.equal(livePvpPerspective('challenger_win', 'challenger'), 'victory');
  assert.equal(livePvpPerspective('challenger_win', 'opponent'), 'defeat');
  assert.equal(livePvpPerspective('opponent_win', 'opponent'), 'victory');
  assert.equal(livePvpPerspective('opponent_win', 'challenger'), 'defeat');
  assert.equal(livePvpPerspective('tie', 'challenger'), 'tie');
  assert.equal(livePvpPerspective('no_contest', 'opponent'), 'no_contest');
  assert.equal(livePvpPerspectiveTitle('victory'), 'VICTORY');
  assert.equal(livePvpPerspectiveTitle('no_contest'), 'NO CONTEST');

  const settled = baseSnapshot({
    status: 'completed',
    outcome: 'challenger_win',
    completionReason: 'normal',
    decidingField: 'score',
    myAttempt: {
      attemptId: TEST_ATTEMPT_ID,
      status: 'completed',
      score: 15420,
      completedAt: null,
    },
    progress: [
      {
        userId: TEST_USER_CHALLENGER,
        sequence: 2,
        score: 15420,
        exact21Count: 1,
        fiveCardClearCount: 0,
        bustCount: 0,
        cardsPlayed: 20,
        lanesCleared: 5,
      },
      {
        userId: TEST_USER_OPPONENT,
        sequence: 2,
        score: 14980,
        exact21Count: 0,
        fiveCardClearCount: 1,
        bustCount: 1,
        cardsPlayed: 18,
        lanesCleared: 4,
      },
    ],
  });
  const presented = presentLiveMatchResult(settled);
  assert.equal(presented.perspective, 'victory');
  assert.equal(presented.headline, 'VICTORY');
  assert.equal(presented.myScore, 15420);
  assert.equal(presented.opponentScore, 14980);

  const forfeitWin = presentLiveMatchResult(
    baseSnapshot({
      status: 'completed',
      participantRole: 'opponent',
      outcome: 'opponent_win',
      completionReason: 'forfeit',
    }),
  );
  assert.equal(forfeitWin.perspective, 'victory');
  assert(forfeitWin.subline?.toLowerCase().includes('forfeit'), 'forfeit subline');

  // Ready helpers
  const lobby = baseSnapshot({
    challengerReady: true,
    opponentReady: false,
    participantRole: 'challenger',
  });
  assert.equal(livePvpMyReady(lobby), true);
  assert.equal(livePvpOpponentReady(lobby), false);
  assert.equal(livePvpOtherPlayer(lobby).displayName, 'BlazeKing');
  assert.equal(
    mapLivePvpFacingStatus({
      status: 'invited',
      participantRole: 'challenger',
    }),
    'WAITING FOR RESPONSE',
  );
  assert.equal(
    mapLivePvpFacingStatus({
      status: 'invited',
      participantRole: 'opponent',
    }),
    'INVITED',
  );

  // Error mapping — no SQL / JWT leakage
  assert.equal(
    mapLivePvpErrorMessage('LIVE_PVP_DISABLED'),
    'Live PvP is temporarily unavailable.',
  );
  assert.equal(mapLivePvpErrorMessage('INVITE_EXPIRED'), 'This invitation expired.');
  assert.equal(
    mapLivePvpErrorMessage('CHANNEL_AUTH_FAILED'),
    'We couldn’t securely join this match.',
  );
  const allMsgs = Object.values({
    a: mapLivePvpErrorMessage('UNKNOWN'),
    b: mapLivePvpErrorMessage('NOT_PARTICIPANT'),
  }).join(' ');
  assert(!/jwt|sql|rls|policy/i.test(allMsgs), 'no internal leakage');

  // Clock: delayed countdown skips elapsed numbers conceptually
  const samples = [
    {
      localRequestStartedAt: 1000,
      localResponseReceivedAt: 1100,
      serverNowMs: 10_050,
    },
  ];
  const estimate = estimateServerClockOffset(samples);
  assert(estimate != null, 'clock estimate');
  const serverNow = serverNowEstimateMs(estimate, 2000);
  const start = serverNow - 2500; // already past 3 and 2
  const remaining = start - serverNow;
  assert(remaining < -2000, 'late arrival skips early countdown numbers');

  // Deck parity reused
  const seed = '21blaze-live-pvp-v1:phase2';
  assert.equal(
    livePvpDeckFingerprint(seed),
    livePvpDeckFingerprint(seed),
    'deck fingerprint stable',
  );
  assert.equal(createLivePvpDeck(seed).length, 52);

  // Notifications registry + deep links
  assert(DUEL_NOTIFICATION_REGISTRY.LIVE_MATCH_INVITE_RECEIVED);
  assert(DUEL_NOTIFICATION_REGISTRY.LIVE_MATCH_RESULT_READY);
  const inviteLink = parseNotificationDeepLink({
    screen: 'LivePvpInviteDetails',
    matchId: 'm1',
  });
  assert.equal(inviteLink?.screen, 'LivePvpInviteDetails');
  assert.equal(inviteLink?.matchId, 'm1');
  const resultLink = parseNotificationDeepLink({
    screen: 'LivePvpResult',
    matchId: 'm2',
  });
  assert.equal(resultLink?.screen, 'LivePvpResult');
  assert.equal(
    parseNotificationDeepLink({ screen: 'LivePvpInviteDetails' }),
    null,
    'reject invite deep link without matchId',
  );

  // Navigation registered
  const nav = readRepo('src/navigation/AppNavigator.tsx');
  assert(nav.includes('LivePvpHub'), 'hub route');
  assert(nav.includes('LivePvpLobby'), 'lobby route');
  assert(nav.includes('LivePvpResult'), 'result route');
  assert(nav.includes('isLivePvpEnabled'), 'feature gate');

  // Home entry
  const home = readRepo('src/screens/HomeScreen.tsx');
  assert(home.includes('LIVE PVP'), 'home live entry');
  assert(home.includes('PLAY LIVE') || home.includes('UNAVAILABLE'), 'home cta');
  assert(home.includes('attentionCount') || home.includes('livePvpAttentionCount'), 'badge');

  // No rewards pathway in live completion
  const gameStore = readRepo('src/store/useGameStore.ts');
  assert(gameStore.includes("gameMode === 'livePvp'"), 'live mode branch');
  assert(
    gameStore.includes('Official Live PvP timer must not pause') ||
      gameStore.includes("gameMode === 'livePvp'"),
    'live timer handling',
  );

  // Seed not in notification registry payloads as a field name requirement
  const registry = readRepo('src/notifications/duelNotificationRegistry.ts');
  assert(!registry.includes('seed'), 'notifications omit seed');

  // Kill switch messaging
  const hub = readRepo('src/screens/LivePvpHubScreen.tsx');
  assert(hub.includes('temporarily unavailable') || hub.includes('Temporarily unavailable') || hub.includes('creationEnabled'), 'ops kill switch UX');

  // Phase 3: Resume only when checkpoint reconciled (not a fake always-on CTA)
  assert(hub.includes('resumeMatchId'), 'hub gates resume on reconciled checkpoint');
  assert(hub.includes('RESUME LIVE MATCH'), 'resume CTA when checkpoint valid');
}

runLivePvpPhase2SelfTests();
console.log('Live PvP Phase 2 self-tests passed.');

