import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { PlayingCard } from '../components/Card/PlayingCard';
import { GameFeedbackBanner } from '../components/GameFeedback/GameFeedbackBanner';
import {
  laneVisualFlags,
  toKitLaneData,
} from '../components/game/adaptGameLanes';
import { BlazeStreak } from '../components/game/BlazeStreak';
import { LaneBox } from '../components/game/LaneBox';
import { StatCounterRow } from '../components/game/StatCounterRow';
import { GameStartCountdown } from '../components/GameTimer/GameStartCountdown';
import { PauseOverlay } from '../components/GameTimer/PauseOverlay';
import { TimerDisplay } from '../components/GameTimer/TimerDisplay';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { BottomActionBar } from '../components/navigation/BottomActionBar';
import { useActiveCardTheme } from '../cosmetics/useActiveCardTheme';
import {
  FINAL_WARNING_SECONDS,
  LANE_IDS,
  MAX_BUSTS,
  MAX_MULTIPLIER,
} from '../game/constants';
import type { Card, LaneId } from '../game/types';
import type { GameScreenProps } from '../navigation/navigationTypes';
import { useGameStore } from '../store/useGameStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

const CONTENT_MAX_WIDTH = 430;

export function GameScreen({ navigation }: GameScreenProps) {
  const { width, height } = useWindowDimensions();
  const isCompactWidth = width < 380;
  const isCompactHeight = height < 780;
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

  const laneData = useMemo(() => toKitLaneData(lanes, LANE_IDS), [lanes]);

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

  const streakCurrent = Math.max(0, Math.min(multiplier, MAX_MULTIPLIER));
  const contentWidth = Math.min(CONTENT_MAX_WIDTH, width);

  // Pulse tokens retained for HUD feedback wiring / future accent flashes.
  void scorePulseToken;
  void multiplierPulseToken;
  void bustPulseToken;

  return (
    <BlazeScreenBackground variant="gameplay" embers>
      <View style={styles.screen} pointerEvents="box-none">
        <LinearGradient
          pointerEvents="none"
          colors={[
            showFinalBlaze ? 'rgba(80,10,6,0.45)' : 'rgba(5,7,9,0.35)',
            'transparent',
            'rgba(5,7,9,0.55)',
          ]}
          locations={[0, 0.35, 1]}
          style={styles.vignette}
        />

        <GameFeedbackBanner
          event={lastMoveEvent}
          onFinished={handleFeedbackFinished}
        />

        {isPreparingMatch || status !== 'playing' ? (
          <View style={styles.preparing}>
            <Text style={styles.preparingTitle}>LIGHTING THE DECK</Text>
            <Text style={styles.preparingDetail}>Preparing your match…</Text>
          </View>
        ) : null}

        <View
          style={[
            styles.column,
            isCompactHeight && styles.columnCompact,
            { width: contentWidth, maxWidth: CONTENT_MAX_WIDTH },
          ]}
        >
          <StatCounterRow
            items={[
              {
                label: 'SCORE',
                value: score.toLocaleString(),
                accent: true,
              },
              {
                label: 'MULTIPLIER',
                value: `×${multiplier}`,
                accent: showFinalBlaze,
                danger: multiplierFlashDanger,
              },
              {
                label: 'BUSTS',
                value: `${busts}/${MAX_BUSTS}`,
                danger: busts > 0,
              },
              { label: 'CARDS', value: cardsRemaining },
            ]}
          />

          <BlazeStreak
            current={streakCurrent}
            maximum={MAX_MULTIPLIER}
            compact={isCompactWidth || isCompactHeight}
            label="BLAZE STREAK"
          />

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
            <View
              style={[
                styles.activeSection,
                isCompactHeight && styles.activeSectionCompact,
              ]}
            >
              {activeCard ? (
                <ActiveCardStage
                  card={activeCard}
                  compact={isCompactWidth || isCompactHeight}
                  cardStyle={cardStyle}
                />
              ) : (
                <View
                  style={[
                    styles.activePlaceholder,
                    (isCompactWidth || isCompactHeight) &&
                      styles.activePlaceholderCompact,
                  ]}
                >
                  <Text style={styles.placeholderText}>No card</Text>
                </View>
              )}
              <Text style={styles.chooseLabel}>CHOOSE A LANE</Text>
            </View>

            <View style={styles.lanesGrid}>
              {laneData.map((lane) => {
                const laneId = lane.laneNumber as LaneId;
                const flags = laneVisualFlags(
                  laneId,
                  lastMoveEvent?.laneId,
                  lastMoveEvent?.type,
                );
                const isEventLane = lastMoveEvent?.laneId === laneId;

                return (
                  <View key={laneId} style={styles.laneCell}>
                    <LaneBox
                      laneNumber={lane.laneNumber}
                      total={lane.total}
                      cards={lane.cards}
                      disabled={!canPlay}
                      selected={flags.selected}
                      danger={flags.danger}
                      cleared={flags.cleared}
                      feedbackType={
                        isEventLane ? lastMoveEvent?.type ?? null : null
                      }
                      feedbackEventId={
                        isEventLane ? lastMoveEvent?.id ?? null : null
                      }
                      onPress={() => playCardToLane(laneId)}
                    />
                  </View>
                );
              })}
            </View>

            <GameStartCountdown
              value={startCountdownValue}
              visible={isCountdown}
            />
            <PauseOverlay
              visible={isPaused}
              onResume={handleResume}
              onRestart={confirmRestart}
              onQuit={confirmQuitToHome}
            />
          </View>

          <BottomActionBar
            layout="row"
            safeAreaEnabled={false}
            primaryAction={{
              label: 'RESTART',
              onPress: confirmRestart,
              variant: 'danger',
              accessibilityLabel: 'Restart game',
            }}
            secondaryAction={{
              label: 'PAUSE',
              onPress: handlePause,
              variant: 'secondary',
              disabled: timerStatus !== 'running',
              accessibilityLabel: 'Pause game',
            }}
          />
        </View>
      </View>
    </BlazeScreenBackground>
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
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(5,7,9,0.22)',
  },
  vignette: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
  },
  column: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: kitSpacing.sm,
    paddingTop: kitSpacing.xs,
    gap: kitSpacing.sm,
  },
  columnCompact: {
    gap: 6,
  },
  preparing: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 8,
    paddingHorizontal: kitSpacing.lg,
  },
  preparingTitle: {
    fontFamily: kitTypography.families.display,
    fontSize: 28,
    color: kitColors.fire.orange,
    letterSpacing: 1,
    textAlign: 'center',
  },
  preparingDetail: {
    fontFamily: kitTypography.families.body,
    fontSize: 14,
    color: kitColors.text.secondary,
    textAlign: 'center',
  },
  timerBlock: {
    alignItems: 'center',
    gap: 4,
  },
  finalBlaze: {
    fontFamily: kitTypography.families.display,
    fontSize: 14,
    letterSpacing: 2,
    color: kitColors.status.danger,
    textAlign: 'center',
    textShadowColor: 'rgba(255,52,38,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  playArea: {
    flex: 1,
    position: 'relative',
    minHeight: 240,
  },
  activeSection: {
    alignItems: 'center',
    gap: kitSpacing.sm,
    marginBottom: kitSpacing.sm,
    minHeight: 120,
  },
  activeSectionCompact: {
    gap: 6,
    marginBottom: 6,
    minHeight: 100,
  },
  activeCardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,101,0,0.22)',
  },
  chooseLabel: {
    fontFamily: kitTypography.families.condensed,
    fontSize: 12,
    letterSpacing: 1.4,
    color: kitColors.text.secondary,
  },
  activePlaceholder: {
    width: 108,
    height: 154,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: kitColors.border.orange,
    backgroundColor: kitColors.background.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePlaceholderCompact: {
    width: 72,
    height: 104,
  },
  placeholderText: {
    fontFamily: kitTypography.families.condensed,
    color: kitColors.text.muted,
    fontSize: 12,
  },
  lanesGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 170,
  },
  laneCell: {
    width: '48%',
    flexGrow: 1,
    maxWidth: '100%',
    minHeight: 112,
  },
});
