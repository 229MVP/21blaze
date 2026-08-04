import { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotionSetting } from '../../hooks/useReducedMotionSetting';
import { trackEvent } from '../../monetization/analytics';
import { colors } from '../../theme/colors';
import { fontFamilies, typography } from '../../theme/typography';
import { BlazeButton } from '../buttons/BlazeButton';

type Props = {
  visible: boolean;
  onOpenLocker: () => void;
  onPlayNow: () => void;
};

const HIGHLIGHTS = [
  'New visual theme support',
  'Enhanced cards and arenas',
  'New lane and board effects',
  'Improved Blaze Locker previews',
  'Performance and stability improvements',
] as const;

/**
 * Version 1.2C — one-time "What's New" message. Shown at most once per
 * installed Version 1.2 update (see `src/services/whatsNewService.ts`).
 * Never mentions paid products, purchases, or prices.
 */
export function WhatsNewOverlay({ visible, onOpenLocker, onPlayNow }: Props) {
  const reduceMotion = useReducedMotionSetting();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.94);

  useEffect(() => {
    if (!visible) {
      return;
    }
    trackEvent('version_1_2_whats_new_viewed');
    if (reduceMotion) {
      opacity.value = 1;
      scale.value = 1;
      return;
    }
    opacity.value = withTiming(1, { duration: 220 });
    scale.value = withTiming(1, { duration: 220 });
  }, [visible, reduceMotion, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onPlayNow}
      accessibilityViewIsModal
    >
      <View style={styles.root}>
        <Animated.View style={[styles.card, animatedStyle]}>
          <Text style={styles.title} accessibilityRole="header">
            EMBER BLAZE HAS ARRIVED
          </Text>
          <View style={styles.list}>
            {HIGHLIGHTS.map((line) => (
              <View key={line} style={styles.listRow}>
                <View
                  style={styles.bullet}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
                <Text style={styles.listText}>{line}</Text>
              </View>
            ))}
          </View>
          <View style={styles.actions}>
            <BlazeButton
              title="OPEN LOCKER"
              onPress={onOpenLocker}
              accessibilityLabel="Open the Blaze Locker"
              fullWidth
            />
            <BlazeButton
              title="PLAY NOW"
              variant="outline"
              onPress={onPlayNow}
              accessibilityLabel="Continue to Home"
              fullWidth
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.blazeStrong,
    backgroundColor: 'rgba(12,10,9,0.96)',
    paddingVertical: 24,
    paddingHorizontal: 22,
    gap: 16,
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 24,
    color: colors.gold,
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  list: {
    gap: 10,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  listText: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 14,
    flexShrink: 1,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
});
