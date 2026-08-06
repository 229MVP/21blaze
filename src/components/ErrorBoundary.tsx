import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { trackEvent } from '../monetization/analytics';
import { activateBasicStartupMode } from '../startup/basicStartupMode';
import { activateClassicVisualsOverride } from '../startup/visualStartupOverride';
import { getLastStartupStageSync, recordStartupStage } from '../startup/startupDiagnostics';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies } from '../theme/typography';

type Props = {
  children: ReactNode;
  /** Called after the internal "try again" reset, e.g. to also reset any
   * app-level state the caller wants a fresh attempt to start clean. */
  onRestart?: () => void;
  /** Called after the internal "start with classic" reset. The classic
   * override itself is activated internally (see
   * `src/startup/visualStartupOverride.ts`) before this fires. */
  onStartWithClassic?: () => void;
  /** Called after Basic Mode is activated (Classic visuals + deferred optional services). */
  onStartBasicMode?: () => void;
};

type State = {
  hasError: boolean;
  /** Sanitized category only — never the raw message or stack. */
  errorCategory: string | null;
  diagnosticsVisible: boolean;
};

/**
 * Version 1.2.0 startup hotfix — production-safe ROOT error boundary.
 *
 * Wraps the entire application tree in `App.tsx`, including the pre-
 * fonts-ready loading phase, so a synchronous render-time throw anywhere
 * in startup (a bad hook, a corrupt cached value, a theme-resolution
 * bug, etc.) always produces this visible recovery screen instead of an
 * unmounted, permanently black native view.
 *
 * Never surfaces a raw stack trace, error message, or any secret to the
 * player — only a sanitized error "category" (the error's `name`,
 * truncated) is shown, and only inside the local, on-device diagnostics
 * line, never sent anywhere.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorCategory: null, diagnosticsVisible: false };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    const category =
      error instanceof Error && error.name ? error.name.slice(0, 60) : 'UnknownError';
    return { hasError: true, errorCategory: category };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    recordStartupStage('startup_error_boundary_triggered');
    // Safe: only the error's `name` (a short class-like category string,
    // e.g. "TypeError") is logged — never the message, stack, or any
    // payload that could contain user/account data.
    trackEvent('startup_error_boundary_triggered', {
      errorCategory: error?.name ? error.name.slice(0, 60) : 'UnknownError',
    });
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[ErrorBoundary]', error.name, error.message.slice(0, 200));
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, errorCategory: null, diagnosticsVisible: false });
    this.props.onRestart?.();
  };

  private handleStartWithClassic = (): void => {
    // Rendering-only: never touches ownership, wallet, XP, high scores,
    // rewards, or authentication (see visualStartupOverride.ts's docs).
    activateClassicVisualsOverride();
    this.setState({ hasError: false, errorCategory: null, diagnosticsVisible: false });
    this.props.onStartWithClassic?.();
  };

  private handleStartBasicMode = (): void => {
    activateBasicStartupMode();
    this.setState({ hasError: false, errorCategory: null, diagnosticsVisible: false });
    this.props.onStartBasicMode?.();
  };

  private toggleDiagnostics = (): void => {
    this.setState((prev) => ({ diagnosticsVisible: !prev.diagnosticsVisible }));
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const lastStage = getLastStartupStageSync();

    return (
      <View style={styles.container} accessibilityRole="alert">
        <Text style={styles.title}>21 BLAZE COULDN&apos;T START</Text>
        <Text style={styles.body}>
          LAST STEP: {lastStage?.stage ?? 'unknown'}
        </Text>
        <Text style={styles.bodyMuted}>
          Your account, wallet, scores, and cosmetics are safe.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={this.handleRetry}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>TRY AGAIN</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start Basic Mode"
          onPress={this.handleStartBasicMode}
          style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>START BASIC MODE</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle startup diagnostics"
          onPress={this.toggleDiagnostics}
          style={({ pressed }) => [styles.diagnosticsToggle, pressed && styles.pressed]}
        >
          <Text style={styles.diagnosticsToggleText}>
            {this.state.diagnosticsVisible ? 'HIDE DIAGNOSTICS' : 'SHOW DIAGNOSTICS'}
          </Text>
        </Pressable>
        {this.state.diagnosticsVisible ? (
          <Text style={styles.diagnosticsText}>
            LAST STARTUP STEP: {lastStage?.stage ?? 'unknown'}
            {'\n'}
            ERROR CATEGORY: {this.state.errorCategory ?? 'unknown'}
          </Text>
        ) : null}
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
    fontSize: 24,
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
  bodyMuted: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 20,
  },
  button: {
    minWidth: 260,
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
    fontSize: 13,
  },
  pressed: {
    opacity: 0.85,
  },
  diagnosticsToggle: {
    marginTop: spacing.md,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  diagnosticsToggleText: {
    fontFamily: fontFamilies.body,
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  diagnosticsText: {
    fontFamily: fontFamilies.body,
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
