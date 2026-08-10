import { StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { AsyncDuelChallengeSentScreenProps } from '../navigation/navigationTypes';
import { useAsyncDuelStore } from '../store/useAsyncDuelStore';
import { useGameStore } from '../store/useGameStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

export function AsyncDuelChallengeSentScreen({
  navigation,
}: AsyncDuelChallengeSentScreenProps) {
  const session = useGameStore((s) => s.asyncDuelSession);
  const score = useGameStore((s) => s.score);
  const exact21 = useGameStore((s) => s.dailyExact21Count);
  const fiveCard = useGameStore((s) => s.dailyFiveCardClearCount);
  const busts = useGameStore((s) => s.busts);
  const cardsPlayed = useGameStore((s) => s.cardsPlayed);
  const clearAsyncDuelMode = useGameStore((s) => s.clearAsyncDuelMode);
  const refreshHub = useAsyncDuelStore((s) => s.refreshHub);

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.inner}>
        <ScreenHeader title="CHALLENGE SENT" />
        <Text style={styles.kicker}>YOUR SCORE</Text>
        <Text style={styles.score}>{score.toLocaleString()}</Text>
        <Text style={styles.body}>
          {session?.opponentDisplayName ?? 'Your opponent'} will receive the same deck and
          rules.
        </Text>
        <Text style={styles.meta}>
          Exact 21s: {exact21} · Five-Card: {fiveCard} · Busts: {busts} · Cards: {cardsPlayed}
        </Text>
        <BlazeButton
          title="BACK TO DUELS"
          onPress={() => {
            clearAsyncDuelMode();
            void refreshHub();
            navigation.navigate('AsyncDuelHub');
          }}
          fullWidth
        />
        <BlazeButton
          title="HOME"
          variant="secondary"
          onPress={() => {
            clearAsyncDuelMode();
            navigation.navigate('Home');
          }}
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
    alignItems: 'center',
  },
  kicker: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1.4,
    color: colors.textSecondary,
  },
  score: {
    fontFamily: fontFamilies.display,
    fontSize: 52,
    color: colors.textPrimary,
  },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  meta: { ...typography.label, color: colors.textSecondary, textTransform: 'none' },
});
