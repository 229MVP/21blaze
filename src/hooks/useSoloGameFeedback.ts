import { useEffect, useRef } from 'react';

import { FINAL_WARNING_SECONDS } from '../game/constants';
import { blazeAudio } from '../services/audio/blazeAudio';
import { blazeHaptics } from '../services/haptics/blazeHaptics';
import { useGameStore } from '../store/useGameStore';

/**
 * Wires Solo gameplay transitions to audio/haptics once per logical event.
 * Must only mount on GameScreen.
 */
export function useSoloGameFeedback(): void {
  const status = useGameStore((s) => s.status);
  const timerStatus = useGameStore((s) => s.timerStatus);
  const startCountdownValue = useGameStore((s) => s.startCountdownValue);
  const lastMoveEvent = useGameStore((s) => s.lastMoveEvent);
  const activeCard = useGameStore((s) => s.activeCard);
  const multiplier = useGameStore((s) => s.multiplier);
  const timeRemainingSeconds = useGameStore((s) => s.timeRemainingSeconds);
  const matchId = useGameStore((s) => s.matchId);

  const previousMultiplier = useRef(multiplier);
  const previousCardId = useRef<string | null>(null);
  const previousCountdown = useRef<number | null>(null);
  const finalWarningMatchId = useRef<string | null>(null);
  const lastMoveFeedbackId = useRef<string | null>(null);

  // Countdown 3 / 2 / 1 / BLAZE
  useEffect(() => {
    if (status !== 'playing' || timerStatus !== 'countdown') {
      previousCountdown.current = null;
      return;
    }

    const value = startCountdownValue;
    if (previousCountdown.current === value) {
      return;
    }
    previousCountdown.current = value;

    const session = matchId ?? 'countdown';
    if (value >= 1 && value <= 3) {
      blazeAudio.play('countdownTick', `${session}:tick:${value}`);
      blazeHaptics.countdownTick(`${session}:tick:${value}`);
      return;
    }

    if (value === 0) {
      blazeAudio.play('countdownGo', `${session}:go`);
      blazeHaptics.countdownGo(`${session}:go`);
    }
  }, [matchId, startCountdownValue, status, timerStatus]);

  // Move outcomes
  useEffect(() => {
    if (!lastMoveEvent) {
      return;
    }
    if (lastMoveFeedbackId.current === lastMoveEvent.id) {
      return;
    }
    lastMoveFeedbackId.current = lastMoveEvent.id;
    const id = lastMoveEvent.id;

    switch (lastMoveEvent.type) {
      case 'placed':
        blazeAudio.play('cardPlaced', id);
        blazeHaptics.cardPlaced(id);
        break;
      case 'cleared21':
      case 'clearedFiveCard':
        blazeAudio.play('laneClear', id);
        blazeHaptics.laneCleared(id);
        break;
      case 'bust':
        blazeAudio.play('bust', id);
        blazeHaptics.bust(id);
        break;
      default:
        break;
    }
  }, [lastMoveEvent]);

  // Card deal — new active card after start / successful place
  useEffect(() => {
    const cardId = activeCard?.id ?? null;
    if (!cardId) {
      previousCardId.current = null;
      return;
    }

    if (previousCardId.current === cardId) {
      return;
    }

    const isFirstDeal =
      previousCardId.current === null &&
      (timerStatus === 'running' || timerStatus === 'countdown');
    const isSubsequentDeal =
      previousCardId.current !== null && timerStatus === 'running';

    previousCardId.current = cardId;

    if (isFirstDeal || isSubsequentDeal) {
      blazeAudio.play('cardDeal', `deal:${cardId}`);
    }
  }, [activeCard?.id, timerStatus]);

  // Multiplier increase only
  useEffect(() => {
    if (multiplier > previousMultiplier.current) {
      const key = `mult:${matchId ?? 'm'}:${multiplier}`;
      blazeAudio.play('multiplierIncrease', key);
      blazeHaptics.multiplierRaised(key);
    }
    previousMultiplier.current = multiplier;
  }, [matchId, multiplier]);

  // Final seconds — once per match when entering warning window
  useEffect(() => {
    if (status !== 'playing' || timerStatus !== 'running') {
      return;
    }
    if (timeRemainingSeconds > FINAL_WARNING_SECONDS) {
      return;
    }
    const key = matchId ?? 'final';
    if (finalWarningMatchId.current === key) {
      return;
    }
    finalWarningMatchId.current = key;
    blazeAudio.play('finalSecondsWarning', `final:${key}`);
    blazeHaptics.warning(`final:${key}`);
  }, [matchId, status, timeRemainingSeconds, timerStatus]);

  // Reset final-warning gate when a new match prepares
  useEffect(() => {
    if (timerStatus === 'countdown') {
      finalWarningMatchId.current = null;
      lastMoveFeedbackId.current = null;
      previousCardId.current = null;
      previousCountdown.current = null;
      previousMultiplier.current = 1;
    }
  }, [timerStatus]);
}
