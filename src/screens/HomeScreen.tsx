import { useEffect } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/BlazeButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '../game/constants';
import type { HomeScreenProps } from '../navigation/navigationTypes';
import { loadHighScore } from '../storage/highScoreStorage';
import { useGameStore } from '../store/useGameStore';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export function HomeScreen({ navigation }: HomeScreenProps) {
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
    <ScreenContainer style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.flame} accessibilityLabel="Flame icon">
          🔥
        </Text>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.subtitle}>{APP_TAGLINE}</Text>

        <View style={styles.highScoreBox}>
          <Text style={styles.highScoreLabel}>HIGH SCORE</Text>
          <Text style={styles.highScoreValue}>{highScore}</Text>
        </View>

        <View style={styles.actions}>
          <BlazeButton
            title="PLAY"
            onPress={() => navigation.navigate('Game')}
            accessibilityLabel="Play 21 Blaze"
          />
          <BlazeButton
            title="HOW TO PLAY"
            variant="secondary"
            onPress={() =>
              Alert.alert(
                'Coming Soon',
                'How to Play will be available in a later update.',
              )
            }
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
          />
        </View>
      </View>

      <Text style={styles.version}>v{APP_VERSION}</Text>
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
    gap: spacing.md,
  },
  flame: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.heroTitle,
    color: colors.primary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.subtitle,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  highScoreBox: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  highScoreLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  highScoreValue: {
    ...typography.title,
    color: colors.secondary,
  },
  actions: {
    width: '100%',
    maxWidth: 320,
    gap: spacing.sm,
  },
  version: {
    ...typography.version,
    textAlign: 'center',
    paddingBottom: spacing.md,
  },
});
