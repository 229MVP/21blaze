import { useEffect, useRef } from 'react';

import { isBoardEffectsEnabled } from '../config/featureFlags';
import { publishVisualEffectEvent, type BoardEffectEventType } from '../services/visualEventBus';
import { useGameStore } from '../store/useGameStore';

/**
 * Version 1.2A — translates the EXISTING, authoritative gameplay event
 * stream (`useGameStore().lastMoveEvent`, already consumed by
 * `useSoloGameFeedback` for audio/haptics) into visual-only board-effect
 * events. This is deliberately a translation layer, not a second
 * gameplay event source — nothing here reads or writes game state.
 *
 * No-ops entirely when `EXPO_PUBLIC_ENABLE_BOARD_EFFECTS` is off, so
 * mounting this hook is always safe and never changes behavior unless
 * explicitly enabled.
 */
export function useBoardEffectEventBridge(boardEffectThemeId: string): void {
  const lastMoveEvent = useGameStore((state) => state.lastMoveEvent);
  const multiplier = useGameStore((state) => state.multiplier);
  const matchId = useGameStore((state) => state.matchId);
  const previousMultiplier = useRef(multiplier);
  const lastHandledMoveId = useRef<string | null>(null);

  useEffect(() => {
    if (!isBoardEffectsEnabled()) {
      return;
    }
    if (!lastMoveEvent || lastHandledMoveId.current === lastMoveEvent.id) {
      return;
    }
    lastHandledMoveId.current = lastMoveEvent.id;

    const typeMap: Record<string, BoardEffectEventType> = {
      placed: 'card_placed',
      cleared21: 'exact_21',
      clearedFiveCard: 'five_card_clear',
      bust: 'bust',
    };
    const eventType = typeMap[lastMoveEvent.type];
    if (!eventType) {
      return;
    }

    publishVisualEffectEvent({
      eventId: lastMoveEvent.id,
      eventType,
      timestamp: Date.now(),
      laneId: lastMoveEvent.laneId,
      intensity: eventType === 'five_card_clear' || eventType === 'bust' ? 'high' : 'medium',
      themeContext: boardEffectThemeId,
    });
  }, [lastMoveEvent, boardEffectThemeId]);

  useEffect(() => {
    if (!isBoardEffectsEnabled()) {
      previousMultiplier.current = multiplier;
      return;
    }
    if (multiplier > previousMultiplier.current) {
      publishVisualEffectEvent({
        eventId: `multiplier:${matchId ?? 'm'}:${multiplier}`,
        eventType: 'multiplier_up',
        timestamp: Date.now(),
        intensity: 'low',
        themeContext: boardEffectThemeId,
      });
    }
    previousMultiplier.current = multiplier;
  }, [multiplier, matchId, boardEffectThemeId]);
}
