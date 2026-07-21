import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { shadows } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';
import { fontFamilies } from '../../theme/typography';

export type BlazeButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline';

type BlazeButtonProps = {
  title: string;
  onPress: () => void;
  variant?: BlazeButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
} & Pick<PressableProps, 'testID'>;

export function BlazeButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  style,
  accessibilityLabel,
  testID,
}: BlazeButtonProps) {
  const isDisabled = disabled || loading;
  const useGradient = (variant === 'primary' || variant === 'danger') && !isDisabled;

  const label = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : (
        <>
          {leftIcon}
          <Text style={styles.label}>{title}</Text>
        </>
      )}
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        variant === 'secondary' && styles.secondary,
        variant === 'outline' && styles.outline,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        variant === 'primary' && !isDisabled && shadows.buttonPrimary,
        variant === 'danger' && !isDisabled && shadows.buttonDanger,
        style,
      ]}
    >
      {useGradient ? (
        <LinearGradient
          colors={
            variant === 'danger'
              ? [colors.deepRed, colors.warningRed]
              : [colors.primary, colors.brightOrange]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        >
          {label}
        </LinearGradient>
      ) : (
        <View style={styles.fill}>{label}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fullWidth: {
    width: '100%',
  },
  fill: {
    flexGrow: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondary: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.whiteSubtle,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.blazeSubtle,
  },
  disabled: {
    backgroundColor: colors.buttonDisabled,
    borderColor: colors.buttonDisabled,
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  label: {
    fontFamily: fontFamilies.display,
    fontSize: 15,
    letterSpacing: 0.8,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
