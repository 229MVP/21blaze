import { readFileSync } from 'node:fs';
const service=readFileSync('src/productionGame/productionV1Service.ts','utf8');
const screen=readFileSync('src/productionGame/ProductionLiveGameScreen.tsx','utf8');
const lobby=readFileSync('src/productionGame/ProductionLobbyScreen.tsx','utf8');
function assert(v:unknown,m:string):asserts v{if(!v)throw new Error(`production-v1 phone sync: ${m}`);}
assert(service.includes("functions.invoke('production-v1-resolver'"),'resolver invoked');
assert(service.includes('expectedRevision: input.snapshot.revision'),'revision bound');
assert(service.includes('getProductionV1Snapshot(input.matchId)'),'post-action authority refresh');
assert(screen.includes("{type:'match.ready'}"),'ready action');
assert(screen.includes("{type:'card.place'"),'lane action');
assert(screen.includes("{type:'match.forfeit'}"),'forfeit action');
assert(screen.includes('setInterval(()=>void refresh(),1500)'),'authoritative polling');
assert(screen.includes("useAuthStore(s=>s.user?.id)"),'player snapshot isolation');
assert(lobby.includes("navigate('ProductionLiveGame'"),'lobby enters match');
assert(!/service[_-]?role/i.test(screen+service+lobby),'no privileged key in phone UI');
console.log('production-v1 phone synchronization self-tests passed.');