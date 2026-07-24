
import React from 'react'; import { FlatList,Text,View,StyleSheet } from 'react-native'; import { BlazePanel } from '../ui/BlazePanel'; import { LeaderboardRow } from './LeaderboardRow'; import { colors,spacing } from '../../theme';
export type LeaderboardEntry={rank:number;playerName:string;score:number;isCurrentPlayer?:boolean;badge?:string};
export function LeaderboardTable({entries,loading=false,emptyText='NO SCORES YET'}:{entries:LeaderboardEntry[];loading?:boolean;emptyText?:string}){return <BlazePanel padding={0} style={styles.panel}>{loading?<Text style={styles.empty}>Loading…</Text>:entries.length===0?<Text style={styles.empty}>{emptyText}</Text>:<FlatList data={entries} keyExtractor={i=>`${i.rank}-${i.playerName}`} renderItem={({item})=><LeaderboardRow {...item}/>}/>}</BlazePanel>}
const styles=StyleSheet.create({panel:{overflow:'hidden'},empty:{color:colors.text.secondary,padding:spacing.xl,textAlign:'center'}});
