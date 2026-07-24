import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/uiKit';

type Props = {
  label: string;
  value?: string;
  icon?: ReactNode;
  danger?: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function SettingsActionRow({
  label,
  value,
  icon,
  danger = false,
  onPress,
  disabled = false,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${value ? `, ${value}` : ''}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { opacity: disabled ? 0.45 : pressed ? 0.78 : 1 },
      ]}
    >
      {icon}
      <Text style={[styles.label, danger && styles.danger]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.spacer} />
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
  },
  label: {
    color: colors.text.primary,
    fontFamily: typography.families.condensed,
    fontWeight: '700',
    fontSize: 14,
    flexShrink: 1,
  },
  spacer: { flex: 1 },
  value: {
    color: colors.text.secondary,
    fontFamily: typography.families.body,
    fontSize: 13,
    maxWidth: '40%',
  },
  danger: {
    color: colors.status.danger,
  },
  chev: {
    color: colors.text.secondary,
    fontSize: 26,
    lineHeight: 28,
  },
});
