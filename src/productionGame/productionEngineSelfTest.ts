import {autoRouteProductionCard,createProductionDeck,createProductionState,finalProductionScore,placeProductionCard,productionTotal,PRODUCTION_RULES,type ProductionCard} from './productionEngine';
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(`production-v1: ${message}`);}
function c(rank:ProductionCard['rank'],index:number):ProductionCard{return{id:`t${index}`,rank,suit:'spades',cycle:0,index};}
assert(PRODUCTION_RULES.matchSeconds===90,'90-second match');
assert(PRODUCTION_RULES.placementSeconds===8,'8-second placement');
assert(JSON.stringify(createProductionDeck('same'))===JSON.stringify(createProductionDeck('same')),'deterministic deck');
assert(new Set(createProductionDeck('unique').map(card=>card.id)).size===52,'52 unique cards');
assert(productionTotal([c('A',0),c('K',1)])===21,'soft Ace at eleven');
assert(productionTotal([c('A',0),c('K',1),c('5',2)])===16,'soft Ace falls to one');
let state=createProductionState('capacity'); for(let i=0;i<5;i+=1)state=placeProductionCard(state,0);
let rejected=false;try{placeProductionCard(state,0);}catch(error){rejected=error instanceof Error&&error.message==='LANE_FULL';}
assert(rejected,'sixth card rejected');
const routed=autoRouteProductionCard(createProductionState('route'));
assert(routed.cursor===1,'Auto-Route consumes exactly one card');
assert(finalProductionScore(routed,10_000)>=20,'score includes lane and time');
console.log('production-v1 deterministic engine self-tests passed.');
