import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { mapAsyncDuelErrorMessage } from '../asyncDuel/asyncDuelErrorMap';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { AsyncDuelChallengeDetailsScreenProps } from '../navigation/navigationTypes';
import { useAsyncDuelStore } from '../store/useAsyncDuelStore';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function formatCountdown(iso: string, nowMs: number): string {
  const ms = Date.parse(iso) - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) {
    return '00:00:00';
  }
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function AsyncDuelChallengeDetailsScreen({
  navigation,
  route,
}: AsyncDuelChallengeDetailsScreenProps) {
  const { duelId } = route.params;
  const userId = useAuthStore((s) => s.user?.id);
  const loadDetails = useAsyncDuelStore((s) => s.loadDetails);
  const acceptChallenge = useAsyncDuelStore((s) => s.acceptChallenge);
  const declineChallenge = useAsyncDuelStore((s) => s.declineChallenge);
  const cancelChallenge = useAsyncDuelStore((s) => s.cancelChallenge);
  const acceptStatus = useAsyncDuelStore((s) => s.acceptStatus);
  const declineStatus = useAsyncDuelStore((s) => s.declineStatus);
  const cancelStatus = useAsyncDuelStore((s) => s.cancelStatus);
  const errorMessage = useAsyncDuelStore((s) => s.errorMessage);
  const prepareAsyncDuelGame = useGameStore((s) => s.prepareAsyncDuelGame);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [confirmDecline, setConfirmDecline] = useState(false);

  useEffect(() => {
    void loadDetails(duelId).then(setDetails);
  }, [duelId, loadDetails]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!details) {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <View style={styles.inner}>
          <ScreenHeader title="ASYNC DUEL" />
          {errorMessage ? (
            <Text style={styles.error}>{mapAsyncDuelErrorMessage(errorMessage)}</Text>
          ) : (
            <ActivityIndicator color={colors.gold} />
          )}
          <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
        </View>
      </ScreenContainer>
    );
  }

  const status = String(details.status);
  const challenger = details.challenger as { displayName?: string; userId?: string } | undefined;
  const opponent = details.opponent as { displayName?: string; userId?: string } | undefined;
  const isOpponent = opponent?.userId === userId;
  const isChallenger = challenger?.userId === userId;
  const otherName = isOpponent
    ? challenger?.displayName ?? 'Opponent'
    : opponent?.displayName ?? 'Opponent';
  const expiresAt = String(details.expiresAt ?? '');
  const challengerScore =
    details.challengerScore != null ? Number(details.challengerScore) : null;
  const durationSeconds = Number(details.durationSeconds ?? 120);
  const bustLimit = Number(details.bustLimit ?? 3);

  if (status === 'completed') {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <View style={styles.inner}>
          <ScreenHeader title="ASYNC DUEL" />
          <Text style={styles.body}>This duel is complete.</Text>
          <BlazeButton
            title="VIEW RESULT"
            onPress={() => navigation.replace('AsyncDuelResult', { duelId })}
            fullWidth
          />
          <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
        </View>
      </ScreenContainer>
    );
  }

  if (status === 'expired' || status === 'declined' || status === 'cancelled' || status === 'invalid') {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <View style={styles.inner}>
          <ScreenHeader title="ASYNC DUEL" />
          <Text style={styles.title}>{status.toUpperCase()}</Text>
          <Text style={styles.body}>
            {status === 'expired'
              ? 'This challenge has expired. No rewards or statistics were changed.'
              : 'This challenge is no longer available.'}
          </Text>
          <BlazeButton title="BACK TO DUELS" onPress={() => navigation.navigate('AsyncDuelHub')} fullWidth />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.inner}>
        <ScreenHeader title="ASYNC DUEL" />
        {isOpponent && status === 'awaiting_opponent' ? (
          <>
            <Text style={styles.title}>{otherName} challenged you.</Text>
            {challengerScore != null ? (
              <Text style={styles.scoreLabel}>SCORE TO BEAT</Text>
            ) : null}
            {challengerScore != null ? (
              <Text style={styles.score}>{challengerScore.toLocaleString()}</Text>
            ) : null}
            <Text style={styles.body}>Same deck. Same timer. Same rules.</Text>
            <Text style={styles.meta}>
              Duration: {Math.floor(durationSeconds / 60)}:
              {String(durationSeconds % 60).padStart(2, '0')} · Bust limit: {bustLimit}
            </Text>
            <Text style={styles.meta}>Expires in: {formatCountdown(expiresAt, nowMs)}</Text>
            {errorMessage ? (
              <Text style={styles.error}>{mapAsyncDuelErrorMessage(errorMessage)}</Text>
            ) : null}
            <BlazeButton
              title={acceptStatus === 'pending' ? 'STARTING…' : 'ACCEPT & PLAY'}
              disabled={acceptStatus === 'pending'}
              loading={acceptStatus === 'pending'}
              onPress={() => {
                void (async () => {
                  const session = await acceptChallenge({
                    duelId,
                    opponentDisplayName: otherName,
                    targetScore: challengerScore,
                  });
                  if (!session) {
                    // Refresh authoritative state near expiration races
                    const refreshed = await loadDetails(duelId);
                    setDetails(refreshed);
                    return;
                  }
                  await prepareAsyncDuelGame(session);
                  navigation.replace('Game');
                })();
              }}
              fullWidth
            />
            {!confirmDecline ? (
              <BlazeButton
                title="DECLINE"
                variant="secondary"
                disabled={declineStatus === 'pending'}
                onPress={() => setConfirmDecline(true)}
                fullWidth
              />
            ) : (
              <>
                <Text style={styles.body}>Decline challenge? It will leave your inbox.</Text>
                <BlazeButton
                  title={declineStatus === 'pending' ? 'DECLINING…' : 'CONFIRM DECLINE'}
                  disabled={declineStatus === 'pending'}
                  onPress={() => {
                    void (async () => {
                      const ok = await declineChallenge(duelId);
                      if (ok) {
                        navigation.navigate('AsyncDuelHub');
                      }
                    })();
                  }}
                  fullWidth
                />
                <BlazeButton title="KEEP" variant="secondary" onPress={() => setConfirmDecline(false)} fullWidth />
              </>
            )}
          </>
        ) : (
          <>
            <Text style={styles.title}>vs {otherName}</Text>
            <Text style={styles.meta}>Status: {status}</Text>
            {challengerScore != null ? (
              <Text style={styles.body}>Your score: {challengerScore.toLocaleString()}</Text>
            ) : (
              <Text style={styles.body}>Finish your run to send this challenge.</Text>
            )}
            <Text style={styles.meta}>Expires in: {formatCountdown(expiresAt, nowMs)}</Text>
            {isChallenger && status === 'challenger_playing' ? (
              <BlazeButton
                title={cancelStatus === 'pending' ? 'CANCELLING…' : 'CANCEL CHALLENGE'}
                variant="secondary"
                disabled={cancelStatus === 'pending'}
                onPress={() => {
                  void (async () => {
                    const ok = await cancelChallenge(duelId);
                    if (ok) {
                      navigation.navigate('AsyncDuelHub');
                    }
                  })();
                }}
                fullWidth
              />
            ) : null}
            {status === 'awaiting_opponent' && isChallenger ? (
              <Text style={styles.body}>Waiting for opponent…</Text>
            ) : null}
          </>
        )}
        <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
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
    fontSize: 26,
    color: colors.gold,
    textAlign: 'center',
  },
  scoreLabel: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1.2,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  score: {
    fontFamily: fontFamilies.display,
    fontSize: 44,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  meta: { ...typography.label, color: colors.textSecondary, textAlign: 'center', textTransform: 'none' },
  error: { ...typography.body, color: '#FF8A80', textAlign: 'center' },
});
