import { StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../ui/BlazeButton';
import { BlazePanel } from '../ui/BlazePanel';
import { colors, spacing, typography } from '../../theme/uiKit';

type PauseOverlayProps = {
  visible: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
};

/**
 * Presentation overlay wired to the real pause/resume/restart/quit store actions.
 * Does not own timer state.
 */
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
      <BlazePanel glow style={styles.panel}>
        <Text style={styles.title}>GAME PAUSED</Text>
        <BlazeButton label="RESUME" onPress={onResume} />
        <BlazeButton label="RESTART GAME" onPress={onRestart} variant="danger" />
        <BlazeButton label="QUIT TO HOME" onPress={onQuit} variant="secondary" />
      </BlazePanel>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    gap: spacing.md,
  },
  title: {
    color: colors.fire.gold,
    fontFamily: typography.families.display,
    fontSize: 28,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
