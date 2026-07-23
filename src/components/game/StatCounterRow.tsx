
import React from 'react'; import { View,StyleSheet } from 'react-native'; import { spacing } from '../../theme'; import { StatCounter } from './StatCounter';
export type StatItem={label:string;value:string|number;accent?:boolean;danger?:boolean};
export function StatCounterRow({items}:{items:StatItem[]}){return <View style={styles.row}>{items.map(i=><StatCounter key={i.label}{...i} compact/>)}</View>}
const styles=StyleSheet.create({row:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm}});
