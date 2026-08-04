import 'react-native-gesture-handler';

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { Anton_400Regular, useFonts } from '@expo-google-fonts/anton';
import {
  RobotoCondensed_400Regular,
  RobotoCondensed_600SemiBold,
  RobotoCondensed_700Bold,
} from '@expo-google-fonts/roboto-condensed';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { hydrateInterstitialCaps } from './src/monetization/interstitialAdService';
import { AppNavigator, navigationRef } from './src/navigation/AppNavigator';
import { blazeAudio } from './src/services/audio/blazeAudio';
import { recordStartupStage } from './src/startup/startupDiagnostics';
import { StartupFallbackView } from './src/startup/StartupFallbackView';
import { activateClassicVisualsOverride } from './src/startup/visualStartupOverride';
import { useAuthStore } from './src/store/useAuthStore';
import { useScoreHistoryStore } from './src/store/useScoreHistoryStore';
import { useSettingsStore } from './src/store/useSettingsStore';
import { colors } from './src/theme/colors';

recordStartupStage('native_entry');

// `preventAutoHideAsync` is called exactly once, at module scope (never
// inside a component render or effect, which could re-run) — the single
// correct global location. A rejection here (e.g. already hidden by the
// native side) must never throw or block anything downstream.
let splashPreventCalled = false;
if (!splashPreventCalled) {
  splashPreventCalled = true;
  SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

// Guards `hideSplashOnce` below so a duplicate call (from both the fonts
// effect and the watchdog, for example) is always a safe no-op.
let splashHidden = false;

/**
 * Guaranteed-safe splash hide. Always resolves (never throws out to the
 * caller — every branch is wrapped), always idempotent, and safe to call
 * from more than one place (fonts-ready path, watchdog path, error
 * recovery path) without ever calling the native API twice.
 */
function hideSplashOnce(): void {
  if (splashHidden) {
    return;
  }
  splashHidden = true;
  try {
    SplashScreen.hideAsync().catch(() => undefined);
  } catch {
    // Never let a splash-hide failure block or crash startup.
  }
}

// Fonts get their own short timeout; the overall app additionally has a
// longer top-level watchdog (see `useStartupWatchdog` below) as a second,
// independent safety net so *no* combination of slow/failed optional
// startup work can leave the screen black indefinitely.
const FONT_LOAD_TIMEOUT_MS = 4000;
const STARTUP_WATCHDOG_MS = 8000;

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.backgroundSecondary,
    primary: colors.primary,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.secondary,
  },
};

/** Runs one startup step, swallowing any error so one failing optional
 * subsystem never crashes or blocks the rest of the root startup effect.
 * Never retries. Used for fire-and-forget steps whose completion nothing
 * else needs to wait on. */
function runGuardedStartupStep(name: string, step: () => void | Promise<unknown>): void {
  try {
    const result = step();
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      (result as Promise<unknown>).catch(() => {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn(`[startup] optional step "${name}" rejected — continuing.`);
        }
      });
    }
  } catch {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn(`[startup] optional step "${name}" threw synchronously — continuing.`);
    }
  }
}

/** Same guarantee as `runGuardedStartupStep`, but returns a promise that
 * always FULFILLS (never rejects) so callers can `Promise.allSettled`
 * (or even safely `Promise.all`) a batch of these without one failure
 * affecting the others or producing an unhandled rejection. */
async function guardedStartupPromise(name: string, step: () => void | Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn(`[startup] optional step "${name}" failed — continuing.`);
    }
  }
}

/**
 * Version 1.2.0 startup hotfix — the actual app content, isolated into
 * its own component so the root `ErrorBoundary` in `App` below wraps it
 * (and therefore the entire font-loading/pre-render phase too, which the
 * previous structure left unprotected — any throw there previously
 * unmounted the whole tree with nothing above it to catch it).
 */
