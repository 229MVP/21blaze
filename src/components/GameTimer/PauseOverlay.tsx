import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';

import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../../theme/uiKit';
import { BlazeButton } from '../ui/BlazeButton';
import { BlazePanel } from '../ui/BlazePanel';

type PauseOverlayProps = {
  visible: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
};

/**
 * Presentation overlay for Solo pause.
 * Does not own timer / pause timestamps — parent wires store actions.
 */
export function PauseOverlay({
  visible,
  onResume,
  onRestart,
  onQuit,
}: PauseOverlayProps) {
  const { width } = useWindowDimensions();

  if (!visible) {
    return null;
  }

  const panelWidth = Math.min(360, width - 32);
  const panelStyle: ViewStyle = {
    ...styles.panel,
    width: panelWidth,
    maxWidth: 360,
  };

  return (
    <View
      style={styles.overlay}
      pointerEvents="auto"
      accessibilityViewIsModal
      accessibilityLabel="Game paused"
    >
      <Pressable
        style={styles.backdrop}
        onPress={onResume}
        accessibilityRole="button"
        accessibilityLabel="Dismiss pause menu and resume"
      />

      <BlazePanel glow style={panelStyle}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            GAME PAUSED
          </Text>
          <Pressable
            onPress={onResume}
            accessibilityRole="button"
            accessibilityLabel="Close and resume"
            hitSlop={12}
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && styles.closePressed,
            ]}
          >
            <Text style={styles.closeLabel}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <BlazeButton
            label="RESUME"
            onPress={onResume}
            accessibilityLabel="Resume match"
          />
          <BlazeButton
            label="RESTART GAME"
            onPress={onRestart}
            variant="danger"
            accessibilityLabel="Restart game. Requires confirmation."
          />
          <BlazeButton
            label="QUIT TO HOME"
            onPress={onQuit}
            variant="secondary"
            accessibilityLabel="Quit to home. Requires confirmation."
          />
        </View>
      </BlazePanel>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: kitSpacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  panel: {
    gap: kitSpacing.md,
    zIndex: 1,
  },
  header: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginBottom: kitSpacing.xs,
  },
  title: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.display,
    fontSize: 28,
    letterSpacing: 1,
    textAlign: 'center',
    paddingHorizontal: 36,
  },
  closeBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  closePressed: {
    opacity: 0.75,
  },
  closeLabel: {
    color: kitColors.text.secondary,
    fontSize: 18,
    fontFamily: kitTypography.families.condensed,
  },
  actions: {
    gap: kitSpacing.sm,
  },
});
