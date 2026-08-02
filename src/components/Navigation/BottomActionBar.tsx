import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../../theme/uiKit';
import { BlazeButton } from '../ui/BlazeButton';

type Action = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  accessibilityLabel?: string;
};

type Props = {
  primaryAction: Action;
  secondaryAction?: Action;
  safeAreaEnabled?: boolean;
  sticky?: boolean;
  /** Side-by-side actions (preferred for gameplay height). */
  layout?: 'stack' | 'row';
};

export function BottomActionBar({
  primaryAction,
  secondaryAction,
  safeAreaEnabled = true,
  sticky = false,
  layout = 'stack',
}: Props) {
  const insets = useSafeAreaInsets();
  const isRow = layout === 'row' && Boolean(secondaryAction);

  return (
    <View
      style={[
        styles.bar,
        isRow && styles.row,
        sticky && styles.sticky,
        {
          paddingBottom: safeAreaEnabled
            ? Math.max(insets.bottom, spacing.md)
            : spacing.sm,
        },
      ]}
    >
      {secondaryAction ? (
        <View style={isRow ? styles.flex : undefined}>
          <BlazeButton
            label={secondaryAction.label}
            onPress={secondaryAction.onPress}
            variant={secondaryAction.variant ?? 'secondary'}
            disabled={secondaryAction.disabled}
            accessibilityLabel={secondaryAction.accessibilityLabel}
          />
        </View>
      ) : null}
      <View style={isRow ? styles.flex : undefined}>
        <BlazeButton
          label={primaryAction.label}
          onPress={primaryAction.onPress}
          variant={primaryAction.variant ?? 'primary'}
          disabled={primaryAction.disabled}
          accessibilityLabel={primaryAction.accessibilityLabel}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  flex: {
    flex: 1,
  },
  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.primary,
  },
});
