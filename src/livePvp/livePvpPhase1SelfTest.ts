/**
 * Version 1.5 Phase 1 Live PvP self-tests — contracts without a live database.
 * Run: npm run test:live-pvp-phase1
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { createLivePvpDeck, livePvpDeckFingerprint } from './createLivePvpDeck';
import { LIVE_PVP_CONFIG, livePvpTopicForMatch } from './livePvpConfig';
import {
  estimateServerClockOffset,
  serverNowEstimateMs,
} from './livePvpClock';
import {
  parseLivePvpRealtimeEvent,
  reconcileLivePvpEvent,
} from './livePvpProtocol';
import {
  isLivePvpTerminalStatus,
  isLivePvpTransitionAllowed,
} from './livePvpStateMachine';
import { compareAsyncDuelResults } from '../asyncDuel/asyncDuelComparator';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Live PvP Phase 1 self-test failed: ${message}`);
  }
}

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

export function runLivePvpPhase1SelfTests(): void {
  assert(LIVE_PVP_CONFIG.protocolVersion === '1', 'protocol version');
  assert(LIVE_PVP_CONFIG.durationSeconds === 120, 'duration');
  assert(LIVE_PVP_CONFIG.presenceEnabled === true, 'presence enabled flag');
  assert(LIVE_PVP_CONFIG.liveProgressEnabled === true, 'progress enabled');
  assert(
    livePvpTopicForMatch('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee') ===
      'live-pvp:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    'topic format',
  );

  // Deterministic decks
  const seed = '21blaze-live-pvp-v1:phase1-parity';
  const a = createLivePvpDeck(seed).map((c) => c.id);
  const b = createLivePvpDeck(seed).map((c) => c.id);
  assert(a.length === 52, 'full deck');
  assert(a.every((id, i) => id === b[i]), 'same seed identical');
  assert(
    livePvpDeckFingerprint(seed) !== livePvpDeckFingerprint(`${seed}-x`),
    'different seeds differ',
  );
  const deckSrc = readRepo('src/livePvp/createLivePvpDeck.ts');
  assert(!deckSrc.includes('Math.random'), 'no Math.random in live deck');
  assert(deckSrc.includes('createDailyChallengeDeck'), 'reuses canonical deck');

  // State machine
  assert(isLivePvpTransitionAllowed('invited', 'lobby'), 'invite→lobby');
  assert(isLivePvpTransitionAllowed('lobby', 'countdown'), 'lobby→countdown');
  assert(isLivePvpTransitionAllowed('countdown', 'active'), 'countdown→active');
  assert(isLivePvpTransitionAllowed('active', 'settling'), 'active→settling');
  assert(isLivePvpTransitionAllowed('settling', 'completed'), 'settling→completed');
  assert(isLivePvpTransitionAllowed('invited', 'declined'), 'decline');
  assert(isLivePvpTransitionAllowed('invited', 'cancelled'), 'cancel');
  assert(!isLivePvpTransitionAllowed('completed', 'active'), 'no revive');
  assert(!isLivePvpTransitionAllowed('expired', 'lobby'), 'no revive expired');
  assert(isLivePvpTerminalStatus('completed'), 'completed terminal');

  // Comparator reuse (settlement authority shared with Async Duel)
  const cmp = compareAsyncDuelResults(
    {
      score: 100,
      exact21Count: 1,
      fiveCardClearCount: 0,
      bustCount: 0,
      completionMs: 50_000,
    },
    {
      score: 100,
      exact21Count: 0,
      fiveCardClearCount: 0,
      bustCount: 0,
      completionMs: 40_000,
    },
  );
  assert(cmp.outcome === 'challenger_win', 'shared comparator exact21');
  assert(cmp.decidingField === 'exact_21', 'deciding field');

  // Protocol envelope validation
  const good = parseLivePvpRealtimeEvent({
    protocolVersion: '1',
    eventId: 'e1',
    matchId: 'm1',
    stateVersion: 2,
    eventType: 'PARTICIPANT_READY',
    serverOccurredAt: new Date().toISOString(),
    payload: { userId: 'u1', seed: 'secret-should-strip' },
  });
  assert(good != null, 'valid event');
  assert(!('seed' in good!.payload), 'seed stripped from payload');
  assert(parseLivePvpRealtimeEvent({ eventType: 'HACK' }) === null, 'reject unknown');
  assert(
    parseLivePvpRealtimeEvent({
      protocolVersion: '1',
      eventId: 'e',
      matchId: 'm',
      stateVersion: 1,
      eventType: 'MATCH_SETTLED',
    }) != null,
    'settled ok',
  );

  assert(reconcileLivePvpEvent(3, good!) === 'ignore', 'stale/equal ignore when v2 vs 3');
  const newer = parseLivePvpRealtimeEvent({
    protocolVersion: '1',
    eventId: 'e2',
    matchId: 'm1',
    stateVersion: 4,
    eventType: 'MATCH_ACTIVE',
    serverOccurredAt: new Date().toISOString(),
    payload: {},
  })!;
  assert(reconcileLivePvpEvent(3, newer) === 'apply', 'next version apply');
  const gap = parseLivePvpRealtimeEvent({
    protocolVersion: '1',
    eventId: 'e3',
    matchId: 'm1',
    stateVersion: 9,
    eventType: 'MATCH_ACTIVE',
    serverOccurredAt: new Date().toISOString(),
    payload: {},
  })!;
  assert(reconcileLivePvpEvent(3, gap) === 'refetch', 'gap refetch');

  // Clock offset estimate
  const estimate = estimateServerClockOffset([
    {
      localRequestStartedAt: 1000,
      localResponseReceivedAt: 1100,
      serverNowMs: 10_050,
    },
  ]);
  assert(estimate != null && estimate.rttMs === 100, 'rtt');
  assert(typeof serverNowEstimateMs(estimate, 2000) === 'number', 'server now estimate');

  // Migration + security contracts on disk
  const migPath = 'supabase/migrations/20260810143545_v1_5_phase1_live_pvp_foundation.sql';
  assert(existsSync(join(process.cwd(), migPath)), 'migration exists');
  const mig = readRepo(migPath);
  assert(mig.includes('live_pvp_matches'), 'matches table');
  assert(mig.includes('live_pvp_participants'), 'participants table');
  assert(mig.includes('live_pvp_attempts'), 'attempts table');
  assert(mig.includes('live_pvp_progress'), 'progress table');
  assert(mig.includes('live_pvp_events'), 'events ledger');
  assert(mig.includes('is_live_pvp_participant'), 'realtime membership');
  assert(mig.includes("extension = 'presence'"), 'presence-only client insert');
  assert(mig.includes('realtime.send'), 'server-originated broadcast');
  assert(mig.includes('create_live_pvp_invite'), 'invite rpc');
  assert(mig.includes('set_live_pvp_ready'), 'ready rpc');
  assert(mig.includes('finalize_live_pvp_deadlines'), 'finalizer');
  assert(mig.includes('compare_async_duel_results'), 'canonical comparator reused');
  assert(mig.includes('-- No XP / Blaze Coins / public Live PvP records in Phase 1.'), 'no rewards in settle');
  assert(!/CREATE TABLE\s+realtime\./i.test(mig), 'no app tables in realtime schema');

  // Client must not ship service role
  assert(
    !/SERVICE_ROLE|service_role_key/i.test(readRepo('src/lib/supabase.ts')),
    'no service role in client',
  );
  assert(
    !readRepo('src/livePvp/livePvpChannel.ts').includes("extension = 'broadcast'") &&
      readRepo('src/livePvp/livePvpChannel.ts').includes('private: true'),
    'private channel client',
  );

  // Docs required
  for (const doc of [
    'docs/LIVE_PVP_SECURITY_MODEL.md',
    'docs/LIVE_PVP_PROTOCOL.md',
    'docs/LIVE_PVP_OPERATIONS.md',
  ]) {
    assert(existsSync(join(process.cwd(), doc)), `missing ${doc}`);
  }

  // No player-facing Live PvP screens added in Phase 1 (harness only under screens/dev)
  assert(
    existsSync(join(process.cwd(), 'src/screens/dev/LivePvpHarnessScreen.tsx')),
    'dev harness present',
  );
  assert(
    !existsSync(join(process.cwd(), 'src/screens/LivePvpLobbyScreen.tsx')),
    'no full lobby UI yet',
  );
}

runLivePvpPhase1SelfTests();
console.log('Live PvP Phase 1 self-tests passed.');
