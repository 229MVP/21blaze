import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BlazeButton } from '../buttons/BlazeButton';
import { BlazeModal } from '../Settings/BlazeModal';
import { useAuthStore } from '../../store/useAuthStore';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';

type EditDisplayNameModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function EditDisplayNameModal({
  visible,
  onClose,
}: EditDisplayNameModalProps) {
  const profile = useAuthStore((state) => state.profile);
  const updateDisplayName = useAuthStore((state) => state.updateDisplayName);
  const [value, setValue] = useState(profile?.display_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue(profile?.display_name ?? '');
      setError(null);
      setIsSaving(false);
    }
  }, [profile?.display_name, visible]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    const result = await updateDisplayName(value);
    setIsSaving(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    onClose();
  };

  return (
    <BlazeModal
      visible={visible}
      title="DISPLAY NAME"
      message="3–16 characters. Letters, numbers, and underscores only."
      onRequestClose={onClose}
    >
      <TextInput
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={16}
        placeholder="Blazer_Name"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        accessibilityLabel="Display name"
        editable={!isSaving}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <BlazeButton
          title="CANCEL"
          variant="secondary"
          onPress={onClose}
          style={styles.action}
          disabled={isSaving}
        />
        <BlazeButton
          title={isSaving ? 'SAVING…' : 'SAVE'}
          onPress={() => {
            void handleSave();
          }}
          style={styles.action}
          disabled={isSaving}
        />
      </View>
    </BlazeModal>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundSecondary,
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  error: {
    ...typography.body,
    fontSize: 13,
    color: colors.warningRed,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    flex: 1,
  },
});
