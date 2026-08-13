import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { PlayingCard } from '../components/cards/PlayingCard';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { ProductionLiveGameScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';
import { getProductionV1Snapshot, ProductionV1ServiceError, syncProductionV1Match, submitProductionV1Intent, type ProductionV1Snapshot } from './productionV1Service';

type Card={id:string;rank:'A'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K';suit:'hearts'|'diamonds'|'clubs'|'spades'};
type Lane={cards:Card[];total:number;status:string};
type Player={lanes:Lane[];bonusScore:number;energy:number;streak:number;multiplier:number;currentCard:Card};
const ranks=new Set(['A','2','3','4','5','6','7','8','9','10','J','Q','K']);
const suits=new Set(['hearts','diamonds','clubs','spades']);
const isCard=(value:unknown):value is Card=>{if(!value||typeof value!=='object'||Array.isArray(value))return false;const card=value as Partial<Card>;return typeof card.id==='string'&&typeof card.rank==='string'&&ranks.has(card.rank)&&typeof card.suit==='string'&&suits.has(card.suit);};
const isLane=(value:unknown):value is Lane=>{if(!value||typeof value!=='object'||Array.isArray(value))return false;const lane=value as Partial<Lane>;return Array.isArray(lane.cards)&&lane.cards.every(isCard)&&typeof lane.total==='number'&&typeof lane.status==='string';};
const asPlayer=(snapshot:ProductionV1Snapshot,userId:string|undefined):Player|null=>{
  if(!userId)return null; const players=snapshot.state.players;
  if(!players||typeof players!=='object'||Array.isArray(players))return null;
  const player=(players as Record<string,unknown>)[userId];
  if(!player||typeof player!=='object'||Array.isArray(player))return null;
  const candidate=player as Partial<Player>;
  if(!Array.isArray(candidate.lanes)||candidate.lanes.length!==4||!candidate.lanes.every(isLane)||!isCard(candidate.currentCard))return null;
  if(typeof candidate.energy!=='number'||typeof candidate.streak!=='number'||typeof candidate.multiplier!=='number'||typeof candidate.bonusScore!=='number')return null;
  return candidate as Player;
};
const errorMessage=(error:unknown)=>error instanceof ProductionV1ServiceError&&['STALE_REVISION','REVISION_ALREADY_QUEUED'].includes(error.code)
  ?'The other phone updated the match. Refreshed—tap again.':'Could not update the match. Check your connection.';

export function ProductionLiveGameScreen({navigation,route}:ProductionLiveGameScreenProps){
  const {matchId}=route.params; const userId=useAuthStore(s=>s.user?.id);
  const [snapshot,setSnapshot]=useState<ProductionV1Snapshot|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null); const [now,setNow]=useState(Date.now());
  const refresh=useCallback(async()=>{try{await syncProductionV1Match(matchId);setSnapshot(await getProductionV1Snapshot(matchId));setError(null);}catch(reason){setError(errorMessage(reason));}},[matchId]);
  useEffect(()=>{void refresh();const poll=setInterval(()=>void refresh(),1500);const clock=setInterval(()=>setNow(Date.now()),250);return()=>{clearInterval(poll);clearInterval(clock);};},[refresh]);
  const send=async(intent:{type:'match.ready'}|{type:'card.place';laneIndex:0|1|2|3}|{type:'match.forfeit'})=>{if(!snapshot||busy)return;setBusy(true);setError(null);try{setSnapshot(await submitProductionV1Intent({matchId,snapshot,intent}));}catch(reason){setError(errorMessage(reason));await refresh();}finally{setBusy(false);}};
  const player=useMemo(()=>snapshot?asPlayer(snapshot,userId):null,[snapshot,userId]);
  const remaining=snapshot?.endsAt?Math.max(0,Math.ceil((Date.parse(snapshot.endsAt)-now)/1000)):90;
  const results=snapshot?.state.results as {scores?:Record<string,number>;winnerUserId?:string|null;tie?:boolean}|undefined; const myScore=userId&&results?.scores?results.scores[userId]:undefined; const opponentScore=userId&&results?.scores?Object.entries(results.scores).find(([id])=>id!==userId)?.[1]:undefined;
  const waiting=!snapshot||snapshot.status==='waiting'; const ready=snapshot?.status==='ready_check'||snapshot?.status==='countdown';
  return <ScreenContainer style={styles.container} intensity="normal" padded={false}><ScrollView contentContainerStyle={styles.scroll}>
    <ScreenHeader title="PRODUCTION LIVE PVP" />
    <View style={styles.stats}><Text style={styles.stat}>TIME {remaining}</Text><Text style={styles.stat}>REV {snapshot?.revision??'—'}</Text><Text style={styles.stat}>ENERGY {player?.energy??0}</Text><Text style={styles.stat}>STREAK {player?.streak??0}</Text></View>
    {waiting?<><Text style={styles.title}>WAITING FOR OPPONENT</Text><Text style={styles.body}>The challenged player must accept the match code.</Text></>:null}
    {ready?<><Text style={styles.title}>READY CHECK</Text><BlazeButton title={busy?'SENDING…':'I’M READY'} onPress={()=>void send({type:'match.ready'})} loading={busy} fullWidth /></>:null}
    {snapshot?.status==='active'&&!player?<><Text style={styles.title}>SYNCING MATCH</Text><Text style={styles.body}>Waiting for a complete server snapshot. Tap Refresh if this continues.</Text></>:null}
    {snapshot?.status==='active'&&player?<>
      <Text style={styles.title}>CHOOSE A LANE</Text><View style={styles.current}><PlayingCard rank={player.currentCard.rank} suit={player.currentCard.suit} size="medium" /></View>
      <View style={styles.board}>{player.lanes.map((lane,index)=><Pressable key={index} disabled={busy||lane.cards.length>=5} onPress={()=>void send({type:'card.place',laneIndex:index as 0|1|2|3})} style={styles.lane} accessibilityRole="button">
        <View style={styles.header}><Text style={styles.laneTitle}>LANE {index+1}</Text><Text style={styles.total}>{lane.total}</Text></View>
        <View style={styles.cards}>{lane.cards.map(card=><PlayingCard key={card.id} rank={card.rank} suit={card.suit} size="tiny" width={25} height={38} />)}</View><Text style={styles.status}>{lane.status.toUpperCase()}</Text>
      </Pressable>)}</View>
      <BlazeButton title="FORFEIT" variant="danger" onPress={()=>void send({type:'match.forfeit'})} disabled={busy} fullWidth />
    </>:null}
    {snapshot&&['forfeit','completed','cancelled','abandoned','invalidated'].includes(snapshot.status)?<View style={styles.result}><Text style={styles.title}>{results?.tie?'TIE':results?.winnerUserId===userId?'YOU WIN':'MATCH ENDED'}</Text><Text style={styles.resultScore}>YOU {myScore??0} · OPPONENT {opponentScore??0}</Text></View>:null}
    {error?<Text style={styles.error}>{error}</Text>:null}
    <BlazeButton title="REFRESH" variant="secondary" onPress={()=>void refresh()} disabled={busy} fullWidth />
    <BlazeButton title="HOME" variant="secondary" onPress={()=>navigation.navigate('Home')} disabled={busy} fullWidth />
  </ScrollView></ScreenContainer>;
}
const styles=StyleSheet.create({container:{flex:1},scroll:{padding:spacing.md,gap:spacing.md,paddingBottom:48,maxWidth:520,width:'100%',alignSelf:'center'},stats:{flexDirection:'row',flexWrap:'wrap',gap:8},stat:{fontFamily:fontFamilies.bodyBold,color:colors.gold,borderWidth:1,borderColor:colors.border,padding:8,borderRadius:8,minWidth:'46%',textAlign:'center'},title:{fontFamily:fontFamilies.display,fontSize:27,color:colors.gold,textAlign:'center'},body:{...typography.body,color:colors.textSecondary,textAlign:'center'},current:{alignItems:'center'},board:{flexDirection:'row',flexWrap:'wrap',gap:10},lane:{width:'48%',minHeight:135,borderWidth:1,borderColor:colors.gold,borderRadius:12,padding:8,backgroundColor:colors.backgroundCard,overflow:'hidden'},header:{flexDirection:'row',justifyContent:'space-between'},laneTitle:{fontFamily:fontFamilies.bodyBold,color:colors.textPrimary},total:{fontFamily:fontFamilies.display,color:colors.primary,fontSize:22},cards:{flexDirection:'row',gap:2,marginTop:8,overflow:'hidden'},status:{fontFamily:fontFamilies.bodyBold,color:colors.textMuted,marginTop:8,fontSize:11},error:{...typography.body,color:'#FF8A80',textAlign:'center'},result:{gap:8,borderWidth:1,borderColor:colors.gold,borderRadius:12,padding:spacing.md},resultScore:{fontFamily:fontFamilies.display,fontSize:24,color:colors.textPrimary,textAlign:'center'}});