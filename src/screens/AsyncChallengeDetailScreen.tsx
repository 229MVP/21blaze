import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { ProfileFrameBadge } from '../components/cosmetics/ProfileFrameBadge';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { BottomActionBar } from '../components/Navigation/BottomActionBar';
import { BlazeButton } from '../components/ui/BlazeButton';
import { BlazePanel } from '../components/ui/BlazePanel';
import {
  formatAsyncTimeRemaining,
  millisecondsUntilExpiration,
} from '../async/asyncChallengePolicy';
import { getCosmetic } from '../cosmetics/catalog';
import { isAsyncRematchEnabled } from '../config/featureFlags';
import { useInterstitialScreenTracking } from '../hooks/useInterstitialScreenTracking';
import { trackEvent } from '../monetization/analytics';
import type { AsyncChallengeDetailScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import {
  attemptStatusLabel,
  useAsyncChallengeStore,
} from '../store/useAsyncChallengeStore';
import { useGameStore } from '../store/useGameStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

const CONTENT_MAX = 410;

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function AsyncChallengeDetailScreen({
  navigation,
  route,
}: AsyncChallengeDetailScreenProps) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);
  const userId = useAuthStore((state) => state.user?.id);
  const selectedChallenge = useAsyncChallengeStore((state) => state.selectedChallenge);
  const refreshChallenge = useAsyncChallengeStore((state) => state.refreshChallenge);
  const lastCreatedInviteCode = useAsyncChallengeStore((state) => state.lastCreatedInviteCode);
  const startAttempt = useAsyncChallengeStore((state) => state.startAttempt);
  const prepareAsyncChallengeGame = useGameStore((state) => state.prepareAsyncChallengeGame);
  const [busy, setBusy] = useState(false);

  useInterstitialScreenTracking('other');

  const challengeId = route.params?.challengeId ?? selectedChallenge?.challengeId;

  useEffect(() => {
    if (challengeId) {
      void refreshChallenge(challengeId);
    }
  }, [challengeId, refreshChallenge]);

  const challenge = selectedChallenge;
  if (!challenge) {
    return (
      <BlazeScreenBackground>
        <View style={styles.loading}>
          <ActivityIndicator color={kitColors.fire.gold} />
        </View>
      </BlazeScreenBackground>
    );
  }

  const isCreator = userId === challenge.creator.userId;
  const opponent = isCreator ? challenge.opponent : challenge.creator;
  const inviteCode = challenge.inviteCode ?? lastCreatedInviteCode;
  const canStart =
    challenge.isYourTurn &&
    challenge.opponent !== null &&
    challenge.status !== 'completed' &&
    challenge.status !== 'expired';

  const handleShare = useCallback(async () => {
    if (!inviteCode) {
      return;
    }
    trackEvent('async_challenge_invite_shared');
    if (Platform.OS === 'web') {
      return;
    }
    await Share.share({
      message: `Join my 21 Blaze Async Duel: ${inviteCode}`,
      url: `twentyoneblaze://challenge/${inviteCode}`,
    });
  }, [inviteCode]);

  const handleStart = useCallback(async () => {
    if (!userId) {
      return;
    }
    setBusy(true);
    try {
      const session = await startAttempt(challenge.challengeId, userId);
      await prepareAsyncChallengeGame(session);
      navigation.replace('Game');
    } finally {
      setBusy(false);
    }
  }, [challenge.challengeId, navigation, prepareAsyncChallengeGame, startAttempt, userId]);

  const handleViewResult = useCallback(() => {
    trackEvent('async_challenge_result_viewed');
    navigation.navigate('Results', { matchId: challenge.challengeId });
  }, [challenge.challengeId, navigation]);

  const titleName =
    opponent?.playerTitleId
      ? getCosmetic(opponent.playerTitleId)?.displayName ?? opponent.playerTitleId
      : null;

  const resultLabel =
    challenge.status === 'completed'
      ? challenge.resultType === 'draw'
        ? 'DRAW'
        : challenge.winnerUserId === userId
          ? 'YOU WIN'
          : 'OPPONENT WINS'
      : null;

  return (
    <BlazeScreenBackground>
      <View style={[styles.column, { width: columnWidth }]}>
        <Text style={styles.title}>ASYNC DUEL</Text>
        <Text style={styles.expires}>
          Expires in {formatAsyncTimeRemaining(millisecondsUntilExpiration(challenge.expiresAt))}
        </Text>

        <BlazePanel style={styles.panel}>
          <View style={styles.vsRow}>
            <View style={styles.playerCol}>
              <ProfileFrameBadge size={44} variant="default" />
              <Text style={styles.playerName} numberOfLines={1}>
                {challenge.creator.displayName}
              </Text>
              <Text style={styles.attemptStatus}>
                {attemptStatusLabel(challenge.creator.attemptStatus)}
              </Text>
            </View>
            <Text style={styles.vs}>VS</Text>
            <View style={styles.playerCol}>
              <ProfileFrameBadge
                size={44}
                variant={
                  opponent?.profileFrameId === 'flame_profile_frame' ? 'flame' : 'default'
                }
              />
              <Text style={styles.playerName} numberOfLines={1}>
                {opponent?.displayName ?? 'Waiting'}
              </Text>
              <Text style={styles.attemptStatus}>
                {attemptStatusLabel(opponent?.attemptStatus ?? 'WAITING')}
              </Text>
              {titleName ? (
                <Text style={styles.playerTitle} numberOfLines={1}>{titleName}</Text>
              ) : null}
            </View>
          </View>

          <Text style={styles.rules}>
            Shared deck · {challenge.durationSeconds}s · Scoring v{challenge.scoringVersion}
          </Text>

          {challenge.yourVerifiedResult ? (
            <View style={styles.resultBlock}>
              <Text style={styles.resultHeading}>YOUR VERIFIED RESULT</Text>
              <StatRow label="Score" value={String(challenge.yourVerifiedResult.score)} />
              <StatRow
                label="Exact 21"
                value={String(challenge.yourVerifiedResult.exact21Count)}
              />
              <StatRow
                label="Five-card"
                value={String(challenge.yourVerifiedResult.fiveCardClears)}
              />
              <StatRow label="Busts" value={String(challenge.yourVerifiedResult.bustCount)} />
              <StatRow
                label="Multiplier"
                value={String(challenge.yourVerifiedResult.bestMultiplier)}
              />
            </View>
          ) : null}

          {challenge.opponentVerifiedResult ? (
            <View style={styles.resultBlock}>
              <Text style={styles.resultHeading}>OPPONENT VERIFIED RESULT</Text>
              <StatRow label="Score" value={String(challenge.opponentVerifiedResult.score)} />
              <StatRow
                label="Exact 21"
                value={String(challenge.opponentVerifiedResult.exact21Count)}
              />
              <StatRow
                label="Five-card"
                value={String(challenge.opponentVerifiedResult.fiveCardClears)}
              />
              <StatRow
                label="Busts"
                value={String(challenge.opponentVerifiedResult.bustCount)}
              />
              <StatRow
                label="Multiplier"
                value={String(challenge.opponentVerifiedResult.bestMultiplier)}
              />
            </View>
          ) : null}

          {resultLabel ? (
            <Text style={styles.finalResult}>{resultLabel}</Text>
          ) : null}
        </BlazePanel>

        <View style={styles.actions}>
          {inviteCode && challenge.status === 'open' ? (
            <BlazeButton label="SHARE INVITE" variant="secondary" onPress={() => void handleShare()} />
          ) : null}
          {canStart ? (
            <BlazeButton
              label="START ATTEMPT"
              disabled={busy}
              onPress={() => void handleStart()}
            />
          ) : null}
          {challenge.status === 'completed' ? (
            <BlazeButton label="VIEW RESULT" onPress={handleViewResult} />
          ) : null}
          {isAsyncRematchEnabled() ? (
            <BlazeButton
              label="CREATE REMATCH"
              variant="ghost"
              disabled
              onPress={() => undefined}
            />
          ) : null}
          <BlazeButton
            label="BACK TO HUB"
            variant="ghost"
            onPress={() => navigation.navigate('AsyncChallengeHub')}
          />
        </View>

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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: kitColors.text.primary,
    fontSize: 32,
    fontFamily: kitTypography.families.display,
    textAlign: 'center',
  },
  expires: {
    color: kitColors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
  panel: {
    padding: kitSpacing.md,
    gap: kitSpacing.md,
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: kitSpacing.sm,
  },
  playerCol: {
    flex: 1,
    alignItems: 'center',
    gap: kitSpacing.xs,
    minWidth: 0,
  },
  playerName: {
    color: kitColors.text.primary,
    fontSize: 14,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    textAlign: 'center',
  },
  playerTitle: {
    color: kitColors.text.secondary,
    fontSize: 13,
    textAlign: 'center',
  },
  attemptStatus: {
    color: kitColors.fire.gold,
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: kitTypography.families.condensed,
  },
  vs: {
    color: kitColors.text.secondary,
    fontSize: 12,
    fontFamily: kitTypography.families.condensed,
  },
  rules: {
    color: kitColors.text.secondary,
    fontSize: 14,
    textAlign: 'center',
  },
  resultBlock: {
    gap: kitSpacing.xs,
  },
  resultHeading: {
    color: kitColors.fire.gold,
    fontSize: 12,
    letterSpacing: 1.2,
    fontFamily: kitTypography.families.condensed,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    color: kitColors.text.secondary,
    fontSize: 13,
  },
  statValue: {
    color: kitColors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  finalResult: {
    color: kitColors.fire.gold,
    fontSize: 28,
    fontFamily: kitTypography.families.display,
    textAlign: 'center',
  },
  actions: {
    gap: kitSpacing.sm,
  },
});
