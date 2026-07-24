import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { paletteForCardTheme } from '../../cosmetics/themePalettes';
import { SUIT_SYMBOLS } from '../../game/constants';
import type { Card, Rank, Suit } from '../../game/types';
import type { CardStyle } from '../../settings/types';
import { colors as kitColors, radii, shadows as kitShadows } from '../../theme/uiKit';
import { fontFamilies } from '../../theme/typography';

export type PlayingCardSize = 'small' | 'medium' | 'large';

type PlayingCardProps = {
  card: Card;
  size?: PlayingCardSize;
  glowing?: boolean;
  selected?: boolean;
  disabled?: boolean;
  faceDown?: boolean;
  cardStyle?: CardStyle | string;
  /** @deprecated Prefer size="small". Kept for existing call sites. */
  compact?: boolean;
};

type SizeConfig = {
  width: number;
  height: number;
  rankFontSize: number;
  suitFontSize: number;
  centerSuitFontSize: number;
  padding: number;
  borderRadius: number;
  showCenter: boolean;
};

type StylePalette = {
  face: [string, string];
  border: string;
  redSuit: string;
  blackSuit: string;
  glow: boolean;
};

const SIZE_CONFIG: Record<PlayingCardSize, SizeConfig> = {
  small: {
    width: 44,
    height: 64,
    rankFontSize: 13,
    suitFontSize: 11,
    centerSuitFontSize: 0,
    padding: 4,
    borderRadius: radii.xs,
    showCenter: false,
  },
  medium: {
    width: 80,
    height: 114,
    rankFontSize: 20,
    suitFontSize: 16,
    centerSuitFontSize: 34,
    padding: 6,
    borderRadius: radii.sm,
    showCenter: true,
  },
  large: {
    width: 118,
    height: 166,
    rankFontSize: 26,
    suitFontSize: 20,
    centerSuitFontSize: 50,
    padding: 8,
    borderRadius: radii.sm,
    showCenter: true,
  },
};

const VALID_SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALID_RANKS: readonly Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

/** Kit-forward defaults for classic / unset themes. */
function resolvePalette(cardStyle: string): StylePalette {
  const theme = String(cardStyle || 'classic');
  if (theme === 'classic' || theme === 'classic_cards') {
    return {
      face: ['#F7F3EA', '#EFE8DA'],
      border: '#2A2E33',
      redSuit: kitColors.suits.red,
      blackSuit: kitColors.suits.black,
      glow: false,
    };
  }
  return paletteForCardTheme(theme);
}

function getSuitColor(suit: Suit, palette: StylePalette): string {
  if (suit === 'hearts' || suit === 'diamonds') {
    return palette.redSuit;
  }
  return palette.blackSuit;
}

function resolveCardDisplay(
  card: Card,
  palette: StylePalette,
): {
  rankLabel: string;
  suitSymbol: string;
  suitColor: string;
  accessibilityLabel: string;
} {
  const hasValidSuit = VALID_SUITS.includes(card.suit);
  const hasValidRank = VALID_RANKS.includes(card.rank);

  if (!hasValidSuit || !hasValidRank) {
    return {
      rankLabel: '?',
      suitSymbol: '?',
      suitColor: palette.blackSuit,
      accessibilityLabel: 'Invalid card',
    };
  }

  return {
    rankLabel: card.rank,
    suitSymbol: SUIT_SYMBOLS[card.suit],
    suitColor: getSuitColor(card.suit, palette),
    accessibilityLabel: `${card.rank} of ${card.suit}`,
  };
}

function FaceDownCard({
  width,
  height,
  borderRadius,
}: {
  width: number;
  height: number;
  borderRadius: number;
}) {
  return (
    <View
      accessibilityLabel="Face-down card"
      style={[
        styles.shell,
        {
          width,
          height,
          borderRadius,
          borderColor: kitColors.border.orange,
          backgroundColor: kitColors.background.elevated,
        },
        kitShadows.panel,
      ]}
    >
      <LinearGradient
        colors={['#2A1810', '#15181B', '#3A1C0A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderRadius, padding: 6 }]}
      >
        <View style={styles.faceDownMark} />
      </LinearGradient>
    </View>
  );
}

export function PlayingCard({
  card,
  size,
  glowing = false,
  selected = false,
  disabled = false,
  faceDown = false,
  cardStyle = 'classic',
  compact = false,
}: PlayingCardProps) {
  const resolvedSize: PlayingCardSize = size ?? (compact ? 'small' : 'medium');
  const config = SIZE_CONFIG[resolvedSize];
  const palette = resolvePalette(String(cardStyle));
  const { rankLabel, suitSymbol, suitColor, accessibilityLabel } =
    resolveCardDisplay(card, palette);
  const showGlow = glowing || selected;

  if (faceDown) {
    return (
      <FaceDownCard
        width={config.width}
        height={config.height}
        borderRadius={config.borderRadius}
      />
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${accessibilityLabel}, ${cardStyle} style`}
      style={[
        styles.shell,
        {
          width: config.width,
          height: config.height,
          borderRadius: config.borderRadius,
          borderColor: showGlow ? kitColors.border.active : palette.border,
          opacity: disabled ? 0.45 : 1,
        },
        showGlow ? kitShadows.glow : kitShadows.panel,
        glowing && styles.activeGlow,
      ]}
    >
      <LinearGradient
        colors={palette.face}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.card,
          {
            borderRadius: config.borderRadius,
            padding: config.padding,
          },
        ]}
      >
        <View style={[styles.corner, styles.cornerTop]}>
          <Text
            style={[
              styles.rank,
              {
                color: suitColor,
                fontSize: config.rankFontSize,
                lineHeight: config.rankFontSize + 1,
              },
            ]}
          >
            {rankLabel}
          </Text>
          <Text
            style={{
              color: suitColor,
              fontSize: config.suitFontSize,
              lineHeight: config.suitFontSize + 1,
            }}
          >
            {suitSymbol}
          </Text>
        </View>

        {config.showCenter ? (
          <View style={styles.center}>
            <Text
              style={{
                color: suitColor,
                fontSize: config.centerSuitFontSize,
                lineHeight: config.centerSuitFontSize + 2,
                textAlign: 'center',
              }}
            >
              {suitSymbol}
            </Text>
          </View>
        ) : null}

        <View style={[styles.corner, styles.cornerBottom]}>
          <Text
            style={[
              styles.rank,
              {
                color: suitColor,
                fontSize: config.rankFontSize,
                lineHeight: config.rankFontSize + 1,
              },
            ]}
          >
            {rankLabel}
          </Text>
          <Text
            style={{
              color: suitColor,
              fontSize: config.suitFontSize,
              lineHeight: config.suitFontSize + 1,
            }}
          >
            {suitSymbol}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    borderWidth: 1.2,
    overflow: 'hidden',
    backgroundColor: '#F7F3EA',
  },
  activeGlow: {
    shadowColor: kitColors.fire.orange,
    shadowOpacity: 0.38,
    shadowRadius: 10,
  },
  card: {
    flex: 1,
    position: 'relative',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    zIndex: 2,
    alignItems: 'center',
  },
  cornerTop: {
    top: 5,
    left: 6,
  },
  cornerBottom: {
    right: 6,
    bottom: 5,
    transform: [{ rotate: '180deg' }],
  },
  rank: {
    fontFamily: fontFamilies.bodyBold,
    fontWeight: '900',
    textAlign: 'center',
  },
  faceDownMark: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.35)',
    borderRadius: radii.xs,
    margin: 4,
  },
});
