import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/uiKit';

type Props = {
  step: number;
  icon?: ReactNode;
  title: string;
  description?: string;
};

export function HowToPlayRow({ step, icon, title, description }: Props) {
  return (
    <View
      accessible
      accessibilityLabel={`Step ${step}. ${title}. ${description ?? ''}`}
      style={styles.row}
    >
      <View
        style={styles.icon}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {icon ?? <Text style={styles.step}>{step}</Text>}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>
          {step}. {title}
        </Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 70,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
  },
  icon: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: {
    color: colors.fire.gold,
    fontFamily: typography.families.display,
    fontSize: 24,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text.primary,
    fontFamily: typography.families.condensed,
    fontWeight: '700',
    fontSize: 15,
  },
  desc: {
    color: colors.text.secondary,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
    fontFamily: typography.families.body,
  },
});
