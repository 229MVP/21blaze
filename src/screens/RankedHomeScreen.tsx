import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { DivisionBadge } from '../components/Ranked/DivisionBadge';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { RankedHomeScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { useRankedStore } from '../store/useRankedStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function formatSeasonRemaining(endsAt: string | undefined): string {
  if (!endsAt) {
    return 'Season window unavailable';
  }
  const remainingMs = Date.parse(endsAt) - Date.now();
  if (!Number.isFinite(remainingMs)) {
    return 'Season window unavailable';
  }
  if (remainingMs <= 0) {
    return 'Season ending soon';
  }
  const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m remaining`;
}

export function RankedHomeScreen({ navigation }: RankedHomeScreenProps) {
  const authStatus = useAuthStore((state) => state.authStatus);
  const hydrateRankedProfile = useRankedStore((state) => state.hydrateRankedProfile);
  const resetRankedSession = useRankedStore((state) => state.resetRankedSession);
  const activeSeason = useRankedStore((state) => state.activeSeason);
  const rankedProfile = useRankedStore((state) => state.rankedProfile);
  const isLoading = useRankedStore((state) => state.isLoading);
  const error = useRankedStore((state) => state.error);
  const online = authStatus === 'online';

  useEffect(() => {
    if (online) {
      void hydrateRankedProfile();
    }
  }, [hydrateRankedProfile, online]);

  const seasonLabel = useMemo(
    () => activeSeason?.name ?? rankedProfile?.seasonName ?? 'Ranked Season',
    [activeSeason?.name, rankedProfile?.seasonName],
  );

  const endsAt = activeSeason?.ends_at ?? rankedProfile?.seasonEndsAt;

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="RANKED DUEL" />
        <Text style={styles.season}>{seasonLabel}</Text>
        <Text style={styles.remaining}>{formatSeasonRemaining(endsAt)}</Text>

        {!online ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>ONLINE REQUIRED</Text>
            <Text style={styles.noticeBody}>
              Ranked needs a connected guest session.
            </Text>
          </View>
        ) : null}

        {isLoading && !rankedProfile ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : null}

        {rankedProfile ? (
          <View style={styles.profileBlock}>
            <DivisionBadge
              division={rankedProfile.division}
              rating={rankedProfile.rating}
              showRating={rankedProfile.placementComplete}
              size="large"
            />

            {!rankedProfile.placementComplete ? (
              <View style={styles.placementBox}>
                <Text style={styles.placementTitle}>PLACEMENT MATCHES</Text>
                <Text style={styles.placementCount}>
                  {rankedProfile.placementMatchesCompleted} /{' '}
                  {rankedProfile.placementMatchesRequired} COMPLETE
                </Text>
              </View>
            ) : (
              <View style={styles.ratingBox}>
                <Text style={styles.ratingLabel}>RATING</Text>
                <Text style={styles.ratingValue}>
                  {rankedProfile.rating.toLocaleString()}
                </Text>
                <Text style={styles.divisionLabel}>DIVISION</Text>
                <Text style={styles.divisionValue}>
                  {rankedProfile.division.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            )}

            <Text style={styles.record}>
              {rankedProfile.wins} – {rankedProfile.losses} – {rankedProfile.draws}
            </Text>
            <Text style={styles.streak}>
              WIN STREAK {rankedProfile.currentWinStreak}
            </Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <BlazeButton
            title="FIND RANKED MATCH"
            onPress={() => {
              resetRankedSession();
              navigation.navigate('RankedSearch');
            }}
            disabled={!online}
            fullWidth
          />
          <BlazeButton
            title="RANKED LEADERBOARD"
            variant="secondary"
            onPress={() => navigation.navigate('RankedLeaderboard')}
            disabled={!online}
            fullWidth
          />
          <BlazeButton
            title="MATCH HISTORY"
            variant="outline"
            onPress={() => navigation.navigate('RankedMatchHistory')}
            disabled={!online}
            fullWidth
          />
          <BlazeButton
            title="HOW RANKED WORKS"
            variant="outline"
            onPress={() => navigation.navigate('HowRankedWorks')}
            fullWidth
          />
          <BlazeButton
            title="BACK"
            variant="outline"
            onPress={() => navigation.goBack()}
            fullWidth
          />
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
    gap: spacing.sm,
  },
  season: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    color: colors.gold,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  remaining: {
    ...typography.label,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  notice: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: 'rgba(0,0,0,0.28)',
    padding: spacing.md,
    gap: 4,
  },
  noticeTitle: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.gold,
    letterSpacing: 1,
    textAlign: 'center',
  },
  noticeBody: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  profileBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  placementBox: {
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  placementTitle: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1.2,
    color: colors.brightOrange,
  },
  placementCount: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.textPrimary,
  },
  ratingBox: {
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.sm,
  },
  ratingLabel: {
    ...typography.label,
    fontSize: 11,
    color: colors.textMuted,
  },
  ratingValue: {
    fontFamily: fontFamilies.display,
    fontSize: 42,
    color: colors.primary,
  },
  divisionLabel: {
    ...typography.label,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  divisionValue: {
    fontFamily: fontFamilies.display,
    fontSize: 26,
    color: colors.gold,
  },
  record: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  streak: {
    ...typography.label,
    fontSize: 11,
    color: colors.textSecondary,
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
