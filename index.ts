import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';
import { recordStartupStage } from './src/startup/startupDiagnostics';

// Version 1.2.0 startup hotfix — a diagnostic-only breadcrumb for truly
// uncaught JS errors that occur OUTSIDE React's render/lifecycle (e.g. in
// a raw timer callback or a legacy-Hermes-runtime unhandled rejection),
// which no React error boundary can ever see. This never suppresses or
// changes the error itself — it always re-invokes whatever handler was
// already installed (LogBox in development, the platform's default
// production behavior otherwise), it only additionally records a
// sanitized local diagnostic stage first. Best-effort and defensive: if
// `ErrorUtils` is unavailable for any reason, this is a silent no-op.
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalErrorUtils = (global as any).ErrorUtils as
    | { setGlobalHandler?: (fn: (error: unknown, isFatal: boolean) => void) => void; getGlobalHandler?: () => (error: unknown, isFatal: boolean) => void }
    | undefined;
  if (globalErrorUtils?.setGlobalHandler && globalErrorUtils.getGlobalHandler) {
    const previousHandler = globalErrorUtils.getGlobalHandler();
    globalErrorUtils.setGlobalHandler((error, isFatal) => {
      try {
        recordStartupStage('startup_error_boundary_triggered');
      } catch {
        // Never let diagnostics recording itself throw.
      }
      previousHandler?.(error, isFatal);
    });
  }
} catch {
  // Never let installing this safety net prevent the app from starting.
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
