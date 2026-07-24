import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { blazeAssets } from '../../assets/blazeAssets';
import { colors, spacing, typography } from '../../theme/uiKit';

type Props = {
  eyebrow?: string;
  title: string;
  score: number;
  subtitle?: string;
  rankLine?: string | null;
  isHighScore?: boolean;
  crownVisible?: boolean;
  stopwatchVisible?: boolean;
  reduceMotion?: boolean;
  /** Stable id so entrance animation does not retrigger on ordinary rerenders. */
  animationKey?: string;
};

export function ResultHero({
  eyebrow,
  title,
  score,
  subtitle,
  rankLine,
  isHighScore = false,
  crownVisible = false,
  stopwatchVisible = false,
  reduceMotion = false,
  animationKey = 'result',
}: Props) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);
  const glow = useSharedValue(1);

  useEffect(() => {
    opacity.value = 0;
    scale.value = reduceMotion ? 1 : 0.92;
    opacity.value = withTiming(1, {
      duration: reduceMotion ? 120 : 280,
      easing: Easing.out(Easing.cubic),
    });
    if (!reduceMotion) {
      scale.value = withTiming(1, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
    }

    if (isHighScore && !reduceMotion) {
      glow.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 700 }),
          withTiming(1, { duration: 700 }),
        ),
        -1,
        false,
      );
    } else {
      glow.value = 1;
    }

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      cancelAnimation(glow);
    };
  }, [animationKey, glow, isHighScore, opacity, reduceMotion, scale]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value * (isHighScore ? glow.value : 1) }],
  }));

  return (
    <Animated.View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${title}. ${subtitle ?? ''}. Score ${score.toLocaleString()}. ${
        rankLine ?? ''
      }`}
      style={[styles.wrap, heroStyle]}
    >
      {crownVisible ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
        >
          <Image
            source={blazeAssets.flamingCrown}
            style={styles.crown}
            resizeMode="contain"
          />
        </View>
      ) : null}

      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={[styles.title, isHighScore && styles.blazing]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {rankLine ? (
        <Text style={styles.rank} accessibilityLiveRegion="polite">
          {rankLine}
        </Text>
      ) : null}

      <View style={styles.scoreStage}>
        {stopwatchVisible ? (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.stopwatchWrap}
          >
            <Image
              source={blazeAssets.fireStopwatch}
              style={styles.stopwatch}
              resizeMode="contain"
            />
          </View>
        ) : null}
        <Text
          style={[styles.score, stopwatchVisible && styles.scoreOverStopwatch]}
          accessibilityLiveRegion="polite"
        >
          {score.toLocaleString()}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.xs,
    width: '100%',
  },
  crown: {
    width: 48,
    height: 48,
    marginBottom: 2,
  },
  eyebrow: {
    color: colors.fire.gold,
    fontFamily: typography.families.condensed,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text.primary,
    fontFamily: typography.families.display,
    fontSize: 40,
    textAlign: 'center',
    textShadowColor: 'rgba(255,101,0,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  blazing: {
    color: colors.fire.brightOrange,
  },
  subtitle: {
    color: colors.fire.gold,
    fontFamily: typography.families.condensed,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  rank: {
    color: colors.fire.brightOrange,
    fontFamily: typography.families.condensed,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 2,
  },
  scoreStage: {
    marginTop: spacing.sm,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  stopwatchWrap: {
    position: 'absolute',
    width: 110,
    height: 110,
  },
  stopwatch: {
    width: 110,
    height: 110,
    opacity: 0.55,
  },
  score: {
    color: colors.fire.gold,
    fontFamily: typography.families.display,
    fontSize: 48,
    textAlign: 'center',
    textShadowColor: 'rgba(255,182,41,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
    zIndex: 1,
  },
  scoreOverStopwatch: {
    color: colors.fire.pale,
    textShadowColor: 'rgba(255,52,38,0.55)',
  },
});
