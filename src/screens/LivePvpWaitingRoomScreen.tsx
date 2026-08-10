import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { mapLivePvpErrorMessage } from '../livePvp/livePvpErrorMap';
import {
  livePvpOtherPlayer,
  livePvpStatusLabel,
} from '../livePvp/livePvpPresentation';
import type { LivePvpWaitingRoomScreenProps } from '../navigation/navigationTypes';
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

export function LivePvpWaitingRoomScreen({
  navigation,
  route,
}: LivePvpWaitingRoomScreenProps) {
  const matchId = route.params.matchId;
  const snapshot = useLivePvpStore((s) => s.snapshot);
  const errorMessage = useLivePvpStore((s) => s.errorMessage);
  const mutationStatus = useLivePvpStore((s) => s.mutationStatus);
  const joinMatchChannel = useLivePvpStore((s) => s.joinMatchChannel);
  const leaveMatchChannel = useLivePvpStore((s) => s.leaveMatchChannel);
  const cancelInvite = useLivePvpStore((s) => s.cancelInvite);
  const refreshSnapshot = useLivePvpStore((s) => s.refreshSnapshot);
  const [now, setNow] = useState(() => Date.now());
  const busy = mutationStatus === 'pending';

  useEffect(() => {
    void joinMatchChannel(matchId);
    void refreshSnapshot(matchId);
  }, [joinMatchChannel, matchId, refreshSnapshot]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!snapshot || snapshot.matchId !== matchId) {
      return;
    }
    if (
      snapshot.status === 'lobby' ||
      snapshot.status === 'countdown' ||
      snapshot.status === 'active'
    ) {
      navigation.replace('LivePvpLobby', { matchId });
      return;
    }
    if (
      snapshot.status === 'declined' ||
      snapshot.status === 'cancelled' ||
      snapshot.status === 'expired' ||
      snapshot.status === 'completed' ||
      snapshot.status === 'invalid'
    ) {
      void leaveMatchChannel();
      navigation.replace('LivePvpResult', { matchId });
    }
  }, [leaveMatchChannel, matchId, navigation, snapshot]);

  const onCancel = useCallback(async () => {
    if (busy) {
      return;
    }
    const ok = await cancelInvite(matchId);
    if (ok) {
      await leaveMatchChannel();
      navigation.replace('LivePvpHub');
    }
  }, [busy, cancelInvite, leaveMatchChannel, matchId, navigation]);

  const opponentName =
    snapshot && snapshot.matchId === matchId
      ? livePvpOtherPlayer(snapshot).displayName
      : 'Opponent';
  const expiresLabel = useMemo(() => {
    if (!snapshot?.expiresAt || snapshot.matchId !== matchId) {
      return null;
    }
    return formatExpires(snapshot.expiresAt, now);
  }, [matchId, now, snapshot]);

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.inner}>
        <ScreenHeader title="LIVE CHALLENGE SENT" />
        <Text style={styles.title}>{opponentName.toUpperCase()}</Text>
        <Text style={styles.body}>Waiting for response…</Text>
        {expiresLabel ? (
          <Text style={styles.meta}>Expires in {expiresLabel}</Text>
        ) : null}
        {snapshot && snapshot.matchId === matchId ? (
          <Text style={styles.meta}>{livePvpStatusLabel(snapshot.status)}</Text>
        ) : (
          <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.md }} />
        )}
        {errorMessage ? (
          <Text style={styles.error}>{mapLivePvpErrorMessage(errorMessage)}</Text>
        ) : null}
        <BlazeButton
          title={busy ? 'CANCELLING…' : 'CANCEL CHALLENGE'}
          variant="secondary"
          disabled={busy}
          loading={busy}
          onPress={() => void onCancel()}
          fullWidth
          accessibilityLabel="Cancel challenge"
        />
        <Pressable onPress={() => void refreshSnapshot(matchId)} accessibilityRole="button">
          <Text style={styles.refresh}>Refresh</Text>
        </Pressable>
        <BlazeButton
          title="BACK"
          variant="secondary"
          onPress={() => {
            void leaveMatchChannel();
            navigation.goBack();
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
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.gold,
    textAlign: 'center',
  },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  meta: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 13,
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
});
