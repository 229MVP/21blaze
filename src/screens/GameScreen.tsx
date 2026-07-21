import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/BlazeButton';
import { PlayingCard } from '../components/Card/PlayingCard';
import { GameLane } from '../components/GameLane/GameLane';
import { ScreenContainer } from '../components/ScreenContainer';
import { APP_NAME, LANE_IDS, MAX_BUSTS } from '../game/constants';
import type { GameScreenProps } from '../navigation/navigationTypes';
import { useGameStore } from '../store/useGameStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export function GameScreen({ navigation }: GameScreenProps) {
  const status = useGameStore((state) => state.status);
  const score = useGameStore((state) => state.score);
  const multiplier = useGameStore((state) => state.multiplier);
  const busts = useGameStore((state) => state.busts);
  const clearedLanes = useGameStore((state) => state.clearedLanes);
  const highScore = useGameStore((state) => state.highScore);
  const activeCard = useGameStore((state) => state.activeCard);
  const deckLength = useGameStore((state) => state.deck.length);
  const lanes = useGameStore((state) => state.lanes);
  const isProcessingMove = useGameStore((state) => state.isProcessingMove);
  const startGame = useGameStore((state) => state.startGame);
  const restartGame = useGameStore((state) => state.restartGame);
  const playCardToLane = useGameStore((state) => state.playCardToLane);

  const cardsRemaining = deckLength + (activeCard ? 1 : 0);

  useEffect(() => {
    // Start only on mount when no game is currently active.
    // Preserve an in-progress game across remounts/rerenders.
    if (useGameStore.getState().status !== 'playing') {
      startGame();
    }
  }, [startGame]);

  useEffect(() => {
    if (status !== 'finished') {
      return;
    }

    navigation.replace('Results', {
      score,
      highScore,
      clearedLanes,
      busts,
    });
  }, [busts, clearedLanes, highScore, navigation, score, status]);

  const returnHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const canPlay = status === 'playing' && activeCard !== null && !isProcessingMove;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>{APP_NAME}</Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="SCORE" value={String(score)} />
        <StatCard label="MULTIPLIER" value={`x${multiplier}`} />
        <StatCard label="BUSTS" value={`${busts}/${MAX_BUSTS}`} />
        <StatCard label="CARDS" value={String(cardsRemaining)} />
      </View>

      <View style={styles.activeSection}>
        <Text style={styles.chooseLabel}>Choose a Lane</Text>
        {activeCard ? (
          <PlayingCard card={activeCard} />
        ) : (
          <View style={styles.activePlaceholder}>
            <Text style={styles.placeholderText}>No card</Text>
          </View>
        )}
      </View>

      <View style={styles.lanesGrid}>
        {LANE_IDS.map((laneId) => {
          const lane = lanes.find((item) => item.id === laneId) ?? {
            id: laneId,
            cards: [],
          };

          return (
            <View key={laneId} style={styles.laneCell}>
              <GameLane
                lane={lane}
                disabled={!canPlay}
                onPress={() => playCardToLane(laneId)}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <BlazeButton title="RESTART GAME" onPress={restartGame} />
        <BlazeButton
          title="RETURN HOME"
          variant="secondary"
          onPress={returnHome}
        />
      </View>
    </ScreenContainer>
  );
}

type StatCardProps = {
  label: string;
  value: string;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  statLabel: {
    ...typography.label,
    fontSize: 10,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.secondary,
  },
  activeSection: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chooseLabel: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  activePlaceholder: {
    width: 92,
    height: 128,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...typography.label,
  },
  lanesGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  laneCell: {
    width: '48%',
    flexGrow: 1,
  },
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
});
