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

import { PlayingCard } from '../components/Card/PlayingCard';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { BlazeStreakMeter } from '../components/GameHUD/BlazeStreakMeter';
import { HUDStatBox } from '../components/GameHUD/HUDStatBox';
import { GameLane } from '../components/GameLane/GameLane';
import { TimerDisplay } from '../components/GameTimer/TimerDisplay';
import { ScreenContainer } from '../components/ScreenContainer';
import { FINAL_WARNING_SECONDS, LANE_IDS, MAX_BUSTS } from '../game/constants';
import {
  createInitialGameStateFromSeed,
  placeCardInLane,
} from '../game/gameEngine';
import { isTimerExpired } from '../game/timerEngine';
import type { GameOverReason, GameState, LaneId } from '../game/types';
import type { MoveLogEntry } from '../online/types';
import type { LiveGameScreenProps } from '../navigation/navigationTypes';
import { selectCardStyle, useSettingsStore } from '../store/useSettingsStore';
import { useLiveMatchStore } from '../store/useLiveMatchStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function remainingFromServerEndsAt(endsAt: string | null, now: number): number {
  if (!endsAt) {
    return 120;
  }
  const endsMs = Date.parse(endsAt);
  if (!Number.isFinite(endsMs)) {
    return 120;
  }
  return Math.max(0, Math.min(120, Math.ceil((endsMs - now) / 1000)));
}

