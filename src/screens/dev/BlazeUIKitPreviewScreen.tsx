import { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { blazeAssets } from '../../assets/blazeAssets';
import { PlayingCard } from '../../components/cards/PlayingCard';
import { BlazeStreak } from '../../components/game/BlazeStreak';
import { LanesGrid, type LaneData } from '../../components/game/LanesGrid';
import { StatCounterRow } from '../../components/game/StatCounterRow';
import { BlazeScreenBackground } from '../../components/layout/BlazeScreenBackground';
import { LeaderboardTable } from '../../components/leaderboard/LeaderboardTable';
import { ResultHero } from '../../components/results/ResultHero';
import { ResultsTable } from '../../components/results/ResultsTable';
import { SettingsActionRow } from '../../components/settings/SettingsActionRow';
import { SettingsToggleRow } from '../../components/settings/SettingsToggleRow';
import { HowToPlayRow } from '../../components/tutorial/HowToPlayRow';
import { BlazeButton } from '../../components/ui/BlazeButton';
import { BlazePanel } from '../../components/ui/BlazePanel';
import type { RootStackParamList } from '../../navigation/navigationTypes';
import { colors, spacing, typography } from '../../theme/uiKit';

type Props = NativeStackScreenProps<RootStackParamList, 'BlazeUIKitPreview'>;

const PREVIEW_LANES: LaneData[] = [
  {
    laneNumber: 1,
    total: 18,
    cards: [
      { rank: '8', suit: 'hearts' },
      { rank: 'Q', suit: 'hearts' },
    ],
  },
  { laneNumber: 2, total: 7, cards: [{ rank: '7', suit: 'spades' }] },
  { laneNumber: 3, total: 0, cards: [] },
  {
    laneNumber: 4,
    total: 15,
    cards: [
      { rank: '10', suit: 'clubs' },
      { rank: '5', suit: 'diamonds' },
    ],
  },
];

/**
 * Development-only component gallery. Mock values are intentional here.
 * Do not import this into production navigation outside __DEV__.
 */
export function BlazeUIKitPreviewScreen({ navigation }: Props) {
  const [toggle, setToggle] = useState(true);

  return (
    <BlazeScreenBackground variant="home" embers>
      <ScrollView contentContainerStyle={styles.content}>
        <BlazeButton
          label="CLOSE PREVIEW"
          variant="secondary"
          onPress={() => navigation.goBack()}
        />

        <Text style={styles.h}>LOGO & ASSETS</Text>
        <Image source={blazeAssets.logoMain} style={styles.logo} />
        <View style={styles.assetRow}>
          <Image source={blazeAssets.flamingCrown} style={styles.assetThumb} />
          <Image
            source={blazeAssets.countdownFireRingPoster}
            style={styles.assetThumb}
          />
          <Image source={blazeAssets.fireStopwatch} style={styles.assetThumb} />
        </View>
        <Text style={styles.caption}>
          Home lava + ember overlay are active on this screen background.
        </Text>

        <Text style={styles.h}>BUTTONS</Text>
        <View style={styles.gap}>
          <BlazeButton label="PRIMARY" onPress={() => undefined} />
          <BlazeButton
            label="SECONDARY"
            onPress={() => undefined}
            variant="secondary"
          />
          <BlazeButton
            label="DANGER"
            onPress={() => undefined}
            variant="danger"
          />
          <BlazeButton label="GHOST" onPress={() => undefined} variant="ghost" />
        </View>

        <Text style={styles.h}>PANELS</Text>
        <BlazePanel>
          <Text style={styles.panelText}>Default panel</Text>
        </BlazePanel>
        <BlazePanel variant="active" glow>
          <Text style={styles.panelText}>Active / glow panel</Text>
        </BlazePanel>
        <BlazePanel variant="danger">
          <Text style={styles.panelText}>Danger panel</Text>
        </BlazePanel>

        <Text style={styles.h}>HUD & STREAK</Text>
        <StatCounterRow
          items={[
            { label: 'SCORE', value: '1,250' },
            { label: 'MULTIPLIER', value: 'x3' },
            { label: 'BUSTS', value: '1/3' },
            { label: 'CARDS', value: 32 },
          ]}
        />
        <BlazeStreak current={4} />

        <Text style={styles.h}>CARDS</Text>
        <View style={styles.cards}>
          <PlayingCard rank="Q" suit="hearts" size="large" highlighted />
          <PlayingCard rank="A" suit="spades" />
          <PlayingCard rank="10" suit="diamonds" size="small" />
          <PlayingCard rank="K" suit="clubs" size="tiny" />
          <PlayingCard rank="2" suit="hearts" faceDown />
        </View>

        <Text style={styles.h}>LANES</Text>
        <LanesGrid lanes={PREVIEW_LANES} />

        <Text style={styles.h}>SETTINGS</Text>
        <BlazePanel>
          <SettingsToggleRow
            label="SOUND EFFECTS"
            value={toggle}
            onValueChange={setToggle}
          />
          <SettingsActionRow
            label="CARD STYLE"
            value="CLASSIC"
            onPress={() => undefined}
          />
        </BlazePanel>

        <Text style={styles.h}>LEADERBOARD</Text>
        <LeaderboardTable
          entries={[
            { rank: 1, playerName: 'PreviewAce', score: 25980 },
            { rank: 2, playerName: 'GalleryKing', score: 18750 },
            {
              rank: 3,
              playerName: 'DevPlayer',
              score: 12450,
              isCurrentPlayer: true,
            },
          ]}
        />

        <Text style={styles.h}>RESULTS</Text>
        <ResultHero
          title="BLAZING!"
          subtitle="PREVIEW ONLY"
          score={12450}
          crownVisible
          isHighScore
        />
        <ResultsTable
          rows={[
            { label: 'HIGH SCORE', value: '12,450', gold: true },
            { label: 'LANES CLEARED', value: 18 },
            { label: 'CARDS PLAYED', value: 52 },
            { label: 'BUSTS', value: '2/3' },
            { label: 'TIME REMAINING', value: '0:00', danger: true },
          ]}
        />

        <Text style={styles.h}>TUTORIAL</Text>
        <BlazePanel>
          {[
            'Place cards in lanes.',
            'Get to 21 to clear the lane.',
            'Five cards below 21 also clears.',
            'Going over 21 busts.',
            'Avoid three busts and beat the clock.',
          ].map((title, index) => (
            <HowToPlayRow key={title} step={index + 1} title={title} />
          ))}
        </BlazePanel>

        <Text style={styles.h}>GAMEPLAY BACKGROUND</Text>
        <View style={styles.bgPreviewWrap}>
          <BlazeScreenBackground variant="gameplay" embers>
            <View style={styles.bgPreviewInner}>
              <Text style={styles.panelText}>Gameplay ember variant</Text>
            </View>
          </BlazeScreenBackground>
        </View>
      </ScrollView>
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  logo: {
    width: 220,
    height: 220,
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  assetThumb: {
    width: 72,
    height: 72,
    resizeMode: 'contain',
  },
  caption: {
    color: colors.text.secondary,
    fontFamily: typography.families.body,
    fontSize: 12,
    textAlign: 'center',
  },
  h: {
    color: colors.fire.gold,
    fontFamily: typography.families.display,
    fontSize: 22,
    marginTop: spacing.lg,
  },
  gap: { gap: spacing.sm },
  cards: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  panelText: {
    color: colors.text.primary,
    fontFamily: typography.families.body,
  },
  bgPreviewWrap: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bgPreviewInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
