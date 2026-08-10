/**
 * Version 1.5 Phase 3 — Live PvP resilience, recovery, rematches, records.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildLivePvpCheckpoint, applyLivePvpCheckpointToGameState } from './livePvpCheckpoint';
import {
  __resetLivePvpCheckpointWriteThrottleForTests,
  clearLivePvpCheckpoint,
} from './livePvpCheckpointStorage';
import { evaluateLivePvpRecovery } from './livePvpRecovery';
import {
  LivePvpProtocolError,
  mapLivePvpPlayerRecord,
  mapLivePvpRematchResult,
  mapLivePvpSnapshot,
} from './livePvpProtocol';
import { LIVE_PVP_PROTOCOL_VERSION } from './livePvpConfig';
import { createInitialGameState } from '../game/gameEngine';
import type { LiveMatchSnapshot } from './livePvpTypes';

const MATCH_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const USER_A = '33333333-3333-4333-8333-333333333333';
const USER_B = '44444444-4444-4444-8444-444444444444';

function readRepo(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function baseSnapshot(overrides: Partial<LiveMatchSnapshot> = {}): LiveMatchSnapshot {
  return {
    matchId: MATCH_ID,
    status: 'active',
    stateVersion: 3,
    protocolVersion: LIVE_PVP_PROTOCOL_VERSION,
    realtimeTopic: `live-pvp:${MATCH_ID}`,
    participantRole: 'challenger',
    challenger: { userId: USER_A, displayName: 'A' },
    opponent: { userId: USER_B, displayName: 'B' },
    challengerReady: true,
    opponentReady: true,
    scheduledStartAt: '2026-08-10T12:00:00.000Z',
    gameplayDeadlineAt: '2026-08-10T12:02:00.000Z',
    submissionGraceUntil: '2026-08-10T12:02:15.000Z',
    expiresAt: '2026-08-10T13:00:00.000Z',
    rulesVersion: '1',
    deckVersion: '1',
    durationSeconds: 120,
    bustLimit: 3,
    seed: '21blaze-live-v1:test-seed',
    seedAvailable: true,
    outcome: null,
    winnerUserId: null,
    decidingField: null,
    completionReason: null,
    settledAt: null,
    myAttempt: {
      attemptId: ATTEMPT_ID,
      status: 'active',
      score: 1000,
      completedAt: null,
    },
    myLatestProgressSequence: 4,
    progress: [],
    serverNow: '2026-08-10T12:01:00.000Z',
    gameplayEligible: true,
    ...overrides,
  };
}

export async function runLivePvpPhase3SelfTests(): Promise<void> {
  const mig = readRepo(
    'supabase/migrations/20260810183000_v1_5_phase3_live_pvp_resilience.sql',
  );

  assert(mig.includes('rematch_of_match_id'), 'rematch column');
  assert(mig.includes('create_live_pvp_rematch'), 'rematch rpc');
  assert(mig.includes('get_live_pvp_player_record'), 'player record rpc');
  assert(mig.includes('myLatestProgressSequence'), 'snapshot sequence field');
  assert(
    mig.includes('REVOKE ALL ON FUNCTION public.finalize_live_pvp_deadlines(integer) FROM authenticated'),
    'finalizer revoked from authenticated',
  );
  assert(mig.includes('SET search_path = \'\''), 'empty search_path on new rpcs');
  assert(mig.includes('LIVE_MATCH_REMATCH_INVITE_RECEIVED'), 'rematch notification type');

  // Strict snapshot parsing
  assert.throws(
    () => mapLivePvpSnapshot({ matchId: 'bad', status: 'active' }),
    LivePvpProtocolError,
  );
  const snap = mapLivePvpSnapshot({
    matchId: MATCH_ID,
    status: 'active',
    stateVersion: 1,
    protocolVersion: '1',
    realtimeTopic: `live-pvp:${MATCH_ID}`,
    participantRole: 'challenger',
    challenger: { userId: USER_A, displayName: 'A' },
    opponent: { userId: USER_B, displayName: 'B' },
    challengerReady: true,
    opponentReady: true,
    scheduledStartAt: '2026-08-10T12:00:00.000Z',
    gameplayDeadlineAt: '2026-08-10T12:02:00.000Z',
    submissionGraceUntil: '2026-08-10T12:02:15.000Z',
    expiresAt: '2026-08-10T13:00:00.000Z',
    rulesVersion: '1',
    deckVersion: '1',
    durationSeconds: 120,
    bustLimit: 3,
    seed: null,
    seedAvailable: false,
    myLatestProgressSequence: 2,
    progress: [],
    serverNow: '2026-08-10T12:01:00.000Z',
    gameplayEligible: true,
  });
  assert.equal(snap.myLatestProgressSequence, 2);

  const record = mapLivePvpPlayerRecord({
    completedMatches: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    noContests: 0,
    forfeitsAgainst: 0,
    timeouts: 0,
    winRate: 0,
    recentForm: [],
    serverNow: '2026-08-10T12:00:00.000Z',
  });
  assert.equal(record.completedMatches, 0);
  assert.equal(record.winRate, 0);

  const rematch = mapLivePvpRematchResult({
    matchId: MATCH_ID,
    status: 'invited',
    realtimeTopic: `live-pvp:${MATCH_ID}`,
    protocolVersion: '1',
    stateVersion: 1,
    expiresAt: '2026-08-10T13:00:00.000Z',
    participantRole: 'challenger',
    opponent: { userId: USER_B, displayName: 'B' },
    rematchOfMatchId: '55555555-5555-4555-8555-555555555555',
    alreadyExisted: false,
    serverNow: '2026-08-10T12:00:00.000Z',
  });
  assert.equal(rematch.alreadyExisted, false);

  // Checkpoint round-trip
  __resetLivePvpCheckpointWriteThrottleForTests();
  await clearLivePvpCheckpoint();
  const session = {
    matchId: MATCH_ID,
    attemptId: ATTEMPT_ID,
    participantRole: 'challenger' as const,
    authoritativeSeed: 'seed',
    rulesVersion: '1',
    deckVersion: '1',
    durationSeconds: 120,
    bustLimit: 3,
    scheduledStartAt: '2026-08-10T12:00:00.000Z',
    gameplayDeadlineAt: '2026-08-10T12:02:00.000Z',
    submissionGraceUntil: '2026-08-10T12:02:15.000Z',
    protocolVersion: LIVE_PVP_PROTOCOL_VERSION,
    opponentDisplayName: 'B',
    serverStartTime: '2026-08-10T12:00:00.000Z',
  };
  const game = createInitialGameState();
  const checkpoint = buildLivePvpCheckpoint({
    userId: USER_A,
    session,
    game,
    exact21Count: 1,
    fiveCardClearCount: 0,
    lastAcceptedProgressSequence: 3,
    lastAttemptedProgressSequence: 4,
  });
  assert.equal(checkpoint.matchId, MATCH_ID);

  const restored = applyLivePvpCheckpointToGameState(checkpoint, createInitialGameState());
  assert.equal(restored.score, game.score);

  // Wrong account rejection
  const wrongAccount = evaluateLivePvpRecovery({
    checkpoint,
    userId: USER_B,
    snapshot: baseSnapshot(),
  });
  assert.equal(wrongAccount.kind, 'discard');
  if (wrongAccount.kind === 'discard') {
    assert.equal(wrongAccount.reason, 'wrong_account');
  }

  // Terminal discard
  const terminal = evaluateLivePvpRecovery({
    checkpoint,
    userId: USER_A,
    snapshot: baseSnapshot({ status: 'completed' }),
  });
  assert.equal(terminal.kind, 'discard');

  // Valid resume
  const resume = evaluateLivePvpRecovery({
    checkpoint,
    userId: USER_A,
    snapshot: baseSnapshot(),
  });
  assert.equal(resume.kind, 'resume');

  // Corrupt checkpoint schema rejected by storage loader shape check (static)
  const storageSrc = readRepo('src/livePvp/livePvpCheckpointStorage.ts');
  assert(storageSrc.includes('schemaVersion'), 'checkpoint schema guard');

  // Progress sequence sync (static — coordinator imports RN via supabase)
  const coordinatorSrc = readRepo('src/livePvp/livePvpCoordinator.ts');
  assert(coordinatorSrc.includes('syncProgressSequenceFromSnapshot'), 'sequence sync helper');
  assert(coordinatorSrc.includes('reconnectWithBackoff'), 'bounded reconnect');

  // Legacy live preserved
  assert(existsSync(join(process.cwd(), 'src/live')));
  assert(existsSync(join(process.cwd(), 'src/store/useLiveMatchStore.ts')));

  // Docs
  for (const doc of [
    'docs/LIVE_PVP_PHASE_3_QA.md',
    'docs/LIVE_PVP_RECOVERY_POLICY.md',
  ]) {
    assert(existsSync(join(process.cwd(), doc)), doc);
  }

  await clearLivePvpCheckpoint();
}

if (require.main === module) {
  runLivePvpPhase3SelfTests()
    .then(() => console.log('Live PvP Phase 3 self-tests passed.'))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
