import { useEffect, useState } from 'react';
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
import { useDuelNotificationStore } from '../store/useDuelNotificationStore';
import { useGameStore } from '../store/useGameStore';
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
  const loadSeriesSummary = useDuelNotificationStore((s) => s.loadSeriesSummary);
  const seriesSummary = useDuelNotificationStore((s) => s.seriesSummary);
  const startRematch = useDuelNotificationStore((s) => s.startRematch);
  const rematchStatus = useDuelNotificationStore((s) => s.rematchStatus);
  const rematchError = useDuelNotificationStore((s) => s.errorMessage);
  const prepareAsyncDuelGame = useGameStore((s) => s.prepareAsyncDuelGame);
  const [confirmRematch, setConfirmRematch] = useState(false);

  useEffect(() => {
    void loadDetails(duelId);
    void loadResult(duelId);
    void loadSeriesSummary(duelId);
  }, [duelId, loadDetails, loadResult, loadSeriesSummary]);

  const challenger = selectedDetails?.challenger as
    | { userId?: string; displayName?: string }
    | undefined;
  const opponent = selectedDetails?.opponent as
    | { userId?: string; displayName?: string }
    | undefined;
  const role: AsyncDuelParticipantRole =
    challenger?.userId === userId ? 'challenger' : 'opponent';
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
          <BlazeButton
            title="BACK TO DUELS"
            onPress={() => navigation.navigate('AsyncDuelHub')}
            fullWidth
          />
        </View>
      </ScreenContainer>
    );
  }

  if (lastCompletion?.status === 'awaiting_opponent' || lastCompletion?.settled === false) {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <View style={styles.inner}>
          <ScreenHeader title="CHALLENGE SENT" />
          <Text style={styles.kicker}>YOUR SCORE</Text>
          <Text style={styles.score}>
            {(yourScore ?? lastCompletion.score ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.body}>
            {themName} will receive the same deck and rules.
          </Text>
          <BlazeButton
            title="BACK TO DUELS"
            onPress={() => navigation.navigate('AsyncDuelHub')}
            fullWidth
          />
        </View>
      </ScreenContainer>
    );
  }

  const h2h = seriesSummary?.headToHead;
  const rematchPending = rematchStatus === 'pending';

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.inner}>
        <ScreenHeader title="DUEL RESULT" />
        {seriesSummary && seriesSummary.rematchIndex > 1 ? (
          <Text style={styles.series}>REMATCH {seriesSummary.rematchIndex - 1}</Text>
        ) : null}
        <Text
          style={styles.title}
          accessibilityRole="header"
          accessibilityLabel={asyncDuelPerspectiveTitle(perspective)}
        >
          {asyncDuelPerspectiveTitle(perspective)}
        </Text>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>YOU</Text>
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
        {h2h && h2h.completedDuels > 0 ? (
          <Text
            style={styles.series}
            accessibilityLabel={`Series. You ${h2h.yourWins}, ${themName} ${h2h.theirWins}, ties ${h2h.ties}`}
          >
            SERIES · You {h2h.yourWins} – {h2h.theirWins} {themName}
            {h2h.ties > 0 ? ` · Ties ${h2h.ties}` : ''}
          </Text>
        ) : null}

        {!confirmRematch ? (
          <BlazeButton title="PLAY REMATCH" onPress={() => setConfirmRematch(true)} fullWidth />
        ) : (
          <>
            <Text style={styles.body}>
              REMATCH {themName.toUpperCase()}? A new duel will begin now. New deck. Same
              competitive rules. You play first.
            </Text>
            {rematchError ? (
              <Text style={styles.error}>{mapAsyncDuelErrorMessage(rematchError)}</Text>
            ) : null}
            <BlazeButton
              title={rematchPending ? 'STARTING…' : 'START REMATCH'}
              disabled={rematchPending}
              loading={rematchPending}
              onPress={() => {
                void (async () => {
                  const session = await startRematch(duelId);
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
              disabled={rematchPending}
              onPress={() => setConfirmRematch(false)}
              fullWidth
            />
          </>
        )}

        <BlazeButton
          title="CONTINUE"
          onPress={() => navigation.navigate('AsyncDuelHub')}
          fullWidth
        />
        <BlazeButton
          title="HOME"
          variant="secondary"
          onPress={() => navigation.navigate('Home')}
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
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 40,
    color: colors.gold,
    textAlign: 'center',
  },
  series: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.textSecondary,
    letterSpacing: 1,
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
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
    width: '100%',
    justifyContent: 'space-around',
  },
  col: { alignItems: 'center', flex: 1 },
  label: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.textSecondary,
    fontSize: 12,
  },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  error: { ...typography.body, color: '#FF8A80', textAlign: 'center' },
});
