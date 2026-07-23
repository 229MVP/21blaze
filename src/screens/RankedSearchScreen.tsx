import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { DivisionBadge } from '../components/Ranked/DivisionBadge';
import { FlameIcon } from '../components/branding/FlameIcon';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { matchmakingRangeLabel } from '../ranked/matchmakingRange';
import type { RankedSearchScreenProps } from '../navigation/navigationTypes';
import { useRankedStore } from '../store/useRankedStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

export function RankedSearchScreen({ navigation }: RankedSearchScreenProps) {
  const status = useRankedStore((state) => state.status);
  const elapsedSeconds = useRankedStore((state) => state.elapsedSeconds);
  const queuedAt = useRankedStore((state) => state.queuedAt);
  const ratingRangeLabel = useRankedStore((state) => state.ratingRangeLabel);
  const error = useRankedStore((state) => state.error);
  const rankedProfile = useRankedStore((state) => state.rankedProfile);
  const joinRankedQueue = useRankedStore((state) => state.joinRankedQueue);
  const stopPolling = useRankedStore((state) => state.stopPolling);
  const cancelRankedQueue = useRankedStore((state) => state.cancelRankedQueue);
  const reconnectRankedMatch = useRankedStore((state) => state.reconnectRankedMatch);

  const joinedRef = useRef(false);
  const [tickElapsed, setTickElapsed] = useState(0);

  const pulse = useSharedValue(0.85);
  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.75 + (pulse.value - 0.85) * 2,
  }));

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  useEffect(() => {
    if (joinedRef.current) {
      return;
    }
    joinedRef.current = true;
    void (async () => {
      const existing = await reconnectRankedMatch();
      if (
        existing === 'idle' ||
        existing === 'cancelled' ||
        existing === 'expired' ||
        existing === 'failed'
      ) {
        await joinRankedQueue();
      }
    })();

    return () => {
      stopPolling();
    };
  }, [joinRankedQueue, reconnectRankedMatch, stopPolling]);

  useEffect(() => {
    if (
      status === 'matchFound' ||
      status === 'waitingForOpponent' ||
      status === 'accepting'
    ) {
      navigation.replace('RankedFound');
    }
    if (status === 'countdown' || status === 'running') {
      navigation.replace('LiveLobby');
    }
  }, [navigation, status]);

  useEffect(() => {
    const id = setInterval(() => {
      if (queuedAt) {
        setTickElapsed(Math.max(0, Math.floor((Date.now() - Date.parse(queuedAt)) / 1000)));
      } else {
        setTickElapsed(elapsedSeconds);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [elapsedSeconds, queuedAt]);

  const rangeText = useMemo(
    () => ratingRangeLabel ?? matchmakingRangeLabel(tickElapsed),
    [ratingRangeLabel, tickElapsed],
  );

  const confirmCancel = () => {
    Alert.alert('Cancel Search', 'Leave the Ranked queue?', [
      { text: 'Keep Searching', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: () => {
          void cancelRankedQueue().then(() => navigation.replace('RankedHome'));
        },
      },
    ]);
  };

  return (
    <ScreenContainer style={styles.container} intensity="intense" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="RANKED MATCH" />
        <View style={styles.center}>
          <Animated.View style={flameStyle}>
            <FlameIcon width={56} height={72} />
          </Animated.View>
          {rankedProfile ? (
            <DivisionBadge
              division={rankedProfile.division}
              rating={rankedProfile.rating}
              showRating={rankedProfile.placementComplete}
              size="small"
            />
          ) : null}
          {!rankedProfile?.placementComplete && rankedProfile ? (
            <Text style={styles.placement}>
              PLACEMENT {rankedProfile.placementMatchesCompleted}/
              {rankedProfile.placementMatchesRequired}
            </Text>
          ) : null}
          <Text style={styles.title}>SEARCHING FOR AN OPPONENT</Text>
          <Text style={styles.elapsed}>{formatElapsed(tickElapsed)}</Text>
          <Text style={styles.range}>{rangeText}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {status === 'expired' ? (
            <Text style={styles.error}>No opponent found. Try again.</Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          {(status === 'failed' || status === 'expired') && (
            <BlazeButton
              title="TRY AGAIN"
              onPress={() => {
                joinedRef.current = false;
                void joinRankedQueue();
                joinedRef.current = true;
              }}
              fullWidth
            />
          )}
          <BlazeButton
            title="CANCEL"
            variant="secondary"
            onPress={confirmCancel}
            fullWidth
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  placement: {
    ...typography.label,
    fontSize: 11,
    color: colors.brightOrange,
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 26,
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  elapsed: {
    fontFamily: fontFamilies.display,
    fontSize: 40,
    color: colors.gold,
  },
  range: {
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
    gap: 10,
  },
});
