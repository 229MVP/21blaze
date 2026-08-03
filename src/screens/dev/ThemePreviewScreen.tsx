import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BlazeButton } from '../../components/buttons/BlazeButton';
import type { CardRank, CardSuit } from '../../components/cards/cardTypes';
import { PlayingCard } from '../../components/cards/PlayingCard';
import { ThemedCardBack } from '../../components/cards/ThemedCardBack';
import { ArenaPreviewPanel } from '../../components/cosmetics/ArenaPreviewPanel';
import { PlayerTitleBadge } from '../../components/cosmetics/PlayerTitleBadge';
import { ProfileFrameBadge } from '../../components/cosmetics/ProfileFrameBadge';
import { LaneBox } from '../../components/game/LaneBox';
import { ScreenHeader } from '../../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ThemedLaneEffect, type LaneEffectState } from '../../components/themes/ThemedLaneEffect';
import { ThemedVictoryEffect } from '../../components/themes/ThemedVictoryEffect';
import type { RootStackParamList } from '../../navigation/navigationTypes';
import { getAssetLoadStatus } from '../../services/visualAssetLoader';
import { selectReducedMotionEnabled, useSettingsStore } from '../../store/useSettingsStore';
import { emberBlazeTheme } from '../../themes/emberBlazeTheme';
import { classicTheme } from '../../themes/defaultTheme';
import { getAllThemeDefinitions, getThemeDefinitionsByCategory } from '../../themes/themeRegistry';
import type { ThemeCategory } from '../../themes/types';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'ThemePreview'>;

const RANKS: CardRank[] = ['A', '2', '7', '10', 'J', 'Q', 'K'];
const SUITS: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

const LANE_STATES: LaneEffectState[] = [
  'idle',
  'selected',
  'validPlacement',
  'cardPlaced',
  'exact21',
  'fiveCardClear',
  'bust',
  'locked',
  'disabled',
];

const PREVIEW_LANE_CARDS = [
  { rank: '9' as const, suit: 'diamonds' as const },
  { rank: 'K' as const, suit: 'clubs' as const },
];

