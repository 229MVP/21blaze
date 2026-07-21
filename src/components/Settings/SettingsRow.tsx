import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';

type SettingsRowProps = {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  disabled?: boolean;
  rightAccessory?: ReactNode;
  accessibilityLabel?: string;
  isFirst?: boolean;
  isLast?: boolean;
};

export function SettingsRow({
  label,
  value,
  onPress,
  danger = false,
  disabled = false,
  rightAccessory,
  accessibilityLabel,
  isFirst = false,
  isLast = false,
}: SettingsRowProps) {
  const content = (
    <>
      <Text style={[styles.label, danger && styles.dangerLabel]}>{label}</Text>
      <View style={styles.trailing}>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        {rightAccessory}
        {onPress ? <Text style={styles.chevron}>›</Text> : null}
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[
          styles.row,
          isFirst && styles.first,
          isLast && styles.last,
          !isLast && styles.rowBorder,
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isFirst && styles.first,
        isLast && styles.last,
        !isLast && styles.rowBorder,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
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
    gap: spacing.sm,
  },
  first: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  last: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    flexShrink: 1,
    fontFamily: fontFamilies.bodySemi,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dangerLabel: {
    color: colors.warningRed,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: {
    ...typography.label,
    fontSize: 13,
    textTransform: 'none',
    color: colors.textSecondary,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 18,
    lineHeight: 20,
  },
});
