
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii } from '../../theme/uiKit';

export type CardBackVariant = 'classic' | 'ember';

type Props = {
  width?: number;
  height?: number;
  /** Version 1.1B "Blaze Locker" — code-driven card back cosmetic. */
  variant?: CardBackVariant;
};

export function CardBack({ width = 72, height = 104, variant = 'classic' }: Props) {
  if (variant === 'ember') {
    return (
      <LinearGradient
        colors={['#241008', '#15181B', '#5A1A00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, styles.emberBorder, { width, height }]}
        accessibilityLabel="Ember card back"
      >
        <View style={styles.emberInner}>
          <View style={styles.emberFlame} pointerEvents="none" />
          <View style={[styles.emberDot, styles.emberDotTopLeft]} pointerEvents="none" />
          <View style={[styles.emberDot, styles.emberDotBottomRight]} pointerEvents="none" />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.fire.ember, colors.background.panel, colors.fire.orange]}
      style={[styles.card, { width, height }]}
      accessibilityLabel="Card back"
    >
      <View style={styles.inner}>
        <View style={styles.diamond} />
        <View style={[styles.diamond, { transform: [{ rotate: '45deg' }, { scale: 0.55 }] }]} />
      </View>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  card: { borderRadius: radii.md, padding: 5, borderWidth: 1, borderColor: colors.fire.gold },
  inner: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.25)',
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamond: {
    width: 24,
    height: 24,
    backgroundColor: colors.fire.orange,
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
  },
  emberBorder: {
    borderColor: '#FF8A00',
  },
  emberInner: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.45)',
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emberFlame: {
    width: 16,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF6500',
    shadowColor: '#FFB629',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    transform: [{ rotate: '180deg' }],
  },
  emberDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFB629',
    opacity: 0.85,
  },
  emberDotTopLeft: { top: 8, left: 10 },
  emberDotBottomRight: { bottom: 8, right: 10 },
});
