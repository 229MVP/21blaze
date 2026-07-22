import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  type AppStateStatus,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { PlayingCard } from '../components/Card/PlayingCard';
import { GameFeedbackBanner } from '../components/GameFeedback/GameFeedbackBanner';
import { BlazeStreakMeter } from '../components/GameHUD/BlazeStreakMeter';
import { HUDStatBox } from '../components/GameHUD/HUDStatBox';
import { GameLane } from '../components/GameLane/GameLane';
import { GameStartCountdown } from '../components/GameTimer/GameStartCountdown';
import { PauseOverlay } from '../components/GameTimer/PauseOverlay';
import { TimerDisplay } from '../components/GameTimer/TimerDisplay';
import { ScreenContainer } from '../components/ScreenContainer';
import { FINAL_WARNING_SECONDS, LANE_IDS, MAX_BUSTS } from '../game/constants';
import type { Card } from '../game/types';
import type { GameScreenProps } from '../navigation/navigationTypes';
import { useActiveCardTheme } from '../cosmetics/useActiveCardTheme';
import { useGameStore } from '../store/useGameStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

export function GameScreen({ navigation }: GameScreenProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const cardStyle = useActiveCardTheme();

  const status = useGameStore((state) => state.status);
  const score = useGameStore((state) => state.score);
  const multiplier = useGameStore((state) => state.multiplier);
  const busts = useGameStore((state) => state.busts);
  const clearedLanes = useGameStore((state) => state.clearedLanes);
  const highScore = useGameStore((state) => state.highScore);
  const matchId = useGameStore((state) => state.matchId);
  const activeCard = useGameStore((state) => state.activeCard);
  const deckLength = useGameStore((state) => state.deck.length);
  const lanes = useGameStore((state) => state.lanes);
  const isProcessingMove = useGameStore((state) => state.isProcessingMove);
  const lastMoveEvent = useGameStore((state) => state.lastMoveEvent);
  const timerStatus = useGameStore((state) => state.timerStatus);
  const timeRemainingSeconds = useGameStore((state) => state.timeRemainingSeconds);
  const startCountdownValue = useGameStore((state) => state.startCountdownValue);
  const gameOverReason = useGameStore((state) => state.gameOverReason);
  const cardsPlayed = useGameStore((state) => state.cardsPlayed);

  const isPreparingMatch = useGameStore((state) => state.isPreparingMatch);
  const prepareAndStartGame = useGameStore((state) => state.prepareAndStartGame);
  const restartGame = useGameStore((state) => state.restartGame);
  const playCardToLane = useGameStore((state) => state.playCardToLane);
  const clearLastMoveEvent = useGameStore((state) => state.clearLastMoveEvent);
  const updateStartCountdown = useGameStore((state) => state.updateStartCountdown);
  const beginTimedGame = useGameStore((state) => state.beginTimedGame);
  const synchronizeTimer = useGameStore((state) => state.synchronizeTimer);
  const pauseGame = useGameStore((state) => state.pauseGame);
  const resumeGame = useGameStore((state) => state.resumeGame);
  const quitGame = useGameStore((state) => state.quitGame);

  const cardsRemaining = deckLength + (activeCard ? 1 : 0);
  const hasNavigatedToResults = useRef(false);
  const countdownSessionId = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const previousScore = useRef(score);
  const previousMultiplier = useRef(multiplier);
  const previousBusts = useRef(busts);
  const [scorePulseToken, setScorePulseToken] = useState(0);
  const [multiplierPulseToken, setMultiplierPulseToken] = useState(0);
  const [multiplierFlashDanger, setMultiplierFlashDanger] = useState(false);
  const [bustPulseToken, setBustPulseToken] = useState(0);

  useEffect(() => {
    const current = useGameStore.getState();
    if (
      !current.isPreparingMatch &&
      (current.status !== 'playing' || current.timerStatus === 'ready')
    ) {
      countdownSessionId.current += 1;
      void prepareAndStartGame();
    }
  }, [prepareAndStartGame]);

  useEffect(() => {
    if (status === 'playing' && timerStatus === 'countdown') {
      hasNavigatedToResults.current = false;
    }
  }, [status, timerStatus]);

  useEffect(() => {
    if (timerStatus !== 'countdown' || status !== 'playing') {
      return;
    }

    const delayMs = startCountdownValue === 0 ? 550 : 1000;
    const session = countdownSessionId.current;

    const timeoutId = setTimeout(() => {
      if (countdownSessionId.current !== session) {
        return;
      }

      if (startCountdownValue > 0) {
        updateStartCountdown(startCountdownValue - 1);
        return;
      }

      beginTimedGame(Date.now());
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    beginTimedGame,
    startCountdownValue,
    status,
    timerStatus,
    updateStartCountdown,
  ]);

  useEffect(() => {
    if (timerStatus !== 'running' || status !== 'playing') {
      return;
    }

    synchronizeTimer(Date.now());
    const intervalId = setInterval(() => {
      synchronizeTimer(Date.now());
    }, 250);

    return () => {
      clearInterval(intervalId);
    };
  }, [status, synchronizeTimer, timerStatus]);

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus) => {
      const wasActive = appStateRef.current === 'active';
      appStateRef.current = nextState;

      if (
        wasActive &&
        nextState !== 'active' &&
        useGameStore.getState().timerStatus === 'running'
      ) {
        pauseGame(Date.now());
      }
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [pauseGame]);

  useEffect(() => {
    if (status !== 'finished' || hasNavigatedToResults.current) {
      return;
    }

    if (!gameOverReason || gameOverReason === 'quit') {
      return;
    }

    hasNavigatedToResults.current = true;
    navigation.replace('Results', {
      score,
      highScore,
      clearedLanes,
      busts,
      gameOverReason,
      timeRemainingSeconds,
      cardsPlayed,
      matchId: matchId ?? undefined,
    });
  }, [
    busts,
    cardsPlayed,
    clearedLanes,
    gameOverReason,
    highScore,
    matchId,
    navigation,
    score,
    status,
    timeRemainingSeconds,
  ]);

  useEffect(() => {
    if (score > previousScore.current) {
      setScorePulseToken((token) => token + 1);
    }
    previousScore.current = score;
  }, [score]);

  useEffect(() => {
    if (multiplier > previousMultiplier.current) {
      setMultiplierFlashDanger(false);
      setMultiplierPulseToken((token) => token + 1);
    } else if (multiplier < previousMultiplier.current) {
      setMultiplierFlashDanger(true);
      setMultiplierPulseToken((token) => token + 1);
    }
    previousMultiplier.current = multiplier;
  }, [multiplier]);

  useEffect(() => {
    if (busts > previousBusts.current) {
      setBustPulseToken((token) => token + 1);
    }
    previousBusts.current = busts;
  }, [busts]);

  const handleFeedbackFinished = useCallback(() => {
    clearLastMoveEvent();
  }, [clearLastMoveEvent]);

  const confirmRestart = useCallback(() => {
    Alert.alert('Restart Game', 'Start a fresh timed run from 2:00?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restart',
        style: 'destructive',
        onPress: () => {
          hasNavigatedToResults.current = false;
          countdownSessionId.current += 1;
          restartGame();
        },
      },
    ]);
  }, [restartGame]);

  const confirmQuitToHome = useCallback(() => {
    Alert.alert('Quit Match', 'Leave this timed run and return home?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Quit',
        style: 'destructive',
        onPress: () => {
          quitGame();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        },
      },
    ]);
  }, [navigation, quitGame]);

  const handlePause = () => {
    if (timerStatus === 'running') {
      pauseGame(Date.now());
    }
  };

  const handleResume = () => {
    resumeGame(Date.now());
  };

  const isCountdown = timerStatus === 'countdown';
  const isPaused = timerStatus === 'paused';
  const canPlay =
    status === 'playing' &&
    timerStatus === 'running' &&
    activeCard !== null &&
    !isProcessingMove &&
    !isPreparingMatch;
  const showFinalBlaze =
    timerStatus === 'running' && timeRemainingSeconds <= FINAL_WARNING_SECONDS;

  return (
    <ScreenContainer
      style={styles.screen}
      intensity={showFinalBlaze ? 'intense' : 'subtle'}
      padded={false}
    >
      <LinearGradient
        colors={[colors.backgroundSecondary, 'transparent']}
        style={styles.hudGlow}
        pointerEvents="none"
      />

      <GameFeedbackBanner event={lastMoveEvent} onFinished={handleFeedbackFinished} />

      {isPreparingMatch || status !== 'playing' ? (
        <View style={styles.preparing}>
          <Text style={styles.preparingTitle}>LIGHTING THE DECK</Text>
          <Text style={styles.preparingDetail}>Preparing your match…</Text>
        </View>
      ) : null}

      <View style={styles.padded}>
        <View style={styles.statsRow}>
          <HUDStatBox
            label="SCORE"
            value={score.toLocaleString()}
            pulseToken={scorePulseToken}
            mode="pulse"
          />
          <HUDStatBox
            label="MULTIPLIER"
            value={`x${multiplier}`}
            valueColor={showFinalBlaze ? colors.gold : colors.primary}
            pulseToken={multiplierPulseToken}
            mode={multiplierFlashDanger ? 'danger' : 'pulse'}
          />
          <HUDStatBox
            label="BUSTS"
            value={`${busts}/${MAX_BUSTS}`}
            valueColor={busts > 0 ? colors.warningRed : colors.gold}
            pulseToken={bustPulseToken}
            mode="shake"
          />
          <HUDStatBox label="CARDS" value={String(cardsRemaining)} />
        </View>

        <BlazeStreakMeter multiplier={multiplier} />

        <View style={styles.timerBlock}>
          {showFinalBlaze ? (
            <Text style={styles.finalBlaze}>FINAL BLAZE</Text>
          ) : null}
          <TimerDisplay
            seconds={timeRemainingSeconds}
            warningThreshold={FINAL_WARNING_SECONDS}
            isPaused={isPaused}
          />
        </View>

        <View style={styles.playArea}>
          <View style={styles.activeSection}>
            {activeCard ? (
              <ActiveCardStage
                card={activeCard}
                compact={isCompact}
                cardStyle={cardStyle}
              />
            ) : (
              <View
                style={[
                  styles.activePlaceholder,
                  isCompact && styles.activePlaceholderCompact,
                ]}
              >
                <Text style={styles.placeholderText}>No card</Text>
              </View>
            )}
            <Text style={styles.chooseLabel}>CHOOSE A LANE</Text>
          </View>

          <View style={styles.lanesGrid}>
            {LANE_IDS.map((laneId) => {
              const lane = lanes.find((item) => item.id === laneId) ?? {
                id: laneId,
                cards: [],
              };
              const isEventLane = lastMoveEvent?.laneId === laneId;

              return (
                <View key={laneId} style={styles.laneCell}>
                  <GameLane
                    lane={lane}
                    disabled={!canPlay}
                    onPress={() => playCardToLane(laneId)}
                    feedbackType={isEventLane ? lastMoveEvent?.type ?? null : null}
                    feedbackEventId={isEventLane ? lastMoveEvent?.id ?? null : null}
                    cardStyle={cardStyle}
                  />
                </View>
              );
            })}
          </View>

          <GameStartCountdown value={startCountdownValue} visible={isCountdown} />
          <PauseOverlay
            visible={isPaused}
            onResume={handleResume}
            onRestart={confirmRestart}
            onQuit={confirmQuitToHome}
          />
        </View>

        <View style={styles.actions}>
          <BlazeButton
            title="PAUSE"
            variant="secondary"
            onPress={handlePause}
            disabled={timerStatus !== 'running'}
            style={styles.actionBtn}
          />
          <BlazeButton
            title="RESTART"
            onPress={confirmRestart}
            style={styles.actionBtn}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

type ActiveCardStageProps = {
  card: Card;
  compact: boolean;
  cardStyle: string;
};

function ActiveCardStage({ card, compact, cardStyle }: ActiveCardStageProps) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = 0.35;
    scale.value = 0.94;
    opacity.value = withTiming(1, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withTiming(1, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
    });
  }, [card.id, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View key={card.id} style={[styles.activeCardWrap, animatedStyle]}>
      <View style={styles.cardGlow} pointerEvents="none" />
      <PlayingCard
        card={card}
        size={compact ? 'medium' : 'large'}
        glowing
        cardStyle={cardStyle}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    overflow: 'hidden',
  },
  hudGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  preparing: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 8,
    paddingHorizontal: spacing.lg,
  },
  preparingTitle: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.primary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  preparingDetail: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.sm,
  },
  timerBlock: {
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: 4,
  },
  finalBlaze: {
    fontFamily: fontFamilies.display,
    fontSize: 13,
    letterSpacing: 2,
    color: colors.gold,
    textAlign: 'center',
  },
  playArea: {
    flex: 1,
    position: 'relative',
    minHeight: 260,
  },
  activeSection: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 120,
  },
  activeCardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,101,0,0.22)',
  },
  chooseLabel: {
    ...typography.label,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textSecondary,
  },
  activePlaceholder: {
    width: 100,
    height: 140,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePlaceholderCompact: {
    width: 72,
    height: 100,
  },
  placeholderText: {
    ...typography.label,
  },
  lanesGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
    minHeight: 180,
  },
  laneCell: {
    width: '48%',
    flexGrow: 1,
    maxWidth: '100%',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
