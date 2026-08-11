/**
 * Version 1.5 Live PvP release-freeze behavioral self-tests.
 * Run: npm run test:live-pvp-release
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createInitialGameState } from '../game/gameEngine';
import { buildLivePvpCheckpoint } from './livePvpCheckpoint';
import {
  LIVE_PVP_CHECKPOINT_SCHEMA_VERSION,
  validateLivePvpCheckpointPayload,
} from './livePvpCheckpointValidate';
import { evaluateLivePvpRecovery } from './livePvpRecovery';
import { LIVE_PVP_PROTOCOL_VERSION } from './livePvpConfig';
import {
  computeLivePvpBackoffDelayMs,
  DEFAULT_LIVE_PVP_RECONNECT_BACKOFF,
  shouldScheduleLivePvpReconnect,
} from './livePvpReconnectPolicy';
import type { LiveMatchSnapshot } from './livePvpTypes';

const USER_A = 'a0000000-0000-4000-8000-000000000001';
const MATCH_ID = 'b0000000-0000-4000-8000-000000000001';
const ATTEMPT_ID = 'c0000000-0000-4000-8000-000000000001';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Live PvP release-freeze self-test failed: ${message}`);
  }
}

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

function baseSnapshot(overrides?: Partial<LiveMatchSnapshot>): LiveMatchSnapshot {
  return {
    matchId: MATCH_ID,
    status: 'active',
    stateVersion: 1,
    protocolVersion: LIVE_PVP_PROTOCOL_VERSION,
    realtimeTopic: `live_pvp:${MATCH_ID}`,
    participantRole: 'challenger',
    challenger: { userId: USER_A, displayName: 'A' },
    opponent: { userId: 'd0000000-0000-4000-8000-000000000002', displayName: 'B' },
    challengerReady: true,
    opponentReady: true,
    scheduledStartAt: '2026-08-10T12:00:00.000Z',
    gameplayDeadlineAt: '2026-08-10T12:02:00.000Z',
    submissionGraceUntil: '2026-08-10T12:02:15.000Z',
    expiresAt: '2026-08-10T12:02:15.000Z',
    rulesVersion: 'v1',
    deckVersion: 'v1',
    durationSeconds: 120,
    bustLimit: 3,
    seed: 'server-authoritative-seed',
    seedAvailable: true,
    outcome: null,
    winnerUserId: null,
    decidingField: null,
    completionReason: null,
    settledAt: null,
    myAttempt: {
      attemptId: ATTEMPT_ID,
      status: 'active',
      score: 0,
      completedAt: null,
    },
    progress: [],
    myLatestProgressSequence: 2,
    serverNow: '2026-08-10T12:00:30.000Z',
    gameplayEligible: true,
    ...overrides,
  };
}

export function runLivePvpReleaseSelfTests(): void {
  // --- Reconnect backoff (injectable timing contract) ---
  const delay0 = computeLivePvpBackoffDelayMs(0, DEFAULT_LIVE_PVP_RECONNECT_BACKOFF, 0);
  const delay1 = computeLivePvpBackoffDelayMs(1, DEFAULT_LIVE_PVP_RECONNECT_BACKOFF, 0);
  assert(delay0 === 500, 'backoff base 500ms');
  assert(delay1 === 1000, 'backoff doubles');
  assert(
    computeLivePvpBackoffDelayMs(10, DEFAULT_LIVE_PVP_RECONNECT_BACKOFF, 0) === 8000,
    'backoff capped',
  );

  assert(
    shouldScheduleLivePvpReconnect({
      disposed: false,
      matchId: MATCH_ID,
      userId: USER_A,
      intentionalLeave: false,
      snapshotStatus: 'active',
    }),
    'reconnect when active',
  );
  assert(
    !shouldScheduleLivePvpReconnect({
      disposed: false,
      matchId: MATCH_ID,
      userId: USER_A,
      intentionalLeave: true,
      snapshotStatus: 'active',
    }),
    'no reconnect after intentional leave',
  );
  assert(
    !shouldScheduleLivePvpReconnect({
      disposed: false,
      matchId: MATCH_ID,
      userId: USER_A,
      intentionalLeave: false,
      snapshotStatus: 'completed',
    }),
    'no reconnect terminal match',
  );

  // --- Checkpoint validation ---
  const session = {
    matchId: MATCH_ID,
    attemptId: ATTEMPT_ID,
    participantRole: 'challenger' as const,
    authoritativeSeed: 'seed-from-snapshot-only',
    rulesVersion: 'v1',
    deckVersion: 'v1',
    durationSeconds: 120,
    bustLimit: 3,
    scheduledStartAt: '2026-08-10T12:00:00.000Z',
    gameplayDeadlineAt: '2026-08-10T12:02:00.000Z',
    submissionGraceUntil: '2026-08-10T12:02:15.000Z',
    protocolVersion: LIVE_PVP_PROTOCOL_VERSION,
    opponentDisplayName: 'B',
    serverStartTime: '2026-08-10T12:00:00.000Z',
  };
  const checkpoint = buildLivePvpCheckpoint({
    userId: USER_A,
    session,
    game: createInitialGameState(),
    exact21Count: 0,
    fiveCardClearCount: 0,
    lastAcceptedProgressSequence: 1,
    lastAttemptedProgressSequence: 1,
  });
  assert(checkpoint.schemaVersion === LIVE_PVP_CHECKPOINT_SCHEMA_VERSION, 'schema v2');
  const valid = validateLivePvpCheckpointPayload(checkpoint);
  assert(valid.ok, 'valid checkpoint passes');

  const withSeed = validateLivePvpCheckpointPayload({
    ...checkpoint,
    authoritativeSeed: 'leak',
  });
  assert(!withSeed.ok && withSeed.reason === 'seed_persisted', 'reject persisted seed');

  const badRole = validateLivePvpCheckpointPayload({
    ...checkpoint,
    participantRole: 'spectator',
  });
  assert(!badRole.ok, 'reject bad role');

  // --- Recovery past deadline ---
  const pastDeadline = evaluateLivePvpRecovery({
    checkpoint,
    userId: USER_A,
    snapshot: baseSnapshot({
      status: 'active',
      serverNow: '2026-08-10T12:03:00.000Z',
      gameplayDeadlineAt: '2026-08-10T12:02:00.000Z',
    }),
  });
  assert(pastDeadline.kind === 'discard' && pastDeadline.reason === 'past_deadline', 'past deadline');

  const countdownPast = evaluateLivePvpRecovery({
    checkpoint,
    userId: USER_A,
    snapshot: baseSnapshot({
      status: 'countdown',
      serverNow: '2026-08-10T12:03:00.000Z',
    }),
  });
  assert(countdownPast.kind === 'discard' && countdownPast.reason === 'past_deadline', 'countdown past deadline');

  const missingSeed = evaluateLivePvpRecovery({
    checkpoint,
    userId: USER_A,
    snapshot: baseSnapshot({ seed: null, seedAvailable: false }),
  });
  assert(missingSeed.kind === 'discard' && missingSeed.reason === 'missing_seed', 'missing seed');

  // --- Privilege closure migration ---
  const mig = readRepo(
    'supabase/migrations/20260810185335_v1_5_live_pvp_privilege_closure.sql',
  );
  assert(mig.includes('REVOKE ALL ON FUNCTION public.enqueue_player_notification'), 'enqueue revoke');
  assert(mig.includes('has_function_privilege'), 'privilege assertions');
  assert(mig.includes('get_live_pvp_snapshot(uuid)'), 'client rpc allowlist');

  // --- Coordinator reconnect wiring ---
  const coordinatorSrc = readRepo('src/livePvp/livePvpCoordinator.ts');
  assert(coordinatorSrc.includes('handleUnexpectedDisconnect'), 'unexpected disconnect handler');
  assert(coordinatorSrc.includes('notifyForegroundActiveMatch'), 'foreground reconnect');
  assert(coordinatorSrc.includes('scheduleReconnect(\'snapshot_failed\')'), 'snapshot failure reconnect');

  const storeSrc = readRepo('src/store/useLivePvpStore.ts');
  assert(storeSrc.includes('notifyMatchForeground'), 'store foreground hook');

  const supabaseClient = readRepo('src/lib/supabase.ts');
  assert(!/SERVICE_ROLE|service_role_key/i.test(supabaseClient), 'no service role in client');

  // --- Native config ---
  const appJson = readRepo('app.json');
  assert(appJson.includes('"version": "1.5.0"'), 'app version 1.5.0');
  assert(appJson.includes('"buildNumber": "909"'), 'ios build 909');
  assert(appJson.includes('"versionCode": 902'), 'android versionCode 902');
  assert(appJson.includes('withAndroidKotlinGradle.js'), 'kotlin plugin');
  assert(appJson.includes('"kotlinVersion": "2.3.0"'), 'kotlin 2.3.0');
  assert(appJson.includes('"rcVersion": "1.5.0"'), 'rcVersion 1.5.0');

  const easJson = readRepo('eas.json');
  assert(easJson.includes('live-pvp-qa'), 'live-pvp-qa profile');
  assert(easJson.includes('testflight-rescue'), 'testflight-rescue profile');
}

if (require.main === module) {
  runLivePvpReleaseSelfTests();
  console.log('Live PvP release-freeze self-tests passed.');
}
