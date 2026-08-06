import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
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
import { isAsyncChallengesEnabled } from '../config/featureFlags';
import { getCosmetic } from '../cosmetics/catalog';
import { useInterstitialScreenTracking } from '../hooks/useInterstitialScreenTracking';
import {
  formatAsyncTimeRemaining,
  millisecondsUntilExpiration,
} from '../async/asyncChallengePolicy';
import type { AsyncChallengeSummary } from '../async/types';
import { trackEvent } from '../monetization/analytics';
import type { AsyncChallengeHubScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import {
  attemptStatusLabel,
  formatChallengeHubLabel,
  useAsyncChallengeStore,
} from '../store/useAsyncChallengeStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

const CONTENT_MAX = 410;

function ChallengeCard({
  challenge,
  viewerUserId,
  onPress,
}: {
  challenge: AsyncChallengeSummary;
  viewerUserId: string | null;
  onPress: () => void;
}) {
  const opponent =
    viewerUserId === challenge.creator.userId
      ? challenge.opponent
      : challenge.creator;
  const timeLeft = formatAsyncTimeRemaining(
    millisecondsUntilExpiration(challenge.expiresAt),
  );
  const lockerOn = true;
  const titleId = opponent?.playerTitleId;
  const titleName =
    lockerOn && titleId ? getCosmetic(titleId)?.displayName ?? titleId : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
    >
      <BlazePanel style={styles.cardPanel}>
        <View style={styles.cardHeader}>
          <ProfileFrameBadge
            size={40}
            variant={
              opponent?.profileFrameId === 'flame_profile_frame'
                ? 'flame'
                : 'default'
            }
          />
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {opponent?.displayName ?? 'Waiting for Opponent'}
            </Text>
            {titleName ? (
              <Text style={styles.cardSubtitle} numberOfLines={1}>{titleName}</Text>
            ) : null}
          </View>
          <Text style={styles.cardBadge}>
            {formatChallengeHubLabel(challenge, viewerUserId)}
          </Text>
        </View>
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardMeta}>Expires {timeLeft}</Text>
          <Text style={styles.cardMeta}>
            You: {attemptStatusLabel(challenge.yourAttemptStatus ?? 'WAITING')}
          </Text>
          <Text style={styles.cardMeta}>
            Opp: {attemptStatusLabel(opponent?.attemptStatus ?? 'WAITING')}
          </Text>
        </View>
        <Text style={styles.cardOpen}>OPEN</Text>
      </BlazePanel>
    </Pressable>
  );
}

