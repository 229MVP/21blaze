import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { FlameIcon } from '../components/branding/FlameIcon';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { DAILY_REWARD_CALENDAR } from '../progression/rewards';
import { getCosmetic } from '../cosmetics/catalog';
import type { DailyRewardScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { useProgressionStore } from '../store/useProgressionStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function formatNextClaim(iso: string | null): string {
  if (!iso) {
    return 'Available soon';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Available soon';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function DailyRewardScreen({ navigation }: DailyRewardScreenProps) {
  const { width } = useWindowDimensions();
  const authStatus = useAuthStore((state) => state.authStatus);
  const status = useProgressionStore((state) => state.dailyRewardStatus);
  const progression = useProgressionStore((state) => state.progression);
  const claimStatus = useProgressionStore((state) => state.dailyRewardClaimStatus);
  const error = useProgressionStore((state) => state.error);
  const loadDailyReward = useProgressionStore((state) => state.loadDailyReward);
  const claimDailyReward = useProgressionStore((state) => state.claimDailyReward);
  const clearError = useProgressionStore((state) => state.clearError);
  const [lastClaimSummary, setLastClaimSummary] = useState<string | null>(null);

  useEffect(() => {
    clearError();
    void loadDailyReward();
  }, [clearError, loadDailyReward]);

  const calendar = status?.calendar?.length
    ? status.calendar
    : [...DAILY_REWARD_CALENDAR];
  const nextDay = status?.nextStreakDay ?? 1;
  const isAvailable = status?.isAvailable ?? false;
  const cardWidth = Math.max(88, Math.min(112, Math.floor((width - 48) / 3.2)));

  const day7Cosmetic = useMemo(() => {
    const key = calendar.find((day) => day.day === 7)?.cosmeticId;
    return key ? getCosmetic(key)?.displayName ?? key : null;
  }, [calendar]);

  const onClaim = () => {
    void (async () => {
      const ok = await claimDailyReward();
      if (ok && status) {
        const reward = status.currentReward;
        const cosmetic = reward.cosmeticId
          ? getCosmetic(reward.cosmeticId)?.displayName
          : null;
        setLastClaimSummary(
          [
            `+${reward.blazeCoins} coins`,
            `+${reward.xp} XP`,
            cosmetic ? cosmetic : null,
          ]
            .filter(Boolean)
            .join(' · '),
        );
      }
    })();
  };

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="DAILY BLAZE" icon={<FlameIcon width={24} height={32} />} />

        {authStatus !== 'online' ? (
          <Text style={styles.offline}>
            Connect online to sync progression and claim rewards.
          </Text>
        ) : null}

        <View style={styles.streakRow}>
          <View style={styles.streakBox}>
            <Text style={styles.streakLabel}>STREAK</Text>
            <Text style={styles.streakValue}>
              {status?.currentStreak ?? progression?.dailyStreak ?? 0}
            </Text>
          </View>
          <View style={styles.streakBox}>
            <Text style={styles.streakLabel}>BEST</Text>
            <Text style={styles.streakValue}>
              {status?.longestStreak ?? progression?.longestDailyStreak ?? 0}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calendar}
        >
          {calendar.map((day) => {
            const isCurrent = day.day === nextDay;
            const claimedToday =
              !isAvailable && day.day === ((nextDay + 5) % 7) + 1;
            const claimedEarlierInCycle =
              status != null &&
              status.currentStreak > 0 &&
              day.day < nextDay &&
              !(nextDay === 1 && isAvailable);
            const claimedVisual = claimedToday || claimedEarlierInCycle;

            return (
              <LinearGradient
                key={day.day}
                colors={
                  isCurrent
                    ? ['rgba(255,101,0,0.35)', 'rgba(255,182,41,0.18)']
                    : ['rgba(24,24,24,1)', 'rgba(18,18,18,1)']
                }
                style={[
                  styles.dayCard,
                  { width: cardWidth },
                  isCurrent && styles.dayCardCurrent,
                  claimedVisual && styles.dayCardClaimed,
                ]}
              >
                <Text style={styles.dayLabel}>DAY {day.day}</Text>
                <Text style={styles.dayCoins}>{day.blazeCoins}</Text>
                <Text style={styles.daySub}>COINS</Text>
                <Text style={styles.dayXp}>+{day.xp} XP</Text>
                {day.cosmeticId ? (
                  <Text style={styles.dayCosmetic} numberOfLines={2}>
                    {getCosmetic(day.cosmeticId)?.displayName ?? 'Cosmetic'}
                  </Text>
                ) : null}
                {claimedVisual ? <Text style={styles.claimedTag}>CLAIMED</Text> : null}
                {isCurrent && isAvailable ? (
                  <Text style={styles.readyTag}>READY</Text>
                ) : null}
              </LinearGradient>
            );
          })}
        </ScrollView>

        {day7Cosmetic ? (
          <Text style={styles.day7Note}>Day 7 unlocks: {day7Cosmetic}</Text>
        ) : null}

        {!isAvailable ? (
          <Text style={styles.nextClaim}>
            Next claim: {formatNextClaim(status?.nextClaimAt ?? null)}
          </Text>
        ) : null}

        {lastClaimSummary && claimStatus === 'success' ? (
          <View style={styles.successBurst}>
            <FlameIcon width={28} height={36} />
            <Text style={styles.successTitle}>REWARD CLAIMED</Text>
            <Text style={styles.successDetail}>{lastClaimSummary}</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <BlazeButton
            title={isAvailable ? 'CLAIM REWARD' : 'ALREADY CLAIMED'}
            onPress={onClaim}
            disabled={!isAvailable || authStatus !== 'online' || claimStatus === 'claiming'}
            loading={claimStatus === 'claiming'}
            fullWidth
          />
          {claimStatus === 'claiming' ? (
            <ActivityIndicator color={colors.gold} />
          ) : null}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  offline: {
    ...typography.body,
    color: colors.gold,
    textAlign: 'center',
  },
  streakRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  streakBox: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: colors.backgroundCard,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  streakLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  streakValue: {
    fontFamily: fontFamilies.display,
    fontSize: 32,
    color: colors.primary,
  },
  calendar: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dayCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: spacing.sm,
    minHeight: 140,
    alignItems: 'center',
    gap: 2,
  },
  dayCardCurrent: {
    borderColor: colors.blazeStrong,
  },
  dayCardClaimed: {
    opacity: 0.72,
  },
  dayLabel: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.gold,
  },
  dayCoins: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.brightOrange,
  },
  daySub: {
    ...typography.label,
    fontSize: 10,
    color: colors.textMuted,
  },
  dayXp: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 12,
    color: colors.textPrimary,
  },
  dayCosmetic: {
    ...typography.body,
    fontSize: 11,
    color: colors.gold,
    textAlign: 'center',
    marginTop: 4,
  },
  claimedTag: {
    marginTop: 'auto',
    fontFamily: fontFamilies.bodyBold,
    fontSize: 10,
    color: colors.success,
  },
  readyTag: {
    marginTop: 'auto',
    fontFamily: fontFamilies.bodyBold,
    fontSize: 10,
    color: colors.primary,
  },
  day7Note: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  nextClaim: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  successBurst: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.blazeStrong,
    backgroundColor: 'rgba(255,101,0,0.12)',
    padding: spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  successTitle: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    color: colors.gold,
  },
  successDetail: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  error: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
  },
});
