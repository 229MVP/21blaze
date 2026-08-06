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
const EFFECT_DURATION_MS = 420;

const EFFECT_COLOR: Record<VisualEffectEvent['eventType'], string> = {
  card_placed: 'rgba(255,138,0,0.35)',
  exact_21: 'rgba(255,182,41,0.55)',
  five_card_clear: 'rgba(255,101,0,0.6)',
  bust: 'rgba(255,52,38,0.55)',
  multiplier_up: 'rgba(255,182,41,0.4)',
  streak_increased: 'rgba(255,182,41,0.4)',
  match_complete: 'rgba(66,199,106,0.45)',
  high_score: 'rgba(255,182,41,0.6)',
};

type ActiveEffect = VisualEffectEvent;

function EffectBurst({ event, onDone }: { event: ActiveEffect; onDone: (eventId: string) => void }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 90 }, () => {
      opacity.value = withTiming(0, { duration: EFFECT_DURATION_MS - 90 }, (finished) => {
        if (finished) {
          runOnJS(onDone)(event.eventId);
        }
      });
    });
    scale.value = withTiming(1.08, { duration: EFFECT_DURATION_MS, easing: Easing.out(Easing.cubic) });
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
        { backgroundColor: EFFECT_COLOR[event.eventType] },
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
