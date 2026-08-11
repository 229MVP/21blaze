/**
 * Live PvP API-level privilege verification against a replayed Supabase project.
 * Requires env (never commit secrets):
 *   SUPABASE_URL=https://<ref>.supabase.co
 *   SUPABASE_ANON_KEY=<anon>
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role> (server-only)
 *
 * Run: npm run test:live-pvp-privileges
 */

import { createClient } from '@supabase/supabase-js';

type Row = {
  role: string;
  action: string;
  ok: boolean;
  detail: string;
};

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`Missing ${name}`);
  }
  return v;
}

function isPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const msg = String((error as { message?: string }).message ?? '').toLowerCase();
  const code = String((error as { code?: string }).code ?? '');
  return (
    code === '42501' ||
    msg.includes('permission denied') ||
    msg.includes('not authorized') ||
    msg.includes('jwt')
  );
}

async function main(): Promise<void> {
  const url = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows: Row[] = [];
  const fakeMatchId = '00000000-0000-4000-8000-000000000099';

  // anon — must not call client RPCs
  const anonOps = await anon.rpc('get_live_pvp_ops_status');
  rows.push({
    role: 'anon',
    action: 'get_live_pvp_ops_status',
    ok: isPermissionDenied(anonOps.error),
    detail: anonOps.error?.message ?? 'no error (unexpected)',
  });

  const anonFinalize = await anon.rpc('finalize_live_pvp_deadlines', { p_limit: 1 });
  rows.push({
    role: 'anon',
    action: 'finalize_live_pvp_deadlines',
    ok: isPermissionDenied(anonFinalize.error),
    detail: anonFinalize.error?.message ?? 'no error (unexpected)',
  });

  // service_role — worker functions
  const svcFinalize = await service.rpc('finalize_live_pvp_deadlines', { p_limit: 1 });
  rows.push({
    role: 'service_role',
    action: 'finalize_live_pvp_deadlines',
    ok: !svcFinalize.error,
    detail: svcFinalize.error?.message ?? 'ok',
  });

  const svcReconcile = await service.rpc('reconcile_live_pvp_active_slots', { p_limit: 5 });
  rows.push({
    role: 'service_role',
    action: 'reconcile_live_pvp_active_slots',
    ok: !svcReconcile.error,
    detail: svcReconcile.error?.message ?? 'ok',
  });

  // authenticated without session — snapshot should fail auth
  const anonSnapshot = await anon.rpc('get_live_pvp_snapshot', { p_match_id: fakeMatchId });
  rows.push({
    role: 'anon',
    action: 'get_live_pvp_snapshot',
    ok: isPermissionDenied(anonSnapshot.error),
    detail: anonSnapshot.error?.message ?? 'no error (unexpected)',
  });

  // direct table read blocked for anon
  const anonTable = await anon.from('live_pvp_matches').select('id').limit(1);
  rows.push({
    role: 'anon',
    action: 'select live_pvp_matches',
    ok: !!anonTable.error,
    detail: anonTable.error?.message ?? 'rows returned (unexpected)',
  });

  // authenticated — create test user via service role (preview branches may block custom email domains)
  const testEmail = `v15priv${Date.now()}@example.com`;
  const testPassword = `ExitGate!${Date.now()}`;
  const created = await service.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`Failed to create test user: ${created.error?.message ?? 'no user'}`);
  }

  const signIn = await anon.auth.signInWithPassword({ email: testEmail, password: testPassword });
  if (signIn.error || !signIn.data.session) {
    throw new Error(`Failed to sign in test user: ${signIn.error?.message ?? 'no session'}`);
  }

  const authed = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${signIn.data.session.access_token}` } },
  });

  const authOps = await authed.rpc('get_live_pvp_ops_status');
  rows.push({
    role: 'authenticated',
    action: 'get_live_pvp_ops_status',
    ok: !authOps.error,
    detail: authOps.error?.message ?? 'ok',
  });

  const authServerTime = await authed.rpc('get_live_pvp_server_time');
  rows.push({
    role: 'authenticated',
    action: 'get_live_pvp_server_time',
    ok: !authServerTime.error,
    detail: authServerTime.error?.message ?? 'ok',
  });

  const authFinalize = await authed.rpc('finalize_live_pvp_deadlines', { p_limit: 1 });
  rows.push({
    role: 'authenticated',
    action: 'finalize_live_pvp_deadlines',
    ok: isPermissionDenied(authFinalize.error),
    detail: authFinalize.error?.message ?? 'no error (unexpected)',
  });

  const authSettle = await authed.rpc('live_pvp_settle_match', { p_match_id: fakeMatchId });
  rows.push({
    role: 'authenticated',
    action: 'live_pvp_settle_match',
    ok: isPermissionDenied(authSettle.error),
    detail: authSettle.error?.message ?? 'no error (unexpected)',
  });

  const authSnapshot = await authed.rpc('get_live_pvp_snapshot', { p_match_id: fakeMatchId });
  const snapshotDenied =
    isPermissionDenied(authSnapshot.error) ||
    String(authSnapshot.error?.message ?? '').toLowerCase().includes('not found') ||
    String(authSnapshot.error?.message ?? '').toLowerCase().includes('match_not_found') ||
    String(authSnapshot.error?.message ?? '').toLowerCase().includes('not a participant');
  rows.push({
    role: 'authenticated',
    action: 'get_live_pvp_snapshot (non-participant)',
    ok: snapshotDenied,
    detail: authSnapshot.error?.message ?? 'data returned (unexpected)',
  });

  const authTable = await authed.from('live_pvp_matches').select('id').limit(1);
  rows.push({
    role: 'authenticated',
    action: 'select live_pvp_matches (direct)',
    ok: !!authTable.error,
    detail: authTable.error?.message ?? 'rows returned (unexpected)',
  });

  const authEventInsert = await authed.from('live_pvp_events').insert({
    match_id: fakeMatchId,
    event_type: 'TEST',
    payload: {},
  });
  rows.push({
    role: 'authenticated',
    action: 'insert live_pvp_events',
    ok: !!authEventInsert.error,
    detail: authEventInsert.error?.message ?? 'insert ok (unexpected)',
  });

  // unrelated authenticated user — cannot access another user's match context
  const unrelatedEmail = `v15privu${Date.now()}@example.com`;
  const unrelatedPassword = `ExitGate!${Date.now()}u`;
  const unrelatedCreated = await service.auth.admin.createUser({
    email: unrelatedEmail,
    password: unrelatedPassword,
    email_confirm: true,
  });
  if (unrelatedCreated.error || !unrelatedCreated.data.user) {
    throw new Error(`Failed to create unrelated user: ${unrelatedCreated.error?.message ?? 'no user'}`);
  }
  const unrelatedSignIn = await anon.auth.signInWithPassword({
    email: unrelatedEmail,
    password: unrelatedPassword,
  });
  if (unrelatedSignIn.error || !unrelatedSignIn.data.session) {
    throw new Error(`Failed to sign in unrelated user: ${unrelatedSignIn.error?.message ?? 'no session'}`);
  }
  const unrelated = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${unrelatedSignIn.data.session.access_token}` } },
  });

  const unrelatedSnapshot = await unrelated.rpc('get_live_pvp_snapshot', { p_match_id: fakeMatchId });
  const unrelatedDenied =
    isPermissionDenied(unrelatedSnapshot.error) ||
    String(unrelatedSnapshot.error?.message ?? '').toLowerCase().includes('not found') ||
    String(unrelatedSnapshot.error?.message ?? '').toLowerCase().includes('match_not_found') ||
    String(unrelatedSnapshot.error?.message ?? '').toLowerCase().includes('not a participant');
  rows.push({
    role: 'authenticated_unrelated',
    action: 'get_live_pvp_snapshot (non-participant)',
    ok: unrelatedDenied,
    detail: unrelatedSnapshot.error?.message ?? 'data returned (unexpected)',
  });

  const unrelatedTable = await unrelated.from('live_pvp_matches').select('id').limit(1);
  rows.push({
    role: 'authenticated_unrelated',
    action: 'select live_pvp_matches (direct)',
    ok: !!unrelatedTable.error,
    detail: unrelatedTable.error?.message ?? 'rows returned (unexpected)',
  });

  const unrelatedFinalize = await unrelated.rpc('finalize_live_pvp_deadlines', { p_limit: 1 });
  rows.push({
    role: 'authenticated_unrelated',
    action: 'finalize_live_pvp_deadlines',
    ok: isPermissionDenied(unrelatedFinalize.error),
    detail: unrelatedFinalize.error?.message ?? 'no error (unexpected)',
  });

  const failures = rows.filter((r) => !r.ok);
  for (const row of rows) {
    const status = row.ok ? 'PASS' : 'FAIL';
    console.log(`${status} [${row.role}] ${row.action}: ${row.detail}`);
  }

  if (failures.length > 0) {
    throw new Error(`Live PvP privilege API verification failed (${failures.length} checks)`);
  }

  console.log('Live PvP privilege API verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
