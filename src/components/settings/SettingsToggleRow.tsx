import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/uiKit';

type Props = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  description?: string;
  disabled?: boolean;
};

export function SettingsToggleRow({
  label,
  value,
  onValueChange,
  description,
  disabled = false,
}: Props) {
  return (
    <View style={styles.row} accessibilityState={{ disabled, checked: value }}>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={`${label}, ${value ? 'on' : 'off'}`}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#33383D', true: colors.fire.orange }}
        thumbColor={colors.text.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
  },
  copy: {
    flex: 1,
    paddingRight: spacing.md,
    minWidth: 0,
  },
  label: {
    color: colors.text.primary,
    fontFamily: typography.families.condensed,
    fontWeight: '700',
    fontSize: 14,
  },
  desc: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 2,
    fontFamily: typography.families.body,
  },
});
