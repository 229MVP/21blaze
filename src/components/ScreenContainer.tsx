import { ReactNode } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '../theme/spacing';
import { BlazeBackground } from './background/BlazeBackground';

type ScreenContainerProps = {
  children: ReactNode;
  padded?: boolean;
  style?: ViewStyle;
  intensity?: 'subtle' | 'normal' | 'intense';
};

export function ScreenContainer({
  children,
  padded = true,
  style,
  intensity = 'normal',
}: ScreenContainerProps) {
  return (
    <BlazeBackground intensity={intensity}>
      <SafeAreaView
        style={[styles.container, padded && styles.padded, style]}
        edges={['top', 'right', 'bottom', 'left']}
      >
        {children}
      </SafeAreaView>
    </BlazeBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
});
