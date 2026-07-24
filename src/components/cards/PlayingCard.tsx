
import React, { memo } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radii, shadows } from '../../theme/uiKit';
import { CardSuit } from './CardSuit';
import { CardBack } from './CardBack';
import { cardAccessibilityLabel, suitSymbol } from './cardUtils';
import type { CardRank, CardSize, CardSuit as Suit } from './cardTypes';

type Props={ rank:CardRank; suit:Suit; size?:CardSize; faceDown?:boolean; disabled?:boolean; selected?:boolean; highlighted?:boolean; accessibilityLabel?:string };
const dims:Record<CardSize,{w:number;h:number;corner:number;center:number}>={ tiny:{w:32,h:46,corner:10,center:0}, small:{w:46,h:66,corner:13,center:18}, medium:{w:72,h:104,corner:18,center:32}, large:{w:108,h:154,corner:25,center:48} };
export const PlayingCard=memo(function PlayingCard({rank,suit,size='medium',faceDown=false,disabled=false,selected=false,highlighted=false,accessibilityLabel}:Props){
 const d=dims[size]; if(faceDown) return <CardBack width={d.w} height={d.h}/>;
 const red=suit==='hearts'||suit==='diamonds'; const color=red?colors.suits.red:colors.suits.black;
 const dynamic:ViewStyle={width:d.w,height:d.h,opacity:disabled?.45:1,borderColor:selected||highlighted?colors.border.active:'#B6B1A8'};
 return <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel??cardAccessibilityLabel(rank,suit)} style={[styles.card,dynamic,(selected||highlighted)&&shadows.glow]}>
   <View style={styles.corner}><Text style={[styles.rank,{fontSize:d.corner,color}]}>{rank}</Text><Text style={{fontSize:d.corner-1,color,lineHeight:d.corner}}>{suitSymbol[suit]}</Text></View>
   {d.center>0&&<CardSuit suit={suit} size={d.center}/>} 
   <View style={[styles.corner,styles.bottom]}><Text style={[styles.rank,{fontSize:d.corner,color}]}>{rank}</Text><Text style={{fontSize:d.corner-1,color,lineHeight:d.corner}}>{suitSymbol[suit]}</Text></View>
 </View>;
});
const styles=StyleSheet.create({card:{backgroundColor:'#F7F3EA',borderWidth:1.2,borderRadius:radii.sm,alignItems:'center',justifyContent:'center',overflow:'hidden',...shadows.panel},corner:{position:'absolute',top:4,left:5,alignItems:'center'},bottom:{top:undefined,left:undefined,bottom:4,right:5,transform:[{rotate:'180deg'}]},rank:{fontWeight:'900',lineHeight:22}});
