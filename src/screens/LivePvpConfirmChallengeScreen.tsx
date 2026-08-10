import { StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { mapLivePvpErrorMessage } from '../livePvp/livePvpErrorMap';
import type { LivePvpConfirmChallengeScreenProps } from '../navigation/navigationTypes';
import { useLivePvpStore } from '../store/useLivePvpStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

export function LivePvpConfirmChallengeScreen({
  navigation,
  route,
}: LivePvpConfirmChallengeScreenProps) {
  const { opponentId, opponentDisplayName } = route.params;
  const createInvite = useLivePvpStore((s) => s.createInvite);
  const mutationStatus = useLivePvpStore((s) => s.mutationStatus);
  const errorMessage = useLivePvpStore((s) => s.errorMessage);
  const pending = mutationStatus === 'pending';

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.inner}>
        <ScreenHeader title="CONFIRM LIVE CHALLENGE" />
        <Text style={styles.title}>CHALLENGE {opponentDisplayName.toUpperCase()} LIVE?</Text>
        <Text style={styles.body}>This is a real-time match.</Text>
        <Text style={styles.body}>If they accept:</Text>
        <Text style={styles.body}>• You will enter the lobby</Text>
        <Text style={styles.body}>• Both players must be ready</Text>
        <Text style={styles.body}>• The match starts automatically</Text>
        <Text style={styles.body}>• The timer continues if you disconnect</Text>
        {errorMessage ? (
          <Text style={styles.error}>{mapLivePvpErrorMessage(errorMessage)}</Text>
        ) : null}
        <BlazeButton
          title={pending ? 'SENDING…' : 'SEND CHALLENGE'}
          disabled={pending}
          loading={pending}
          onPress={() => {
            void (async () => {
              const matchId = await createInvite(opponentId, opponentDisplayName);
              if (!matchId) {
                return;
              }
              navigation.replace('LivePvpWaitingRoom', { matchId });
            })();
          }}
          fullWidth
        />
        <BlazeButton
          title="CANCEL"
          variant="secondary"
          disabled={pending}
          onPress={() => navigation.goBack()}
          fullWidth
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    padding: spacing.md,
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.gold,
    textAlign: 'center',
  },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  error: { ...typography.body, color: '#FF8A80', textAlign: 'center' },
});
