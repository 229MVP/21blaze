import type { ReactNode } from 'react';
import { Image, ImageBackground, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../theme/uiKit';

type Variant = 'home' | 'gameplay' | 'plain' | 'dramatic';

const sources = {
  home: require('../../../assets/backgrounds/home-lava-portrait.webp'),
  gameplay: require('../../../assets/backgrounds/gameplay-embers.webp'),
  plain: require('../../../assets/backgrounds/gameplay-embers-subtle.webp'),
  dramatic: require('../../../assets/backgrounds/home-lava-portrait.webp'),
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
        <SafeAreaView style={styles.fill}>{children}</SafeAreaView>
        {embers ? (
          <View pointerEvents="none" style={styles.embers}>
            <Image
              source={require('../../../assets/effects/embers-overlay.webp')}
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
  embers: {
    ...StyleSheet.absoluteFill,
    opacity: 0.35,
  },
  embersImage: {
    width: '100%',
    height: '100%',
  },
});