function AppContent() {
  const [fontsLoaded, fontError] = useFonts({
    Anton_400Regular,
    RobotoCondensed_400Regular,
    RobotoCondensed_600SemiBold,
    RobotoCondensed_700Bold,
  });
  const [fontTimedOut, setFontTimedOut] = useState(false);
  const [watchdogTriggered, setWatchdogTriggered] = useState(false);

  useEffect(() => {
    recordStartupStage('react_root_started');
    const timeoutId = setTimeout(() => setFontTimedOut(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, []);

  // Independent, longer top-level watchdog — fires regardless of why the
  // app hasn't rendered yet (fonts, or anything added to this gate in
  // the future). Never depends on fonts, network, Supabase, ads,
  // consent, theme assets, or analytics resolving.
  useEffect(() => {
    const watchdogId = setTimeout(() => {
      recordStartupStage('startup_watchdog_triggered');
      // The watchdog firing means *something* optional stalled past the
      // safety window — fail open to Classic rather than keep waiting on
      // whatever it was (per the release-hotfix requirement that the
      // visual system must never be able to hold up first render).
      activateClassicVisualsOverride();
      setWatchdogTriggered(true);
    }, STARTUP_WATCHDOG_MS);
    return () => clearTimeout(watchdogId);
  }, []);

  const fontsReady = fontsLoaded || Boolean(fontError) || fontTimedOut || watchdogTriggered;

  useEffect(() => {
    if (fontsReady) {
      hideSplashOnce();
    }
  }, [fontsReady]);

  // Root-level, always-run optional startup work. Each step is
  // independently guarded (see `runGuardedStartupStep`) so none of them
  // can throw past this effect, block the JS thread, or prevent the
  // first visible screen from mounting — every one of these already runs
  // strictly after the first render commit (useEffect), never before it.
  useEffect(() => {
    // Classic theme is a pure, synchronous default — it never depends on
    // any of the storage/auth hydration below, so this stage is recorded
    // immediately rather than after those (independent, optional) tasks
    // settle.
    recordStartupStage('classic_theme_ready');

    recordStartupStage('storage_hydration_started');
    void Promise.allSettled([
      guardedStartupPromise('hydrateSettings', () => useSettingsStore.getState().hydrateSettings()),
      guardedStartupPromise('hydrateScoreHistory', () =>
        useScoreHistoryStore.getState().hydrateScoreHistory(),
      ),
      guardedStartupPromise('initializeAuth', () => useAuthStore.getState().initializeAuth()),
      guardedStartupPromise('hydrateInterstitialCaps', () => hydrateInterstitialCaps()),
    ]).then(() => {
      recordStartupStage('storage_hydration_finished');
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    runGuardedStartupStep('audioBootstrap', async () => {
      await useSettingsStore.getState().hydrateSettings();
      if (cancelled) {
        return;
      }
      blazeAudio.setEnabled(useSettingsStore.getState().settings.soundEffectsEnabled);
      runGuardedStartupStep('audioInitialize', () => blazeAudio.initialize());
    });

    const appStateSub = AppState.addEventListener('change', (next) => {
      try {
        blazeAudio.handleAppStateChange(next);
      } catch {
        // Never let an audio lifecycle error crash the app.
      }
    });

    let previousSoundEnabled = useSettingsStore.getState().settings.soundEffectsEnabled;
    const unsubscribeSettings = useSettingsStore.subscribe((state) => {
      const enabled = state.settings.soundEffectsEnabled;
      if (enabled !== previousSoundEnabled) {
        previousSoundEnabled = enabled;
        try {
          blazeAudio.setEnabled(enabled);
        } catch {
          // Never let an audio setting change crash the app.
        }
      }
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
      unsubscribeSettings();
      try {
        blazeAudio.dispose();
      } catch {
        // Never let teardown crash the app.
      }
    };
  }, []);

  // Never a bare, empty, black view: the fallback below always has a
  // visible non-black background and readable text (see
  // `StartupFallbackView`), and never returns null.
  if (!fontsReady) {
    return <StartupFallbackView stage={watchdogTriggered ? 'classic' : 'starting'} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={() => {
          recordStartupStage('navigation_ready');
          recordStartupStage('first_content_rendered');
          recordStartupStage('optional_services_started');
          // Nothing awaited here — ads/consent/analytics initialize (when
          // they do at all) strictly after the first screen is visible,
          // never before. Individual services remain responsible for
          // their own guarded, timeout-bounded init (see
          // `src/startup/runOptionalStartupTasks.ts`); this is only the
          // diagnostic bookend recorded once navigation has mounted.
          recordStartupStage('optional_services_finished');
        }}
      >
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default function App() {
  const [restartNonce, setRestartNonce] = useState(0);

  return (
    <ErrorBoundary
      onRestart={() => setRestartNonce((n) => n + 1)}
      onStartWithClassic={() => setRestartNonce((n) => n + 1)}
    >
      <AppContent key={restartNonce} />
    </ErrorBoundary>
  );
}
