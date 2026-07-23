import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { shadows } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';
import { fontFamilies } from '../../theme/typography';
import { BlazeButton } from '../buttons/BlazeButton';

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
    <View style={styles.overlay} pointerEvents="auto" accessibilityViewIsModal>
      <View style={[styles.card, shadows.soft]}>
        <Text style={styles.title}>GAME PAUSED</Text>
        <View style={styles.divider} />
        <View style={styles.actions}>
          <BlazeButton title="RESUME" onPress={onResume} fullWidth />
          <BlazeButton
            title="RESTART GAME"
            variant="danger"
            onPress={onRestart}
            fullWidth
          />
          <BlazeButton
            title="QUIT TO HOME"
            variant="secondary"
            onPress={onQuit}
            fullWidth
          />
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
    backgroundColor: colors.backgroundCard,
    borderColor: colors.blazeSubtle,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 24,
    letterSpacing: 1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.blazeSubtle,
  },
  actions: {
    gap: spacing.sm,
  },
});
