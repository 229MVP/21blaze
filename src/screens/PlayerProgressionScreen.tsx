import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { XpProgressBar } from '../components/Progression/XpProgressBar';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  isDailyMissionsEnabled,
  isDailyRewardsEnabled,
  isMonetizationBetaEnabled,
} from '../config/featureFlags';
import { getCosmetic } from '../cosmetics/catalog';
import { trackEvent } from '../monetization/analytics';
import type { PlayerProgressionScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { useCosmeticStore } from '../store/useCosmeticStore';
import { useProgressionStore } from '../store/useProgressionStore';
import { useRankedStore } from '../store/useRankedStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function sourceLabel(sourceType: string): string {
  switch (sourceType) {
    case 'solo_match':
      return 'Solo Match';
    case 'casual_duel':
      return 'Casual Duel';
    case 'ranked_duel':
      return 'Ranked Duel';
    case 'daily_mission':
      return 'Daily Mission';
    case 'daily_reward':
      return 'Daily Reward';
    case 'level_reward':
      return 'Level Reward';
    default:
      return sourceType.replace(/_/g, ' ');
  }
}

export function PlayerProgressionScreen({ navigation }: PlayerProgressionScreenProps) {
  const profile = useAuthStore((state) => state.profile);
  const equipped = useCosmeticStore((state) => state.equippedCosmetics);
  const owned = useCosmeticStore((state) => state.ownedCosmetics);
  const rankedProfile = useRankedStore((state) => state.rankedProfile);
  const progression = useProgressionStore((state) => state.progression);
  const recentTransactions = useProgressionStore((state) => state.recentTransactions);
  const error = useProgressionStore((state) => state.error);
  const hydrateProgression = useProgressionStore((state) => state.hydrateProgression);
  const loadProgressionHistory = useProgressionStore((state) => state.loadProgressionHistory);

  useEffect(() => {
    trackEvent('progression_profile_viewed');
    void hydrateProgression();
    void loadProgressionHistory(12);
  }, [hydrateProgression, loadProgressionHistory]);

  const titleKey = equipped.playerTitle;
  const titleName = titleKey ? getCosmetic(titleKey)?.displayName ?? titleKey : null;
  const frameName = getCosmetic(equipped.profileFrame)?.displayName ?? 'Default Frame';
  const level = progression?.level ?? 1;
  const totalXp = progression?.totalXp ?? 0;
  const currentXp = progression?.currentLevelXp ?? 0;
  const nextXp = progression?.xpRequiredForNextLevel ?? 100;

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="PROGRESSION" />

        <View style={styles.profileCard}>
          <Text style={styles.frameLabel}>{frameName.toUpperCase()}</Text>
          <Text style={styles.displayName} numberOfLines={1}>
            {profile?.display_name ?? 'Player'}
          </Text>
          {titleName ? <Text style={styles.titleLine}>{titleName}</Text> : null}
          <Text style={styles.levelHuge}>LEVEL {level}</Text>
          <Text style={styles.totalXp}>{totalXp.toLocaleString()} TOTAL XP</Text>
          <XpProgressBar
            level={level}
            currentLevelXp={currentXp}
            xpRequiredForNextLevel={nextXp}
          />
        </View>

        <View style={styles.statsRow}>
          <StatBox label="STREAK" value={String(progression?.dailyStreak ?? 0)} />
          <StatBox
            label="BEST STREAK"
            value={String(progression?.longestDailyStreak ?? 0)}
          />
          <StatBox label="COSMETICS" value={String(owned.length)} />
        </View>

        {rankedProfile ? (
          <Text style={styles.rankedLine}>
            RANKED · {rankedProfile.division.replace(/_/g, ' ').toUpperCase()}
            {rankedProfile.rating != null
              ? ` · ${rankedProfile.rating} RR`
              : ''}
          </Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.history}>
          <Text style={styles.sectionTitle}>RECENT XP</Text>
          {recentTransactions.length === 0 ? (
            <Text style={styles.emptyHistory}>No XP history yet.</Text>
          ) : (
            recentTransactions.slice(0, 8).map((tx) => (
              <View key={tx.id} style={styles.historyRow}>
                <Text style={styles.historySource} numberOfLines={1}>
                  {sourceLabel(tx.sourceType)}
                </Text>
                <Text style={styles.historyXp}>
                  {tx.xpAmount > 0 ? '+' : ''}
                  {tx.xpAmount} XP
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.actions}>
          {isDailyRewardsEnabled() ? (
            <BlazeButton
              title="DAILY REWARD"
              onPress={() => navigation.navigate('DailyReward')}
              fullWidth
            />
          ) : null}
          {isDailyMissionsEnabled() ? (
            <BlazeButton
              title="DAILY MISSIONS"
              variant="secondary"
              onPress={() => navigation.navigate('DailyMissions')}
              fullWidth
            />
          ) : null}
          {isMonetizationBetaEnabled() ? (
            <BlazeButton
              title="BLAZE STORE"
              variant="outline"
              onPress={() => navigation.navigate('BlazeStore')}
              fullWidth
            />
          ) : null}
          <BlazeButton
            title="MATCH HISTORY"
            variant="outline"
            onPress={() => navigation.navigate('HighScores')}
            fullWidth
          />
          <BlazeButton
            title="BACK"
            variant="secondary"
            onPress={() => navigation.goBack()}
            fullWidth
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  profileCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: colors.backgroundCard,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  frameLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.textMuted,
  },
  displayName: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  titleLine: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: colors.gold,
  },
  levelHuge: {
    fontFamily: fontFamilies.display,
    fontSize: 36,
    color: colors.primary,
    textShadowColor: colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  totalXp: {
    ...typography.label,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.textMuted,
  },
  statValue: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    color: colors.brightOrange,
  },
  rankedLine: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  error: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },
  history: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: 'rgba(0,0,0,0.22)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1.2,
    color: colors.gold,
  },
  emptyHistory: {
    ...typography.body,
    color: colors.textMuted,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  historySource: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  historyXp: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.brightOrange,
  },
  actions: {
    gap: spacing.sm,
  },
});
