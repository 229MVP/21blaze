import { readFileSync } from 'node:fs';
const source=readFileSync('supabase/functions/production-v1-resolver/index.ts','utf8');
const migration=readFileSync('supabase/migrations/20260812200525_production_v1_secure_resolver.sql','utf8').toLowerCase();
function assert(v:unknown,m:string):asserts v{if(!v)throw new Error(`production-v1 resolver: ${m}`);}
assert(source.includes('caller.auth.getUser()'),'verified caller identity');
assert(source.includes("action.user_id!==user.id"),'action ownership');
assert(source.includes("select('seed,server_state')"),'hidden server state');
assert(source.includes('publicPlayer'),'public snapshot sanitizer');
assert(!source.includes('seed:secretRow.seed'),'seed not returned');
assert(source.includes("'npm:@supabase/supabase-js@2.109.0'"),'pinned server client');
assert(migration.includes('for update'),'transaction row locks');
assert(migration.includes('production_v1_match_secrets set server_state'),'atomic hidden-state update');
assert(migration.includes('to service_role'),'service-only resolver');
assert(migration.includes('from public,anon,authenticated'),'client execution revoked');
console.log('production-v1 resolver self-tests passed.');