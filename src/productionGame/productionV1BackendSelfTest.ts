import { readFileSync } from 'node:fs';
const sql=readFileSync('supabase/migrations/20260812193000_production_v1_authoritative_matches.sql','utf8').toLowerCase();
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(`production-v1 backend: ${message}`);}
for(const table of ['production_v1_matches','production_v1_participants','production_v1_actions']){
  assert(sql.includes(`alter table public.${table} enable row level security`),`${table} RLS`);
  assert(sql.includes(`revoke all on public.${table}`),`${table} direct grants closed`);
}
assert(sql.includes('for update'),'row locking');
assert(sql.includes('unique (match_id,user_id,client_action_id)'),'idempotency key');
assert(sql.includes('unique (match_id,expected_revision)'),'one action per revision');
assert(sql.includes("raise exception 'stale_revision'"),'stale revision rejection');
assert(sql.includes("set search_path=pg_catalog,public"),'fixed search paths');
assert(sql.includes("v_user uuid:=auth.uid()"),'server identity');
assert(sql.includes("'card.place'"),'card intent allowlist');
assert(sql.includes('to service_role'),'resolver is server-only');
assert(!sql.includes('grant select on public.production_v1_'),'no client table reads');
console.log('production-v1 backend contract self-tests passed.');
