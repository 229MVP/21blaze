import { Suspense, lazy, useEffect } from 'react';

import { recordStartupStage } from './src/startup/startupDiagnostics';
import { StartupFallbackView } from './src/startup/StartupFallbackView';
import { hideSplashOnce, preventSplashAutoHideOnce } from './src/startup/splashControl';

recordStartupStage('native_entry');
preventSplashAutoHideOnce();

const AppShell = lazy(() => import('./AppShell'));

/**
 * Version 1.2.0 iOS black-screen hotfix — minimal root entry.
 *
 * This file intentionally imports ONLY React, the synchronous rescue view,
 * splash helpers, and in-memory diagnostics. Heavy providers, fonts,
 * navigation, ads, and stores load inside `AppShell.tsx` after the first
 * visible rescue frame (via `React.lazy` + `Suspense`).
 */
export default function App() {
  useEffect(() => {
    recordStartupStage('react_registered');
  }, []);

  return (
    <Suspense
      fallback={
        <StartupFallbackView
          stage="starting"
          onFirstLayout={() => {
            recordStartupStage('rescue_root_rendered');
            hideSplashOnce();
          }}
        />
      }
    >
      <AppShell />
    </Suspense>
  );
}
