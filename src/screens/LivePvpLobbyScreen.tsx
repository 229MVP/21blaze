import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { livePvpMatchCoordinator } from '../livePvp/livePvpCoordinator';
import { mapLivePvpErrorMessage } from '../livePvp/livePvpErrorMap';
import {
  livePvpMyReady,
  livePvpOpponentReady,
  livePvpOtherPlayer,
  livePvpStatusLabel,
} from '../livePvp/livePvpPresentation';
import type { LivePvpSession } from '../livePvp/livePvpSession';
import type { LivePvpLobbyScreenProps } from '../navigation/navigationTypes';
import { useGameStore } from '../store/useGameStore';
import { useLivePvpStore } from '../store/useLivePvpStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';
import { trackEvent } from '../monetization/analytics';

function connectionLabel(
  state: string,
  opponentConnected: boolean | null,
  isSelf: boolean,
): string {
  if (isSelf) {
    switch (state) {
      case 'subscribed':
        return 'CONNECTED';
      case 'connecting':
      case 'reconnecting':
        return 'CONNECTING…';
      case 'timed_out':
      case 'channel_error':
        return 'CONNECTION ISSUE';
      case 'closed':
        return 'DISCONNECTED';
      default:
        return 'IDLE';
    }
  }
  if (opponentConnected === true) {
    return 'CONNECTED';
  }
  if (opponentConnected === false) {
    return 'CONNECTING…';
  }
  return '—';
}

function countdownDisplay(
  scheduledStartAt: string | null,
  serverNowMs: number,
): { phase: 'waiting' | 'counting' | 'go' | 'late'; value: string } {
  if (!scheduledStartAt) {
    return { phase: 'waiting', value: '' };
  }
  const start = Date.parse(scheduledStartAt);
  const remaining = start - serverNowMs;
  if (remaining > 3000) {
    return { phase: 'waiting', value: '' };
  }
  if (remaining > 2000) {
    return { phase: 'counting', value: '3' };
  }
  if (remaining > 1000) {
    return { phase: 'counting', value: '2' };
  }
  if (remaining > 0) {
    return { phase: 'counting', value: '1' };
  }
  if (remaining > -800) {
    return { phase: 'go', value: 'BLAZE!' };
  }
  return { phase: 'late', value: '' };
}

function buildSessionFromSnapshot(
  snapshot: NonNullable<ReturnType<typeof useLivePvpStore.getState>['snapshot']>,
): LivePvpSession | null {
  if (!snapshot.seed || !snapshot.myAttempt?.attemptId) {
    return null;
  }
  if (
    !snapshot.scheduledStartAt ||
    !snapshot.gameplayDeadlineAt ||
    !snapshot.submissionGraceUntil
  ) {
    return null;
  }
  return {
    matchId: snapshot.matchId,
    attemptId: snapshot.myAttempt.attemptId,
    participantRole: snapshot.participantRole,
    authoritativeSeed: snapshot.seed,
    rulesVersion: snapshot.rulesVersion ?? 'v1',
    deckVersion: snapshot.deckVersion ?? 'v1',
    durationSeconds: snapshot.durationSeconds ?? 120,
    bustLimit: snapshot.bustLimit ?? 3,
    scheduledStartAt: snapshot.scheduledStartAt,
    gameplayDeadlineAt: snapshot.gameplayDeadlineAt,
    submissionGraceUntil: snapshot.submissionGraceUntil,
    protocolVersion: String(snapshot.protocolVersion),
    opponentDisplayName: livePvpOtherPlayer(snapshot).displayName,
    serverStartTime: snapshot.scheduledStartAt,
  };
}

