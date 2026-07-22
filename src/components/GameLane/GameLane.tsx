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
import type { CardStyle } from '../../settings/types';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';
import { PlayingCard } from '../Card/PlayingCard';

type GameLaneProps = {
  lane: Lane;
  disabled?: boolean;
  onPress: () => void;
  feedbackType?: MoveEventType | null;
  feedbackEventId?: string | null;
  cardStyle?: CardStyle | string;
};

export function GameLane({
  lane,
  disabled = false,
  onPress,
  feedbackType = null,
  feedbackEventId = null,
  cardStyle = 'classic',
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
      [colors.blazeSubtle, colors.primary, colors.warningRed],
    );

    return {
      borderColor,
      transform: [{ translateX: shakeX.value }, { scale: scale.value }],
    };
  });

  const visibleCards = lane.cards.slice(-4);

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
        <Text style={styles.title}>LANE {lane.id}</Text>
        <Text style={styles.total}>{total === 0 ? '—' : total}</Text>

        <View style={styles.cards}>
          {lane.cards.length === 0 ? (
            <Text style={styles.empty}>empty</Text>
          ) : (
            visibleCards.map((card, index) => (
              <View
                key={card.id}
                style={[styles.cardOverlap, index > 0 && styles.cardOverlapOffset]}
              >
                <PlayingCard card={card} size="small" cardStyle={cardStyle} />
              </View>
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
    borderWidth: 1.5,
    borderColor: colors.blazeSubtle,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  lane: {
    flex: 1,
    minHeight: 110,
    backgroundColor: colors.backgroundCard,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.55,
  },
  title: {
    ...typography.label,
    fontSize: 9,
    letterSpacing: 1,
  },
  total: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.gold,
    textShadowColor: 'rgba(255,182,41,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  cards: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: 2,
  },
  cardOverlap: {
    zIndex: 1,
  },
  cardOverlapOffset: {
    marginLeft: -12,
  },
  empty: {
    fontFamily: typography.label.fontFamily,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.textDisabled,
    fontStyle: 'italic',
    textTransform: 'none',
  },
});

