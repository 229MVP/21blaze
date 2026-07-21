import 'react-native-gesture-handler';

import { useEffect, useState } from 'react';
import { View } from 'react-native';
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

import { AppNavigator } from './src/navigation/AppNavigator';
import { useScoreHistoryStore } from './src/store/useScoreHistoryStore';
import { useSettingsStore } from './src/store/useSettingsStore';
import { colors } from './src/theme/colors';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const FONT_LOAD_TIMEOUT_MS = 4000;

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

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Anton_400Regular,
    RobotoCondensed_400Regular,
    RobotoCondensed_600SemiBold,
    RobotoCondensed_700Bold,
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTimedOut(true);
    }, FONT_LOAD_TIMEOUT_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  const fontsReady = fontsLoaded || Boolean(fontError) || timedOut;

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsReady]);

  useEffect(() => {
    void useSettingsStore.getState().hydrateSettings();
    void useScoreHistoryStore.getState().hydrateScoreHistory();
  }, []);

  // Proceed with system-font fallbacks if custom fonts fail or stall.
  if (!fontsReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
