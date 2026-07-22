import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { QuickMatchFoundScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { useLiveMatchStore } from '../store/useLiveMatchStore';
import { useQuickMatchStore } from '../store/useQuickMatchStore';
import { getLiveMatchState } from '../services/liveMatchService';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

export function QuickMatchFoundScreen({ navigation }: QuickMatchFoundScreenProps) {
  const profile = useAuthStore((state) => state.profile);
  const status = useQuickMatchStore((state) => state.status);
  const opponent = useQuickMatchStore((state) => state.opponent);
  const acceptanceExpiresAt = useQuickMatchStore((state) => state.acceptanceExpiresAt);
  const localAccepted = useQuickMatchStore((state) => state.localAccepted);
  const opponentAccepted = useQuickMatchStore((state) => state.opponentAccepted);
  const matchId = useQuickMatchStore((state) => state.matchId);
  const error = useQuickMatchStore((state) => state.error);
  const isBusy = useQuickMatchStore((state) => state.isBusy);
  const acceptMatch = useQuickMatchStore((state) => state.acceptMatch);
  const declineMatch = useQuickMatchStore((state) => state.declineMatch);
  const pollQueue = useQuickMatchStore((state) => state.pollQueue);
  const applyServerState = useLiveMatchStore((state) => state.applyServerState);
  const connectChannel = useLiveMatchStore((state) => state.connectChannel);

  const [remainingAcceptSeconds, setRemainingAcceptSeconds] = useState(12);

  useEffect(() => {
    const id = setInterval(() => {
      if (!acceptanceExpiresAt) {
        setRemainingAcceptSeconds(0);
        return;
      }
      const remaining = Math.max(
        0,
        Math.ceil((Date.parse(acceptanceExpiresAt) - Date.now()) / 1000),
      );
      setRemainingAcceptSeconds(remaining);
      if (remaining === 0) {
        void pollQueue();
      }
    }, 200);
    return () => clearInterval(id);
  }, [acceptanceExpiresAt, pollQueue]);

  useEffect(() => {
    if (status === 'queued') {
      navigation.replace('QuickMatchSearch');
      return;
    }
    if (status === 'cancelled' || status === 'expired' || status === 'failed') {
      navigation.replace('LiveDuelHome');
      return;
    }
    if (status === 'countdown' || status === 'running') {
      void (async () => {
        if (!matchId) {
          return;
        }
        try {
          const state = await getLiveMatchState(matchId);
          applyServerState(state);
          await connectChannel();
        } catch {
          // Lobby can still reconnect.
        }
        navigation.replace('LiveLobby');
      })();
    }
  }, [
    applyServerState,
    connectChannel,
    matchId,
    navigation,
    status,
  ]);

  // Keep acceptance state fresh while waiting.
  useEffect(() => {
    if (status === 'waitingForOpponent' || status === 'matchFound') {
      const id = setInterval(() => {
        void pollQueue();
      }, 2000);
      return () => clearInterval(id);
    }
    return undefined;
  }, [pollQueue, status]);

  return (
    <ScreenContainer style={styles.container} intensity="intense" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="MATCH FOUND" />
        <Text style={styles.headline}>MATCH FOUND!</Text>

        <View style={styles.vsRow}>
          <PlayerChip
            name={profile?.display_name ?? 'You'}
            side="you"
          />
          <Text style={styles.vs}>VS</Text>
          <PlayerChip
            name={opponent?.displayName ?? 'Opponent'}
            side="them"
          />
        </View>

        <Text style={styles.countdown}>
          {localAccepted && !opponentAccepted
            ? 'WAITING FOR OPPONENT'
            : `ACCEPT IN ${remainingAcceptSeconds}s`}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          {!localAccepted ? (
            <>
              <BlazeButton
                title="ACCEPT"
                onPress={() => {
                  void acceptMatch();
                }}
                loading={isBusy || status === 'accepting'}
                disabled={isBusy || remainingAcceptSeconds <= 0}
                fullWidth
              />
              <BlazeButton
                title="DECLINE"
                variant="secondary"
                onPress={() => {
                  void declineMatch().then(() => navigation.replace('LiveDuelHome'));
                }}
                disabled={isBusy}
                fullWidth
              />
            </>
          ) : (
            <BlazeButton
              title="WAITING…"
              variant="outline"
              onPress={() => undefined}
              disabled
              fullWidth
            />
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

function PlayerChip({
  name,
  side,
}: {
  name: string;
  side: 'you' | 'them';
}) {
  return (
    <View style={[styles.chip, side === 'you' ? styles.chipYou : styles.chipThem]}>
      <Text style={styles.chipLabel}>{side === 'you' ? 'YOU' : 'OPPONENT'}</Text>
      <Text style={styles.chipName} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headline: {
    fontFamily: fontFamilies.display,
    fontSize: 36,
    color: colors.gold,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing.lg,
  },
  vs: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    color: colors.primary,
  },
  chip: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  chipYou: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(255,101,0,0.12)',
  },
  chipThem: {
    borderColor: colors.blazeSubtle,
    backgroundColor: colors.backgroundCard,
  },
  chipLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.textMuted,
  },
  chipName: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  countdown: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    color: colors.brightOrange,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  error: {
    ...typography.body,
    fontSize: 13,
    color: colors.warningRed,
    textAlign: 'center',
  },
  actions: {
    marginTop: 'auto',
    gap: 10,
  },
});
