import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/uiKit';
import { BlazeButton } from '../ui/BlazeButton';
import { BlazePanel } from '../ui/BlazePanel';

type Props = {
  visible: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onClose?: () => void;
};

/** Mockup / preview pause modal. Production Solo uses PauseOverlay. */
export function PauseModal({
  visible,
  onResume,
  onRestart,
  onQuit,
  onClose,
}: Props) {
  const dismiss = onClose ?? onResume;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      accessibilityViewIsModal
    >
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Close pause menu"
        />
        <BlazePanel glow style={styles.panel}>
          <Text style={styles.title} accessibilityRole="header">
            GAME PAUSED
          </Text>
          <BlazeButton label="RESUME" onPress={onResume} />
          <BlazeButton
            label="RESTART GAME"
            onPress={onRestart}
            variant="danger"
          />
          <BlazeButton
            label="QUIT TO HOME"
            onPress={onQuit}
            variant="secondary"
          />
        </BlazePanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
    zIndex: 1,
  },
  title: {
    color: colors.fire.gold,
    fontFamily: typography.families.display,
    fontSize: 30,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
