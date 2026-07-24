import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { MoveEvent } from '../../game/types';
import { colors as kitColors, radii, spacing, typography } from '../../theme/uiKit';

type GameFeedbackBannerProps = {
  event: MoveEvent | null;
  onFinished: () => void;
};

const ENTER_MS = 180;
const HOLD_MS = 620;
const EXIT_MS = 300;

function getBannerCopy(event: MoveEvent): { title: string; detail: string } | null {
  switch (event.type) {
    case 'cleared21':
      return {
        title: '21 BLAZE!',
        detail: `+${event.pointsAwarded} POINTS`,
      };
    case 'clearedFiveCard':
      return {
        title: '5-CARD BLAZE!',
        detail: `+${event.pointsAwarded} POINTS`,
      };
    case 'bust':
      return {
        title: 'BUST!',
        detail: `${event.bustsAfter}/3 BUSTS`,
      };
    case 'placed':
    default:
      return null;
  }
}

export function GameFeedbackBanner({
  event,
  onFinished,
}: GameFeedbackBannerProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);
  const scale = useSharedValue(0.94);

  useEffect(() => {
    if (!event) {
      return;
    }

    if (event.type === 'placed') {
      const timer = setTimeout(() => {
        onFinished();
      }, 280);
      return () => {
        clearTimeout(timer);
      };
    }

    opacity.value = 0;
    translateY.value = 12;
    scale.value = 0.92;

    opacity.value = withSequence(
      withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }),
      withDelay(
        HOLD_MS,
        withTiming(
          0,
          { duration: EXIT_MS, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) {
              runOnJS(onFinished)();
            }
          },
        ),
      ),
    );

    translateY.value = withSequence(
      withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }),
      withDelay(HOLD_MS, withTiming(-8, { duration: EXIT_MS })),
    );

    scale.value = withSequence(
      withTiming(1.04, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 120 }),
      withDelay(HOLD_MS - 120, withTiming(0.96, { duration: EXIT_MS })),
    );
  }, [event, onFinished, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (!event || event.type === 'placed') {
    return null;
  }

  const copy = getBannerCopy(event);
  if (!copy) {
    return null;
  }

  const isBust = event.type === 'bust';
  const accent = isBust ? kitColors.status.danger : kitColors.fire.gold;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        {
          borderColor: accent,
          backgroundColor: isBust
            ? 'rgba(255,52,38,0.18)'
            : 'rgba(255,101,0,0.18)',
        },
        animatedStyle,
      ]}
    >
      <Text style={[styles.title, { color: accent }]}>{copy.title}</Text>
      <Text style={styles.detail}>{copy.detail}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    zIndex: 20,
    minWidth: 220,
    maxWidth: '90%',
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    fontFamily: typography.families.display,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 1,
  },
  detail: {
    fontFamily: typography.families.condensed,
    fontWeight: '700',
    color: kitColors.text.primary,
    textAlign: 'center',
    fontSize: 13,
  },
});
