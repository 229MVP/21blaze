import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { getStreakRewardForMilestone } from '../../challenge/dailyStreakRewardRegistry';
import { isMonetizationBetaEnabled } from '../../config/featureFlags';
import { BlazeButton } from '../ui/BlazeButton';
import { BlazePanel } from '../ui/BlazePanel';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../../theme/uiKit';

type StreakMilestoneModalProps = {
  visible: boolean;
  milestone: number;
  claiming?: boolean;
  reduceMotion?: boolean;
  onClaim: () => void;
  onDismiss: () => void;
};

export function StreakMilestoneModal({
  visible,
  milestone,
  claiming = false,
  reduceMotion = false,
  onClaim,
  onDismiss,
}: StreakMilestoneModalProps) {
  const reward = getStreakRewardForMilestone(milestone);
  const showCoins =
    isMonetizationBetaEnabled() && reward?.blazeCoins != null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel="Dismiss" />
      <View style={styles.center} pointerEvents="box-none">
        <BlazePanel style={styles.panel} glow>
          <Text style={styles.eyebrow}>🔥 STREAK MILESTONE</Text>
          <Text style={styles.title}>{milestone} DAYS</Text>
          <Text style={styles.subtitle}>YOU&apos;RE ON FIRE.</Text>
          {showCoins ? (
            <Text style={styles.reward} accessibilityLabel={`Reward ${reward!.blazeCoins} Blaze Coins`}>
              +{reward!.blazeCoins} Blaze Coins
            </Text>
          ) : (
            <Text style={styles.rewardMuted}>Reward unlocked</Text>
          )}
          <BlazeButton
            label="CLAIM"
            onPress={onClaim}
            loading={claiming}
            accessibilityLabel={`Claim ${milestone} day streak reward`}
          />
          <BlazeButton label="LATER" variant="ghost" onPress={onDismiss} />
        </BlazePanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: kitSpacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    gap: kitSpacing.sm,
    alignItems: 'center',
  },
  eyebrow: {
    color: kitColors.fire.orange,
    fontFamily: kitTypography.families.condensed,
    fontSize: 12,
    letterSpacing: 1.4,
  },
  title: {
    color: kitColors.text.primary,
    fontFamily: kitTypography.families.display,
    fontSize: 36,
  },
  subtitle: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.condensed,
    fontSize: 14,
    letterSpacing: 1,
  },
  reward: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.display,
    fontSize: 24,
    marginVertical: kitSpacing.sm,
  },
  rewardMuted: {
    color: kitColors.text.secondary,
    fontSize: 14,
    marginVertical: kitSpacing.sm,
  },
});
