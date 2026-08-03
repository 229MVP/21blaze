import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { isBoardEffectsEnabled } from '../../config/featureFlags';
import { useReducedMotionSetting } from '../../hooks/useReducedMotionSetting';
import { subscribeToVisualEffects, type VisualEffectEvent } from '../../services/visualEventBus';

const MAX_SIMULTANEOUS_EFFECTS = 3;

/**
 * Version 1.2C — one total on-screen duration per event type, chosen
 * within the recommended maximum ranges audited in
 * docs/V1_2C_EFFECT_TIMING_FINAL.md. These are visual-only targets: the
 * burst is removed automatically after this duration and never blocks,
 * delays, or is awaited by any gameplay code path.
 */
const EFFECT_DURATION_MS: Record<VisualEffectEvent['eventType'], number> = {
  card_placed: 380, // target range 250-500ms
  exact_21: 700, // target range 500-900ms
  five_card_clear: 850, // target range 600-1100ms
  bust: 550, // target range 400-800ms
  multiplier_up: 550, // target range 400-700ms
  streak_increased: 550,
  match_complete: 900, // target range 700-1400ms
  high_score: 1200, // target range 1000-2000ms
};

/**
 * Version 1.2B — classic vs. Ember Blaze color palettes. Selected by each
 * event's `themeContext` (the board_effect themeId resolved for the
 * player *at the moment the event fired* — see
 * `useBoardEffectEventBridge.ts`), so a player using the coordinated
 * Ember collection sees ember/gold tones while Classic stays a neutral,
 * lower-saturation glow that never competes with card readability.
 */
const CLASSIC_EFFECT_COLOR: Record<VisualEffectEvent['eventType'], string> = {
  card_placed: 'rgba(201,162,39,0.30)',
  exact_21: 'rgba(224,196,120,0.5)',
  five_card_clear: 'rgba(201,162,39,0.5)',
  bust: 'rgba(255,52,38,0.5)',
  multiplier_up: 'rgba(224,196,120,0.35)',
  streak_increased: 'rgba(224,196,120,0.35)',
  match_complete: 'rgba(66,199,106,0.4)',
  high_score: 'rgba(224,196,120,0.55)',
};

const EMBER_EFFECT_COLOR: Record<VisualEffectEvent['eventType'], string> = {
  card_placed: 'rgba(255,138,0,0.35)',
  exact_21: 'rgba(255,182,41,0.55)',
  five_card_clear: 'rgba(255,101,0,0.6)',
  bust: 'rgba(255,52,38,0.55)',
  multiplier_up: 'rgba(255,182,41,0.4)',
  streak_increased: 'rgba(255,182,41,0.4)',
  match_complete: 'rgba(255,138,0,0.45)',
  high_score: 'rgba(255,182,41,0.6)',
};

function colorForEvent(event: VisualEffectEvent): string {
  const palette = event.themeContext === 'ember_board_effect' ? EMBER_EFFECT_COLOR : CLASSIC_EFFECT_COLOR;
  return palette[event.eventType];
}

type ActiveEffect = VisualEffectEvent;

function EffectBurst({ event, onDone }: { event: ActiveEffect; onDone: (eventId: string) => void }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const duration = EFFECT_DURATION_MS[event.eventType];

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 90 }, () => {
      opacity.value = withTiming(0, { duration: Math.max(60, duration - 90) }, (finished) => {
        if (finished) {
          runOnJS(onDone)(event.eventId);
        }
      });
    });
    scale.value = withTiming(1.08, { duration, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.burst,
        { backgroundColor: colorForEvent(event) },
        animatedStyle,
      ]}
    />
  );
}

/**
 * Version 1.2A — event-driven board-effect overlay. Subscribes to
 * `src/services/visualEventBus.ts`; never intercepts touches
 * (`pointerEvents="none"` throughout), never delays gameplay (mounted
 * effects are pure presentation, removed automatically after their fixed
 * duration), and caps simultaneous effects so a burst of rapid events
 * (e.g. cascading clears) cannot stack unboundedly. Renders nothing
 * (returns null) unless `EXPO_PUBLIC_ENABLE_BOARD_EFFECTS` is on.
 */
export function ThemedBoardEffectLayer() {
  const reduceMotion = useReducedMotionSetting();
  const [effects, setEffects] = useState<ActiveEffect[]>([]);

  useEffect(() => {
    if (!isBoardEffectsEnabled()) {
      return;
    }
    return subscribeToVisualEffects((event) => {
      setEffects((current) => {
        if (current.some((existing) => existing.eventId === event.eventId)) {
          return current;
        }
        const next = [...current, event];
        // Bounded queue — drop the oldest effect rather than growing forever.
        return next.length > MAX_SIMULTANEOUS_EFFECTS
          ? next.slice(next.length - MAX_SIMULTANEOUS_EFFECTS)
          : next;
      });
    });
  }, []);

  const removeEffect = (eventId: string) => {
    setEffects((current) => current.filter((effect) => effect.eventId !== eventId));
  };

  if (!isBoardEffectsEnabled() || effects.length === 0) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {effects.map((effect) =>
        reduceMotion ? null : <EffectBurst key={effect.eventId} event={effect} onDone={removeEffect} />,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  burst: {
    borderRadius: 0,
  },
});
