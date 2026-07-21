import { StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/BlazeButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { APP_NAME } from '../game/constants';
import type { ResultsScreenProps } from '../navigation/navigationTypes';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

function resolveParam(value: number | undefined, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

export function ResultsScreen({ navigation, route }: ResultsScreenProps) {
  const score = resolveParam(route.params?.score);
  const highScore = resolveParam(route.params?.highScore);
  const clearedLanes = resolveParam(route.params?.clearedLanes);
  const busts = resolveParam(route.params?.busts);

  const playAgain = () => {
    navigation.replace('Game');
  };

  const returnHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.subtitle}>Results</Text>
      </View>

      <View style={styles.resultsCard}>
        <ResultRow label="Final Score" value={score} emphasize />
        <ResultRow label="High Score" value={highScore} />
        <ResultRow label="Lanes Cleared" value={clearedLanes} />
        <ResultRow label="Busts" value={busts} />
      </View>

      <View style={styles.actions}>
        <BlazeButton title="PLAY AGAIN" onPress={playAgain} />
        <BlazeButton
          title="RETURN HOME"
          variant="secondary"
          onPress={returnHome}
        />
      </View>
    </ScreenContainer>
  );
}

type ResultRowProps = {
  label: string;
  value: number;
  emphasize?: boolean;
};

function ResultRow({ label, value, emphasize = false }: ResultRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasize && styles.emphasizedValue]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.primary,
  },
  subtitle: {
    ...typography.subtitle,
  },
  resultsCard: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    ...typography.label,
  },
  rowValue: {
    ...typography.body,
    fontWeight: '700',
  },
  emphasizedValue: {
    color: colors.secondary,
    fontSize: 24,
  },
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
});
