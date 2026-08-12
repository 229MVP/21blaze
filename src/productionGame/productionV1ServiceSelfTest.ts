import { readFileSync } from 'node:fs';
const source=readFileSync('src/productionGame/productionV1Service.ts','utf8');
function assert(v:unknown,m:string):asserts v{if(!v)throw new Error(`production-v1 service: ${m}`);}
assert(source.includes("rulesVersion: 'production-v1'"),'rules-version boundary');
assert(source.includes('p_expected_revision'),'expected revision sent');
assert(source.includes('p_client_action_id'),'idempotency key sent');
assert(source.includes('REVISION_ALREADY_QUEUED'),'revision conflict mapped');
assert(source.includes('Never replay an intent automatically'),'no unsafe automatic replay');
assert(source.includes("type: 'card.place'"),'typed card intent');
assert(source.includes("type: 'power.activate'"),'typed power intent');
assert(source.includes('createProductionV1PrivateMatch'),'private match creation bridge');
assert(source.includes('acceptProductionV1PrivateMatch'),'private match acceptance bridge');
assert(source.includes('PRODUCTION_V1_DISABLED'),'creation kill switch mapped');
assert(!/service[_-]?role/i.test(source),'no service role in client');
console.log('production-v1 client service self-tests passed.');
