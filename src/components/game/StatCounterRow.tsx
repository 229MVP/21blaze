import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { spacing } from '../../theme/uiKit';
import { StatCounter } from './StatCounter';

export type StatItem = {
  label: string;
  value: string | number;
  accent?: boolean;
  danger?: boolean;
  accessibilityValue?: string;
};

export function StatCounterRow({ items }: { items: StatItem[] }) {
  const { width } = useWindowDimensions();
  const narrow = width < 360;

  return (
    <View style={[styles.row, narrow && styles.rowNarrow]}>
      {items.map((item) => (
        <StatCounter
          key={item.label}
          label={item.label}
          value={item.value}
          accent={item.accent}
          danger={item.danger}
          accessibilityValue={item.accessibilityValue}
          compact
          narrow={narrow}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: spacing.sm,
    width: '100%',
  },
  rowNarrow: {
    flexWrap: 'wrap',
    gap: 6,
  },
});
