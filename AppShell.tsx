import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { Anton_400Regular, useFonts } from '@expo-google-fonts/anton';
import {
  RobotoCondensed_400Regular,
  RobotoCondensed_600SemiBold,
  RobotoCondensed_700Bold,
} from '@expo-google-fonts/roboto-condensed';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { isStartupAdsDisabled } from './src/config/featureFlags';
import { hydrateInterstitialCaps } from './src/monetization/interstitialAdService';
import { AppNavigator, navigationRef } from './src/navigation/AppNavigator';
import { blazeAudio } from './src/services/audio/blazeAudio';
import { recordStartupStage } from './src/startup/startupDiagnostics';
import { StartupFallbackView } from './src/startup/StartupFallbackView';
import { hideSplashOnce } from './src/startup/splashControl';
import { activateClassicVisualsOverride } from './src/startup/visualStartupOverride';
import { useAuthStore } from './src/store/useAuthStore';
import { useScoreHistoryStore } from './src/store/useScoreHistoryStore';
import { useSettingsStore } from './src/store/useSettingsStore';
import { colors } from './src/theme/colors';

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

function runGuardedStartupStep(name: string, step: () => void | Promise<unknown>): void {
  try {
    const result = step();
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      (result as Promise<unknown>).catch(() => undefined);
    }
  } catch {
    // Optional startup step — never block the shell.
  }
}

async function guardedStartupPromise(name: string, step: () => void | Promise<unknown>): Promise<void> {
  try {
    await step();
  } catch {
    // Optional startup step — never block the shell.
  }
}

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
    recordStartupStage('providers_loading');
    const timeoutId = setTimeout(() => setFontTimedOut(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const watchdogId = setTimeout(() => {
      recordStartupStage('startup_watchdog_triggered');
      activateClassicVisualsOverride();
      setWatchdogTriggered(true);
    }, STARTUP_WATCHDOG_MS);
    return () => clearTimeout(watchdogId);
  }, []);

  const fontsReady = fontsLoaded || Boolean(fontError) || fontTimedOut || watchdogTriggered;

  useEffect(() => {
    if (fontsReady) {
      recordStartupStage('navigation_loading');
      hideSplashOnce();
    }
  }, [fontsReady]);

  useEffect(() => {
    recordStartupStage('classic_theme_ready');
    recordStartupStage('storage_loading');
    const tasks: Promise<void>[] = [
      guardedStartupPromise('hydrateSettings', () => useSettingsStore.getState().hydrateSettings()),
      guardedStartupPromise('hydrateScoreHistory', () =>
        useScoreHistoryStore.getState().hydrateScoreHistory(),
      ),
      guardedStartupPromise('initializeAuth', () => useAuthStore.getState().initializeAuth()),
    ];
    if (!isStartupAdsDisabled()) {
      tasks.push(guardedStartupPromise('hydrateInterstitialCaps', () => hydrateInterstitialCaps()));
    }
    void Promise.allSettled(tasks).then(() => {
      recordStartupStage('storage_ready');
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

  if (!fontsReady) {
    return (
      <StartupFallbackView
        stage={watchdogTriggered ? 'classic' : 'starting'}
        onFirstLayout={() => hideSplashOnce()}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={() => {
          recordStartupStage('navigation_ready');
          recordStartupStage('app_ready');
          recordStartupStage('optional_services_loading');
          recordStartupStage('optional_services_finished');
          hideSplashOnce();
        }}
      >
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default function AppShell() {
  const [restartNonce, setRestartNonce] = useState(0);

  return (
    <ErrorBoundary
      onRestart={() => setRestartNonce((n) => n + 1)}
      onStartWithClassic={() => setRestartNonce((n) => n + 1)}
      onStartBasicMode={() => setRestartNonce((n) => n + 1)}
    >
      <AppContent key={restartNonce} />
    </ErrorBoundary>
  );
}
