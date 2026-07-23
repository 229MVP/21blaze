import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies } from '../theme/typography';

type Props = {
  children: ReactNode;
  onReturnHome?: () => void;
};

type State = {
  hasError: boolean;
};

/**
 * Production-safe root error boundary.
 * Never surfaces secrets, stack traces, or raw server payloads to players.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally no console dump of potentially sensitive details in production UI.
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  private handleHome = (): void => {
    this.setState({ hasError: false });
    this.props.onReturnHome?.();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container} accessibilityRole="alert">
        <Text style={styles.title}>SOMETHING WENT WRONG</Text>
        <Text style={styles.body}>
          21 Blaze hit an unexpected error. Solo Play usually still works after a
          retry. No account data was shown here.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry application"
          onPress={this.handleRetry}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>RETRY</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to home"
          onPress={this.handleHome}
          style={({ pressed }) => [
            styles.button,
            styles.secondary,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.buttonText}>RETURN HOME</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.primary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 22,
  },
  button: {
    minWidth: 220,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    fontFamily: fontFamilies.display,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  pressed: {
    opacity: 0.85,
  },
});
