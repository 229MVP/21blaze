
import React from 'react';
import { ActivityIndicator, Pressable, Text, StyleSheet, View, type ReactNode } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii, spacing, typography } from '../../theme';
type Variant='primary'|'secondary'|'danger'|'ghost'|'disabled';
type Props={label:string;onPress:()=>void;icon?:ReactNode;loading?:boolean;disabled?:boolean;fullWidth?:boolean;size?:'sm'|'md'|'lg';variant?:Variant;accessibilityLabel?:string};
export function BlazeButton({label,onPress,icon,loading=false,disabled=false,fullWidth=true,size='md',variant='primary',accessibilityLabel}:Props){
 const inactive=disabled||loading||variant==='disabled'; const grad=variant==='danger'?[colors.fire.red,colors.fire.ember]:[colors.fire.gold,colors.fire.orange];
 const content=<View style={styles.content}>{loading?<ActivityIndicator color={variant==='primary'?colors.text.inverse:colors.text.primary}/>:icon}<Text style={[styles.label,variant==='primary'?styles.dark:styles.light]}>{label}</Text></View>;
 return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel??label} accessibilityState={{disabled:inactive,busy:loading}} disabled={inactive} onPress={onPress} style={({pressed})=>[{width:fullWidth?'100%':undefined,opacity:inactive?.45:pressed?.86:1,transform:[{scale:pressed?.985:1}]}]}>
  {variant==='primary'||variant==='danger'?<LinearGradient colors={grad} style={[styles.base,styles[size]]}>{content}</LinearGradient>:<View style={[styles.base,styles[size],variant==='ghost'?styles.ghost:styles.secondary]}>{content}</View>}
 </Pressable>;
}
const styles=StyleSheet.create({base:{borderRadius:radii.md,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border.orange},sm:{minHeight:40,paddingHorizontal:spacing.md},md:{minHeight:48,paddingHorizontal:spacing.lg},lg:{minHeight:56,paddingHorizontal:spacing.xl},secondary:{backgroundColor:colors.background.elevated},ghost:{backgroundColor:'transparent',borderColor:colors.border.default},content:{flexDirection:'row',gap:spacing.sm,alignItems:'center',justifyContent:'center'},label:{fontFamily:typography.families.condensed,fontWeight:'800',letterSpacing:.8,fontSize:15},dark:{color:colors.text.inverse},light:{color:colors.text.primary}});
