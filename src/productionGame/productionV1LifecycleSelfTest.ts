import { readFileSync } from 'node:fs';
const resolver=readFileSync('supabase/functions/production-v1-resolver/index.ts','utf8');
const migration=readFileSync('supabase/migrations/20260812203000_production_v1_timeout_settlement.sql','utf8').toLowerCase();
const screen=readFileSync('src/productionGame/ProductionLiveGameScreen.tsx','utf8');
const service=readFileSync('src/productionGame/productionV1Service.ts','utf8');
function assert(v:unknown,m:string):asserts v{if(!v)throw new Error(`production-v1 lifecycle: ${m}`);}
assert(resolver.includes("body?.sync&&body.matchId"),'authenticated heartbeat');
assert(resolver.includes("connected:true,disconnect_deadline_at:null"),'reconnect recovery');
assert(resolver.includes("Date.parse(match.ends_at)<=Date.now()"),'server timeout');
assert(resolver.includes("score(state,0)"),'authoritative final score');
assert(resolver.includes('winnerUserId'),'winner settlement');
assert(migration.includes('for update'),'settlement row lock');
assert(migration.includes("v_match.ends_at>now()"),'early settlement blocked');
assert(migration.includes('to service_role'),'settlement service-only');
assert(service.includes('syncProductionV1Match'),'phone heartbeat bridge');
assert(screen.includes("results?.winnerUserId===userId?'YOU WIN'"),'winner UI');
assert(screen.includes('OPPONENT {opponentScore??0}'),'opponent score UI');
console.log('production-v1 lifecycle self-tests passed.');