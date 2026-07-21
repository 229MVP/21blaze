import { ReactNode } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

type ScreenContainerProps = {
  children: ReactNode;
  padded?: boolean;
  style?: ViewStyle;
};

export function ScreenContainer({
  children,
  padded = true,
  style,
}: ScreenContainerProps) {
  return (
    <SafeAreaView
      style={[styles.container, padded && styles.padded, style]}
      edges={['top', 'right', 'bottom', 'left']}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
});
