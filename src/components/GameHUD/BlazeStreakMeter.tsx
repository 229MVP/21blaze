import { StyleSheet, Text, View } from 'react-native';

import { MAX_MULTIPLIER } from '../../game/constants';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { FlameIcon } from '../branding/FlameIcon';

type BlazeStreakMeterProps = {
  multiplier: number;
};

export function BlazeStreakMeter({ multiplier }: BlazeStreakMeterProps) {
  const clamped = Math.max(1, Math.min(MAX_MULTIPLIER, multiplier));

  return (
    <View style={styles.container} accessibilityLabel={`Blaze streak x${clamped}`}>
      <Text style={styles.label}>BLAZE STREAK</Text>
      <View style={styles.markers}>
        {Array.from({ length: MAX_MULTIPLIER }, (_, index) => {
          const active = index < clamped;
          return (
            <FlameIcon
              key={`streak-${index + 1}`}
              width={18}
              height={24}
              active={active}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.backgroundCard,
    borderColor: colors.blazeSubtle,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'center',
    gap: 6,
  },
  label: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 1,
  },
  markers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
