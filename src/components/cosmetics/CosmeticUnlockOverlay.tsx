import { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { LockerCatalogEntry } from '../../cosmetics/lockerCatalog';
import { useReducedMotionSetting } from '../../hooks/useReducedMotionSetting';
import { BlazeButton } from '../buttons/BlazeButton';
import { CosmeticPreview } from './CosmeticPreview';

type Props = {
  entry: LockerCatalogEntry | null;
  onEquipNow: () => void;
  onContinue: () => void;
};

/**
 * Version 1.1B "Blaze Locker" — unlock celebration shown exactly once per
 * server-confirmed purchase. The caller (BlazeLockerScreen) is responsible
 * for clearing `pendingUnlock` via `acknowledgeUnlock()` after either
 * button is pressed, which is what makes `entry` become null and the
 * modal disappear — it never reappears on unrelated rerenders because it
 * is keyed off that single piece of store state, not local mount timing.
 */
export function CosmeticUnlockOverlay({ entry, onEquipNow, onContinue }: Props) {
  const reduceMotion = useReducedMotionSetting();
  const scale = useSharedValue(reduceMotion ? 1 : 0.9);
  const opacity = useSharedValue(0);
  const visible = entry !== null;

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (reduceMotion) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    scale.value = withTiming(1, { duration: 220 });
    opacity.value = withTiming(1, { duration: 180 });
  }, [visible, reduceMotion, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!entry) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onContinue}
      accessibilityViewIsModal
    >
      <View style={styles.root} accessibilityRole="alert">
        <Animated.View style={[styles.card, animatedStyle]}>
          <Text style={styles.heading} accessibilityRole="header">
            NEW COSMETIC!
          </Text>
          <CosmeticPreview
            cosmeticId={entry.id}
            cosmeticType={entry.cosmeticType}
            name={entry.name}
          />
          <Text style={styles.name}>{entry.name}</Text>
          <View style={styles.actions}>
            <BlazeButton
              title="EQUIP NOW"
              onPress={onEquipNow}
              accessibilityLabel={`Equip ${entry.name} now`}
              fullWidth
            />
            <BlazeButton
              title="CONTINUE"
              variant="outline"
              onPress={onContinue}
              accessibilityLabel="Continue without equipping"
              fullWidth
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,182,41,0.5)',
    backgroundColor: 'rgba(12,10,9,0.96)',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 14,
    alignItems: 'center',
  },
  heading: {
    color: '#FFD24A',
    fontFamily: 'Anton_400Regular',
    fontSize: 24,
    letterSpacing: 1,
  },
  name: {
    color: '#F4EEE4',
    fontFamily: 'RobotoCondensed_700Bold',
    fontSize: 16,
  },
  actions: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
});
