/**
 * Version 1.4 Release Freeze self-tests — contracts that must hold for ship.
 * Run: npm run test:async-duel-release
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  compareAsyncDuelResults,
  isAsyncDuelTransitionAllowed,
} from './asyncDuelComparator';
import {
  asyncDuelDeckFingerprint,
  createAsyncDuelDeck,
} from './createAsyncDuelDeck';
import { ASYNC_DUEL_RESUME_POLICY } from './asyncDuelResumePolicy';
import { mapAsyncDuelErrorMessage } from './asyncDuelErrorMap';
import { parseNotificationDeepLink } from '../notifications/duelNotificationRegistry';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Async Duel release-freeze self-test failed: ${message}`);
  }
}

function base(
  score: number,
  extras?: Partial<Parameters<typeof compareAsyncDuelResults>[0]>,
) {
  return {
    score,
    exact21Count: 0,
    fiveCardClearCount: 0,
    bustCount: 0,
    completionMs: 90_000,
    ...extras,
  };
}

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

export function runAsyncDuelReleaseFreezeSelfTests(): void {
  // --- Identical conditions ---
  const seed = '21blaze-async-v1:freeze-parity-seed';
  const deckA = createAsyncDuelDeck(seed).map((c) => c.id);
  const deckB = createAsyncDuelDeck(seed).map((c) => c.id);
  assert(deckA.length === 52, 'full deck');
  assert(deckA.every((id, i) => id === deckB[i]), 'same seed identical order');
  assert(
    asyncDuelDeckFingerprint(seed) === asyncDuelDeckFingerprint(seed),
    'fingerprint stable',
  );
  assert(
    asyncDuelDeckFingerprint(seed) !==
      asyncDuelDeckFingerprint(`${seed}-other`),
    'different seeds differ',
  );

  const deckSource = readRepo('src/asyncDuel/createAsyncDuelDeck.ts');
  assert(!deckSource.includes('Math.random'), 'async deck factory avoids Math.random');
  assert(
    deckSource.includes("from '../game/challenge/createDailyChallengeDeck'"),
    'reuses canonical daily deck',
  );
  const dailySrc = readRepo('src/game/challenge/createDailyChallengeDeck.ts');
  assert(
    dailySrc.includes('shuffleDeckWithSeed'),
    'canonical deck uses seeded shuffle',
  );
  // Strip docs/comments that may mention Math.random before scanning for calls.
  const dailyCode = dailySrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert(!dailyCode.includes('Math.random'), 'canonical deck code avoids Math.random');

  // --- State machine ---
  assert(isAsyncDuelTransitionAllowed('challenger_playing', 'awaiting_opponent'), 'c→await');
  assert(isAsyncDuelTransitionAllowed('awaiting_opponent', 'opponent_playing'), 'await→opp');
  assert(isAsyncDuelTransitionAllowed('opponent_playing', 'completed'), 'opp→done');
  assert(isAsyncDuelTransitionAllowed('challenger_playing', 'cancelled'), 'cancel');
  assert(isAsyncDuelTransitionAllowed('awaiting_opponent', 'declined'), 'decline');
  assert(isAsyncDuelTransitionAllowed('awaiting_opponent', 'expired'), 'expire await');
  assert(isAsyncDuelTransitionAllowed('opponent_playing', 'expired'), 'expire opp');
  assert(!isAsyncDuelTransitionAllowed('cancelled', 'challenger_playing'), 'no revive cancel');
  assert(!isAsyncDuelTransitionAllowed('declined', 'opponent_playing'), 'no revive decline');
  assert(!isAsyncDuelTransitionAllowed('expired', 'opponent_playing'), 'no revive expired');
  assert(!isAsyncDuelTransitionAllowed('completed', 'challenger_playing'), 'no revive completed');
  assert(!isAsyncDuelTransitionAllowed('completed', 'cancelled'), 'no cancel after complete');
  assert(!isAsyncDuelTransitionAllowed('awaiting_opponent', 'completed'), 'no skip opponent');
  assert(!isAsyncDuelTransitionAllowed('challenger_playing', 'completed'), 'no one-sided complete');

  // --- Comparator order ---
  assert(
    compareAsyncDuelResults(base(200), base(100)).outcome === 'challenger_win',
    'higher score',
  );
  assert(
    compareAsyncDuelResults(base(100, { exact21Count: 3 }), base(100, { exact21Count: 1 }))
      .outcome === 'challenger_win',
    'exact 21s',
  );
  assert(
    compareAsyncDuelResults(
      base(100, { fiveCardClearCount: 2 }),
      base(100, { fiveCardClearCount: 1 }),
    ).outcome === 'challenger_win',
    'five-card clears',
  );
  assert(
    compareAsyncDuelResults(base(100, { bustCount: 1 }), base(100, { bustCount: 3 })).outcome ===
      'challenger_win',
    'fewer busts',
  );
  assert(
    compareAsyncDuelResults(base(100, { completionMs: 50_000 }), base(100, { completionMs: 80_000 }))
      .outcome === 'challenger_win',
    'faster completion',
  );
  assert(compareAsyncDuelResults(base(100), base(100)).outcome === 'tie', 'full equality tie');

  // --- Seed / deep-link policy ---
  assert(
    ASYNC_DUEL_RESUME_POLICY.seedDisclosure === 'only_on_own_attempt_start',
    'seed disclosure policy',
  );
  const link = parseNotificationDeepLink({
    screen: 'AsyncDuelResult',
    duelId: 'd1',
    seed: 'must-not-pass',
  });
  assert(link != null && !('seed' in link), 'deep link strips seed');
  assert(
    mapAsyncDuelErrorMessage('ASYNC_DUEL_DISABLED').includes('unavailable'),
    'disabled error copy',
  );

  // --- Migration safeguards present ---
  const mig = readRepo('supabase/migrations/0018_v1_4_release_freeze_safeguards.sql');
  assert(mig.includes('async_duel_push_enabled'), 'push kill switch');
  assert(mig.includes('async_duel_rematch_enabled'), 'rematch kill switch');
  assert(mig.includes('get_async_duel_ops_status'), 'ops status rpc');
  assert(mig.includes('diagnose_async_duel_integrity'), 'integrity diagnostics');
  assert(mig.includes('validate_async_duel_result_fields'), 'result validation restored');
  assert(
    mig.includes('REVOKE ALL ON FUNCTION public.expire_async_duels(timestamptz) FROM anon, authenticated'),
    'expire revoked from clients',
  );
  assert(mig.includes('REVOKE INSERT, UPDATE, DELETE ON public.player_notifications'), 'notif mutate revoke');

  // --- Client must not ship service role ---
  const supabaseClient = readRepo('src/lib/supabase.ts');
  assert(
    !/SERVICE_ROLE|service_role_key/i.test(supabaseClient),
    'no service role in supabase client',
  );

  // --- Required release docs ---
  for (const doc of [
    'docs/V1_4_ASYNC_DUEL_OPERATIONS.md',
    'docs/V1_4_SECURITY_AUDIT.md',
    'docs/V1_4_RELEASE_TEST_MATRIX.md',
    'docs/V1_4_RELEASE_CHECKLIST.md',
    'docs/V1_4_RELEASE_VALIDATION_REPORT.md',
  ]) {
    assert(existsSync(join(process.cwd(), doc)), `missing ${doc}`);
  }

  // --- Marketing version ---
  const pkg = JSON.parse(readRepo('package.json')) as { version: string };
  const app = JSON.parse(readRepo('app.json')) as { expo: { version: string } };
  assert(pkg.version === '1.5.0', 'package version 1.5.0');
  assert(app.expo.version === '1.5.0', 'app.json version 1.5.0');
}

runAsyncDuelReleaseFreezeSelfTests();
console.log('Async Duel release-freeze self-tests passed.');
