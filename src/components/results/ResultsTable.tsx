import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/uiKit';
import { BlazePanel } from '../ui/BlazePanel';

export type ResultRow = {
  label: string;
  value: string | number;
  gold?: boolean;
  danger?: boolean;
  badge?: string;
};

type Props = {
  rows: ResultRow[];
  highlightedRow?: string;
  compact?: boolean;
};

export function ResultsTable({
  rows,
  highlightedRow,
  compact = false,
}: Props) {
  return (
    <BlazePanel padding={0} style={styles.panel}>
      {rows.map((row) => (
        <View
          key={row.label}
          accessible
          accessibilityLabel={`${row.label}: ${row.value}${
            row.badge ? `, ${row.badge}` : ''
          }`}
          style={[
            styles.row,
            compact && styles.compact,
            row.label === highlightedRow && styles.highlight,
          ]}
        >
          <View style={styles.labelWrap}>
            <Text style={styles.label}>{row.label}</Text>
            {row.badge ? <Text style={styles.badge}>{row.badge}</Text> : null}
          </View>
          <Text
            style={[
              styles.value,
              row.gold && styles.gold,
              row.danger && styles.danger,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </BlazePanel>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    overflow: 'hidden',
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
    gap: spacing.sm,
  },
  compact: {
    minHeight: 38,
  },
  highlight: {
    backgroundColor: 'rgba(255,138,0,.08)',
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  label: {
    color: colors.text.secondary,
    fontFamily: typography.families.condensed,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  badge: {
    color: colors.fire.gold,
    fontFamily: typography.families.condensed,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  value: {
    color: colors.text.primary,
    fontFamily: typography.families.condensed,
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'right',
    flexShrink: 0,
  },
  gold: {
    color: colors.fire.gold,
  },
  danger: {
    color: colors.status.danger,
  },
});