export function LivePvpLobbyScreen({ navigation, route }: LivePvpLobbyScreenProps) {
  const matchId = route.params.matchId;
  const snapshot = useLivePvpStore((s) => s.snapshot);
  const connectionState = useLivePvpStore((s) => s.connectionState);
  const opponentPresenceConnected = useLivePvpStore((s) => s.opponentPresenceConnected);
  const errorMessage = useLivePvpStore((s) => s.errorMessage);
  const mutationStatus = useLivePvpStore((s) => s.mutationStatus);
  const joinMatchChannel = useLivePvpStore((s) => s.joinMatchChannel);
  const setReady = useLivePvpStore((s) => s.setReady);
  const refreshSnapshot = useLivePvpStore((s) => s.refreshSnapshot);
  const prepareLivePvpGame = useGameStore((s) => s.prepareLivePvpGame);
  const [tick, setTick] = useState(0);
  const startedRef = useRef(false);
  const busy = mutationStatus === 'pending';

  useEffect(() => {
    void joinMatchChannel(matchId);
  }, [joinMatchChannel, matchId]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, []);

  const serverNowMs = livePvpMatchCoordinator.estimatedServerNowMs();
  const cd = useMemo(
    () => countdownDisplay(snapshot?.scheduledStartAt ?? null, serverNowMs),
    // tick forces recompute against monotonic clock
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot?.scheduledStartAt, serverNowMs, tick],
  );

  useEffect(() => {
    if (!snapshot || snapshot.matchId !== matchId || startedRef.current) {
      return;
    }
    if (snapshot.status === 'completed' || snapshot.status === 'invalid') {
      navigation.replace('LivePvpResult', { matchId });
      return;
    }

    const startMs = snapshot.scheduledStartAt
      ? Date.parse(snapshot.scheduledStartAt)
      : NaN;
    const shouldEnterGame =
      snapshot.status === 'active' ||
      ((snapshot.status === 'countdown' || cd.phase === 'late' || cd.phase === 'go') &&
        Number.isFinite(startMs) &&
        serverNowMs >= startMs);

    if (!shouldEnterGame) {
      return;
    }

    const session = buildSessionFromSnapshot(snapshot);
    if (!session) {
      return;
    }

    startedRef.current = true;
    trackEvent('live_match_started');
    void (async () => {
      await prepareLivePvpGame(session);
      navigation.replace('Game');
    })();
  }, [cd.phase, matchId, navigation, prepareLivePvpGame, serverNowMs, snapshot]);

  const myReady = snapshot ? livePvpMyReady(snapshot) : false;
  const oppReady = snapshot ? livePvpOpponentReady(snapshot) : false;
  const canReady =
    connectionState === 'subscribed' &&
    !!snapshot &&
    snapshot.matchId === matchId &&
    snapshot.status === 'lobby' &&
    !myReady &&
    !busy;

  const onReady = useCallback(async () => {
    if (!canReady) {
      return;
    }
    await setReady(matchId);
  }, [canReady, matchId, setReady]);

  const opponentName =
    snapshot && snapshot.matchId === matchId
      ? livePvpOtherPlayer(snapshot).displayName
      : 'Opponent';

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      {(cd.phase === 'counting' || cd.phase === 'go') && (
        <View style={styles.countdownOverlay} accessibilityLiveRegion="polite">
          <Text style={styles.countdownKicker}>MATCH STARTING</Text>
          <Text style={styles.countdownValue}>{cd.value}</Text>
        </View>
      )}
      <View style={styles.inner}>
        <ScreenHeader title="LIVE PVP" />
        {!snapshot || snapshot.matchId !== matchId ? (
          <ActivityIndicator color={colors.gold} />
        ) : (
          <>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.youLabel}>YOU</Text>
                <Text style={styles.conn}>
                  {connectionLabel(connectionState, null, true)}
                </Text>
                <Text
                  style={[styles.ready, myReady && styles.readyOn]}
                  accessibilityLabel={myReady ? 'Ready' : 'Not ready'}
                >
                  {myReady ? 'READY' : 'NOT READY'}
                </Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.oppLabel} numberOfLines={1}>
                  {opponentName.toUpperCase()}
                </Text>
                <Text style={styles.conn}>
                  {connectionLabel(connectionState, opponentPresenceConnected, false)}
                </Text>
                <Text
                  style={[styles.ready, oppReady && styles.readyOn]}
                  accessibilityLabel={oppReady ? 'Opponent ready' : 'Opponent not ready'}
                >
                  {oppReady ? 'READY' : 'NOT READY'}
                </Text>
              </View>
            </View>

            <Text style={styles.body}>
              The match begins automatically when both players are ready.
            </Text>
            <Text style={styles.meta}>{livePvpStatusLabel(snapshot.status)}</Text>
            {errorMessage ? (
              <Text style={styles.error}>{mapLivePvpErrorMessage(errorMessage)}</Text>
            ) : null}

            {canReady || busy ? (
              <BlazeButton
                title={busy ? 'SUBMITTING…' : 'READY'}
                disabled={!canReady || busy}
                loading={busy}
                onPress={() => void onReady()}
                fullWidth
                accessibilityLabel="Ready"
              />
            ) : myReady && !oppReady ? (
              <Text style={styles.body}>Waiting for {opponentName}…</Text>
            ) : null}

            {(connectionState === 'timed_out' || connectionState === 'channel_error') && (
              <BlazeButton
                title="RETRY CONNECTION"
                variant="secondary"
                onPress={() => void joinMatchChannel(matchId)}
                fullWidth
                accessibilityLabel="Retry connection"
              />
            )}

            <Pressable onPress={() => void refreshSnapshot(matchId)} accessibilityRole="button">
              <Text style={styles.refresh}>Refresh</Text>
            </Pressable>
            <BlazeButton
              title="HUB"
              variant="secondary"
              onPress={() => navigation.navigate('LivePvpHub')}
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
  },
  row: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  youLabel: {
    fontFamily: fontFamilies.display,
    fontSize: 20,
    color: colors.primary,
    letterSpacing: 1,
  },
  oppLabel: {
    fontFamily: fontFamilies.display,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  conn: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  ready: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.8,
  },
  readyOn: { color: colors.success },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  meta: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  error: { ...typography.body, color: '#FF8A80', textAlign: 'center' },
  refresh: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontFamily: fontFamilies.bodySemi,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  countdownKicker: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 14,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  countdownValue: {
    marginTop: spacing.md,
    fontFamily: fontFamilies.display,
    fontSize: 72,
    color: colors.primary,
  },
});
