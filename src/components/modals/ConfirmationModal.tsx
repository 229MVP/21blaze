import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/uiKit';
import { BlazeButton } from '../ui/BlazeButton';
import { BlazePanel } from '../ui/BlazePanel';

type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationModal({
  title,
  message,
  confirmLabel = 'CONFIRM',
  cancelLabel = 'CANCEL',
  danger = false,
  visible,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close confirmation"
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
        />
        <BlazePanel style={styles.panel}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <BlazeButton
              label={cancelLabel}
              onPress={onCancel}
              variant="secondary"
              accessibilityLabel={cancelLabel}
            />
            <BlazeButton
              label={confirmLabel}
              onPress={onConfirm}
              variant={danger ? 'danger' : 'primary'}
              accessibilityLabel={confirmLabel}
            />
          </View>
        </BlazePanel>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.lg,
    zIndex: 1,
  },
  title: {
    color: colors.fire.gold,
    fontFamily: typography.families.display,
    fontSize: 28,
    textAlign: 'center',
  },
  message: {
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.families.body,
  },
  actions: {
    gap: spacing.sm,
  },
});
