import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  MAX_MULTIPLIER,
  SCORE_CLEAR_21,
  SCORE_CLEAR_FIVE,
} from '../game/constants';
import type { HowToPlayScreenProps } from '../navigation/navigationTypes';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

const STEPS = [
  {
    title: 'PLACE CARDS IN LANES',
    detail: 'Choose one of four lanes for every active card.',
    icon: 'lanes' as const,
  },
  {
    title: 'REACH EXACTLY 21',
    detail: 'A lane that reaches exactly 21 clears and awards points.',
    icon: 'exact' as const,
  },
  {
    title: 'FIVE-CARD CLEAR',
    detail: 'Five cards totaling less than 21 also clear the lane.',
    icon: 'five' as const,
  },
  {
    title: 'AVOID BUSTS',
    detail: 'Going over 21 causes a bust. Three busts end the match.',
    icon: 'bust' as const,
  },
  {
    title: 'BEAT THE CLOCK',
    detail:
      'Build your Blaze Streak and score as much as possible before time expires.',
    icon: 'clock' as const,
  },
];

function BookIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5V4.5z"
        fill="none"
        stroke={colors.primary}
        strokeWidth={1.8}
      />
      <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke={colors.gold} strokeWidth={1.8} />
    </Svg>
  );
}

function StepIcon({ kind }: { kind: (typeof STEPS)[number]['icon'] }) {
  return (
    <LinearGradient
      colors={['rgba(255,101,0,0.22)', 'rgba(255,182,41,0.12)']}
      style={styles.iconBadge}
    >
      <Svg width={22} height={22} viewBox="0 0 24 24">
        {kind === 'lanes' ? (
          <>
            <Rect x="3" y="4" width="7" height="7" rx="1.5" fill={colors.primary} />
            <Rect x="14" y="4" width="7" height="7" rx="1.5" fill={colors.gold} />
            <Rect x="3" y="13" width="7" height="7" rx="1.5" fill={colors.gold} />
            <Rect x="14" y="13" width="7" height="7" rx="1.5" fill={colors.primary} />
          </>
        ) : null}
        {kind === 'exact' ? (
          <Path
            d="M12 3l2.2 5.4L20 9.2l-4 4.1.9 5.7L12 16.5 7.1 19l.9-5.7-4-4.1 5.8-.8L12 3z"
            fill={colors.gold}
          />
        ) : null}
        {kind === 'five' ? (
          <Path
            d="M7 4h10v2H7V4zm0 4h10v12H7V8zm2 2v8h6v-8H9z"
            fill={colors.primary}
          />
        ) : null}
        {kind === 'bust' ? (
          <Path
            d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v6h-2V7h2zm0 8v2h-2v-2h2z"
            fill={colors.warningRed}
          />
        ) : null}
        {kind === 'clock' ? (
          <Path
            d="M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2zm1 5v5.2l3.4 2-1 1.6L11 13V7h2z"
            fill={colors.brightOrange}
          />
        ) : null}
      </Svg>
    </LinearGradient>
  );
}

export function HowToPlayScreen({ navigation }: HowToPlayScreenProps) {
  return (
    <ScreenContainer style={styles.container} intensity="subtle" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="HOW TO PLAY" icon={<BookIcon />} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panel}>
            {STEPS.map((step, index) => (
              <View
                key={step.title}
                style={[styles.step, index < STEPS.length - 1 && styles.stepBorder]}
              >
                <StepIcon kind={step.icon} />
                <View style={styles.stepCopy}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDetail}>{step.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.scoringPanel}>
            <Text style={styles.scoringTitle}>SCORING</Text>
            <Text style={styles.scoringLine}>
              Exact 21:{' '}
              <Text style={styles.scoringHighlight}>
                {SCORE_CLEAR_21} × multiplier
              </Text>
            </Text>
            <Text style={styles.scoringLine}>
              Five-card clear:{' '}
              <Text style={styles.scoringHighlight}>
                {SCORE_CLEAR_FIVE} × multiplier
              </Text>
            </Text>
            <Text style={styles.scoringLine}>
              Maximum multiplier:{' '}
              <Text style={styles.scoringHighlight}>x{MAX_MULTIPLIER}</Text>
            </Text>
            <Text style={styles.scoringLine}>
              Bust resets multiplier to{' '}
              <Text style={styles.scoringHighlight}>x1</Text>
            </Text>
          </View>
        </ScrollView>

        <BlazeButton
          title="BACK"
          variant="secondary"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back to home"
          fullWidth
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  scroll: {
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  panel: {
    backgroundColor: colors.backgroundCard,
    borderColor: colors.blazeSubtle,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  stepBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCopy: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontFamily: fontFamilies.display,
    fontSize: 16,
    letterSpacing: 0.8,
    color: colors.textPrimary,
  },
  stepDetail: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  scoringPanel: {
    backgroundColor: colors.backgroundCard,
    borderColor: colors.blazeSubtle,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
  },
  scoringTitle: {
    ...typography.label,
    color: colors.gold,
    marginBottom: 4,
  },
  scoringLine: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  scoringHighlight: {
    color: colors.primary,
    fontFamily: fontFamilies.bodyBold,
  },
});
