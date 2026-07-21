import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { fontFamilies } from '../../theme/typography';

type SegmentOption<T extends string> = {
  label: string;
  value: T;
};

type BlazeSegmentedControlProps<T extends string> = {
  options: SegmentOption<T>[];
  selectedValue: T;
  onChange: (value: T) => void;
  disabledValues?: readonly T[];
};

export function BlazeSegmentedControl<T extends string>({
  options,
  selectedValue,
  onChange,
  disabledValues = [],
}: BlazeSegmentedControlProps<T>) {
  const { width } = useWindowDimensions();
  const compact = width < 380;

  return (
    <View
      style={styles.container}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const selected = option.value === selectedValue;
        const disabled = disabledValues.includes(option.value);
        const label = (
          <Text
            style={[
              styles.label,
              compact && styles.labelCompact,
              selected && styles.labelSelected,
              disabled && styles.labelDisabled,
            ]}
            numberOfLines={1}
          >
            {option.label}
          </Text>
        );

        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`${option.label}${disabled ? ', coming soon' : ''}`}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              pressed && !disabled && styles.pressed,
            ]}
          >
            {selected && !disabled ? (
              <LinearGradient
                colors={[colors.primary, colors.brightOrange]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.activeFill}
              >
                {label}
              </LinearGradient>
            ) : (
              <View style={styles.inactiveFill}>{label}</View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundCard,
    borderColor: colors.blazeSubtle,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  activeFill: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  inactiveFill: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    fontFamily: fontFamilies.display,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 11,
    letterSpacing: 0.6,
  },
  labelSelected: {
    color: colors.textPrimary,
  },
  labelDisabled: {
    color: colors.textDisabled,
  },
});
