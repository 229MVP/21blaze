import 'react-native-gesture-handler';

import { useEffect } from 'react';
import { Text, View } from 'react-native';
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
import { colors } from './src/theme/colors';
import { fontFamilies } from './src/theme/typography';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style="light" />
        {/* System-font fallback path still mounts navigation if fonts fail */}
        {fontError ? (
          <Text
            style={{
              position: 'absolute',
              opacity: 0,
              fontFamily: fontFamilies.display,
            }}
          >
            {' '}
          </Text>
        ) : null}
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