export function AsyncChallengeHubScreen({ navigation }: AsyncChallengeHubScreenProps) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);
  const authStatus = useAuthStore((state) => state.authStatus);
  const isAnonymous = useAuthStore((state) => state.isAnonymous);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const loadChallenges = useAsyncChallengeStore((state) => state.loadChallenges);
  const activeChallenges = useAsyncChallengeStore((state) => state.activeChallenges);
  const completedChallenges = useAsyncChallengeStore((state) => state.completedChallenges);
  const isLoading = useAsyncChallengeStore((state) => state.isLoading);
  const error = useAsyncChallengeStore((state) => state.error);
  const selectChallenge = useAsyncChallengeStore((state) => state.selectChallenge);

  useInterstitialScreenTracking('other');

  useEffect(() => {
    trackEvent('async_challenge_hub_viewed');
    if (isAsyncChallengesEnabled()) {
      void loadChallenges();
    }
  }, [loadChallenges]);

  const online = authStatus === 'online' && !isAnonymous;

  const openChallenge = useCallback(
    (challenge: AsyncChallengeSummary) => {
      selectChallenge(challenge);
      navigation.navigate('AsyncChallengeDetail');
    },
    [navigation, selectChallenge],
  );

  if (!isAsyncChallengesEnabled()) {
    return (
      <BlazeScreenBackground>
        <View style={[styles.centered, { width: columnWidth }]}>
          <Text style={styles.disabledTitle}>ASYNC DUELS UNAVAILABLE</Text>
          <BlazeButton label="BACK" onPress={() => navigation.goBack()} />
        </View>
      </BlazeScreenBackground>
    );
  }

  return (
    <BlazeScreenBackground>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.column, { width: columnWidth }]}>
          <Text style={styles.title}>ASYNC DUEL</Text>
          <Text style={styles.subtitle}>
            Same deck. One attempt each. Best verified result wins.
          </Text>

          {!online ? (
            <BlazePanel style={styles.offlinePanel}>
              <Text style={styles.offlineText}>CONNECT ONLINE FOR ASYNC DUELS</Text>
              <Text style={styles.offlineDetail}>
                Sign in with an account to create or join official challenges.
              </Text>
            </BlazePanel>
          ) : null}

          <View style={styles.actions}>
            <BlazeButton
              label="CREATE CHALLENGE"
              disabled={!online}
              onPress={() => navigation.navigate('CreateAsyncChallenge')}
            />
            <BlazeButton
              label="JOIN WITH CODE"
              variant="secondary"
              disabled={!online}
              onPress={() => navigation.navigate('JoinAsyncChallenge')}
            />
          </View>

          {isLoading ? (
            <ActivityIndicator color={kitColors.fire.gold} style={styles.loader} />
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.sectionLabel}>ACTIVE CHALLENGES</Text>
          {activeChallenges.length === 0 ? (
            <Text style={styles.emptyText}>No active challenges yet.</Text>
          ) : (
            activeChallenges.map((challenge) => (
              <ChallengeCard
                key={challenge.challengeId}
                challenge={challenge}
                viewerUserId={userId}
                onPress={() => openChallenge(challenge)}
              />
            ))
          )}

          <Text style={styles.sectionLabel}>COMPLETED</Text>
          {completedChallenges.length === 0 ? (
            <Text style={styles.emptyText}>No completed challenges yet.</Text>
          ) : (
            completedChallenges.slice(0, 10).map((challenge) => (
              <ChallengeCard
                key={challenge.challengeId}
                challenge={challenge}
                viewerUserId={userId}
                onPress={() => openChallenge(challenge)}
              />
            ))
          )}
        </View>
      </ScrollView>
      <BottomActionBar
        primaryAction={{ label: 'BACK', onPress: () => navigation.goBack() }}
      />
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: kitSpacing.md,
    paddingTop: kitSpacing.lg,
    paddingBottom: 120,
    alignItems: 'center',
  },
  column: {
    gap: kitSpacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: kitSpacing.md,
    padding: kitSpacing.lg,
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
  actions: {
    gap: kitSpacing.sm,
  },
  sectionLabel: {
    color: kitColors.fire.gold,
    fontSize: 12,
    letterSpacing: 1.2,
    fontFamily: kitTypography.families.condensed,
    marginTop: kitSpacing.sm,
  },
  emptyText: {
    color: kitColors.text.secondary,
    fontSize: 14,
  },
  offlinePanel: {
    padding: kitSpacing.md,
    gap: kitSpacing.xs,
  },
  offlineText: {
    color: kitColors.fire.gold,
    fontSize: 12,
    letterSpacing: 1.2,
    fontFamily: kitTypography.families.condensed,
  },
  offlineDetail: {
    color: kitColors.text.secondary,
    fontSize: 14,
  },
  loader: {
    marginVertical: kitSpacing.md,
  },
  errorText: {
    color: kitColors.status.danger,
    fontSize: 14,
  },
  cardPressable: {
    width: '100%',
  },
  pressed: {
    opacity: 0.85,
  },
  cardPanel: {
    padding: kitSpacing.md,
    gap: kitSpacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kitSpacing.sm,
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: kitColors.text.primary,
    fontSize: 15,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: kitColors.text.secondary,
    fontSize: 13,
  },
  cardBadge: {
    color: kitColors.fire.gold,
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: kitTypography.families.condensed,
  },
  cardMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: kitSpacing.sm,
  },
  cardMeta: {
    color: kitColors.text.secondary,
    fontSize: 13,
  },
  cardOpen: {
    color: kitColors.fire.gold,
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: kitTypography.families.condensed,
    alignSelf: 'flex-end',
  },
  disabledTitle: {
    color: kitColors.text.primary,
    fontSize: 28,
    fontFamily: kitTypography.families.display,
    textAlign: 'center',
  },
});
