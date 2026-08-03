/**
 * Version 1.2A — small, typed visual-event bus.
 *
 * This is presentation-only plumbing: it exists so `ThemedBoardEffectLayer`
 * / `ThemedVictoryEffect` can react to gameplay moments without gameplay
 * code importing anything visual. Events published here are NEVER
 * authoritative — nothing reads this bus to decide score, timers, or
 * rewards. The single real source of truth for gameplay remains
 * `useGameStore` (see `useBoardEffectEventBridge` in
 * `src/hooks/useBoardEffectEventBridge.ts`, which translates
 * `useGameStore`'s existing `lastMoveEvent` into these visual events
 * rather than introducing a second gameplay event source).
 *
 * Deliberately not a Zustand store — subscribers are plain closures held
 * in a module-level `Set`, so no native/animation objects ever end up in
 * persisted or devtools-inspected state.
 */

export type BoardEffectEventType =
  | 'card_placed'
  | 'exact_21'
  | 'five_card_clear'
  | 'bust'
  | 'multiplier_up'
  | 'streak_increased'
  | 'match_complete'
  | 'high_score';

export type VisualEffectIntensity = 'low' | 'medium' | 'high';

export type VisualEffectEvent = {
  /** Stable per-occurrence id, used for deduplication. Never a full move-log entry. */
  eventId: string;
  eventType: BoardEffectEventType;
  timestamp: number;
  laneId?: number;
  intensity: VisualEffectIntensity;
  /** The resolved board_effect or victory_effect themeId active when this fired. */
  themeContext: string;
};

type VisualEventListener = (event: VisualEffectEvent) => void;

const listeners = new Set<VisualEventListener>();
const recentEventIds = new Set<string>();
const RECENT_ID_LIMIT = 50;

export function subscribeToVisualEffects(listener: VisualEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Publishes one visual event to all subscribers. De-duplicates by
 * `eventId` — republishing the same id (e.g. from a rerender or a retried
 * dispatch) is a silent no-op, never a duplicate visual.
 */
export function publishVisualEffectEvent(event: VisualEffectEvent): void {
  if (recentEventIds.has(event.eventId)) {
    return;
  }
  recentEventIds.add(event.eventId);
  if (recentEventIds.size > RECENT_ID_LIMIT) {
    const oldest = recentEventIds.values().next().value;
    if (oldest !== undefined) {
      recentEventIds.delete(oldest);
    }
  }
  for (const listener of listeners) {
    listener(event);
  }
}

export function __resetVisualEventBusForTests(): void {
  listeners.clear();
  recentEventIds.clear();
}
