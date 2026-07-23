import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Path } from 'react-native-svg';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { SvgRoot as Svg } from '../components/svg/SvgRoot';
import { HowToPlayRow } from '../components/tutorial/HowToPlayRow';
import { BlazePanel } from '../components/ui/BlazePanel';
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
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 28, height: 28 }}
    >
      <Svg width={28} height={28} viewBox="0 0 24 24">
        <Path
          d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5V4.5z"
          fill="none"
          stroke={colors.primary}
          strokeWidth={1.8}
        />
        <Path
          d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
          stroke={colors.gold}
          strokeWidth={1.8}
        />
      </Svg>
    </View>
  );
}

export function HowToPlayScreen({ navigation }: HowToPlayScreenProps) {
  return (
    <BlazeScreenBackground variant="plain">
      <View style={styles.padded}>
        <ScreenHeader title="HOW TO PLAY" icon={<BookIcon />} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <BlazePanel>
            {STEPS.map((step, index) => (
              <HowToPlayRow
                key={step.title}
                step={index + 1}
                title={step.title}
                description={step.detail}
              />
            ))}
          </BlazePanel>

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
    </BlazeScreenBackground>
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
