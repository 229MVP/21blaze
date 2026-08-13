import { readFileSync } from 'node:fs';
const card=readFileSync('src/components/cards/PlayingCard.tsx','utf8');
const practice=readFileSync('src/productionGame/ProductionPracticeScreen.tsx','utf8');
const live=readFileSync('src/productionGame/ProductionLiveGameScreen.tsx','utf8');
function assert(v:unknown,m:string):asserts v{if(!v)throw new Error(`production-v1 visual regression: ${m}`);}
assert(card.includes("backgroundColor: isMidnight ? '#141414' : '#F7F3EA'"),'classic card has opaque cream surface');
assert(practice.includes('width={25} height={38}'),'practice lane cards are compact');
assert(practice.includes("overflow:'hidden'"),'practice lanes contain cards');
assert(live.includes('candidate.lanes.length!==4'),'live snapshot validates four lanes');
assert(live.includes('!isCard(candidate.currentCard)'),'live snapshot validates current card');
assert(live.includes('SYNCING MATCH'),'incomplete snapshot has recoverable UI');
assert(live.includes('width={25} height={38}'),'live lane cards are compact');
console.log('production-v1 visual regression self-tests passed.');