function ThemePicker({
  category,
  selectedThemeId,
  onSelect,
}: {
  category: ThemeCategory;
  selectedThemeId: string;
  onSelect: (themeId: string) => void;
}) {
  const definitions = getThemeDefinitionsByCategory(category);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
      {definitions.map((def) => (
        <BlazeButton
          key={def.themeId}
          title={def.displayName}
          variant={def.themeId === selectedThemeId ? 'primary' : 'outline'}
          onPress={() => onSelect(def.themeId)}
          accessibilityLabel={`${def.displayName}, ${def.rarity} ${category.replace('_', ' ')} theme${
            def.themeId === selectedThemeId ? ', selected' : ''
          }`}
        />
      ))}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * Version 1.2A — development-only theme gallery. Never reachable in
 * production: gated by both `isThemePreviewDevEnabled()` (requires
 * `__DEV__` AND the explicit `EXPO_PUBLIC_ENABLE_THEME_PREVIEW_DEV` flag)
 * at the navigator registration and again here as a defensive fallback.
 * Never mutates player ownership or wallet data, and never offers an
 * unlock action — this is a read-only rendering gallery.
 */
export function ThemePreviewScreen({ navigation }: Props) {
  const [cardFaceThemeId, setCardFaceThemeId] = useState('classic_card_face');
  const [cardBackThemeId, setCardBackThemeId] = useState('classic_card_back');
  const [arenaThemeId, setArenaThemeId] = useState('classic_arena');
  const [laneThemeId, setLaneThemeId] = useState('classic_lane_effect');
  const [profileThemeId, setProfileThemeId] = useState('default_profile_frame');
  const [titleThemeId, setTitleThemeId] = useState('no_title');
  const [overlayMode, setOverlayMode] = useState<'dark' | 'light'>('dark');
  const [victoryTrigger, setVictoryTrigger] = useState<'standardWin' | 'newHighScore' | null>(null);
  const [simulateMissingAsset, setSimulateMissingAsset] = useState(false);

  const globalReducedMotion = useSettingsStore(selectReducedMotionEnabled);
  const setReducedMotionEnabled = useSettingsStore((state) => state.setReducedMotionEnabled);
  const allThemes = useMemo(() => getAllThemeDefinitions(), []);

  // Version 1.2B — "Simulate asset failure" forces every picker back to
  // its classic fallback, exactly what `resolvePlayerVisualTheme` does
  // for a real player when `unavailableThemeIds` marks the equipped id's
  // required asset as failed to load. Never mutates real ownership.
  const effectiveCardBack = simulateMissingAsset ? classicTheme.cardBackTheme : cardBackThemeId;
  const effectiveArena = simulateMissingAsset ? classicTheme.arenaTheme : arenaThemeId;
  const effectiveLane = simulateMissingAsset ? classicTheme.laneTheme : laneThemeId;
  const effectiveProfile = simulateMissingAsset ? classicTheme.profileFrameTheme : profileThemeId;

  const faceVariant = cardFaceThemeId === 'midnight_card_style' ? 'midnight' : 'classic';
  const isFlameFrame = effectiveProfile === 'flame_profile_frame';

  const loadEmberCollection = () => {
    setCardBackThemeId(emberBlazeTheme.cardBackTheme);
    setArenaThemeId(emberBlazeTheme.arenaTheme);
    setLaneThemeId(emberBlazeTheme.laneTheme);
    setProfileThemeId(emberBlazeTheme.profileFrameTheme);
    setTitleThemeId(emberBlazeTheme.playerTitleTheme);
  };
  const loadClassicCollection = () => {
    setCardBackThemeId(classicTheme.cardBackTheme);
    setArenaThemeId(classicTheme.arenaTheme);
    setLaneThemeId(classicTheme.laneTheme);
    setProfileThemeId(classicTheme.profileFrameTheme);
    setTitleThemeId(classicTheme.playerTitleTheme);
  };

  const emberAssetIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...emberBlazeTheme.requiredAssets,
          'classic_card_back_asset',
          'classic_arena_home_asset',
          'classic_arena_gameplay_asset',
        ]),
      ),
    [],
  );

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="THEME PREVIEW (DEV)" />
        <Text style={styles.disclosure}>
          Development-only gallery. Registry has {allThemes.length} theme definitions across 8
          categories. Reduced Motion (system/preference): {globalReducedMotion ? 'ON' : 'OFF'}.
        </Text>

        <Section title="CARD FACE">
          <ThemePicker category="card_face" selectedThemeId={cardFaceThemeId} onSelect={setCardFaceThemeId} />
          <View style={styles.cardGrid}>
            {SUITS.map((suit) =>
              RANKS.map((rank) => (
                <View key={`${suit}-${rank}`} style={styles.cardCell}>
                  <PlayingCard rank={rank} suit={suit} size="small" faceVariant={faceVariant} />
                </View>
              )),
            )}
          </View>
          <View style={styles.row}>
            <PlayingCard rank="K" suit="hearts" size="large" faceVariant={faceVariant} selected />
            <PlayingCard rank="Q" suit="spades" size="large" faceVariant={faceVariant} disabled />
          </View>
        </Section>

        <Section title="CARD BACK">
          <ThemePicker category="card_back" selectedThemeId={cardBackThemeId} onSelect={setCardBackThemeId} />
          <View style={styles.row}>
            <ThemedCardBack themeId={effectiveCardBack} width={44} height={64} />
            <ThemedCardBack themeId={effectiveCardBack} width={118} height={166} />
          </View>
        </Section>

        <Section title="ARENA BACKGROUND">
          <ThemePicker category="arena" selectedThemeId={arenaThemeId} onSelect={setArenaThemeId} />
          <ArenaPreviewPanel arenaId={effectiveArena} width={220} height={140} />
        </Section>

        <Section title="LANE STATES">
          <ThemePicker category="lane_effect" selectedThemeId={laneThemeId} onSelect={setLaneThemeId} />
          <View style={styles.laneGrid}>
            {LANE_STATES.map((state) => (
              <View key={state} style={styles.laneCell}>
                <Text style={styles.laneLabel}>{state}</Text>
                <View style={styles.laneWrap}>
                  <LaneBox
                    laneNumber={1}
                    total={14}
                    cards={PREVIEW_LANE_CARDS}
                    disabled
                    selected={state === 'selected'}
                    danger={state === 'bust'}
                    cleared={state === 'exact21' || state === 'fiveCardClear'}
                  />
                  <ThemedLaneEffect laneThemeId={effectiveLane} state={state} eventKey={state} />
                </View>
              </View>
            ))}
          </View>
        </Section>

        <Section title="EMBER COLLECTION (1.2B)">
          <Text style={styles.disclosure}>
            Ember Blaze bundles card back, arena, lane, board/victory effects, profile frame, and
            player title into one coordinated preset. Card face has no dedicated Ember cosmetic yet
            (see docs/V1_2B_MISSING_ASSET_REPORT.md) — it stays Classic in this preset.
          </Text>
          <View style={styles.row}>
            <BlazeButton title="LOAD EMBER BLAZE" onPress={loadEmberCollection} variant="primary" />
            <BlazeButton title="LOAD CLASSIC" onPress={loadClassicCollection} variant="outline" />
          </View>
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonColumn}>
              <Text style={styles.laneLabel}>CLASSIC</Text>
              <ThemedCardBack themeId="classic_card_back" width={60} height={86} />
              <ProfileFrameBadge variant="default" initial="P" size={48} />
            </View>
            <View style={styles.comparisonColumn}>
              <Text style={styles.laneLabel}>EMBER BLAZE</Text>
              <ThemedCardBack themeId="ember_card_back" width={60} height={86} />
              <ProfileFrameBadge variant="flame" initial="P" size={48} />
            </View>
          </View>
        </Section>

        <Section title="ASSET STATUS (DEV)">
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Simulate missing/failed asset (forces classic fallback)</Text>
            <Switch
              value={simulateMissingAsset}
              onValueChange={setSimulateMissingAsset}
              accessibilityLabel="Toggle missing-asset fallback simulation"
            />
          </View>
          {emberAssetIds.map((id) => (
            <View key={id} style={styles.assetStatusRow}>
              <Text style={styles.assetStatusId} numberOfLines={1}>
                {id}
              </Text>
              <Text style={styles.assetStatusValue}>{getAssetLoadStatus(id).toUpperCase()}</Text>
            </View>
          ))}
        </Section>

        <Section title="BOARD & VICTORY EFFECTS">
          <View style={styles.row}>
            <BlazeButton title="HIGH SCORE" onPress={() => setVictoryTrigger('newHighScore')} variant="outline" />
            <BlazeButton title="STANDARD WIN" onPress={() => setVictoryTrigger('standardWin')} variant="outline" />
            <BlazeButton title="CLEAR" onPress={() => setVictoryTrigger(null)} variant="outline" />
          </View>
          <View style={styles.victoryPreview}>
            <ThemedVictoryEffect trigger={victoryTrigger} themeId="classic_victory_effect" />
            <Text style={styles.laneLabel}>Victory overlay preview surface</Text>
          </View>
        </Section>

        <Section title="PROFILE FRAME">
          <ThemePicker category="profile_frame" selectedThemeId={profileThemeId} onSelect={setProfileThemeId} />
          <View style={styles.row}>
            <ProfileFrameBadge variant={isFlameFrame ? 'flame' : 'default'} initial="P" size={44} />
            <ProfileFrameBadge variant={isFlameFrame ? 'flame' : 'default'} initial="P" size={80} />
          </View>
        </Section>

        <Section title="PLAYER TITLE">
          <ThemePicker category="player_title" selectedThemeId={titleThemeId} onSelect={setTitleThemeId} />
          <PlayerTitleBadge
            label={titleThemeId === 'no_title' ? 'NO TITLE' : 'SEVEN DAY BLAZE'}
            emphasized
          />
        </Section>

        <Section title="ACCESSIBILITY / OVERLAY TOGGLES">
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Reduced Motion (live app setting)</Text>
            <Switch
              value={globalReducedMotion}
              onValueChange={setReducedMotionEnabled}
              accessibilityLabel="Toggle Reduced Motion for previewing all themed components"
            />
          </View>
          <View style={styles.row}>
            <BlazeButton
              title="DARK OVERLAY"
              variant={overlayMode === 'dark' ? 'primary' : 'outline'}
              onPress={() => setOverlayMode('dark')}
            />
            <BlazeButton
              title="LIGHT OVERLAY"
              variant={overlayMode === 'light' ? 'primary' : 'outline'}
              onPress={() => setOverlayMode('light')}
            />
          </View>
          <View
            style={[
              styles.overlaySwatch,
              overlayMode === 'dark' ? styles.overlayDark : styles.overlayLight,
            ]}
          >
            <Text style={overlayMode === 'dark' ? styles.overlayTextLight : styles.overlayTextDark}>
              Sample readability check
            </Text>
          </View>
        </Section>

        <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  disclosure: {
    ...typography.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  section: {
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: colors.backgroundCard,
    padding: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1.2,
    color: colors.gold,
  },
  pickerRow: { gap: 8, paddingVertical: 4 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cardCell: { alignItems: 'center' },
  laneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  laneCell: { width: 160, gap: 4 },
  laneLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  laneWrap: { height: 120 },
  comparisonRow: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'center' },
  comparisonColumn: { alignItems: 'center', gap: spacing.xs },
  assetStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.blazeSubtle,
    paddingVertical: 4,
  },
  assetStatusId: {
    ...typography.body,
    fontSize: 11,
    color: colors.textSecondary,
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  assetStatusValue: {
    ...typography.label,
    fontSize: 10,
    color: colors.gold,
  },
  victoryPreview: {
    height: 100,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  overlaySwatch: {
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  overlayDark: { backgroundColor: '#0A0A0A' },
  overlayLight: { backgroundColor: '#F4EEE4' },
  overlayTextLight: { color: '#F4EEE4', fontFamily: fontFamilies.bodyBold },
  overlayTextDark: { color: '#0A0A0A', fontFamily: fontFamilies.bodyBold },
});
