
import React from 'react'; import { View,StyleSheet } from 'react-native'; import { spacing } from '../../theme'; import { LaneBox } from './LaneBox'; import type { CardModel } from '../cards';
export type LaneData={laneNumber:number;total:number;cards:CardModel[]};
export function LanesGrid({lanes,onSelect,disabled=false}:{lanes:LaneData[];onSelect?:(lane:number)=>void;disabled?:boolean}){return <View style={styles.grid}>{lanes.map(l=><View key={l.laneNumber} style={styles.cell}><LaneBox {...l} disabled={disabled} onPress={()=>onSelect?.(l.laneNumber)}/></View>)}</View>}
const styles=StyleSheet.create({grid:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},cell:{width:'48.5%',flexGrow:1}});
