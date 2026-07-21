import { Pressable, StyleSheet, Text, View } from 'react-native';

import { calculateHandTotal } from '../../game/cardValues';
import type { Lane } from '../../game/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { PlayingCard } from '../Card/PlayingCard';

type GameLaneProps = {
  lane: Lane;
  disabled?: boolean;
  onPress: () => void;
};

export function GameLane({ lane, disabled = false, onPress }: GameLaneProps) {
  const total = calculateHandTotal(lane.cards);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Lane ${lane.id}, total ${total}, ${lane.cards.length} cards`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.lane,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Lane {lane.id}</Text>
        <Text style={styles.total}>{total}</Text>
      </View>

      <View style={styles.cards}>
        {lane.cards.length === 0 ? (
          <Text style={styles.empty}>Empty</Text>
        ) : (
          lane.cards.map((card) => (
            <PlayingCard key={card.id} card={card} size="small" />
          ))
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lane: {
    flex: 1,
    minHeight: 130,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  pressed: {
    borderColor: colors.primary,
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.55,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.label,
    color: colors.textPrimary,
  },
  total: {
    ...typography.body,
    fontWeight: '700',
    color: colors.secondary,
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
    minHeight: 82,
  },
  empty: {
    ...typography.label,
    color: colors.textSecondary,
  },
});
