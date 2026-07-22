import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DivisionBadge } from '../components/Ranked/DivisionBadge';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { RankedFoundScreenProps } from '../navigation/navigationTypes';
import { getLiveMatchState } from '../services/liveMatchService';
import { useAuthStore } from '../store/useAuthStore';
import { useLiveMatchStore } from '../store/useLiveMatchStore';
import { useRankedStore } from '../store/useRankedStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';
import { isRankedDivisionKey } from '../ranked/types';

export function RankedFoundScreen({ navigation }: RankedFoundScreenProps) {
  const profile = useAuthStore((state) => state.profile);
  const status = useRankedStore((state) => state.status);
  const opponent = useRankedStore((state) => state.opponent);
  const rankedProfile = useRankedStore((state) => state.rankedProfile);
  const acceptanceExpiresAt = useRankedStore((state) => state.acceptanceExpiresAt);
  const localAccepted = useRankedStore((state) => state.localAccepted);
  const opponentAccepted = useRankedStore((state) => state.opponentAccepted);
  const matchId = useRankedStore((state) => state.matchId);
  const error = useRankedStore((state) => state.error);
  const isBusy = useRankedStore((state) => state.isBusy);
  const acceptMatch = useRankedStore((state) => state.acceptRankedMatch);
  const declineMatch = useRankedStore((state) => state.declineRankedMatch);
  const pollQueue = useRankedStore((state) => state.pollRankedQueue);
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
      navigation.replace('RankedSearch');
      return;
    }
    if (status === 'cancelled' || status === 'expired' || status === 'failed') {
      navigation.replace('RankedHome');
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
  }, [applyServerState, connectChannel, matchId, navigation, status]);

  useEffect(() => {
    if (status === 'waitingForOpponent' || status === 'matchFound') {
      const id = setInterval(() => {
        void pollQueue();
      }, 2000);
      return () => clearInterval(id);
    }
    return undefined;
  }, [pollQueue, status]);

  const localDivision = rankedProfile?.division ?? 'unranked';
  const opponentDivision = isRankedDivisionKey(opponent?.division)
    ? opponent.division
    : 'unranked';

  return (
    <ScreenContainer style={styles.container} intensity="intense" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="MATCH FOUND" />
        <Text style={styles.headline}>MATCH FOUND</Text>

        <View style={styles.vsRow}>
          <View style={[styles.chip, styles.chipYou]}>
            <Text style={styles.chipLabel}>YOU</Text>
            <Text style={styles.chipName} numberOfLines={1}>
              {profile?.display_name ?? 'You'}
            </Text>
            <DivisionBadge division={localDivision} size="small" />
            {!rankedProfile?.placementComplete ? (
              <Text style={styles.placementBadge}>PLACEMENT</Text>
            ) : null}
          </View>
          <Text style={styles.vs}>VS</Text>
          <View style={[styles.chip, styles.chipThem]}>
            <Text style={styles.chipLabel}>OPPONENT</Text>
            <Text style={styles.chipName} numberOfLines={1}>
              {opponent?.displayName ?? 'Opponent'}
            </Text>
            <DivisionBadge division={opponentDivision} size="small" />
            {opponent?.placementComplete === false ? (
              <Text style={styles.placementBadge}>PLACEMENT</Text>
            ) : null}
          </View>
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
                  void declineMatch().then(() => navigation.replace('RankedHome'));
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
    alignItems: 'stretch',
    gap: 10,
    marginTop: spacing.lg,
  },
  vs: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    color: colors.primary,
    alignSelf: 'center',
  },
  chip: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: 6,
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
  placementBadge: {
    ...typography.label,
    fontSize: 10,
    color: colors.brightOrange,
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
