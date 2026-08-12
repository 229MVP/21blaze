import { createProductionState, placeProductionCard } from './productionEngine';
import { createState, place } from '../../supabase/functions/_shared/productionV1Engine';
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(`production-v1 parity: ${message}`);}
for(const seed of ['parity-a','parity-b','21blaze-production-v1:test']){
  let client=createProductionState(seed); let server=createState(seed);
  assert(JSON.stringify(client.deck)===JSON.stringify(server.deck),`${seed} deck`);
  for(const lane of [0,1,2,3,0,2,1,3,0,1] as const){
    client=placeProductionCard(client,lane); server=place(server,lane,seed);
    const {seed:_seed,...clientComparable}=client;
    assert(JSON.stringify(clientComparable)===JSON.stringify(server),`${seed} lane ${lane}`);
  }
}
console.log('production-v1 server parity self-tests passed.');