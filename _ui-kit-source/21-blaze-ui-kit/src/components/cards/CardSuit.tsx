
import React from 'react';
import { Text, type TextStyle } from 'react-native';
import { colors } from '../../theme';
import type { CardSuit as Suit } from './cardTypes';
import { suitSymbol } from './cardUtils';
export function CardSuit({ suit, size=20, style }: { suit: Suit; size?: number; style?: TextStyle }) {
  const color = suit === 'hearts' || suit === 'diamonds' ? colors.suits.red : colors.suits.black;
  return <Text style={[{ color, fontSize: size, lineHeight: size * 1.05, fontWeight: '900' }, style]}>{suitSymbol[suit]}</Text>;
}
