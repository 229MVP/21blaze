import { StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/BlazeButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { APP_NAME } from '../game/constants';
import { formatTimerSeconds } from '../game/timerEngine';
import type { GameOverReason } from '../game/types';
import type { ResultsScreenProps } from '../navigation/navigationTypes';
import { useGameStore } from '../store/useGameStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

function resolveParam(value: number | undefined, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

function getEndMessage(reason: GameOverReason | undefined): string {
  switch (reason) {
    case 'timeExpired':
      return 'TIME’S UP!';
    case 'busts':
      return 'TOO HOT!';
    case 'deckEmpty':
      return 'DECK CLEARED!';
    case 'quit':
      return 'GAME ENDED';
    default:
      return 'RESULTS';
  }
}

export function ResultsScreen({ navigation, route }: ResultsScreenProps) {
  const restartGame = useGameStore((state) => state.restartGame);
  const score = resolveParam(route.params?.score);
  const highScore = resolveParam(route.params?.highScore);
  const clearedLanes = resolveParam(route.params?.clearedLanes);
  const busts = resolveParam(route.params?.busts);
  const cardsPlayed = resolveParam(route.params?.cardsPlayed);
  const timeRemainingSeconds = resolveParam(route.params?.timeRemainingSeconds);
  const gameOverReason = route.params?.gameOverReason;

  const playAgain = () => {
    restartGame();
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
        <Text style={styles.endMessage}>{getEndMessage(gameOverReason)}</Text>
        <Text style={styles.subtitle}>Results</Text>
      </View>

      <View style={styles.resultsCard}>
        <ResultRow label="Final Score" value={String(score)} emphasize />
        <ResultRow label="High Score" value={String(highScore)} />
        <ResultRow label="Lanes Cleared" value={String(clearedLanes)} />
        <ResultRow label="Cards Played" value={String(cardsPlayed)} />
        <ResultRow label="Busts" value={String(busts)} />
        <ResultRow
          label="Time Remaining"
          value={formatTimerSeconds(timeRemainingSeconds)}
        />
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
  value: string;
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
  endMessage: {
    ...typography.title,
    fontSize: 24,
    color: colors.secondary,
    textAlign: 'center',
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
