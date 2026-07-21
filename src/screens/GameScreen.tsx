import { StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/BlazeButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { APP_NAME, LANE_COUNT, MAX_BUSTS, TEST_GAME_RESULT } from '../game/constants';
import type { GameScreenProps } from '../navigation/navigationTypes';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const LANES = Array.from({ length: LANE_COUNT }, (_, index) => index + 1);

export function GameScreen({ navigation }: GameScreenProps) {
  const returnHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const endTestGame = () => {
    navigation.navigate('Results', {
      score: TEST_GAME_RESULT.score,
      highScore: TEST_GAME_RESULT.highScore,
      clearedLanes: TEST_GAME_RESULT.clearedLanes,
      busts: TEST_GAME_RESULT.busts,
    });
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.subtitle}>Game Foundation</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>SCORE</Text>
          <Text style={styles.statValue}>0</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>MULTIPLIER</Text>
          <Text style={styles.statValue}>x1</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>BUSTS</Text>
          <Text style={styles.statValue}>
            0/{MAX_BUSTS}
          </Text>
        </View>
      </View>

      <View style={styles.lanes}>
        {LANES.map((lane) => (
          <View key={lane} style={styles.laneBox}>
            <Text style={styles.laneLabel}>Lane {lane}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <BlazeButton title="END TEST GAME" onPress={endTestGame} />
        <BlazeButton
          title="RETURN HOME"
          variant="secondary"
          onPress={returnHome}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.primary,
  },
  subtitle: {
    ...typography.subtitle,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  statLabel: {
    ...typography.label,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.secondary,
  },
  lanes: {
    flex: 1,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  laneBox: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laneLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
});
