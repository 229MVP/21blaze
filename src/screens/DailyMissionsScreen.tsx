import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { DailyMissionsScreenProps } from '../navigation/navigationTypes';
import type { DailyMissionView } from '../progression/types';
import { useAuthStore } from '../store/useAuthStore';
import { useProgressionStore } from '../store/useProgressionStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function formatReset(iso: string | null | undefined): string {
  if (!iso) {
    return 'Reset time syncing…';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Reset time syncing…';
  }
  return `Resets ${date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function MissionCard({
  mission,
  claiming,
  online,
  onClaim,
}: {
  mission: DailyMissionView;
  claiming: boolean;
  online: boolean;
  onClaim: () => void;
}) {
  const fraction =
    mission.targetValue <= 0
      ? 1
      : Math.max(0, Math.min(1, mission.progress / mission.targetValue));
  const widthPercent = `${Math.round(fraction * 100)}%` as `${number}%`;
  const canClaim = mission.isComplete && !mission.isClaimed && online;

  return (
    <View style={styles.missionCard}>
      <Text style={styles.missionName}>{mission.name}</Text>
      <Text style={styles.missionDesc}>{mission.description}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: widthPercent }]} />
      </View>
      <View style={styles.missionMeta}>
        <Text style={styles.progressText}>
          {mission.progress}/{mission.targetValue}
        </Text>
        <Text style={styles.rewardText}>
          +{mission.xpReward} XP · +{mission.blazeCoinReward} coins
        </Text>
      </View>
      {mission.isClaimed ? (
        <Text style={styles.claimed}>CLAIMED</Text>
      ) : (
        <BlazeButton
          title="CLAIM"
          onPress={onClaim}
          disabled={!canClaim || claiming}
          loading={claiming}
          fullWidth
        />
      )}
    </View>
  );
}

export function DailyMissionsScreen({ navigation }: DailyMissionsScreenProps) {
  const authStatus = useAuthStore((state) => state.authStatus);
  const dailyMissions = useProgressionStore((state) => state.dailyMissions);
  const missionClaimStatus = useProgressionStore((state) => state.missionClaimStatus);
  const error = useProgressionStore((state) => state.error);
  const loadDailyMissions = useProgressionStore((state) => state.loadDailyMissions);
  const claimMission = useProgressionStore((state) => state.claimMission);
  const clearError = useProgressionStore((state) => state.clearError);

  useEffect(() => {
    clearError();
    void loadDailyMissions();
  }, [clearError, loadDailyMissions]);

  const missions = dailyMissions?.missions ?? [];
  const online = authStatus === 'online';

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="DAILY MISSIONS" />
        <Text style={styles.reset}>{formatReset(dailyMissions?.resetAt)}</Text>

        {!online ? (
          <Text style={styles.offline}>
            Connect online to sync progression and claim rewards.
          </Text>
        ) : null}

        {missions.length === 0 ? (
          <Text style={styles.empty}>
            {online
              ? 'Missions are loading or unavailable right now.'
              : 'Missions require an online connection.'}
          </Text>
        ) : (
          missions.slice(0, 3).map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              claiming={missionClaimStatus === 'claiming'}
              online={online}
              onClaim={() => {
                void claimMission(mission.id);
              }}
            />
          ))
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <BlazeButton
          title="BACK"
          variant="secondary"
          onPress={() => navigation.goBack()}
          fullWidth
        />
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
  reset: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  offline: {
    ...typography.body,
    color: colors.gold,
    textAlign: 'center',
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  missionCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: colors.backgroundCard,
    padding: spacing.md,
    gap: spacing.sm,
  },
  missionName: {
    fontFamily: fontFamilies.display,
    fontSize: 20,
    color: colors.textPrimary,
  },
  missionDesc: {
    ...typography.body,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  missionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  progressText: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.textPrimary,
  },
  rewardText: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.gold,
  },
  claimed: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.success,
    textAlign: 'center',
    letterSpacing: 1.2,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },
});
