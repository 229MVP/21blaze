import { StyleSheet, Text, View } from 'react-native';

/**
 * Version 1.2.0 startup hotfix — the ONLY view rendered before the real
 * app shell (fonts/theme/navigation) is ready. Deliberately dependency-
 * free: no custom fonts (system font only), no remote data, no theme
 * assets, no Supabase, no ads, no RevenueCat, no SVG, no large images —
 * every one of those is a potential failure point this view must survive
 * without going blank. Uses a plain `View`/`Text` from react-native core
 * only, so it can render even if every other subsystem in the app is
 * broken.
 *
 * Never a bare, empty, black `View` — always a visible, non-black
 * background plus readable text, per the release-hotfix requirement that
 * no startup path may show only a black screen.
 */
export type StartupFallbackStage = 'starting' | 'loading' | 'classic';

const STAGE_COPY: Record<StartupFallbackStage, string> = {
  starting: 'STARTING 21 BLAZE…',
  loading: 'LOADING YOUR GAME…',
  classic: 'STARTING WITH CLASSIC THEME…',
};

// A dark-but-clearly-not-black, dependency-free color literal (never
// imported from `src/theme/*`, which could itself fail to load/evaluate
// in a truly broken bundle) — deliberately duplicated here rather than
// shared, so this view has zero import surface beyond `react-native`.
const FALLBACK_BACKGROUND = '#1A0F06';
const FALLBACK_TEXT = '#FFE7C2';
const FALLBACK_ACCENT = '#FF6B00';

export function StartupFallbackView({ stage = 'starting' }: { stage?: StartupFallbackStage }) {
  return (
    <View style={styles.root}>
      <View style={styles.mark} />
      <Text style={styles.title}>21 BLAZE</Text>
      <Text style={styles.subtitle}>{STAGE_COPY[stage]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    opacity: 0.85,
  },
});
