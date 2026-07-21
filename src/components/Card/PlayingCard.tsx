import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { SUIT_SYMBOLS } from '../../game/constants';
import type { Card, Rank, Suit } from '../../game/types';
import type { CardStyle } from '../../settings/types';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';

export type PlayingCardSize = 'small' | 'medium' | 'large';

type PlayingCardProps = {
  card: Card;
  size?: PlayingCardSize;
  glowing?: boolean;
  cardStyle?: CardStyle;
  /** @deprecated Prefer size="small". Kept for existing call sites. */
  compact?: boolean;
};

type SizeConfig = {
  width: number;
  height: number;
  rankFontSize: number;
  suitFontSize: number;
  centerSuitFontSize: number;
  padding: number;
  borderRadius: number;
};

type StylePalette = {
  face: [string, string];
  border: string;
  redSuit: string;
  blackSuit: string;
  glow: boolean;
};

const SIZE_CONFIG: Record<PlayingCardSize, SizeConfig> = {
  small: {
    width: 36,
    height: 50,
    rankFontSize: 10,
    suitFontSize: 9,
    centerSuitFontSize: 18,
    padding: 3,
    borderRadius: 4,
  },
  medium: {
    width: 72,
    height: 100,
    rankFontSize: 16,
    suitFontSize: 14,
    centerSuitFontSize: 34,
    padding: 5,
    borderRadius: 6,
  },
  large: {
    width: 100,
    height: 140,
    rankFontSize: 22,
    suitFontSize: 18,
    centerSuitFontSize: 48,
    padding: 7,
    borderRadius: 8,
  },
};

const STYLE_PALETTE: Record<CardStyle, StylePalette> = {
  classic: {
    face: [colors.cardFace, colors.cardFaceAlt],
    border: colors.cardBorder,
    redSuit: colors.cardInkRed,
    blackSuit: colors.cardInk,
    glow: false,
  },
  blaze: {
    face: ['#FFF8F0', '#FFE8D4'],
    border: colors.primary,
    redSuit: colors.cardInkRed,
    blackSuit: colors.cardInk,
    glow: true,
  },
  midnight: {
    face: ['#1A1A1A', '#121212'],
    border: 'rgba(255,255,255,0.28)',
    redSuit: '#FF5A5A',
    blackSuit: '#E8E8E8',
    glow: false,
  },
};

const VALID_SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALID_RANKS: readonly Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

function getSuitColor(suit: Suit, palette: StylePalette): string {
  if (suit === 'hearts' || suit === 'diamonds') {
    return palette.redSuit;
  }

  return palette.blackSuit;
}

function resolveCardDisplay(
  card: Card,
  palette: StylePalette,
): {
  rankLabel: string;
  suitSymbol: string;
  suitColor: string;
  accessibilityLabel: string;
} {
  const hasValidSuit = VALID_SUITS.includes(card.suit);
  const hasValidRank = VALID_RANKS.includes(card.rank);

  if (!hasValidSuit || !hasValidRank) {
    return {
      rankLabel: '?',
      suitSymbol: '?',
      suitColor: palette.blackSuit,
      accessibilityLabel: 'Invalid card',
    };
  }

  return {
    rankLabel: card.rank,
    suitSymbol: SUIT_SYMBOLS[card.suit],
    suitColor: getSuitColor(card.suit, palette),
    accessibilityLabel: `${card.rank} of ${card.suit}`,
  };
}

export function PlayingCard({
  card,
  size,
  glowing = false,
  cardStyle = 'classic',
  compact = false,
}: PlayingCardProps) {
  const resolvedSize: PlayingCardSize = size ?? (compact ? 'small' : 'medium');
  const config = SIZE_CONFIG[resolvedSize];
  const palette = STYLE_PALETTE[cardStyle];
  const { rankLabel, suitSymbol, suitColor, accessibilityLabel } =
    resolveCardDisplay(card, palette);
  const showGlow = glowing || (cardStyle === 'blaze' && glowing);

  return (
    <View
      accessibilityLabel={`${accessibilityLabel}, ${cardStyle} style`}
      style={[
        styles.shell,
        {
          width: config.width,
          height: config.height,
          borderRadius: config.borderRadius,
          borderColor: palette.border,
        },
        showGlow || (glowing && palette.glow) ? shadows.cardGlow : shadows.card,
        glowing && styles.activeGlow,
      ]}
    >
      <LinearGradient
        colors={palette.face}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.card,
          {
            borderRadius: config.borderRadius,
            padding: config.padding,
          },
        ]}
      >
        <View style={[styles.corner, styles.cornerTop]}>
          <Text
            style={[
              styles.rank,
              {
                color: suitColor,
                fontSize: config.rankFontSize,
                lineHeight: config.rankFontSize + 1,
              },
            ]}
          >
            {rankLabel}
          </Text>
          <Text
            style={{
              color: suitColor,
              fontSize: config.suitFontSize,
              lineHeight: config.suitFontSize + 1,
            }}
          >
            {suitSymbol}
          </Text>
        </View>

        <View style={styles.center}>
          <Text
            style={{
              color: suitColor,
              fontSize: config.centerSuitFontSize,
              lineHeight: config.centerSuitFontSize + 2,
              textAlign: 'center',
            }}
          >
            {suitSymbol}
          </Text>
        </View>

        <View style={[styles.corner, styles.cornerBottom]}>
          <Text
            style={[
              styles.rank,
              {
                color: suitColor,
                fontSize: config.rankFontSize,
                lineHeight: config.rankFontSize + 1,
              },
            ]}
          >
            {rankLabel}
          </Text>
          <Text
            style={{
              color: suitColor,
              fontSize: config.suitFontSize,
              lineHeight: config.suitFontSize + 1,
            }}
          >
            {suitSymbol}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: colors.cardFace,
  },
  activeGlow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.65,
    shadowRadius: 14,
  },
  card: {
    flex: 1,
    position: 'relative',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    zIndex: 2,
    alignItems: 'center',
  },
  cornerTop: {
    top: 2,
    left: 3,
  },
  cornerBottom: {
    right: 3,
    bottom: 2,
    transform: [{ rotate: '180deg' }],
  },
  rank: {
    fontFamily: fontFamilies.bodyBold,
    fontWeight: '700',
    textAlign: 'center',
  },
});
