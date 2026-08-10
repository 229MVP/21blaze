/**
 * v1.4 Phase 1.5 integration gate — security hardening and client validation tests.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  parseAsyncDuelCompletion,
  parseAsyncDuelDetails,
  parseAsyncDuelHistoryItem,
  parseAsyncDuelInboxItem,
  parseAsyncDuelStart,
} from './asyncDuelProtocol';
import { AsyncDuelServiceError } from './asyncDuelServiceError';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Async Duel integration self-test failed: ${message}`);
  }
}

function readRepo(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

export function runAsyncDuelIntegrationSelfTests(): void {
  const mig0015 = readRepo('supabase/migrations/0015_v1_4_phase1_async_duel_foundation.sql');
  const mig0016 = readRepo('supabase/migrations/0016_v1_4_async_duel_security_hardening.sql');

  // Expiration exploit regression (static)
  assert(
    mig0015.includes('GRANT EXECUTE ON FUNCTION public.expire_async_duels(timestamptz) TO authenticated'),
    '0015 originally granted expire to authenticated (known vulnerability)',
  );
  assert(mig0016.includes('LEAST(COALESCE(p_now, now()), now())'), '0016 clamps expiration time');
  assert(
    mig0016.includes(
      'REVOKE ALL ON FUNCTION public.expire_async_duels(timestamptz) FROM anon, authenticated',
    ),
    '0016 revokes expire from clients',
  );
  assert(
    mig0016.includes('GRANT EXECUTE ON FUNCTION public.expire_async_duels(timestamptz) TO service_role'),
    '0016 grants expire to service_role only',
  );

  // Create recovery
  assert(mig0016.includes('resumedExisting'), 'create returns resumedExisting flag');
  assert(mig0016.includes('Resume existing active duel'), 'create resume documented in SQL');

  // Seed disclosure in SQL JSON builders (details/inbox/history only — create/start may return seed)
  const detailsFn = mig0015.split('CREATE OR REPLACE FUNCTION public.get_async_duel_details')[1]?.split('CREATE OR REPLACE FUNCTION')[0] ?? '';
  assert(!detailsFn.includes("'seed'"), 'get_async_duel_details JSON omits seed key');
  assert(detailsFn.includes('Seed intentionally omitted'), 'details documents seed omission');

  // Migration order
  for (const name of [
    '0011_v1_3a_daily_challenge.sql',
    '0012_v1_3_phase1_daily_challenge_rpc.sql',
    '0013_v1_3_phase3_leaderboards_streaks_rewards.sql',
    '0014_v1_3_phase4_progression.sql',
    '0015_v1_4_phase1_async_duel_foundation.sql',
    '0016_v1_4_async_duel_security_hardening.sql',
  ]) {
    assert(existsSync(join(process.cwd(), 'supabase/migrations', name)), `migration ${name}`);
  }

  // Strict parsers reject malformed payloads
  let threw = false;
  try {
    parseAsyncDuelStart({
      duelId: 'd1',
      attemptId: 'a1',
      // missing seed
      rulesVersion: '1',
      deckVersion: '1',
      durationSeconds: 120,
      bustLimit: 3,
      status: 'challenger_playing',
      expiresAt: '2026-01-01T00:00:00Z',
      participantRole: 'challenger',
    });
  } catch (e) {
    threw = e instanceof AsyncDuelServiceError;
  }
  assert(threw, 'start parser rejects missing seed');

  threw = false;
  try {
    parseAsyncDuelStart({
      duelId: undefined,
      attemptId: 'a1',
      seed: 's',
      rulesVersion: '1',
      deckVersion: '1',
      durationSeconds: 120,
      bustLimit: 3,
      status: 'challenger_playing',
      expiresAt: '2026-01-01T00:00:00Z',
      participantRole: 'challenger',
    } as Record<string, unknown>);
  } catch (e) {
    threw = e instanceof AsyncDuelServiceError;
  }
  assert(threw, 'start parser rejects undefined duelId');

  const validStart = parseAsyncDuelStart({
    duelId: 'd1',
    attemptId: 'a1',
    seed: '21blaze-async-v1:test',
    rulesVersion: '1',
    deckVersion: '1',
    durationSeconds: 120,
    bustLimit: 3,
    status: 'challenger_playing',
    expiresAt: '2026-01-01T00:00:00Z',
    participantRole: 'challenger',
    resumedExisting: true,
  });
  assert(validStart.resumedExisting === true, 'parses resumedExisting');

  threw = false;
  try {
    parseAsyncDuelInboxItem({
      duelId: 'd1',
      challenger: { userId: 'u1', displayName: 'A', profileFrameId: null },
      challengerScore: 100,
      rulesVersion: '1',
      deckVersion: '1',
      durationSeconds: 120,
      bustLimit: 3,
      createdAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-02T00:00:00Z',
      status: 'awaiting_opponent',
      seed: 'leak',
    });
  } catch (e) {
    threw = e instanceof AsyncDuelServiceError;
  }
  assert(threw, 'inbox parser rejects seed field');

  const details = parseAsyncDuelDetails({
    duelId: 'd1',
    status: 'awaiting_opponent',
    participantRole: 'opponent',
    outcome: null,
    winnerUserId: null,
    decidingField: null,
    challenger: { userId: 'u1', displayName: 'A', profileFrameId: null },
    opponent: { userId: 'u2', displayName: 'B', profileFrameId: null },
    rulesVersion: '1',
    deckVersion: '1',
    durationSeconds: 120,
    bustLimit: 3,
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-01-02T00:00:00Z',
    settledAt: null,
    challengerAttemptStatus: 'completed',
    opponentAttemptStatus: null,
    challengerScore: 5000,
    opponentScore: null,
  });
  assert(details.participantRole === 'opponent', 'details participant role');

  const completion = parseAsyncDuelCompletion({
    duelId: 'd1',
    status: 'completed',
    outcome: 'challenger_win',
    winnerUserId: 'u1',
    decidingField: 'score',
    settledAt: '2026-01-03T00:00:00Z',
    challengerResult: {
      attemptId: 'a1',
      score: 100,
      exact21Count: 0,
      fiveCardClearCount: 0,
      bustCount: 0,
      cardsPlayed: 10,
      lanesCleared: 2,
      completionMs: 50000,
      status: 'completed',
    },
    opponentResult: null,
  });
  assert(completion.outcome === 'challenger_win', 'completion outcome');

  threw = false;
  try {
    parseAsyncDuelHistoryItem({ duelId: 'd1', status: 'bad_status' });
  } catch (e) {
    threw = e instanceof AsyncDuelServiceError;
  }
  assert(threw, 'history rejects invalid status');

  // Legacy live duel preserved
  assert(existsSync(join(process.cwd(), 'src/live')), 'legacy live/ preserved');
  assert(existsSync(join(process.cwd(), 'src/store/useLiveMatchStore.ts')), 'live match store preserved');
  assert(existsSync(join(process.cwd(), 'supabase/migrations/0002_live_duels.sql')), 'live migration preserved');

  // Feature flag default off
  const flags = readRepo('src/config/featureFlags.ts');
  assert(flags.includes('isAsyncDuelEnabled'), 'async duel flag exists');
  assert(
    flags.includes('EXPO_PUBLIC_ENABLE_ASYNC_DUEL') && flags.includes('false'),
    'async duel defaults off',
  );
  assert(flags.includes('isLiveDuelEnabled'), 'legacy live duel flag exists');

  // Protocol module present
  assert(existsSync(join(process.cwd(), 'src/asyncDuel/asyncDuelProtocol.ts')), 'protocol validators');
  assert(existsSync(join(process.cwd(), 'docs/V1_4_FOUNDATION_INTEGRATION_REPORT.md')), 'integration report');
}

if (require.main === module) {
  runAsyncDuelIntegrationSelfTests();
  console.log('Async Duel integration self-tests passed.');
}
