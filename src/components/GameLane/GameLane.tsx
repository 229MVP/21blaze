import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { calculateHandTotal } from '../../game/cardValues';
import type { Lane, MoveEventType } from '../../game/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { PlayingCard } from '../Card/PlayingCard';

type GameLaneProps = {
  lane: Lane;
  disabled?: boolean;
  onPress: () => void;
  feedbackType?: MoveEventType | null;
  feedbackEventId?: string | null;
};

export function GameLane({
  lane,
  disabled = false,
  onPress,
  feedbackType = null,
  feedbackEventId = null,
}: GameLaneProps) {
  const total = calculateHandTotal(lane.cards);
  const scale = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const flashTone = useSharedValue(0); // 0 base, 1 primary, 2 danger

  useEffect(() => {
    if (!feedbackEventId || !feedbackType) {
      return;
    }

    scale.value = 1;
    shakeX.value = 0;
    flashTone.value = 0;

    if (feedbackType === 'placed') {
      flashTone.value = withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 220 }),
      );
      return;
    }

    if (feedbackType === 'cleared21') {
      flashTone.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 280 }),
      );
      scale.value = withSequence(
        withTiming(1.03, { duration: 100, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 180 }),
      );
      return;
    }

    if (feedbackType === 'clearedFiveCard') {
      flashTone.value = withSequence(
        withTiming(1, { duration: 110 }),
        withTiming(0, { duration: 320 }),
      );
      scale.value = withSequence(
        withTiming(1.05, { duration: 110, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 200 }),
      );
      return;
    }

    if (feedbackType === 'bust') {
      flashTone.value = withSequence(
        withTiming(2, { duration: 90 }),
        withTiming(0, { duration: 280 }),
      );
      shakeX.value = withSequence(
        withTiming(-5, { duration: 40 }),
        withTiming(5, { duration: 40 }),
        withTiming(-4, { duration: 40 }),
        withTiming(4, { duration: 40 }),
        withTiming(0, { duration: 40 }),
      );
    }
  }, [feedbackEventId, feedbackType, flashTone, scale, shakeX]);

  const animatedStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      flashTone.value,
      [0, 1, 2],
      [colors.border, colors.primary, colors.danger],
    );

    return {
      borderColor,
      transform: [
        { translateX: shakeX.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <Animated.View style={[styles.laneShell, animatedStyle]}>
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  laneShell: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  lane: {
    flex: 1,
    minHeight: 130,
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.92,
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
