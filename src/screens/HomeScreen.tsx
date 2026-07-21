import { useEffect } from 'react';
import { Alert, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BlazeLogo } from '../components/branding/BlazeLogo';
import { FlameIcon } from '../components/branding/FlameIcon';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { APP_VERSION } from '../game/constants';
import type { HomeScreenProps } from '../navigation/navigationTypes';
import { loadHighScore } from '../storage/highScoreStorage';
import { useGameStore } from '../store/useGameStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function TrophyIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d="M7 4h10v2h3v2c0 2.2-1.5 4-3.5 4.6A4.5 4.5 0 0 1 14 15.9V18h2v2H8v-2h2v-2.1A4.5 4.5 0 0 1 7.5 12.6C5.5 12 4 10.2 4 8V6h3V4zm2 2v1.5H6.1c.2 1 .9 1.8 1.9 2.1V6zm8.9 0H15v3.6c1-.3 1.7-1.1 1.9-2.1H17.9z"
        fill={colors.gold}
      />
    </Svg>
  );
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  const { width } = useWindowDimensions();
  const logoSize = width < 360 ? 'md' : 'lg';
  const highScore = useGameStore((state) => state.highScore);
  const setHighScore = useGameStore((state) => state.setHighScore);

  useEffect(() => {
    let isMounted = true;

    const hydrateHighScore = async () => {
      const savedScore = await loadHighScore();

      if (isMounted) {
        setHighScore(savedScore);
      }
    };

    void hydrateHighScore();

    return () => {
      isMounted = false;
    };
  }, [setHighScore]);

  return (
    <ScreenContainer style={styles.container} intensity="intense">
      <View style={styles.content}>
        <BlazeLogo size={logoSize} showTagline />

        <View style={styles.highScoreBox}>
          <View style={styles.highScoreLabelRow}>
            <TrophyIcon />
            <Text style={styles.highScoreLabel}>HIGH SCORE</Text>
          </View>
          <Text style={styles.highScoreValue}>{highScore.toLocaleString()}</Text>
        </View>

        <View style={styles.actions}>
          <BlazeButton
            title="PLAY"
            onPress={() => navigation.navigate('Game')}
            accessibilityLabel="Play 21 Blaze"
            fullWidth
          />
          <View style={styles.secondaryRow}>
            <BlazeButton
              title="HOW TO PLAY"
              variant="secondary"
              onPress={() =>
                Alert.alert(
                  'Coming Soon',
                  'How to Play will be available in a later update.',
                )
              }
              style={styles.halfButton}
            />
            <BlazeButton
              title="SETTINGS"
              variant="secondary"
              onPress={() =>
                Alert.alert(
                  'Coming Soon',
                  'Settings will be available in a later update.',
                )
              }
              style={styles.halfButton}
            />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <FlameIcon width={10} height={14} />
        <Text style={styles.version}>v{APP_VERSION}</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: spacing.md,
  },
  highScoreBox: {
    width: '100%',
    backgroundColor: colors.backgroundCard,
    borderColor: colors.blazeSubtle,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  highScoreLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  highScoreLabel: {
    ...typography.label,
    letterSpacing: 1,
  },
  highScoreValue: {
    fontFamily: fontFamilies.display,
    fontSize: 36,
    lineHeight: 40,
    color: colors.primary,
    textShadowColor: colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfButton: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: spacing.md,
  },
  version: {
    ...typography.version,
  },
});
