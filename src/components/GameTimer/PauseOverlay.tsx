import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { BlazeButton } from '../BlazeButton';

type PauseOverlayProps = {
  visible: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
};

export function PauseOverlay({
  visible,
  onResume,
  onRestart,
  onQuit,
}: PauseOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <Text style={styles.title}>GAME PAUSED</Text>
        <Text style={styles.subtitle}>Your score stays on the board.</Text>
        <View style={styles.actions}>
          <BlazeButton title="RESUME" onPress={onResume} />
          <BlazeButton title="RESTART GAME" variant="secondary" onPress={onRestart} />
          <BlazeButton title="QUIT TO HOME" variant="secondary" onPress={onQuit} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.primary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.subtitle,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
  },
});
