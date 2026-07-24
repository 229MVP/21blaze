
import React from 'react'; import { View,StyleSheet } from 'react-native'; import { useSafeAreaInsets } from 'react-native-safe-area-context'; import { BlazeButton } from '../ui/BlazeButton'; import { colors,spacing } from '../../theme';
type Action={label:string;onPress:()=>void;variant?:'primary'|'secondary'|'danger'|'ghost'};
export function BottomActionBar({primaryAction,secondaryAction,safeAreaEnabled=true,sticky=false}:{primaryAction:Action;secondaryAction?:Action;safeAreaEnabled?:boolean;sticky?:boolean}){const i=useSafeAreaInsets();return <View style={[styles.bar,sticky&&styles.sticky,{paddingBottom:safeAreaEnabled?Math.max(i.bottom,spacing.md):spacing.md}]}>{secondaryAction&&<BlazeButton {...secondaryAction}/>}<BlazeButton {...primaryAction}/></View>}
const styles=StyleSheet.create({bar:{gap:spacing.sm,padding:spacing.md,backgroundColor:colors.background.primary},sticky:{position:'absolute',left:0,right:0,bottom:0}});
