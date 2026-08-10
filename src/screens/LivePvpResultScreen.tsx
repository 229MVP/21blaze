import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { mapLivePvpErrorMessage } from '../livePvp/livePvpErrorMap';
import {
  livePvpOtherPlayer,
  livePvpStatusLabel,
  presentLiveMatchResult,
} from '../livePvp/livePvpPresentation';
import { trackEvent } from '../monetization/analytics';
import type { LivePvpResultScreenProps } from '../navigation/navigationTypes';
import { useLivePvpStore } from '../store/useLivePvpStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

export function LivePvpResultScreen({ navigation, route }: LivePvpResultScreenProps) {
  const matchId = route.params.matchId;
  const snapshot = useLivePvpStore((s) => s.snapshot);
  const errorMessage = useLivePvpStore((s) => s.errorMessage);
  const refreshSnapshot = useLivePvpStore((s) => s.refreshSnapshot);
  const leaveMatchChannel = useLivePvpStore((s) => s.leaveMatchChannel);
  const joinMatchChannel = useLivePvpStore((s) => s.joinMatchChannel);

  useEffect(() => {
    void refreshSnapshot(matchId);
    void joinMatchChannel(matchId);
    return () => {
      void leaveMatchChannel();
    };
  }, [joinMatchChannel, leaveMatchChannel, matchId, refreshSnapshot]);

  useEffect(() => {
    if (snapshot?.matchId === matchId && snapshot.status === 'completed') {
      trackEvent('live_result_viewed');
    }
  }, [matchId, snapshot]);

  const presented =
    snapshot && snapshot.matchId === matchId ? presentLiveMatchResult(snapshot) : null;
  const waiting =
    snapshot &&
    snapshot.matchId === matchId &&
    (snapshot.status === 'active' || snapshot.status === 'settling') &&
    snapshot.myAttempt?.status === 'completed';
  const opponentName =
    snapshot && snapshot.matchId === matchId
      ? livePvpOtherPlayer(snapshot).displayName
      : 'Opponent';

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.inner}>
        <ScreenHeader title="LIVE RESULT" />
        {!snapshot || snapshot.matchId !== matchId ? (
          <ActivityIndicator color={colors.gold} />
        ) : waiting ? (
          <>
            <Text style={styles.kicker}>FINISHED</Text>
            <Text style={styles.body}>Your Score</Text>
            <Text style={styles.score}>
              {(snapshot.myAttempt?.score ?? presented?.myScore ?? 0).toLocaleString()}
            </Text>
            <Text style={styles.body}>Waiting for {opponentName}…</Text>
            <Text style={styles.meta}>
              Opponent Score{'\n'}
              {(presented?.opponentScore ?? 0).toLocaleString()} — LIVE
            </Text>
            {snapshot.gameplayDeadlineAt ? (
              <Text style={styles.meta}>
                Deadline {new Date(snapshot.gameplayDeadlineAt).toLocaleTimeString()}
              </Text>
            ) : null}
            <BlazeButton
              title="RETURN TO HUB"
              variant="secondary"
              onPress={() => navigation.replace('LivePvpHub')}
              fullWidth
            />
          </>
        ) : presented && presented.perspective !== 'pending' ? (
          <>
            <Text
              style={[
                styles.outcome,
                presented.perspective === 'victory' && styles.victory,
                presented.perspective === 'defeat' && styles.defeat,
              ]}
              accessibilityRole="header"
              accessibilityLabel={`${presented.headline}. ${presented.subline ?? ''}`}
            >
              {presented.headline}
            </Text>
            {presented.subline ? <Text style={styles.body}>{presented.subline}</Text> : null}
            <View style={styles.scoreRow}>
              <View style={styles.scoreCol}>
                <Text style={styles.who}>YOU</Text>
                <Text style={styles.score}>
                  {(presented.myScore ?? 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.scoreCol}>
                <Text style={styles.who} numberOfLines={1}>
                  {opponentName.toUpperCase()}
                </Text>
                <Text style={styles.score}>
                  {(presented.opponentScore ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>
            <BlazeButton
              title="DONE"
              onPress={() => navigation.replace('LivePvpHub')}
              fullWidth
            />
          </>
        ) : (
          <>
            <Text style={styles.kicker}>{livePvpStatusLabel(snapshot.status)}</Text>
            {errorMessage ? (
              <Text style={styles.error}>{mapLivePvpErrorMessage(errorMessage)}</Text>
            ) : null}
            <Text style={styles.body}>
              {snapshot.status === 'invited' ||
              snapshot.status === 'declined' ||
              snapshot.status === 'cancelled' ||
              snapshot.status === 'expired'
                ? 'This challenge is no longer active.'
                : 'Match state updated.'}
            </Text>
            <BlazeButton
              title="BACK TO HUB"
              variant="secondary"
              onPress={() => navigation.replace('LivePvpHub')}
              fullWidth
            />
          </>
        )}
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
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.gold,
    letterSpacing: 1,
    textAlign: 'center',
  },
  outcome: {
    fontFamily: fontFamilies.display,
    fontSize: 36,
    color: colors.textPrimary,
    letterSpacing: 2,
    textAlign: 'center',
  },
  victory: { color: colors.primary },
  defeat: { color: colors.textSecondary },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  meta: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 13,
  },
  scoreRow: { flexDirection: 'row', width: '100%', gap: spacing.md },
  scoreCol: { flex: 1, alignItems: 'center' },
  who: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  score: {
    fontFamily: fontFamilies.display,
    fontSize: 32,
    color: colors.textPrimary,
  },
  error: { ...typography.body, color: '#FF8A80', textAlign: 'center' },
});
