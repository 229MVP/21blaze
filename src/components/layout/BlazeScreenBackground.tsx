import type { ReactNode } from 'react';
import { Image, ImageBackground, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { blazeAssets } from '../../assets/blazeAssets';
import { useIsLavaArenaTintActive } from '../../cosmetics/useLockerCosmetics';
import { colors } from '../../theme/uiKit';

type Variant = 'home' | 'gameplay' | 'plain' | 'dramatic';

const sources = {
  home: blazeAssets.lavaBackground,
  gameplay: blazeAssets.gameplayEmbers,
  plain: blazeAssets.gameplayEmbersSubtle,
  dramatic: blazeAssets.lavaBackground,
} as const;

type Props = {
  children: ReactNode;
  variant?: Variant;
  embers?: boolean;
};

export function BlazeScreenBackground({
  children,
  variant = 'gameplay',
  embers = false,
}: Props) {
  const lavaTintActive = useIsLavaArenaTintActive();

  return (
    <ImageBackground
      source={sources[variant]}
      resizeMode="cover"
      style={styles.fill}
    >
      <LinearGradient
        colors={['rgba(3,5,7,.20)', 'rgba(3,5,7,.70)']}
        style={styles.fill}
      >
        {lavaTintActive ? (
          // Version 1.1B "Blaze Locker" — Lava Arena, a purely decorative
          // background tint. Never affects layout, cards, or gameplay.
          <LinearGradient
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            colors={['transparent', 'transparent', 'rgba(120,16,4,0.32)', 'rgba(20,4,2,0.5)']}
            locations={[0, 0.55, 0.85, 1]}
            style={[StyleSheet.absoluteFill, styles.lavaTint]}
          />
        ) : null}
        <SafeAreaView style={styles.fill}>{children}</SafeAreaView>
        {embers ? (
          <View pointerEvents="none" style={styles.embers}>
            <Image
              source={blazeAssets.emberOverlay}
              style={styles.embersImage}
              resizeMode="cover"
            />
          </View>
        ) : null}
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background.primary },
  lavaTint: {
    zIndex: 0,
  },
  embers: {
    ...StyleSheet.absoluteFill,
    opacity: 0.35,
  },
  embersImage: {
    width: '100%',
    height: '100%',
  },
});
