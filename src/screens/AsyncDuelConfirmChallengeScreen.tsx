import { StyleSheet, Text, View } from 'react-native';

import { mapAsyncDuelErrorMessage } from '../asyncDuel/asyncDuelErrorMap';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { AsyncDuelConfirmChallengeScreenProps } from '../navigation/navigationTypes';
import { useAsyncDuelStore } from '../store/useAsyncDuelStore';
import { useGameStore } from '../store/useGameStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

export function AsyncDuelConfirmChallengeScreen({
  navigation,
  route,
}: AsyncDuelConfirmChallengeScreenProps) {
  const { opponentId, opponentDisplayName } = route.params;
  const createChallenge = useAsyncDuelStore((s) => s.createChallenge);
  const createStatus = useAsyncDuelStore((s) => s.createStatus);
  const errorMessage = useAsyncDuelStore((s) => s.errorMessage);
  const prepareAsyncDuelGame = useGameStore((s) => s.prepareAsyncDuelGame);
  const pending = createStatus === 'pending';

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.inner}>
        <ScreenHeader title="CONFIRM CHALLENGE" />
        <Text style={styles.title}>CHALLENGE {opponentDisplayName.toUpperCase()}?</Text>
        <Text style={styles.body}>You will play first.</Text>
        <Text style={styles.body}>
          They will receive the same deck, the same timer, and the same rules.
        </Text>
        <Text style={styles.body}>
          Your challenge appears after you finish your run.
        </Text>
        {errorMessage ? (
          <Text style={styles.error}>{mapAsyncDuelErrorMessage(errorMessage)}</Text>
        ) : null}
        <BlazeButton
          title={pending ? 'STARTING…' : 'START DUEL'}
          disabled={pending}
          loading={pending}
          onPress={() => {
            void (async () => {
              const session = await createChallenge({
                opponentId,
                opponentDisplayName,
              });
              if (!session) {
                return;
              }
              await prepareAsyncDuelGame(session);
              navigation.replace('Game');
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
