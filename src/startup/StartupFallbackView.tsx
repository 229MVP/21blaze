import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Synchronous rescue screen — react-native core only (plus SafeAreaView).
 * Renders before fonts, navigation, Supabase, ads, or themes load.
 */
export type StartupFallbackStage = 'starting' | 'loading' | 'classic';

const STAGE_COPY: Record<StartupFallbackStage, string> = {
  starting: 'STARTING GAME…',
  loading: 'LOADING YOUR GAME…',
  classic: 'STARTING WITH CLASSIC THEME…',
};

const FALLBACK_BACKGROUND = '#2A2520';
const FALLBACK_TEXT = '#F5E6D0';
const FALLBACK_ACCENT = '#FF6B00';

type Props = {
  stage?: StartupFallbackStage;
  onFirstLayout?: () => void;
};

export function StartupFallbackView({ stage = 'starting', onFirstLayout }: Props) {
  const handleLayout = (event: LayoutChangeEvent) => {
    if (event.nativeEvent.layout.height > 0) {
      onFirstLayout?.();
    }
  };

  return (
    <SafeAreaView style={styles.safe} onLayout={handleLayout}>
      <View style={styles.root}>
        <View style={styles.mark} />
        <Text style={styles.title}>21 BLAZE</Text>
        <Text style={styles.subtitle}>{STAGE_COPY[stage]}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: FALLBACK_BACKGROUND,
  },
  root: {
    flex: 1,
    backgroundColor: FALLBACK_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: FALLBACK_ACCENT,
  },
  title: {
    color: FALLBACK_TEXT,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
  },
  subtitle: {
    color: FALLBACK_TEXT,
    fontSize: 13,
    letterSpacing: 0.5,
    opacity: 0.9,
  },
});
