import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { FlameIcon } from '../components/branding/FlameIcon';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ResultsPanel } from '../components/Results/ResultsPanel';
import { ScreenContainer } from '../components/ScreenContainer';
import { MAX_BUSTS } from '../game/constants';
import { formatTimerSeconds } from '../game/timerEngine';
import type { GameOverReason } from '../game/types';
import type { ResultsScreenProps } from '../navigation/navigationTypes';
import { useGameStore } from '../store/useGameStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function resolveParam(value: number | undefined, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

function getResultTitle(
  reason: GameOverReason | undefined,
  isNewHighScore: boolean,
): string {
  if (isNewHighScore) {
    return 'BLAZING!';
  }

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
      return 'GOOD RUN';
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

  const isNewHighScore = score > 0 && score >= highScore;
  const title = getResultTitle(gameOverReason, isNewHighScore);

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
    <ScreenContainer style={styles.container} intensity="intense" padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <FlameIcon width={36} height={48} />
          <Text style={styles.title}>{title}</Text>
          {isNewHighScore ? (
            <Text style={styles.newHigh}>NEW HIGH SCORE!</Text>
          ) : null}
        </View>

        <LinearGradient
          colors={[colors.backgroundCard, '#222222']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.scoreCard}
        >
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{score.toLocaleString()}</Text>
        </LinearGradient>

        <ResultsPanel
          rows={[
            {
              label: 'High Score',
              value: String(highScore),
              highlight: isNewHighScore,
              showNewBadge: isNewHighScore,
            },
            { label: 'Lanes Cleared', value: String(clearedLanes) },
            { label: 'Cards Played', value: String(cardsPlayed) },
            { label: 'Busts', value: `${busts}/${MAX_BUSTS}` },
            {
              label: 'Time Remaining',
              value: formatTimerSeconds(timeRemainingSeconds),
            },
          ]}
        />

        <View style={styles.actions}>
          <BlazeButton title="PLAY AGAIN" onPress={playAgain} style={styles.actionBtn} />
          <BlazeButton
            title="RETURN HOME"
            variant="outline"
            onPress={returnHome}
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 48,
    lineHeight: 52,
    color: colors.primary,
    textAlign: 'center',
    textShadowColor: colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  newHigh: {
    ...typography.subtitle,
    color: colors.gold,
    fontSize: 14,
  },
  scoreCard: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.blazeSubtle,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  scoreLabel: {
    ...typography.label,
    letterSpacing: 1,
  },
  scoreValue: {
    fontFamily: fontFamilies.display,
    fontSize: 52,
    lineHeight: 56,
    color: colors.brightOrange,
    textShadowColor: colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
  },
});
