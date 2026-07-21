import { StyleSheet, Text, View } from 'react-native';

import { SUIT_SYMBOLS } from '../../game/constants';
import type { Card } from '../../game/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type PlayingCardProps = {
  card: Card;
  compact?: boolean;
};

function isRedSuit(suit: Card['suit']): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function PlayingCard({ card, compact = false }: PlayingCardProps) {
  const suitColor = isRedSuit(card.suit) ? colors.danger : colors.textPrimary;
  const suitSymbol = SUIT_SYMBOLS[card.suit];

  return (
    <View
      style={[styles.card, compact && styles.compactCard]}
      accessibilityLabel={`${card.rank} of ${card.suit}`}
    >
      <Text style={[styles.corner, { color: suitColor }]}>
        {card.rank}
        {suitSymbol}
      </Text>
      <Text style={[styles.centerSuit, compact && styles.compactCenter, { color: suitColor }]}>
        {suitSymbol}
      </Text>
      <Text style={[styles.corner, styles.cornerBottom, { color: suitColor }]}>
        {card.rank}
        {suitSymbol}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 92,
    height: 128,
    borderRadius: 10,
    backgroundColor: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    justifyContent: 'space-between',
  },
  compactCard: {
    width: 44,
    height: 62,
    borderRadius: 6,
    padding: spacing.xs,
  },
  corner: {
    fontSize: 14,
    fontWeight: '700',
  },
  cornerBottom: {
    alignSelf: 'flex-end',
    transform: [{ rotate: '180deg' }],
  },
  centerSuit: {
    fontSize: 34,
    textAlign: 'center',
    fontWeight: '700',
  },
  compactCenter: {
    fontSize: 16,
  },
});
