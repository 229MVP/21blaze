import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { LiveLobbyScreenProps } from '../navigation/navigationTypes';
import { useLiveMatchStore } from '../store/useLiveMatchStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

export function LiveLobbyScreen({ navigation }: LiveLobbyScreenProps) {
  const matchState = useLiveMatchStore((state) => state.matchState);
  const localReady = useLiveMatchStore((state) => state.localReady);
  const opponentReady = useLiveMatchStore((state) => state.opponentReady);
  const serverStartsAt = useLiveMatchStore((state) => state.serverStartsAt);
  const markReady = useLiveMatchStore((state) => state.markReady);
  const leaveMatch = useLiveMatchStore((state) => state.leaveMatch);
  const reconnectToMatch = useLiveMatchStore((state) => state.reconnectToMatch);
  const error = useLiveMatchStore((state) => state.error);
  const isBusy = useLiveMatchStore((state) => state.isBusy);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    void reconnectToMatch();
  }, [reconnectToMatch]);

  useEffect(() => {
    if (!serverStartsAt) {
      setCountdown(null);
      return;
    }

    const tick = () => {
      const remainingMs = Date.parse(serverStartsAt) - Date.now();
      if (remainingMs <= 0) {
        setCountdown(0);
        navigation.replace('LiveGame');
        return;
      }
      setCountdown(Math.ceil(remainingMs / 1000));
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [navigation, serverStartsAt]);

  useEffect(() => {
    const status = matchState?.match.status;
    if (status === 'cancelled' || status === 'expired') {
      navigation.replace('LiveDuelHome');
    }
  }, [matchState?.match.status, navigation]);

  if (!matchState) {
    return (
      <ScreenContainer style={styles.container} intensity="normal">
        <Text style={styles.help}>Loading lobby…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="LOBBY" />
        <Text style={styles.room}>ROOM {matchState.match.roomCode}</Text>

        <View style={styles.players}>
          <PlayerCard
            name={matchState.self.displayName}
            ready={localReady}
            you
          />
          <PlayerCard
            name={matchState.opponent?.displayName ?? 'Waiting…'}
            ready={opponentReady}
            you={false}
          />
        </View>

        {countdown !== null ? (
          <Text style={styles.countdown}>STARTING IN {countdown}</Text>
        ) : (
          <Text style={styles.help}>
            Both players must ready up. Match starts on the server clock.
          </Text>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <BlazeButton
            title={localReady ? 'READY!' : 'READY'}
            onPress={() => {
              void markReady();
            }}
            disabled={localReady || isBusy || !matchState.opponent}
            fullWidth
          />
          <BlazeButton
            title="LEAVE"
            variant="secondary"
            onPress={() => {
              void leaveMatch().then(() => navigation.replace('LiveDuelHome'));
            }}
            fullWidth
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

function PlayerCard({
  name,
  ready,
  you,
}: {
  name: string;
  ready: boolean;
  you: boolean;
}) {
  return (
    <View style={[styles.playerCard, ready && styles.playerReady]}>
      <Text style={styles.playerName} numberOfLines={1}>
        {name}
        {you ? ' (YOU)' : ''}
      </Text>
      <Text style={styles.readyLabel}>{ready ? 'READY' : 'NOT READY'}</Text>
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
  room: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 2,
    color: colors.gold,
    textAlign: 'center',
  },
  players: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  playerCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.backgroundCard,
    padding: spacing.md,
    gap: 4,
  },
  playerReady: {
    borderColor: colors.gold,
  },
  playerName: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  readyLabel: {
    ...typography.label,
    fontSize: 11,
    color: colors.textSecondary,
  },
  countdown: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  help: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
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
