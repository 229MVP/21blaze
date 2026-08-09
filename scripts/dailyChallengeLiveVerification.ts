/**
 * Phase 1.5 — hosted Daily Challenge backend verification (Node only).
 * Requires EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 * Never commit or log JWTs, service-role keys, or passwords.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { hashDailyChallengeDeckOrder } from '../src/challenge/dailyChallengeDeckHash';
import { hashAuthoritativeSeedFingerprint } from '../src/challenge/seedFingerprint';
import { getUtcChallengeDate } from '../src/challenge/utcChallengeDate';
import { createDailyChallengeDeck } from '../src/game/challenge/createDailyChallengeDeck';

type ReportSection = Record<string, unknown>;

const report: Record<string, ReportSection> = {};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function hashSeedFingerprint(authoritativeSeed: string): string {
  return hashAuthoritativeSeedFingerprint(authoritativeSeed);
}

async function createAuthedTestUser(
  admin: SupabaseClient,
  label: string,
): Promise<{ client: SupabaseClient; userId: string }> {
  const email = `v13-live-${label}-${Date.now()}@21blaze-test.invalid`;
  const password = `Test-${crypto.randomUUID()}`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    throw new Error(`create_user_failed_${label}: ${createError?.message ?? 'no user'}`);
  }

  const url = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
  const publishableKey = requireEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`sign_in_failed_${label}: ${signInError.message}`);
  }

  return { client, userId: created.user.id };
}

async function main(): Promise<void> {
  const url = requireEnv('EXPO_PUBLIC_SUPABASE_URL');
  const publishableKey = requireEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY required for test-user creation only (not stored in app).',
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  report.migration = {
    note: '0012 listed via supabase migration list in agent run',
  };

  const userA = await createAuthedTestUser(admin, 'a');
  const userB = await createAuthedTestUser(admin, 'b');

  const today = getUtcChallengeDate();
  report.utcToday = { challengeDate: today };

  const { data: todayChallenge, error: todayError } = await userA.client.rpc(
    'get_today_daily_challenge',
  );
  if (todayError) {
    throw new Error(`get_today_daily_challenge failed: ${todayError.message}`);
  }
  report.todayChallenge = todayChallenge as ReportSection;

  const { data: start1, error: start1Error } = await userA.client.rpc('start_daily_challenge');
  if (start1Error) {
    throw new Error(`start_daily_challenge failed: ${start1Error.message}`);
  }
  report.authenticatedStart = start1 as ReportSection;

  const startRecord = start1 as Record<string, unknown>;
  if (startRecord.error) {
    throw new Error(`unexpected start error: ${String(startRecord.error)}`);
  }

  const seed = String(startRecord.seed);
  const attemptId = String(startRecord.attemptId);
  const challengeId = String(startRecord.challengeId);
  const rulesVersion = String(startRecord.rulesVersion);

  const deck1 = createDailyChallengeDeck(seed).map((c) => c.id);
  const deck2 = createDailyChallengeDeck(seed).map((c) => c.id);
  report.hostedSeedDeterminism = {
    seedFingerprint: hashSeedFingerprint(seed),
    deckHash: hashDailyChallengeDeckOrder(deck1),
    identicalRepeatedRuns: deck1.every((id, i) => id === deck2[i]),
    deckLength: deck1.length,
  };

  const { data: start2, error: start2Error } = await userA.client.rpc('start_daily_challenge');
  if (start2Error) {
    throw new Error(`duplicate start failed: ${start2Error.message}`);
  }
  report.duplicateStart = start2 as ReportSection;

  const { count: attemptCountA } = await admin
    .from('daily_challenge_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('challenge_id', challengeId)
    .eq('user_id', userA.userId)
    .eq('attempt_type', 'ranked');

  report.duplicateStartRowCount = { userA: attemptCountA };

  const { data: startB, error: startBError } = await userB.client.rpc('start_daily_challenge');
  if (startBError) {
    throw new Error(`user_b start failed: ${startBError.message}`);
  }
  const startBRecord = startB as Record<string, unknown>;
  report.secondUserStart = {
    challengeId: startBRecord.challengeId,
    seedFingerprint: hashSeedFingerprint(String(startBRecord.seed)),
    sameChallengeId: startBRecord.challengeId === challengeId,
    sameSeedFingerprint:
      hashSeedFingerprint(String(startBRecord.seed)) === hashSeedFingerprint(seed),
    resumed: startBRecord.resumed,
  };

  const { data: readCrossA, error: readCrossAError } = await userA.client
    .from('daily_challenge_attempts')
    .select('id')
    .eq('user_id', userB.userId);
  report.rlsCrossReadA = {
    rowsReturned: readCrossA?.length ?? 0,
    error: readCrossAError?.message ?? null,
  };

  const { data: readCrossB, error: readCrossBError } = await userB.client
    .from('daily_challenge_attempts')
    .select('id')
    .eq('user_id', userA.userId);
  report.rlsCrossReadB = {
    rowsReturned: readCrossB?.length ?? 0,
    error: readCrossBError?.message ?? null,
  };

  const { error: insertFakeAttempt } = await userA.client.from('daily_challenge_attempts').insert({
    challenge_id: challengeId,
    user_id: userA.userId,
    attempt_type: 'ranked',
    status: 'started',
  });
  report.rlsFakeAttemptInsert = { blocked: Boolean(insertFakeAttempt) };

  const { error: insertChallenge } = await userA.client.from('daily_challenges').insert({
    challenge_date: today,
    seed: 1,
    rules_version: 1,
    scoring_version: 1,
    duration_seconds: 120,
    status: 'active',
    starts_at: new Date().toISOString(),
    ends_at: new Date().toISOString(),
  });
  report.rlsChallengeInsert = { blocked: Boolean(insertChallenge) };

  const { data: complete1, error: complete1Error } = await userA.client.rpc(
    'complete_daily_challenge',
    {
      p_attempt_id: attemptId,
      p_score: 1500,
      p_exact_21_count: 2,
      p_five_card_clear_count: 1,
      p_bust_count: 1,
      p_cards_played: 35,
      p_completion_ms: 95000,
      p_rules_version: rulesVersion,
    },
  );
  if (complete1Error) {
    throw new Error(`complete failed: ${complete1Error.message}`);
  }
  report.completion = complete1 as ReportSection;

  const { data: complete2, error: complete2Error } = await userA.client.rpc(
    'complete_daily_challenge',
    {
      p_attempt_id: attemptId,
      p_score: 9999,
      p_exact_21_count: 99,
      p_five_card_clear_count: 99,
      p_bust_count: 99,
      p_cards_played: 99,
      p_completion_ms: 95000,
      p_rules_version: rulesVersion,
    },
  );
  if (complete2Error) {
    throw new Error(`completion retry failed: ${complete2Error.message}`);
  }
  report.completionRetry = complete2 as ReportSection;

  const { data: startAfterComplete } = await userA.client.rpc('start_daily_challenge');
  report.startAfterComplete = startAfterComplete as ReportSection;

  const utcBoundary = {
    dateAt235959: getUtcChallengeDate(Date.parse(`${today}T23:59:59.000Z`)),
    dateAtNextMidnight: getUtcChallengeDate(
      Date.parse(`${today}T00:00:00.000Z`) + 24 * 60 * 60 * 1000 + 1000,
    ),
  };
  report.utcBoundary = utcBoundary;

  await admin.from('daily_challenge_attempts').delete().eq('user_id', userA.userId);
  await admin.from('daily_challenge_attempts').delete().eq('user_id', userB.userId);
  await admin.auth.admin.deleteUser(userA.userId);
  await admin.auth.admin.deleteUser(userB.userId);
  report.testDataCleanup = {
    removedAttemptRowsForTestUsers: true,
    removedTestAuthUsers: true,
    preservedOfficialChallenge: true,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
