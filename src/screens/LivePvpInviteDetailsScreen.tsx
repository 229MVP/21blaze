import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { mapLivePvpErrorMessage } from '../livePvp/livePvpErrorMap';
import { livePvpOtherPlayer } from '../livePvp/livePvpPresentation';
import type { LivePvpInviteDetailsScreenProps } from '../navigation/navigationTypes';
import { useLivePvpStore } from '../store/useLivePvpStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function formatExpires(iso: string, now: number): string {
  const ms = Date.parse(iso) - now;
  if (!Number.isFinite(ms) || ms <= 0) {
    return 'Expired';
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function LivePvpInviteDetailsScreen({
  navigation,
  route,
}: LivePvpInviteDetailsScreenProps) {
  const matchId = route.params.matchId;
  const snapshot = useLivePvpStore((s) => s.snapshot);
  const errorMessage = useLivePvpStore((s) => s.errorMessage);
  const mutationStatus = useLivePvpStore((s) => s.mutationStatus);
  const refreshSnapshot = useLivePvpStore((s) => s.refreshSnapshot);
  const acceptInvite = useLivePvpStore((s) => s.acceptInvite);
  const declineInvite = useLivePvpStore((s) => s.declineInvite);
  const joinMatchChannel = useLivePvpStore((s) => s.joinMatchChannel);
  const leaveMatchChannel = useLivePvpStore((s) => s.leaveMatchChannel);
  const [action, setAction] = useState<'accept' | 'decline' | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void refreshSnapshot(matchId);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [matchId, refreshSnapshot]);

  useEffect(() => {
    if (!snapshot || snapshot.matchId !== matchId) {
      return;
    }
    if (
      snapshot.status === 'lobby' ||
      snapshot.status === 'countdown' ||
      snapshot.status === 'active' ||
      snapshot.status === 'settling'
    ) {
      void joinMatchChannel(matchId);
      navigation.replace('LivePvpLobby', { matchId });
      return;
    }
    if (snapshot.status === 'completed') {
      navigation.replace('LivePvpResult', { matchId });
    }
  }, [joinMatchChannel, matchId, navigation, snapshot]);

  const canRespond =
    snapshot?.matchId === matchId &&
    snapshot.status === 'invited' &&
    mutationStatus !== 'pending' &&
    action == null;

  const onAccept = useCallback(async () => {
    if (!canRespond) {
      return;
    }
    setAction('accept');
    try {
      const accepted = await acceptInvite(matchId);
      if (!accepted) {
        await refreshSnapshot(matchId);
        return;
      }
      await joinMatchChannel(matchId);
      navigation.replace('LivePvpLobby', { matchId });
    } finally {
      setAction(null);
    }
  }, [acceptInvite, canRespond, joinMatchChannel, matchId, navigation, refreshSnapshot]);

  const onDecline = useCallback(async () => {
    if (!canRespond) {
      return;
    }
    setAction('decline');
    try {
      const ok = await declineInvite(matchId);
      if (ok) {
        await leaveMatchChannel();
        navigation.replace('LivePvpHub');
      }
    } finally {
      setAction(null);
    }
  }, [canRespond, declineInvite, leaveMatchChannel, matchId, navigation]);

  const challengerName =
    snapshot && snapshot.matchId === matchId
      ? livePvpOtherPlayer(snapshot).displayName
      : 'Opponent';
  const expiresLabel = useMemo(() => {
    if (!snapshot?.expiresAt || snapshot.matchId !== matchId) {
      return null;
    }
    return formatExpires(snapshot.expiresAt, now);
  }, [matchId, now, snapshot]);
  const terminal =
    snapshot &&
    snapshot.matchId === matchId &&
    (snapshot.status === 'declined' ||
      snapshot.status === 'cancelled' ||
      snapshot.status === 'expired' ||
      snapshot.status === 'invalid');

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.inner}>
        <ScreenHeader title="LIVE CHALLENGE" />
        {!snapshot || snapshot.matchId !== matchId ? (
          <ActivityIndicator color={colors.gold} />
        ) : (
          <>
            <Text style={styles.title}>
              {challengerName} is ready to go head-to-head.
            </Text>
            <Text style={styles.body}>Same deck.</Text>
            <Text style={styles.body}>Same timer.</Text>
            <Text style={styles.body}>Live scores.</Text>
            {expiresLabel && snapshot.status === 'invited' ? (
              <Text style={styles.meta}>Invitation expires in {expiresLabel}</Text>
            ) : null}
            {terminal ? (
              <Text style={styles.meta}>
                This invitation is no longer available ({snapshot.status}).
              </Text>
            ) : null}
            {errorMessage ? (
              <Text style={styles.error}>{mapLivePvpErrorMessage(errorMessage)}</Text>
            ) : null}
            {canRespond || action ? (
              <>
                <BlazeButton
                  title={action === 'accept' ? 'ACCEPTING…' : 'ACCEPT'}
                  disabled={!!action || mutationStatus === 'pending'}
                  loading={action === 'accept'}
                  onPress={() => void onAccept()}
                  fullWidth
                  accessibilityLabel="Accept live challenge"
                />
                <BlazeButton
                  title={action === 'decline' ? 'DECLINING…' : 'DECLINE'}
                  variant="secondary"
                  disabled={!!action || mutationStatus === 'pending'}
                  loading={action === 'decline'}
                  onPress={() => void onDecline()}
                  fullWidth
                  accessibilityLabel="Decline live challenge"
                />
              </>
            ) : (
              <BlazeButton
                title="BACK TO HUB"
                variant="secondary"
                onPress={() => navigation.replace('LivePvpHub')}
                fullWidth
              />
            )}
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
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 26,
    color: colors.gold,
    textAlign: 'center',
  },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  meta: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  error: { ...typography.body, color: '#FF8A80', textAlign: 'center' },
});
