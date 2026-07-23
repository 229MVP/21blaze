
import React, { type ReactNode } from 'react'; import { View, StyleSheet, type ViewStyle } from 'react-native'; import { colors,radii,spacing,shadows } from '../../theme';
type Variant='default'|'active'|'warning'|'danger'|'transparent';
export function BlazePanel({children,variant='default',padding=spacing.lg,radius=radii.lg,glow=false,style}:{children:ReactNode;variant?:Variant;padding?:number;radius?:number;glow?:boolean;style?:ViewStyle}){const border=variant==='danger'?colors.status.danger:variant==='active'||variant==='warning'?colors.border.active:colors.border.orange;return <View style={[styles.base,{padding,borderRadius:radius,borderColor:border,backgroundColor:variant==='transparent'?'transparent':colors.background.panel},glow&&shadows.glow,style]}>{children}</View>}
const styles=StyleSheet.create({base:{borderWidth:1}});
