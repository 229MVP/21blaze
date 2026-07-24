
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii } from '../../theme/uiKit';
export function CardBack({ width=72, height=104 }: { width?: number; height?: number }) {
  return <LinearGradient colors={[colors.fire.ember, colors.background.panel, colors.fire.orange]} style={[styles.card,{width,height}]}>
    <View style={styles.inner}><View style={styles.diamond}/><View style={[styles.diamond,{transform:[{rotate:'45deg'},{scale:.55}]}]}/></View>
  </LinearGradient>;
}
const styles=StyleSheet.create({card:{borderRadius:radii.md,padding:5,borderWidth:1,borderColor:colors.fire.gold},inner:{flex:1,borderWidth:1,borderColor:'rgba(255,255,255,.25)',borderRadius:radii.sm,alignItems:'center',justifyContent:'center'},diamond:{width:24,height:24,backgroundColor:colors.fire.orange,transform:[{rotate:'45deg'}],position:'absolute'}});
