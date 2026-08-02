import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  arenaId: string;
  width?: number;
  height?: number;
};

/**
 * Version 1.1B "Blaze Locker" — small, code-driven arena background
 * preview. Mirrors the lava tint used in `BlazeScreenBackground` at a
 * fraction of the size, with no remote images or particle engines.
 */
export function ArenaPreviewPanel({ arenaId, width = 96, height = 64 }: Props) {
  const isLava = arenaId === 'lava_arena_tint';

  return (
    <View
      style={[styles.wrap, { width, height }]}
      accessibilityLabel={isLava ? 'Lava Arena preview' : 'Classic Arena preview'}
    >
      <LinearGradient
        colors={
          isLava
            ? ['#0A0604', '#170805', '#4A0E02', '#7A1503']
            : ['#161014', '#1D1418', '#221217']
        }
        locations={isLava ? [0, 0.45, 0.8, 1] : [0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {isLava ? (
        <View pointerEvents="none" accessibilityElementsHidden style={styles.emberRow}>
          <View style={styles.ember} />
          <View style={[styles.ember, styles.emberSmall]} />
          <View style={styles.ember} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.28)',
  },
  emberRow: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  ember: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FF8A00',
    opacity: 0.85,
  },
  emberSmall: {
    width: 2,
    height: 2,
  },
});
