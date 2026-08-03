import { StyleSheet, Text, View } from 'react-native';

import type { LockerCosmeticType } from '../../cosmetics/lockerCatalog';
import { resolveThemeDefinition } from '../../themes/themeRegistry';
import type { ThemeCategory } from '../../themes/types';
import { PlayingCard } from '../cards';
import { LaneBox } from '../game/LaneBox';
import { ArenaPreviewPanel } from './ArenaPreviewPanel';
import { PlayerTitleBadge } from './PlayerTitleBadge';
import { ProfileFrameBadge } from './ProfileFrameBadge';

type Props = {
  cosmeticId: string;
  cosmeticType: LockerCosmeticType;
  name: string;
};

const PREVIEW_LANE_CARDS = [
  { rank: '7' as const, suit: 'hearts' as const },
  { rank: 'K' as const, suit: 'spades' as const },
];

/**
 * Version 1.1B "Blaze Locker" (Version 1.2A: theme-registry-aware) —
 * cosmetic previews built entirely from real, reusable production
 * components (never a screenshot). Each branch renders the same
 * component used elsewhere in the app (gameplay cards, LaneBox, profile
 * frame, player title), driven by `resolveThemeDefinition()` instead of
 * a raw `cosmeticId === '...'` comparison — a future 1.2B art swap for
 * any of these ids never requires touching this file again.
 */
export function CosmeticPreview({ cosmeticId, cosmeticType, name }: Props) {
  return (
    <View
      style={styles.wrap}
      accessibilityRole="image"
      accessibilityLabel={`Preview of ${name}`}
    >
      {renderPreview(cosmeticId, cosmeticType)}
    </View>
  );
}

function renderPreview(cosmeticId: string, cosmeticType: LockerCosmeticType) {
  const category = cosmeticType as ThemeCategory;
  const themeId = resolveThemeDefinition(category, cosmeticId).themeId;

  switch (cosmeticType) {
    case 'card_face':
      return (
        <PlayingCard
          rank="A"
          suit="hearts"
          size="medium"
          faceVariant={themeId === 'midnight_card_style' ? 'midnight' : 'classic'}
        />
      );
    case 'card_back':
      return (
        <PlayingCard
          rank="A"
          suit="hearts"
          size="medium"
          faceDown
          backVariant={themeId === 'ember_card_back' ? 'ember' : 'classic'}
        />
      );
    case 'lane_effect':
      return (
        <View style={styles.lanePreviewShell}>
          <LaneBox
            laneNumber={1}
            total={17}
            cards={PREVIEW_LANE_CARDS}
            disabled
            laneEffect={themeId === 'gold_lane_glow' ? 'gold_lane_glow' : null}
          />
        </View>
      );
    case 'arena':
      return <ArenaPreviewPanel arenaId={themeId} width={132} height={84} />;
    case 'profile_frame':
      return (
        <ProfileFrameBadge
          variant={themeId === 'flame_profile_frame' ? 'flame' : 'default'}
          initial="P"
          size={64}
        />
      );
    case 'player_title':
      return (
        <View style={styles.titlePreview}>
          <Text style={styles.titlePreviewName}>Player</Text>
          <PlayerTitleBadge label={themeId === 'no_title' ? 'NO TITLE' : 'SEVEN DAY BLAZE'} emphasized />
        </View>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
  },
  lanePreviewShell: {
    width: 160,
    height: 110,
  },
  titlePreview: {
    alignItems: 'center',
    gap: 6,
  },
  titlePreviewName: {
    color: '#F4EEE4',
    fontFamily: 'RobotoCondensed_700Bold',
    fontSize: 14,
  },
});
