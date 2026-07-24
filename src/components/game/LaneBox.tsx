import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { MoveEventType } from '../../game/types';
import { colors, spacing, typography } from '../../theme/uiKit';
import { PlayingCard, type CardModel } from '../cards';
import { BlazePanel } from '../ui/BlazePanel';

type Props = {
  laneNumber: number;
  total: number;
  cards: readonly CardModel[];
  selected?: boolean;
  disabled?: boolean;
  danger?: boolean;
  cleared?: boolean;
  onPress?: () => void;
  maxCards?: number;
  accessibilityHint?: string;
  feedbackType?: MoveEventType | null;
  feedbackEventId?: string | null;
};

const MIN_VISIBLE_PEEK = 16;
const TWO_CARD_GAP = 4;

function laneCardSize(viewportWidth: number): { width: number; height: number } {
  if (viewportWidth < 360) {
    return { width: 36, height: 52 };
  }
  if (viewportWidth < 430) {
    return { width: 40, height: 58 };
  }
  return { width: 42, height: 60 };
}

/**
 * Visible horizontal step for each card after the first.
 * Positive step: cards sit side-by-side (or with gap).
 * Step < cardWidth: controlled overlap.
 */
function visibleCardOffset(
  cardCount: number,
  cardWidth: number,
  availableWidth: number,
): number {
  if (cardCount <= 1) {
    return cardWidth;
  }

  const ideal =
    cardCount === 2
      ? cardWidth + TWO_CARD_GAP
      : cardWidth * (cardCount <= 3 ? 0.72 : 0.55);

  const fitted = (availableWidth - cardWidth) / (cardCount - 1);
  const maxStep = cardCount === 2 ? cardWidth + TWO_CARD_GAP : cardWidth * 0.85;
  const step = Math.min(ideal, fitted, maxStep);
  return Math.max(MIN_VISIBLE_PEEK, step);
}

export const LaneBox = memo(function LaneBox({
  laneNumber,
  total,
  cards,
  selected = false,
  disabled = false,
  danger = false,
  cleared = false,
  onPress,
  maxCards = 5,
  accessibilityHint,
  feedbackType = null,
  feedbackEventId = null,
}: Props) {
  const { width: viewportWidth } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(0);
  const cardSize = useMemo(
    () => laneCardSize(viewportWidth),
    [viewportWidth],
  );

  const scale = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const flashTone = useSharedValue(0);

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
      [colors.border.orange, colors.fire.orange, colors.status.danger],
    );

    return {
      borderColor,
      transform: [{ translateX: shakeX.value }, { scale: scale.value }],
    };
  });

  const onCardsLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setRowWidth((prev) => (prev === next ? prev : next));
  }, []);

  const visibleCards = cards.slice(-maxCards);
  const availableWidth = rowWidth > 0 ? rowWidth : Math.max(120, viewportWidth * 0.42);
  const step = visibleCardOffset(
    visibleCards.length,
    cardSize.width,
    availableWidth,
  );
  const marginLeftStep = -(cardSize.width - step);

  const panelVariant = danger
    ? 'danger'
    : selected || cleared
      ? 'active'
      : 'default';

  return (
    <Animated.View style={[styles.shell, animatedStyle]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Lane ${laneNumber}, total ${total}, ${cards.length} cards`}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled, selected }}
        style={({ pressed }) => [
          styles.pressable,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <BlazePanel
          variant={panelVariant}
          padding={spacing.sm}
          glow={selected || cleared}
          style={styles.panelInner}
        >
          <View style={styles.header}>
            <Text style={styles.label}>LANE {laneNumber}</Text>
            <Text
              style={[styles.total, danger && styles.dangerTotal]}
              accessibilityLabel={
                danger ? `Lane ${laneNumber} busted at ${total}` : undefined
              }
            >
              {total}
            </Text>
          </View>

          <View
            style={[styles.cards, { minHeight: cardSize.height + 4 }]}
            onLayout={onCardsLayout}
          >
            {visibleCards.length === 0 ? (
              <Text style={styles.empty}>EMPTY</Text>
            ) : (
              visibleCards.map((card, index) => (
                <View
                  key={`${laneNumber}-${card.rank}-${card.suit}-${index}`}
                  style={[
                    styles.cardSlot,
                    index > 0 ? { marginLeft: marginLeftStep } : null,
                    { zIndex: index + 1 },
                  ]}
                >
                  <PlayingCard
                    rank={card.rank}
                    suit={card.suit}
                    size="tiny"
                    width={cardSize.width}
                    height={cardSize.height}
                    disabled={disabled}
                  />
                </View>
              ))
            )}
          </View>
        </BlazePanel>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border.orange,
    overflow: 'hidden',
    backgroundColor: colors.background.panel,
  },
  pressable: {
    flex: 1,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.45,
  },
  panelInner: {
    flex: 1,
    minHeight: 128,
    borderWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    color: colors.text.secondary,
    fontFamily: typography.families.condensed,
    fontSize: 11,
    letterSpacing: 0.9,
  },
  total: {
    color: colors.fire.gold,
    fontFamily: typography.families.condensed,
    fontWeight: '900',
    fontSize: 18,
  },
  dangerTotal: {
    color: colors.status.danger,
  },
  cards: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    paddingRight: 2,
  },
  cardSlot: {
    // Keep stacked cards from clipping under neighbors incorrectly.
  },
  empty: {
    color: colors.text.muted,
    fontFamily: typography.families.condensed,
    fontSize: 11,
    letterSpacing: 1,
  },
});