export function LiveGameScreen({ navigation }: LiveGameScreenProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 380;
  const cardStyle = useSettingsStore(selectCardStyle);

  const matchState = useLiveMatchStore((state) => state.matchState);
  const serverStartsAt = useLiveMatchStore((state) => state.serverStartsAt);
  const serverEndsAt = useLiveMatchStore((state) => state.serverEndsAt);
  const opponentProgress = useLiveMatchStore((state) => state.opponentProgress);
  const connectionStatus = useLiveMatchStore((state) => state.connectionStatus);
  const gameplayFlash = useLiveMatchStore((state) => state.gameplayFlash);
  const submissionStatus = useLiveMatchStore((state) => state.submissionStatus);
  const finalResult = useLiveMatchStore((state) => state.finalResult);
  const sendProgress = useLiveMatchStore((state) => state.sendProgress);
  const sendGameplayEvent = useLiveMatchStore((state) => state.sendGameplayEvent);
  const submitResult = useLiveMatchStore((state) => state.submitResult);
  const reconnectToMatch = useLiveMatchStore((state) => state.reconnectToMatch);
  const clearGameplayFlash = useLiveMatchStore((state) => state.clearGameplayFlash);
  const leaveMatch = useLiveMatchStore((state) => state.leaveMatch);
  const isRanked = matchState?.match.mode === 'ranked';

  const seed = matchState?.match.seed;
  const [game, setGame] = useState<GameState | null>(null);
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([]);
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(120);
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const submittedRef = useRef(false);
  const navigatedRef = useRef(false);
  const moveLogRef = useRef<MoveLogEntry[]>([]);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const finishMatch = useCallback(
    async (reason: Exclude<GameOverReason, 'quit'>) => {
      if (submittedRef.current) {
        return;
      }
      submittedRef.current = true;

      void sendGameplayEvent(
        'emote',
        reason === 'busts' ? 'Finished — busts' : 'Finished',
      );
      await submitResult(moveLogRef.current);

      if (
        useLiveMatchStore.getState().finalResult ||
        useLiveMatchStore.getState().submissionStatus === 'verified'
      ) {
        if (!navigatedRef.current) {
          navigatedRef.current = true;
          navigation.replace('LiveDuelResults');
        }
      }
    },
    [navigation, sendGameplayEvent, submitResult],
  );

  useEffect(() => {
    if (typeof seed !== 'number') {
      return;
    }
    setGame(createInitialGameStateFromSeed(seed));
    setMoveLog([]);
    moveLogRef.current = [];
    submittedRef.current = false;
    navigatedRef.current = false;
  }, [seed]);

  useEffect(() => {
    moveLogRef.current = moveLog;
  }, [moveLog]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const startsMs = serverStartsAt ? Date.parse(serverStartsAt) : NaN;
      if (Number.isFinite(startsMs) && now < startsMs) {
        setHasStarted(false);
        setTimeRemainingSeconds(120);
        return;
      }

      setHasStarted(true);
      const remaining = remainingFromServerEndsAt(serverEndsAt, now);
      setTimeRemainingSeconds(remaining);

      if (isTimerExpired(remaining) && !submittedRef.current) {
        void finishMatch('timeExpired');
      }
    }, 200);

    return () => clearInterval(id);
  }, [finishMatch, serverEndsAt, serverStartsAt]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const wasActive = appStateRef.current === 'active';
      appStateRef.current = next;
      if (!wasActive && next === 'active') {
        void reconnectToMatch();
      }
    });
    return () => sub.remove();
  }, [reconnectToMatch]);

  useEffect(() => {
    if (!gameplayFlash) {
      return;
    }
    const id = setTimeout(() => clearGameplayFlash(), 1400);
    return () => clearTimeout(id);
  }, [clearGameplayFlash, gameplayFlash]);

  useEffect(() => {
    if (
      (finalResult?.match.status === 'completed' ||
        finalResult?.match.status === 'forfeited') &&
      !navigatedRef.current
    ) {
      navigatedRef.current = true;
      if (finalResult?.match.mode === 'ranked' || matchState?.match.mode === 'ranked') {
        navigation.replace('RankedResults');
      } else {
        navigation.replace('LiveDuelResults');
      }
    }
  }, [
    finalResult?.match.mode,
    finalResult?.match.status,
    matchState?.match.mode,
    navigation,
  ]);

  const confirmRankedQuit = () => {
    Alert.alert(
      'Leave Ranked Match?',
      'Leaving this ranked match after it has started will count as a loss.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Forfeit',
          style: 'destructive',
          onPress: () => {
            void leaveMatch();
          },
        },
      ],
    );
  };

  const playCardToLane = (laneId: LaneId) => {
    if (!game || !hasStarted || isProcessingMove || game.activeCard === null) {
      return;
    }
    if (game.status !== 'playing') {
      return;
    }

    setIsProcessingMove(true);
    const running: GameState = {
      ...game,
      status: 'playing',
      timerStatus: 'running',
    };
    const next = placeCardInLane(running, laneId);
    if (next === running) {
      setIsProcessingMove(false);
      return;
    }

    const startsMs = serverStartsAt ? Date.parse(serverStartsAt) : Date.now();
    const elapsedMilliseconds = Math.max(0, Date.now() - startsMs);
    const entry: MoveLogEntry = {
      sequence: moveLog.length + 1,
      laneId,
      elapsedMilliseconds,
    };
    const cardsPlayed = (game.cardsPlayed ?? 0) + 1;
    const updated: GameState = {
      ...next,
      cardsPlayed,
    };

    const busted = updated.busts > game.busts;
    const cleared = updated.clearedLanes > game.clearedLanes;

    setGame(updated);
    setMoveLog((prev) => [...prev, entry]);
    setIsProcessingMove(false);

    sendProgress({
      score: updated.score,
      multiplier: updated.multiplier,
      busts: updated.busts,
      cardsPlayed,
      lanesCleared: updated.clearedLanes,
      elapsedMilliseconds,
    });

    if (cleared) {
      sendGameplayEvent('lane_clear', 'Lane cleared!');
    }
    if (busted) {
      sendGameplayEvent('bust', 'Bust!');
    }

    if (updated.busts >= MAX_BUSTS) {
      void finishMatch('busts');
      return;
    }
    if (updated.activeCard === null) {
      void finishMatch('deckEmpty');
    }
  };

  if (!matchState || !game) {
    return (
      <ScreenContainer style={styles.screen} intensity="subtle">
        <Text style={styles.centerText}>Preparing duel…</Text>
      </ScreenContainer>
    );
  }

  const opponent = matchState.opponent;
  const cardsRemaining = game.deck.length + (game.activeCard ? 1 : 0);
  const canPlay =
    hasStarted &&
    game.activeCard !== null &&
    !isProcessingMove &&
    submissionStatus !== 'submitting' &&
    !submittedRef.current;

  return (
    <ScreenContainer style={styles.screen} intensity="subtle" padded={false}>
      <View style={styles.padded}>
        <View style={styles.opponentPanel}>
          <Text style={styles.modeLabel}>
            {matchState.match.mode === 'ranked'
              ? 'RANKED'
              : matchState.match.mode === 'quick_match'
                ? 'QUICK MATCH'
                : 'FRIEND DUEL'}
          </Text>
          <Text style={styles.opponentName} numberOfLines={1}>
            {opponent?.displayName ?? 'Opponent'}
          </Text>
          <View style={styles.opponentStats}>
            <Text style={styles.opponentStat}>
              {opponentProgress?.score ?? 0}
            </Text>
            <Text style={styles.opponentStat}>
              x{opponentProgress?.multiplier ?? 1}
            </Text>
            <Text style={styles.opponentStat}>
              {opponentProgress?.busts ?? 0}/{MAX_BUSTS}
            </Text>
            <Text style={styles.opponentStat}>
              {opponentProgress?.cardsPlayed ?? 0}c
            </Text>
          </View>
          <Text style={styles.connection}>
            {connectionStatus === 'reconnecting'
              ? 'RECONNECTING…'
              : connectionStatus === 'connected'
                ? 'CONNECTED'
                : connectionStatus.toUpperCase()}
          </Text>
        </View>

        {gameplayFlash ? (
          <Text style={styles.flash}>{gameplayFlash.message}</Text>
        ) : null}

        {!hasStarted ? (
          <Text style={styles.prestart}>SERVER COUNTDOWN…</Text>
        ) : null}

        <View style={styles.statsRow}>
          <HUDStatBox label="SCORE" value={game.score.toLocaleString()} />
          <HUDStatBox label="MULT" value={`x${game.multiplier}`} />
          <HUDStatBox label="BUSTS" value={`${game.busts}/${MAX_BUSTS}`} />
          <HUDStatBox label="CARDS" value={String(cardsRemaining)} />
        </View>

        <BlazeStreakMeter multiplier={game.multiplier} />
        <TimerDisplay
          seconds={timeRemainingSeconds}
          warningThreshold={FINAL_WARNING_SECONDS}
          isPaused={false}
        />

        <View style={styles.activeSection}>
          {game.activeCard ? (
            <PlayingCard
              card={game.activeCard}
              size={isCompact ? 'medium' : 'large'}
              glowing
              cardStyle={cardStyle}
            />
          ) : (
            <Text style={styles.centerText}>No card</Text>
          )}
        </View>

        <View style={styles.lanesGrid}>
          {LANE_IDS.map((laneId) => {
            const lane = game.lanes.find((item) => item.id === laneId) ?? {
              id: laneId,
              cards: [],
            };
            return (
              <View key={laneId} style={styles.laneCell}>
                <GameLane
                  lane={lane}
                  disabled={!canPlay}
                  onPress={() => playCardToLane(laneId)}
                  feedbackType={null}
                  feedbackEventId={null}
                  cardStyle={cardStyle}
                />
              </View>
            );
          })}
        </View>

        {submissionStatus === 'submitting' ? (
          <Text style={styles.centerText}>VERIFYING RESULT…</Text>
        ) : null}

        {isRanked && hasStarted && submissionStatus !== 'submitting' ? (
          <BlazeButton
            title="FORFEIT"
            variant="outline"
            onPress={confirmRankedQuit}
            fullWidth
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    gap: 6,
  },
  opponentPanel: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  modeLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.textMuted,
  },
  opponentName: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 13,
    color: colors.gold,
  },
  opponentStats: {
    flexDirection: 'row',
    gap: 12,
  },
  opponentStat: {
    fontFamily: fontFamilies.display,
    fontSize: 14,
    color: colors.textPrimary,
  },
  connection: {
    ...typography.label,
    fontSize: 10,
    color: colors.textMuted,
  },
  flash: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.brightOrange,
    textAlign: 'center',
    fontSize: 13,
  },
  prestart: {
    fontFamily: fontFamilies.display,
    color: colors.primary,
    textAlign: 'center',
    fontSize: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  activeSection: {
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
  },
  lanesGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 160,
  },
  laneCell: {
    width: '48%',
    flexGrow: 1,
  },
  centerText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
