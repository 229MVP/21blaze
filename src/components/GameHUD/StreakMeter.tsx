import { StyleSheet, Text, View } from 'react-native';

import { MAX_MULTIPLIER } from '../../game/constants';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type StreakMeterProps = {
  multiplier: number;
};

export function StreakMeter({ multiplier }: StreakMeterProps) {
  const clamped = Math.max(1, Math.min(MAX_MULTIPLIER, multiplier));

  return (
    <View style={styles.container} accessibilityLabel={`Blaze streak x${clamped}`}>
      <View style={styles.header}>
        <Text style={styles.label}>BLAZE STREAK</Text>
        <Text style={styles.value}>x{clamped}</Text>
      </View>
      <View style={styles.markers}>
        {Array.from({ length: MAX_MULTIPLIER }, (_, index) => {
          const active = index < clamped;
          return (
            <View
              key={`streak-${index + 1}`}
              style={[styles.marker, active ? styles.markerActive : styles.markerInactive]}
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
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  value: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  markers: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  marker: {
    flex: 1,
    height: 8,
    borderRadius: 999,
  },
  markerActive: {
    backgroundColor: colors.primary,
  },
  markerInactive: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
