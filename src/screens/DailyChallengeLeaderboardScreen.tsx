import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { BlazeButton } from '../components/ui/BlazeButton';
import type { DailyChallengeLeaderboardScreenProps } from '../navigation/navigationTypes';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

const CONTENT_MAX = 410;

/**
 * Leaderboard UI ships in Phase 3. This screen remains registered for deep links
 * but does not fetch or display placeholder ranks in Phase 2.
 */
export function DailyChallengeLeaderboardScreen({
  navigation,
}: DailyChallengeLeaderboardScreenProps) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);

  return (
    <BlazeScreenBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { width: columnWidth, maxWidth: CONTENT_MAX }]}
      >
        <Text style={styles.title}>DAILY LEADERBOARD</Text>
        <Text style={styles.subtitle}>Coming in Phase 3</Text>
        <Text style={styles.body}>
          Daily Blaze leaderboards, streak rewards, and placement are not available in this
          release. Complete your official attempt from the Daily Blaze screen.
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <BlazeButton label="BACK" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    alignSelf: 'center',
    paddingTop: kitSpacing.xl,
    paddingBottom: 120,
    gap: kitSpacing.md,
  },
  title: {
    color: kitColors.text.primary,
    fontSize: 28,
    fontFamily: kitTypography.families.display,
  },
  subtitle: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.condensed,
    fontSize: 14,
    letterSpacing: 1,
  },
  body: {
    color: kitColors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    left: kitSpacing.md,
    right: kitSpacing.md,
    bottom: kitSpacing.lg,
  },
});
