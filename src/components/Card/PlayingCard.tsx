import { StyleSheet, Text, View } from 'react-native';

import { SUIT_SYMBOLS } from '../../game/constants';
import type { Card, Rank, Suit } from '../../game/types';
import { colors } from '../../theme/colors';

export type PlayingCardSize = 'small' | 'medium' | 'large';

type PlayingCardProps = {
  card: Card;
  size?: PlayingCardSize;
  /** @deprecated Prefer size="small". Kept for existing call sites. */
  compact?: boolean;
};

type SizeConfig = {
  width: number;
  height: number;
  rankFontSize: number;
  centerSuitFontSize: number;
  padding: number;
  borderRadius: number;
};

const SIZE_CONFIG: Record<PlayingCardSize, SizeConfig> = {
  small: {
    width: 58,
    height: 82,
    rankFontSize: 16,
    centerSuitFontSize: 24,
    padding: 4,
    borderRadius: 6,
  },
  medium: {
    width: 90,
    height: 126,
    rankFontSize: 22,
    centerSuitFontSize: 34,
    padding: 6,
    borderRadius: 8,
  },
  large: {
    width: 124,
    height: 172,
    rankFontSize: 28,
    centerSuitFontSize: 48,
    padding: 8,
    borderRadius: 10,
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

function getSuitColor(suit: Suit): string {
  if (suit === 'hearts' || suit === 'diamonds') {
    return colors.danger;
  }

  return colors.cardInk;
}

function resolveCardDisplay(card: Card): {
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
      suitColor: colors.cardInk,
      accessibilityLabel: 'Invalid card',
    };
  }

  return {
    rankLabel: card.rank,
    suitSymbol: SUIT_SYMBOLS[card.suit],
    suitColor: getSuitColor(card.suit),
    accessibilityLabel: `${card.rank} of ${card.suit}`,
  };
}

export function PlayingCard({
  card,
  size,
  compact = false,
}: PlayingCardProps) {
  const resolvedSize: PlayingCardSize = size ?? (compact ? 'small' : 'medium');
  const config = SIZE_CONFIG[resolvedSize];
  const { rankLabel, suitSymbol, suitColor, accessibilityLabel } =
    resolveCardDisplay(card);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        {
          width: config.width,
          height: config.height,
          borderRadius: config.borderRadius,
          padding: config.padding,
        },
      ]}
    >
      <Text
        style={[
          styles.corner,
          styles.cornerTop,
          {
            color: suitColor,
            fontSize: config.rankFontSize,
            lineHeight: config.rankFontSize + 2,
          },
        ]}
      >
        {rankLabel}
        {'\n'}
        {suitSymbol}
      </Text>

      <View style={styles.center}>
        <Text
          style={{
            color: suitColor,
            fontSize: config.centerSuitFontSize,
            lineHeight: config.centerSuitFontSize + 4,
            fontWeight: '700',
            textAlign: 'center',
          }}
        >
          {suitSymbol}
        </Text>
      </View>

      <Text
        style={[
          styles.corner,
          styles.cornerBottom,
          {
            color: suitColor,
            fontSize: config.rankFontSize,
            lineHeight: config.rankFontSize + 2,
          },
        ]}
      >
        {rankLabel}
        {'\n'}
        {suitSymbol}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: colors.cardFace,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    zIndex: 2,
    fontWeight: '700',
    textAlign: 'left',
  },
  cornerTop: {
    top: 4,
    left: 4,
  },
  cornerBottom: {
    right: 4,
    bottom: 4,
    textAlign: 'left',
    transform: [{ rotate: '180deg' }],
  },
});
