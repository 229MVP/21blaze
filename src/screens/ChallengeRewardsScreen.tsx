import { useEffect } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { BlazeButton } from '../components/ui/BlazeButton';
import { BlazePanel } from '../components/ui/BlazePanel';
import {
  isChallengeRewardsEnabled,
  isChallengeStreaksEnabled,
  isWeeklyChallengeRewardsEnabled,
} from '../config/featureFlags';
import { nextWeeklyTier, weeklyTierForChallengePoints } from '../challenge/challengeRewardPolicy';
import { useInterstitialScreenTracking } from '../hooks/useInterstitialScreenTracking';
import type { ChallengeRewardsScreenProps } from '../navigation/navigationTypes';
import { trackEvent } from '../monetization/analytics';
import { useChallengeRewardStore } from '../store/useChallengeRewardStore';
import { useDailyChallengeStore } from '../store/useDailyChallengeStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

const CONTENT_MAX = 410;

export function ChallengeRewardsScreen({ navigation }: ChallengeRewardsScreenProps) {
  useInterstitialScreenTracking('dailyChallenge');
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);
  const challenge = useDailyChallengeStore((state) => state.challenge);
  const status = useChallengeRewardStore((state) => state.status);
  const isLoading = useChallengeRewardStore((state) => state.isLoading);
  const isRefreshing = useChallengeRewardStore((state) => state.isRefreshing);
  const isClaimingWeekly = useChallengeRewardStore((state) => state.isClaimingWeekly);
  const error = useChallengeRewardStore((state) => state.error);
  const isOfflineCache = useChallengeRewardStore((state) => state.isOfflineCache);
  const lastUpdatedAt = useChallengeRewardStore((state) => state.lastUpdatedAt);
  const hydrate = useChallengeRewardStore((state) => state.hydrate);
  const refresh = useChallengeRewardStore((state) => state.refresh);
  const claimWeekly = useChallengeRewardStore((state) => state.claimWeekly);

  const rewardsOn = isChallengeRewardsEnabled();

  useEffect(() => {
    if (rewardsOn) {
      void hydrate(challenge?.challengeDate);
    }
  }, [challenge?.challengeDate, hydrate, rewardsOn]);

  if (!rewardsOn) {
    return (
      <BlazeScreenBackground>
        <View style={[styles.disabled, { width: columnWidth }]}>
          <Text style={styles.title}>CHALLENGE REWARDS DISABLED</Text>
          <BlazeButton label="BACK" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </BlazeScreenBackground>
    );
  }

  const weekly = status?.weekly;
  const nextTier = weekly ? nextWeeklyTier(weekly.challengePoints) : null;
  const currentTier = weekly
    ? weeklyTierForChallengePoints(weekly.challengePoints)
    : null;

  return (
    <BlazeScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { width: columnWidth, maxWidth: CONTENT_MAX }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => refresh(challenge?.challengeDate)}
            tintColor={kitColors.fire.orange}
          />
        }
      >
        <Text style={styles.title}>CHALLENGE REWARDS</Text>
        {isOfflineCache && lastUpdatedAt ? (
          <Text style={styles.stale}>LAST UPDATED {new Date(lastUpdatedAt).toLocaleString()}</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isLoading ? (
          <ActivityIndicator color={kitColors.fire.orange} />
        ) : (
          <>
            <BlazePanel style={styles.panel}>
              <Text style={styles.label}>PARTICIPATION</Text>
              <Text style={styles.value}>
                {status?.participation.granted ? 'GRANTED (+20 COINS, +75 XP)' : 'PENDING VERIFICATION'}
              </Text>
            </BlazePanel>

            <BlazePanel style={styles.panel}>
              <Text style={styles.label}>DAILY PLACEMENT</Text>
              {status?.placement.finalized ? (
                <Text style={styles.value}>
                  {status.placement.granted
                    ? `FINALIZED · +${status.placement.coins_if_finalized ?? 0} COINS`
                    : 'FINALIZED · NO PLACEMENT COINS'}
                </Text>
              ) : status?.placement.pending ? (
                <Text style={styles.value}>PLACEMENT REWARD CALCULATED AFTER THE CHALLENGE ENDS</Text>
              ) : (
                <Text style={styles.value}>NOT RANKED TODAY</Text>
              )}
            </BlazePanel>

            {isWeeklyChallengeRewardsEnabled() && weekly ? (
              <BlazePanel style={styles.panel}>
                <Text style={styles.label}>WEEKLY CHALLENGE POINTS</Text>
                <Text style={styles.value}>{weekly.challengePoints} PTS</Text>
                <Text style={styles.hint}>
                  Tier: {currentTier?.label ?? 'NONE'}
                  {nextTier ? ` · Next: ${nextTier.label} (${nextTier.minChallengePoints} PTS)` : ''}
                </Text>
                {weekly.previousWeekClaimable ? (
                  <BlazeButton
                    label={`CLAIM ${weekly.previousWeekCoins} COINS`}
                    onPress={() => {
                      trackEvent('weekly_reward_claim_started');
                      void claimWeekly(weekly.previousWeekStart);
                    }}
                    disabled={isClaimingWeekly}
                  />
                ) : weekly.previousWeekFinalized ? (
                  <Text style={styles.hint}>Previous week reward claimed or unavailable</Text>
                ) : (
                  <Text style={styles.hint}>Weekly reward pending finalization</Text>
                )}
              </BlazePanel>
            ) : null}

            {isChallengeStreaksEnabled() && status?.streak ? (
              <BlazePanel style={styles.panel}>
                <Text style={styles.label}>CHALLENGE STREAK</Text>
                <Text style={styles.value}>{status.streak.current} DAYS</Text>
                <Text style={styles.hint}>Longest: {status.streak.longest}</Text>
              </BlazePanel>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <BlazeButton label="BACK" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    alignSelf: 'center',
    paddingTop: kitSpacing.xl,
    paddingBottom: 120,
    gap: kitSpacing.md,
  },
  disabled: {
    flex: 1,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: kitSpacing.md,
    padding: kitSpacing.lg,
  },
  title: {
    color: kitColors.text.primary,
    fontSize: 28,
    fontFamily: kitTypography.families.display,
    letterSpacing: 1,
  },
  panel: { gap: kitSpacing.xs },
  label: {
    color: kitColors.fire.gold,
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: kitTypography.families.condensed,
  },
  value: {
    color: kitColors.text.primary,
    fontSize: 16,
    lineHeight: 22,
  },
  hint: {
    color: kitColors.text.secondary,
    fontSize: 13,
  },
  error: {
    color: kitColors.status.danger,
    textAlign: 'center',
  },
  stale: {
    color: kitColors.fire.orange,
    fontSize: 12,
  },
  footer: {
    position: 'absolute',
    left: kitSpacing.md,
    right: kitSpacing.md,
    bottom: kitSpacing.lg,
  },
});
