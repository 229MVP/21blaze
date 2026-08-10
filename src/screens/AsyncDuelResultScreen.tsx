import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { mapAsyncDuelErrorMessage } from '../asyncDuel/asyncDuelErrorMap';
import {
  asyncDuelDecidingLabel,
  asyncDuelPerspective,
  asyncDuelPerspectiveTitle,
} from '../asyncDuel/asyncDuelPresentation';
import type { AsyncDuelParticipantRole } from '../asyncDuel/asyncDuelTypes';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { AsyncDuelResultScreenProps } from '../navigation/navigationTypes';
import { useAsyncDuelStore } from '../store/useAsyncDuelStore';
import { useAuthStore } from '../store/useAuthStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

export function AsyncDuelResultScreen({ navigation, route }: AsyncDuelResultScreenProps) {
  const { duelId } = route.params;
  const userId = useAuthStore((s) => s.user?.id);
  const loadResult = useAsyncDuelStore((s) => s.loadResult);
  const loadDetails = useAsyncDuelStore((s) => s.loadDetails);
  const lastCompletion = useAsyncDuelStore((s) => s.lastCompletion);
  const selectedDetails = useAsyncDuelStore((s) => s.selectedDetails);
  const errorMessage = useAsyncDuelStore((s) => s.errorMessage);

  useEffect(() => {
    void loadDetails(duelId);
    void loadResult(duelId);
  }, [duelId, loadDetails, loadResult]);

  const challenger = selectedDetails?.challenger as { userId?: string; displayName?: string } | undefined;
  const opponent = selectedDetails?.opponent as { userId?: string; displayName?: string } | undefined;
  const role: AsyncDuelParticipantRole =
    challenger?.userId === userId ? 'challenger' : 'opponent';
  const youName = 'YOU';
  const themName =
    role === 'challenger'
      ? opponent?.displayName ?? 'Opponent'
      : challenger?.displayName ?? 'Opponent';

  const outcome = lastCompletion?.outcome ?? null;
  const perspective = asyncDuelPerspective(outcome, role);
  const yourScore =
    role === 'challenger'
      ? lastCompletion?.challengerResult?.score
      : lastCompletion?.opponentResult?.score;
  const theirScore =
    role === 'challenger'
      ? lastCompletion?.opponentResult?.score
      : lastCompletion?.challengerResult?.score;

  if (!lastCompletion && !errorMessage) {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <View style={styles.inner}>
          <ScreenHeader title="DUEL RESULT" />
          <ActivityIndicator color={colors.gold} />
        </View>
      </ScreenContainer>
    );
  }

  if (errorMessage && !lastCompletion) {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <View style={styles.inner}>
          <ScreenHeader title="DUEL RESULT" />
          <Text style={styles.error}>{mapAsyncDuelErrorMessage(errorMessage)}</Text>
          <BlazeButton title="BACK TO DUELS" onPress={() => navigation.navigate('AsyncDuelHub')} fullWidth />
        </View>
      </ScreenContainer>
    );
  }

  // Challenger finished but not settled yet
  if (lastCompletion?.status === 'awaiting_opponent' || lastCompletion?.settled === false) {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <View style={styles.inner}>
          <ScreenHeader title="CHALLENGE SENT" />
          <Text style={styles.kicker}>YOUR SCORE</Text>
          <Text style={styles.score}>{(yourScore ?? lastCompletion.score ?? 0).toLocaleString()}</Text>
          <Text style={styles.body}>
            {themName} will receive the same deck and rules.
          </Text>
          <BlazeButton title="BACK TO DUELS" onPress={() => navigation.navigate('AsyncDuelHub')} fullWidth />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.inner}>
        <ScreenHeader title="DUEL RESULT" />
        <Text
          style={styles.title}
          accessibilityRole="header"
          accessibilityLabel={asyncDuelPerspectiveTitle(perspective)}
        >
          {asyncDuelPerspectiveTitle(perspective)}
        </Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>{youName}</Text>
            <Text style={styles.scoreSmall}>{(yourScore ?? 0).toLocaleString()}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>{themName.toUpperCase()}</Text>
            <Text style={styles.scoreSmall}>{(theirScore ?? 0).toLocaleString()}</Text>
          </View>
        </View>
        <Text style={styles.body}>
          {perspective === 'victory'
            ? `Won by ${asyncDuelDecidingLabel(lastCompletion?.decidingField).toLowerCase()}`
            : perspective === 'defeat'
              ? `Lost by ${asyncDuelDecidingLabel(lastCompletion?.decidingField).toLowerCase()}`
              : asyncDuelDecidingLabel(lastCompletion?.decidingField)}
        </Text>
        <BlazeButton title="CONTINUE" onPress={() => navigation.navigate('AsyncDuelHub')} fullWidth />
        <BlazeButton title="HOME" variant="secondary" onPress={() => navigation.navigate('Home')} fullWidth />
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
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 40,
    color: colors.gold,
    textAlign: 'center',
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
  scoreSmall: {
    fontFamily: fontFamilies.display,
    fontSize: 36,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', gap: spacing.lg, width: '100%', justifyContent: 'space-around' },
  col: { alignItems: 'center', flex: 1 },
  label: { fontFamily: fontFamilies.bodyBold, color: colors.textSecondary, fontSize: 12 },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  error: { ...typography.body, color: '#FF8A80', textAlign: 'center' },
});
