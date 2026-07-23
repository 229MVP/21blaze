import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { FlameIcon } from '../components/branding/FlameIcon';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { QuickMatchSearchScreenProps } from '../navigation/navigationTypes';
import { useQuickMatchStore } from '../store/useQuickMatchStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

const STATUS_MESSAGES = [
  'Shuffling the deck…',
  'Finding another Blazer…',
  'Preparing the arena…',
  'Looking for a worthy opponent…',
];

export function QuickMatchSearchScreen({ navigation }: QuickMatchSearchScreenProps) {
  const status = useQuickMatchStore((state) => state.status);
  const elapsedSeconds = useQuickMatchStore((state) => state.elapsedSeconds);
  const queuedAt = useQuickMatchStore((state) => state.queuedAt);
  const region = useQuickMatchStore((state) => state.region);
  const error = useQuickMatchStore((state) => state.error);
  const joinQueue = useQuickMatchStore((state) => state.joinQueue);
  const stopPolling = useQuickMatchStore((state) => state.stopPolling);
  const cancelQueue = useQuickMatchStore((state) => state.cancelQueue);
  const reconnect = useQuickMatchStore((state) => state.reconnect);
  const preferredRegion = useSettingsStore((state) => state.settings.preferredRegion);

  const joinedRef = useRef(false);
  const [tickElapsed, setTickElapsed] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

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
      const existing = await reconnect();
      if (
        existing === 'idle' ||
        existing === 'cancelled' ||
        existing === 'expired' ||
        existing === 'failed'
      ) {
        await joinQueue();
      }
    })();

    return () => {
      stopPolling();
    };
  }, [joinQueue, reconnect, stopPolling]);

  useEffect(() => {
    if (
      status === 'matchFound' ||
      status === 'waitingForOpponent' ||
      status === 'accepting'
    ) {
      navigation.replace('QuickMatchFound');
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
      setMessageIndex((index) => (index + 1) % STATUS_MESSAGES.length);
    }, 1000);
    return () => clearInterval(id);
  }, [elapsedSeconds, queuedAt]);

  const regionLabel = useMemo(
    () => (region ?? preferredRegion ?? 'unknown').toUpperCase(),
    [preferredRegion, region],
  );

  const confirmCancel = () => {
    Alert.alert('Cancel Search', 'Leave the Quick Match queue?', [
      { text: 'Keep Searching', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: () => {
          void cancelQueue().then(() => navigation.replace('LiveDuelHome'));
        },
      },
    ]);
  };

  return (
    <ScreenContainer style={styles.container} intensity="intense" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="QUICK MATCH" />
        <View style={styles.center}>
          <Animated.View style={flameStyle}>
            <FlameIcon width={56} height={72} />
          </Animated.View>
          <Text style={styles.title}>SEARCHING FOR AN OPPONENT</Text>
          <Text style={styles.elapsed}>{formatElapsed(tickElapsed)}</Text>
          <Text style={styles.region}>REGION · {regionLabel}</Text>
          <Text style={styles.message}>{STATUS_MESSAGES[messageIndex]}</Text>
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
                void joinQueue();
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
  region: {
    ...typography.label,
    fontSize: 11,
    color: colors.textMuted,
  },
  message: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    minHeight: 40,
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
