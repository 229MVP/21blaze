import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, spacing, typography } from '../../theme/uiKit';
import { BlazePanel } from '../ui/BlazePanel';

type Props = {
  label: string;
  value: string | number;
  accent?: boolean;
  danger?: boolean;
  compact?: boolean;
  accessibilityValue?: string;
  narrow?: boolean;
};

export function StatCounter({
  label,
  value,
  accent = false,
  danger = false,
  compact = false,
  accessibilityValue,
  narrow = false,
}: Props) {
  const panelStyle: ViewStyle = narrow
    ? { ...styles.panel, ...styles.panelNarrow }
    : styles.panel;

  return (
    <BlazePanel
      padding={compact ? spacing.sm : spacing.md}
      style={panelStyle}
    >
      <View
        accessible
        accessibilityLabel={`${label}: ${accessibilityValue ?? value}`}
      >
        <Text style={[styles.label, narrow && styles.labelNarrow]}>{label}</Text>
        <Text
          style={[
            styles.value,
            narrow && styles.valueNarrow,
            accent && styles.accent,
            danger && styles.danger,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {value}
        </Text>
      </View>
    </BlazePanel>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minWidth: 64,
  },
  panelNarrow: {
    minWidth: '46%',
    flexBasis: '46%',
    flexGrow: 1,
  },
  label: {
    color: colors.text.secondary,
    fontFamily: typography.families.condensed,
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  labelNarrow: {
    fontSize: 9,
    letterSpacing: 0.5,
  },
  value: {
    color: colors.fire.gold,
    fontFamily: typography.families.condensed,
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 4,
  },
  valueNarrow: {
    fontSize: 15,
    marginTop: 2,
  },
  accent: {
    color: colors.fire.brightOrange,
  },
  danger: {
    color: colors.status.danger,
  },
});
