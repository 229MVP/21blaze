import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';

type SettingsToggleProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  isLast?: boolean;
};

export function SettingsToggle({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  isLast = false,
}: SettingsToggleProps) {
  const stateLabel = value ? 'enabled' : 'disabled';
  const resolvedLabel =
    accessibilityLabel ?? `${label}, ${stateLabel}`;

  return (
    <View
      style={[styles.row, !isLast && styles.rowBorder]}
      accessibilityRole="none"
    >
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        <Text style={styles.stateHint}>{value ? 'On' : 'Off'}</Text>
      </View>
      <View style={styles.switchWrap}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{
            false: colors.buttonDisabled,
            true: colors.primary,
          }}
          thumbColor={colors.textPrimary}
          ios_backgroundColor={colors.buttonDisabled}
          accessibilityRole="switch"
          accessibilityLabel={resolvedLabel}
          accessibilityState={{ checked: value, disabled }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.backgroundCard,
    gap: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  description: {
    ...typography.label,
    fontSize: 11,
    textTransform: 'none',
    letterSpacing: 0.2,
    color: colors.textMuted,
  },
  stateHint: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
  },
  switchWrap: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
