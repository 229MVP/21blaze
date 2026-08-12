export type ProductionRank = 'A'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K';
export type ProductionSuit = 'hearts'|'diamonds'|'clubs'|'spades';
export type ProductionCard = { id:string; rank:ProductionRank; suit:ProductionSuit; cycle:number; index:number };
export type ProductionLane = { cards:ProductionCard[]; total:number; status:'open'|'full'|'blazed'|'bust' };
export type ProductionState = {
  seed:string; rulesVersion:'production-v1'; cycle:number; deck:ProductionCard[]; cursor:number;
  lanes:[ProductionLane,ProductionLane,ProductionLane,ProductionLane];
  bonusScore:number; energy:number; streak:number; multiplier:1|2|3|4;
};

export const PRODUCTION_RULES = Object.freeze({
  matchSeconds:90, placementSeconds:8, reconnectSeconds:20,
  laneCount:4, laneCapacity:5, maxEnergy:100,
});

const suits:ProductionSuit[]=['hearts','diamonds','clubs','spades'];
const ranks:ProductionRank[]=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function hash(text:string):number {
  let h=2166136261;
  for(let i=0;i<text.length;i+=1){ h^=text.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0;
}
function random(seed:string):()=>number {
  let value=hash(seed);
  return ()=>{ value+=0x6d2b79f5; let t=value; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}
export function createProductionDeck(seed:string,cycle=0):ProductionCard[]{
  const deck=suits.flatMap(suit=>ranks.map(rank=>({id:`${cycle}:${suit}:${rank}`,rank,suit,cycle,index:0})));
  const rng=random(`${seed}:${cycle}`);
  for(let i=deck.length-1;i>0;i-=1){ const j=Math.floor(rng()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
  return deck.map((card,index)=>({...card,index}));
}
export function productionTotal(cards:readonly ProductionCard[]):number{
  let total=0,aces=0;
  for(const card of cards){
    if(card.rank==='A'){total+=11;aces+=1;}
    else if(card.rank==='J'||card.rank==='Q'||card.rank==='K') total+=10;
    else total+=Number(card.rank);
  }
  while(total>21&&aces>0){total-=10;aces-=1;}
  return total;
}
function lane(cards:ProductionCard[]):ProductionLane{
  const total=productionTotal(cards);
  return {cards,total,status:total>21?'bust':total===21?'blazed':cards.length===5?'full':'open'};
}
export function createProductionState(seed:string):ProductionState{
  if(!seed.trim()) throw new Error('SEED_REQUIRED');
  const empty=()=>lane([]);
  return {seed,rulesVersion:'production-v1',cycle:0,deck:createProductionDeck(seed),cursor:0,
    lanes:[empty(),empty(),empty(),empty()],bonusScore:0,energy:0,streak:0,multiplier:1};
}
export function currentProductionCard(state:ProductionState):ProductionCard{return state.deck[state.cursor];}
function streakMultiplier(streak:number):1|2|3|4{return streak>=10?4:streak>=6?3:streak>=3?2:1;}
export function placeProductionCard(state:ProductionState,laneIndex:0|1|2|3):ProductionState{
  const before=state.lanes[laneIndex];
  if(before.cards.length>=5) throw new Error('LANE_FULL');
  const after=lane([...before.cards,currentProductionCard(state)]);
  const streak=after.status==='bust'?0:state.streak+1;
  const multiplier=streakMultiplier(streak);
  let rawBonus=0,energy=3;
  if(after.total===21){rawBonus+=150;energy+=20;if(after.cards.length===5){rawBonus+=100;energy+=15;}}
  else if(after.cards.length===5&&after.total>=16&&after.total<=20){rawBonus+=50;energy+=8;}
  const lanes=[...state.lanes] as ProductionState['lanes']; lanes[laneIndex]=after;
  const exhausted=state.cursor+1>=state.deck.length;
  const cycle=exhausted?state.cycle+1:state.cycle;
  return {...state,lanes,streak,multiplier,bonusScore:state.bonusScore+rawBonus*multiplier,
    energy:Math.min(100,state.energy+energy),cycle,deck:exhausted?createProductionDeck(state.seed,cycle):state.deck,cursor:exhausted?0:state.cursor+1};
}
export function autoRouteProductionCard(state:ProductionState):ProductionState{
  const card=currentProductionCard(state);
  const legal=state.lanes.map((item,index)=>({item,index:index as 0|1|2|3})).filter(x=>x.item.cards.length<5);
  if(!legal.length) throw new Error('BOARD_FULL');
  legal.sort((a,b)=>{const at=productionTotal([...a.item.cards,card]),bt=productionTotal([...b.item.cards,card]);
    const av=at>21?-at:at,bv=bt>21?-bt:bt;return bv-av||a.index-b.index;});
  return placeProductionCard(state,legal[0].index);
}
export function finalProductionScore(state:ProductionState,remainingMs:number):number{
  const base=state.lanes.reduce((sum,item)=>sum+(item.total<=21?item.total*10:0),0);
  const clean=state.lanes.every(item=>item.cards.length===5&&item.status!=='bust');
  return base+state.bonusScore+(clean?200*state.multiplier:0)+Math.max(0,Math.floor(remainingMs/1000))*2;
}

