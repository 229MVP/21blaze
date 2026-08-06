import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { BottomActionBar } from '../components/Navigation/BottomActionBar';
import { BlazeButton } from '../components/ui/BlazeButton';
import { BlazePanel } from '../components/ui/BlazePanel';
import {
  formatAsyncTimeRemaining,
  millisecondsUntilExpiration,
} from '../async/asyncChallengePolicy';
import { useInterstitialScreenTracking } from '../hooks/useInterstitialScreenTracking';
import { trackEvent } from '../monetization/analytics';
import type { CreateAsyncChallengeScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { useAsyncChallengeStore } from '../store/useAsyncChallengeStore';
import { useGameStore } from '../store/useGameStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

const CONTENT_MAX = 410;

export function CreateAsyncChallengeScreen({ navigation }: CreateAsyncChallengeScreenProps) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);
  const userId = useAuthStore((state) => state.user?.id);
  const createChallenge = useAsyncChallengeStore((state) => state.createChallenge);
  const createStatus = useAsyncChallengeStore((state) => state.createStatus);
  const lastCreatedInviteCode = useAsyncChallengeStore((state) => state.lastCreatedInviteCode);
  const selectedChallenge = useAsyncChallengeStore((state) => state.selectedChallenge);
  const startAttempt = useAsyncChallengeStore((state) => state.startAttempt);
  const prepareAsyncChallengeGame = useGameStore((state) => state.prepareAsyncChallengeGame);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useInterstitialScreenTracking('other');

  const handleCreate = useCallback(async () => {
    setBusy(true);
    try {
      await createChallenge();
    } finally {
      setBusy(false);
    }
  }, [createChallenge]);

  const handleCopy = useCallback(async () => {
    if (!lastCreatedInviteCode) {
      return;
    }
    await Clipboard.setStringAsync(lastCreatedInviteCode);
    setCopied(true);
  }, [lastCreatedInviteCode]);

  const handleShare = useCallback(async () => {
    if (!lastCreatedInviteCode) {
      return;
    }
    trackEvent('async_challenge_invite_shared');
    if (Platform.OS === 'web') {
      await handleCopy();
      return;
    }
    await Share.share({
      message: `Join my 21 Blaze Async Duel: ${lastCreatedInviteCode}`,
      url: `twentyoneblaze://challenge/${lastCreatedInviteCode}`,
    });
  }, [handleCopy, lastCreatedInviteCode]);

  const handleStart = useCallback(async () => {
    if (!selectedChallenge || !userId) {
      return;
    }
    setBusy(true);
    try {
      const session = await startAttempt(selectedChallenge.challengeId, userId);
      await prepareAsyncChallengeGame(session);
      navigation.replace('Game');
    } finally {
      setBusy(false);
    }
  }, [navigation, prepareAsyncChallengeGame, selectedChallenge, startAttempt, userId]);

  const expiresAt = selectedChallenge?.expiresAt;
  const timeLeft =
    expiresAt
      ? formatAsyncTimeRemaining(millisecondsUntilExpiration(expiresAt))
      : null;

  return (
    <BlazeScreenBackground>
      <View style={[styles.column, { width: columnWidth }]}>
        <Text style={styles.title}>ASYNC DUEL</Text>
        <Text style={styles.subtitle}>
          Play the same deck. One attempt each. Best verified result wins.
        </Text>

        {createStatus !== 'created' ? (
          <BlazeButton
            label={busy ? 'CREATING…' : 'CREATE CHALLENGE'}
            size="lg"
            disabled={busy}
            onPress={() => void handleCreate()}
          />
        ) : (
          <BlazePanel style={styles.codePanel}>
            <Text style={styles.codeLabel}>INVITE CODE</Text>
            <Text style={styles.codeValue} selectable>{lastCreatedInviteCode}</Text>
            <View style={styles.codeActions}>
              <BlazeButton
                label={copied ? 'COPIED' : 'COPY CODE'}
                variant="secondary"
                onPress={() => void handleCopy()}
              />
              <BlazeButton
                label="SHARE CHALLENGE"
                variant="secondary"
                onPress={() => void handleShare()}
              />
            </View>
            {timeLeft ? (
              <Text style={styles.expires}>Expires in {timeLeft}</Text>
            ) : null}
            <BlazeButton
              label="START YOUR ATTEMPT"
              onPress={() => void handleStart()}
              disabled={busy}
            />
            <Text style={styles.waitingNote}>Waiting for opponent after you share.</Text>
          </BlazePanel>
        )}

        {busy ? <ActivityIndicator color={kitColors.fire.gold} /> : null}
      </View>
      <BottomActionBar
        primaryAction={{ label: 'BACK', onPress: () => navigation.goBack() }}
      />
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    alignSelf: 'center',
    paddingHorizontal: kitSpacing.md,
    paddingTop: kitSpacing.lg,
    gap: kitSpacing.md,
  },
  title: {
    color: kitColors.text.primary,
    fontSize: 32,
    fontFamily: kitTypography.families.display,
    textAlign: 'center',
  },
  subtitle: {
    color: kitColors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
  codePanel: {
    padding: kitSpacing.md,
    gap: kitSpacing.sm,
  },
  codeLabel: {
    color: kitColors.fire.gold,
    fontSize: 12,
    letterSpacing: 1.2,
    fontFamily: kitTypography.families.condensed,
  },
  codeValue: {
    color: kitColors.text.primary,
    fontSize: 28,
    fontFamily: kitTypography.families.display,
    textAlign: 'center',
  },
  codeActions: {
    gap: kitSpacing.sm,
  },
  expires: {
    color: kitColors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
  waitingNote: {
    color: kitColors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
