import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { PlayingCard } from '../components/cards/PlayingCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import type { ProductionPracticeScreenProps } from '../navigation/navigationTypes';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';
import { autoRouteProductionCard, createProductionState, currentProductionCard, finalProductionScore, placeProductionCard, PRODUCTION_RULES, type ProductionState } from './productionEngine';

function newSeed(): string { return `practice:${Date.now()}`; }

export function ProductionPracticeScreen({ navigation }: ProductionPracticeScreenProps) {
  const [game, setGame] = useState<ProductionState>(() => createProductionState(newSeed()));
  const [matchMs, setMatchMs] = useState(PRODUCTION_RULES.matchSeconds * 1000);
  const [placementMs, setPlacementMs] = useState(PRODUCTION_RULES.placementSeconds * 1000);
  const [finished, setFinished] = useState(false);
  const gameRef = useRef(game); gameRef.current = game;
  const score = useMemo(() => finalProductionScore(game, matchMs), [game, matchMs]);

  useEffect(() => {
    if (finished) return;
    const timer = setInterval(() => {
      setMatchMs(value => {
        const next = Math.max(0, value - 100);
        if (next === 0) setFinished(true);
        return next;
      });
      setPlacementMs(value => {
        const next = Math.max(0, value - 100);
        if (next === 0) {
          try { setGame(current => autoRouteProductionCard(current)); } catch { setFinished(true); }
          return PRODUCTION_RULES.placementSeconds * 1000;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [finished]);

  const reset = () => { setGame(createProductionState(newSeed())); setMatchMs(90_000); setPlacementMs(8_000); setFinished(false); };
  const chooseLane = (index: 0|1|2|3) => {
    if (finished) return;
    try { setGame(current => placeProductionCard(current, index)); setPlacementMs(8_000); }
    catch (error) { if (error instanceof Error && error.message !== 'LANE_FULL') setFinished(true); }
  };
  const card = currentProductionCard(game);

  return <ScreenContainer style={styles.container} intensity="normal" padded={false}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <ScreenHeader title="PRODUCTION PRACTICE" />
      <View style={styles.stats}>
        <Text style={styles.stat}>SCORE {score}</Text><Text style={styles.stat}>TIME {Math.ceil(matchMs/1000)}</Text>
        <Text style={styles.stat}>ENERGY {game.energy}</Text><Text style={styles.stat}>CARD {Math.ceil(placementMs/1000)}</Text>
      </View>
      <Text style={styles.kicker}>PRODUCTION-V1 · CHOOSE A LANE</Text>
      <View style={styles.current}><PlayingCard rank={card.rank} suit={card.suit} size="medium" /></View>
      <View style={styles.board}>{game.lanes.map((lane,index)=><Pressable key={index} accessibilityRole="button" accessibilityLabel={`Lane ${index+1}, total ${lane.total}, ${lane.cards.length} cards`} onPress={()=>chooseLane(index as 0|1|2|3)} style={({pressed})=>[styles.lane,pressed&&styles.pressed]}>
        <View style={styles.laneHeader}><Text style={styles.laneTitle}>LANE {index+1}</Text><Text style={styles.total}>{lane.total}</Text></View>
        <View style={styles.cards}>{lane.cards.map(item=><PlayingCard key={item.id} rank={item.rank} suit={item.suit} size="tiny" width={25} height={38} />)}{Array.from({length:5-lane.cards.length},(_,slot)=><View key={`e${slot}`} style={styles.empty}/>)}</View>
        <Text style={[styles.status,lane.status==='bust'&&styles.bust]}>{lane.status.toUpperCase()}</Text>
      </Pressable>)}</View>
      {finished?<Text style={styles.finished}>FINAL SCORE {score}</Text>:null}
      <BlazeButton title="RESTART" onPress={reset} fullWidth />
      <BlazeButton title="HOME" variant="secondary" onPress={()=>navigation.navigate('Home')} fullWidth />
    </ScrollView>
  </ScreenContainer>;
}

const styles=StyleSheet.create({container:{flex:1},scroll:{padding:spacing.md,gap:spacing.md,paddingBottom:48,maxWidth:520,width:'100%',alignSelf:'center'},stats:{flexDirection:'row',flexWrap:'wrap',gap:8},stat:{fontFamily:fontFamilies.bodyBold,color:colors.primary,borderWidth:1,borderColor:colors.border,padding:8,borderRadius:8,minWidth:'46%',textAlign:'center'},kicker:{...typography.body,color:colors.textSecondary,textAlign:'center'},current:{alignItems:'center'},board:{flexDirection:'row',flexWrap:'wrap',gap:10},lane:{width:'48%',minHeight:142,borderWidth:1,borderColor:colors.gold,borderRadius:12,padding:8,backgroundColor:colors.backgroundCard},pressed:{opacity:.75},laneHeader:{flexDirection:'row',justifyContent:'space-between'},laneTitle:{fontFamily:fontFamilies.bodyBold,color:colors.textPrimary},total:{fontFamily:fontFamilies.display,color:colors.primary,fontSize:22},cards:{flexDirection:'row',gap:2,marginTop:8,alignItems:'center',overflow:'hidden'},empty:{width:25,height:38,borderWidth:1,borderColor:colors.border,borderRadius:5},status:{fontFamily:fontFamilies.bodyBold,color:colors.textMuted,marginTop:8,fontSize:11},bust:{color:'#FF6B5E'},finished:{fontFamily:fontFamilies.display,color:colors.primary,fontSize:32,textAlign:'center'}});
