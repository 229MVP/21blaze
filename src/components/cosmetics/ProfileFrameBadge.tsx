import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type ProfileFrameVariant = 'default' | 'flame';

type Props = {
  variant?: ProfileFrameVariant;
  initial?: string;
  size?: number;
};

/**
 * Version 1.1B "Blaze Locker" — lightweight, code-driven profile frame.
 * No remote images or large textures; a gradient ring plus two small
 * corner flame accents for the "flame_profile_frame" cosmetic.
 */
export function ProfileFrameBadge({ variant = 'default', initial = '?', size = 44 }: Props) {
  const isFlame = variant === 'flame';
  const label = initial.trim().slice(0, 1).toUpperCase() || '?';

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityLabel={isFlame ? 'Flame profile frame equipped' : 'Default profile frame'}
    >
      {isFlame ? (
        <LinearGradient
          colors={['#FF9A2E', '#FFD24A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <View
            style={[
              styles.inner,
              {
                width: size - 6,
                height: size - 6,
                borderRadius: (size - 6) / 2,
              },
            ]}
          >
            <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{label}</Text>
          </View>
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.flameAccent, styles.flameTopLeft]}
          />
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.flameAccent, styles.flameTopRight]}
          />
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.defaultRing,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  inner: {
    backgroundColor: 'rgba(10,8,6,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultRing: {
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.4)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#FFE8C7',
    fontFamily: 'RobotoCondensed_700Bold',
    fontWeight: '700',
  },
  flameAccent: {
    position: 'absolute',
    width: 7,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF6500',
  },
  flameTopLeft: { top: -2, left: 4, transform: [{ rotate: '-20deg' }] },
  flameTopRight: { top: -2, right: 4, transform: [{ rotate: '20deg' }] },
});
