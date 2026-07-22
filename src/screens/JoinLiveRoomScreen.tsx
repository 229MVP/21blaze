import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { JoinLiveRoomScreenProps } from '../navigation/navigationTypes';
import { useLiveMatchStore } from '../store/useLiveMatchStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export function JoinLiveRoomScreen({ navigation }: JoinLiveRoomScreenProps) {
  const joinRoom = useLiveMatchStore((state) => state.joinRoom);
  const error = useLiveMatchStore((state) => state.error);
  const isBusy = useLiveMatchStore((state) => state.isBusy);
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const normalized = code.trim().toUpperCase();

  const handleJoin = async () => {
    if (!CODE_PATTERN.test(normalized)) {
      setLocalError('Enter a valid 6-character code (no O/0/I/1).');
      return;
    }
    setLocalError(null);
    const ok = await joinRoom(normalized);
    if (ok) {
      navigation.replace('LiveLobby');
    }
  };

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="JOIN ROOM" />
        <Text style={styles.help}>Enter the 6-character code from your friend.</Text>
        <TextInput
          value={normalized}
          onChangeText={(value) => setCode(value.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          placeholder="ABC234"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel="Room code"
        />
        {localError || error ? (
          <Text style={styles.error}>{localError ?? error}</Text>
        ) : null}

        <View style={styles.actions}>
          <BlazeButton
            title={isBusy ? 'JOINING…' : 'JOIN'}
            onPress={() => {
              void handleJoin();
            }}
            loading={isBusy}
            disabled={isBusy}
            fullWidth
          />
          <BlazeButton
            title="BACK"
            variant="secondary"
            onPress={() => navigation.goBack()}
            fullWidth
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  help: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.blazeSubtle,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundCard,
    color: colors.gold,
    fontFamily: fontFamilies.display,
    fontSize: 36,
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  error: {
    ...typography.body,
    fontSize: 13,
    color: colors.warningRed,
    textAlign: 'center',
  },
  actions: {
    marginTop: 'auto',
    gap: 10,
  },
});
