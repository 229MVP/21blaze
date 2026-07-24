import React, { memo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, radii, shadows } from '../../theme/uiKit';
import { CardBack } from './CardBack';
import { CardSuit } from './CardSuit';
import type { CardRank, CardSize, CardSuit as Suit } from './cardTypes';
import { cardAccessibilityLabel, suitSymbol } from './cardUtils';

type Props = {
  rank: CardRank;
  suit: Suit;
  size?: CardSize;
  faceDown?: boolean;
  disabled?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  accessibilityLabel?: string;
  /** Optional exact dimensions for responsive lane cards. */
  width?: number;
  height?: number;
};

type Dims = {
  w: number;
  h: number;
  corner: number;
  center: number;
  padTop: number;
  padLeft: number;
  bottomScale: number;
};

const SIZE_DIMS: Record<CardSize, Dims> = {
  tiny: {
    w: 36,
    h: 52,
    corner: 12,
    center: 0,
    padTop: 3,
    padLeft: 3,
    bottomScale: 0.85,
  },
  small: {
    w: 44,
    h: 64,
    corner: 14,
    center: 0,
    padTop: 3,
    padLeft: 4,
    bottomScale: 0.9,
  },
  medium: {
    w: 80,
    h: 114,
    corner: 20,
    center: 34,
    padTop: 5,
    padLeft: 6,
    bottomScale: 1,
  },
  large: {
    w: 118,
    h: 166,
    corner: 26,
    center: 50,
    padTop: 6,
    padLeft: 7,
    bottomScale: 1,
  },
};

function resolveDims(
  size: CardSize,
  width?: number,
  height?: number,
): Dims {
  const base = SIZE_DIMS[size];
  if (!width && !height) {
    return base;
  }
  const w = width ?? base.w;
  const h = height ?? base.h;
  const scale = w / base.w;
  return {
    w,
    h,
    corner: Math.max(10, Math.round(base.corner * scale)),
    center: base.center > 0 ? Math.round(base.center * scale) : 0,
    padTop: Math.max(2, Math.round(base.padTop * scale)),
    padLeft: Math.max(2, Math.round(base.padLeft * scale)),
    bottomScale: base.bottomScale,
  };
}

export const PlayingCard = memo(function PlayingCard({
  rank,
  suit,
  size = 'medium',
  faceDown = false,
  disabled = false,
  selected = false,
  highlighted = false,
  accessibilityLabel,
  width,
  height,
}: Props) {
  const d = resolveDims(size, width, height);

  if (faceDown) {
    return <CardBack width={d.w} height={d.h} />;
  }

  const red = suit === 'hearts' || suit === 'diamonds';
  const color = red ? colors.suits.red : colors.suits.black;
  const bottomCorner = Math.max(9, Math.round(d.corner * d.bottomScale));
  const dynamic: ViewStyle = {
    width: d.w,
    height: d.h,
    opacity: disabled ? 0.45 : 1,
    borderColor:
      selected || highlighted ? colors.border.active : '#B6B1A8',
  };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        accessibilityLabel ?? cardAccessibilityLabel(rank, suit)
      }
      style={[
        styles.card,
        dynamic,
        (selected || highlighted) && shadows.glow,
      ]}
    >
      <View
        style={[
          styles.corner,
          { top: d.padTop, left: d.padLeft },
        ]}
      >
        <Text
          style={[
            styles.rank,
            {
              color,
              fontSize: d.corner,
              lineHeight: d.corner + 1,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {rank}
        </Text>
        <Text
          style={{
            color,
            fontSize: d.corner - 1,
            lineHeight: d.corner,
          }}
        >
          {suitSymbol[suit]}
        </Text>
      </View>

      {d.center > 0 ? <CardSuit suit={suit} size={d.center} /> : null}

      <View
        style={[
          styles.corner,
          styles.bottom,
          {
            bottom: d.padTop,
            right: d.padLeft,
          },
        ]}
      >
        <Text
          style={[
            styles.rank,
            {
              color,
              fontSize: bottomCorner,
              lineHeight: bottomCorner + 1,
            },
          ]}
          numberOfLines={1}
        >
          {rank}
        </Text>
        <Text
          style={{
            color,
            fontSize: bottomCorner - 1,
            lineHeight: bottomCorner,
          }}
        >
          {suitSymbol[suit]}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F7F3EA',
    borderWidth: 1.2,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.panel,
  },
  corner: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 2,
  },
  bottom: {
    transform: [{ rotate: '180deg' }],
  },
  rank: {
    fontWeight: '900',
    textAlign: 'center',
  },
});
