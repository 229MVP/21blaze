import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EditDisplayNameModal } from './EditDisplayNameModal';
import { useAuthStore } from '../../store/useAuthStore';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';

export function PlayerProfileButton() {
  const profile = useAuthStore((state) => state.profile);
  const authStatus = useAuthStore((state) => state.authStatus);
  const [editorOpen, setEditorOpen] = useState(false);

  if (!profile?.display_name) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Player ${profile.display_name}. Edit display name.`}
        onPress={() => setEditorOpen(true)}
        disabled={authStatus !== 'online'}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.label}>PLAYER</Text>
        <Text style={styles.name} numberOfLines={1}>
          {profile.display_name}
        </Text>
      </Pressable>
      <EditDisplayNameModal
        visible={editorOpen}
        onClose={() => setEditorOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  button: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    ...typography.label,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  name: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
