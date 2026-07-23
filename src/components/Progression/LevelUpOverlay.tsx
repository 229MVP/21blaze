import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { getCosmetic } from '../../cosmetics/catalog';
import { useReducedMotionSetting } from '../../hooks/useReducedMotionSetting';
import type { PendingLevelUp } from '../../progression/types';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { shadows } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';
import { BlazeButton } from '../buttons/BlazeButton';
import { FlameIcon } from '../branding/FlameIcon';

type LevelUpOverlayProps = {
  pending: PendingLevelUp | null;
  onContinue: () => void;
};

export function LevelUpOverlay({ pending, onContinue }: LevelUpOverlayProps) {
  const reducedMotion = useReducedMotionSetting();
  const scale = useRef(new Animated.Value(reducedMotion ? 1 : 0.86)).current;
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (!pending) {
      return;
    }
    if (reducedMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    scale.setValue(0.86);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, pending, reducedMotion, scale]);

  if (!pending) {
    return null;
  }

  const coinTotal = pending.rewards.reduce((sum, reward) => sum + reward.blazeCoins, 0);
  const cosmetics = pending.rewards
    .map((reward) => reward.cosmeticId)
    .filter((id): id is string => Boolean(id))
    .map((id) => getCosmetic(id)?.displayName ?? id);
  const titles = pending.rewards
    .map((reward) => reward.title)
    .filter((title): title is string => Boolean(title));

  return (
    <View style={styles.overlay} pointerEvents="auto" accessibilityViewIsModal>
      <Animated.View
        style={[
          styles.card,
          shadows.soft,
          { opacity, transform: [{ scale }] },
        ]}
      >
        <FlameIcon width={40} height={52} />
        <Text style={styles.kicker}>LEVEL UP!</Text>
        <Text style={styles.level}>LEVEL {pending.levelAfter}</Text>
        {pending.levelsCrossed.length > 1 ? (
          <Text style={styles.multi}>
            Crossed {pending.levelsCrossed.length} levels
          </Text>
        ) : null}

        {coinTotal > 0 || cosmetics.length > 0 || titles.length > 0 ? (
          <View style={styles.rewards}>
            <Text style={styles.rewardsTitle}>REWARDS UNLOCKED</Text>
            {coinTotal > 0 ? (
              <Text style={styles.rewardLine}>+{coinTotal.toLocaleString()} Blaze Coins</Text>
            ) : null}
            {titles.map((title) => (
              <Text key={title} style={styles.rewardLine}>
                Title: {title}
              </Text>
            ))}
            {cosmetics.map((name) => (
              <Text key={name} style={styles.rewardLine}>
                Cosmetic: {name}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.detail}>Keep blazing to unlock more rewards.</Text>
        )}

        <BlazeButton title="CONTINUE" onPress={onContinue} fullWidth />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 60,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.backgroundCard,
    borderColor: colors.blazeStrong,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  kicker: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    letterSpacing: 2,
    color: colors.gold,
    textAlign: 'center',
  },
  level: {
    fontFamily: fontFamilies.display,
    fontSize: 44,
    lineHeight: 48,
    color: colors.primary,
    textAlign: 'center',
    textShadowColor: colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  multi: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  detail: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  rewards: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: 'rgba(0,0,0,0.28)',
    padding: spacing.md,
    gap: 6,
    marginBottom: spacing.sm,
  },
  rewardsTitle: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1.2,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 4,
  },
  rewardLine: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
