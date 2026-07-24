import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Path, Rect } from 'react-native-svg';

import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { SvgRoot as Svg } from '../components/svg/SvgRoot';
import { HowToPlayRow } from '../components/tutorial/HowToPlayRow';
import { BlazeButton } from '../components/ui/BlazeButton';
import { BlazePanel } from '../components/ui/BlazePanel';
import {
  GAME_DURATION_SECONDS,
  MAX_BUSTS,
  MAX_MULTIPLIER,
  SCORE_CLEAR_21,
  SCORE_CLEAR_FIVE,
} from '../game/constants';
import { formatTimerSeconds } from '../game/timerEngine';
import type { HowToPlayScreenProps } from '../navigation/navigationTypes';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

const CONTENT_MAX = 410;

const STEPS = [
  {
    title: 'PLACE CARDS IN LANES',
    detail: 'Choose one of four lanes for every active card.',
    icon: 'lanes' as const,
  },
  {
    title: 'REACH EXACTLY 21',
    detail: 'A lane totaling exactly 21 clears and awards points.',
    icon: 'exact' as const,
  },
  {
    title: 'FIVE-CARD CLEAR',
    detail: 'Five cards totaling less than 21 also clear the lane.',
    icon: 'five' as const,
  },
  {
    title: 'AVOID BUSTS',
    detail: `Going over 21 causes a bust. ${MAX_BUSTS} busts end the match.`,
    icon: 'bust' as const,
  },
  {
    title: 'BEAT THE CLOCK',
    detail:
      'Build your Blaze Streak and score as much as possible before time expires.',
    icon: 'clock' as const,
  },
] as const;

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
          stroke={kitColors.fire.orange}
          strokeWidth={1.8}
        />
        <Path
          d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
          stroke={kitColors.fire.gold}
          strokeWidth={1.8}
        />
      </Svg>
    </View>
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
            <Rect
              x="3"
              y="4"
              width="7"
              height="7"
              rx="1.5"
              fill={kitColors.fire.orange}
            />
            <Rect
              x="14"
              y="4"
              width="7"
              height="7"
              rx="1.5"
              fill={kitColors.fire.gold}
            />
            <Rect
              x="3"
              y="13"
              width="7"
              height="7"
              rx="1.5"
              fill={kitColors.fire.gold}
            />
            <Rect
              x="14"
              y="13"
              width="7"
              height="7"
              rx="1.5"
              fill={kitColors.fire.orange}
            />
          </>
        ) : null}
        {kind === 'exact' ? (
          <Path
            d="M12 3l2.2 5.4L20 9.2l-4 4.1.9 5.7L12 16.5 7.1 19l.9-5.7-4-4.1 5.8-.8L12 3z"
            fill={kitColors.fire.gold}
          />
        ) : null}
        {kind === 'five' ? (
          <Path
            d="M7 4h10v2H7V4zm0 4h10v12H7V8zm2 2v8h6v-8H9z"
            fill={kitColors.fire.orange}
          />
        ) : null}
        {kind === 'bust' ? (
          <Path
            d="M12.1 3.5c-1.8 0-3.3 1.2-3.8 2.9-.4-1.2-1.5-2-2.8-2C3.5 4.4 2 5.9 2 7.8c0 4.2 4.8 7.5 10 11.2 5.2-3.7 10-7 10-11.2 0-1.9-1.5-3.4-3.4-3.4-1.3 0-2.4.8-2.8 2-.5-1.7-2-2.9-3.7-2.9z"
            fill={kitColors.status.danger}
          />
        ) : null}
        {kind === 'clock' ? (
          <Path
            d="M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2zm1 5v5.2l3.4 2-1 1.6L11 13V7h2z"
            fill={kitColors.fire.brightOrange}
          />
        ) : null}
      </Svg>
    </LinearGradient>
  );
}

export function HowToPlayScreen({ navigation }: HowToPlayScreenProps) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);

  return (
    <BlazeScreenBackground variant="plain">
      <View
        style={[
          styles.column,
          { width: columnWidth, maxWidth: CONTENT_MAX, alignSelf: 'center' },
        ]}
      >
        <ScreenHeader title="HOW TO PLAY" icon={<BookIcon />} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <BlazePanel padding={0} style={styles.panel}>
            {STEPS.map((step, index) => (
              <HowToPlayRow
                key={step.title}
                step={index + 1}
                title={step.title}
                description={step.detail}
                icon={<StepIcon kind={step.icon} />}
              />
            ))}
          </BlazePanel>

          <BlazePanel style={styles.scoringPanel}>
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
              <Text style={styles.scoringHighlight}>×{MAX_MULTIPLIER}</Text>
            </Text>
            <Text style={styles.scoringLine}>
              Bust resets multiplier to{' '}
              <Text style={styles.scoringHighlight}>×1</Text>
            </Text>
            <Text style={styles.scoringLine}>
              Match time:{' '}
              <Text style={styles.scoringHighlight}>
                {formatTimerSeconds(GAME_DURATION_SECONDS)}
              </Text>
            </Text>
            <Text style={styles.scoringLine}>
              Maximum busts:{' '}
              <Text style={styles.scoringHighlight}>{MAX_BUSTS}</Text>
            </Text>
          </BlazePanel>
        </ScrollView>

        <BlazeButton
          label="BACK"
          variant="secondary"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back to home"
        />
      </View>
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    paddingHorizontal: kitSpacing.md,
    paddingBottom: kitSpacing.md,
    gap: kitSpacing.sm,
  },
  scroll: {
    paddingBottom: kitSpacing.md,
    gap: kitSpacing.md,
  },
  panel: {
    width: '100%',
    overflow: 'hidden',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: kitColors.border.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoringPanel: {
    width: '100%',
    gap: 6,
  },
  scoringTitle: {
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: kitColors.fire.gold,
    fontSize: 12,
    marginBottom: 2,
  },
  scoringLine: {
    fontFamily: kitTypography.families.body,
    fontSize: 14,
    color: kitColors.text.secondary,
  },
  scoringHighlight: {
    color: kitColors.fire.orange,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
  },
});
