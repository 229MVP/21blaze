import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  divisionForRating,
  type RankedDivisionKey,
  RANKED_DIVISIONS,
} from '../../ranked/divisions';
import { colors } from '../../theme/colors';
import { fontFamilies, typography } from '../../theme/typography';

type BadgeSize = 'small' | 'medium' | 'large';

type DivisionBadgeProps = {
  division: RankedDivisionKey;
  rating?: number | null;
  size?: BadgeSize;
  showRating?: boolean;
};

function accentFor(key: RankedDivisionKey): string {
  switch (key) {
    case 'ember':
      return colors.warningRed;
    case 'spark':
      return colors.brightOrange;
    case 'flame':
      return colors.primary;
    case 'inferno':
      return colors.gold;
    case 'blaze':
      return colors.secondary;
    case 'blaze_elite':
      return '#FFE08A';
    default:
      return colors.textMuted;
  }
}

function DivisionGlyph({
  division,
  color,
  size,
}: {
  division: RankedDivisionKey;
  color: string;
  size: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {division === 'unranked' ? (
        <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2} fill="none" />
      ) : (
        <Path
          d="M12 2c1.5 3.5 2 5.5 1 8 2-.5 3.5-2 4.5-4 1 4-1 8-4.5 10.5C15 18 14 20 12 22c-2-2-3-4-1-5.5C7.5 14 5.5 10 6.5 6c1 2 2.5 3.5 4.5 4-1-2.5-.5-4.5 1-8z"
          fill={color}
        />
      )}
    </Svg>
  );
}

export function DivisionBadge({
  division,
  rating = null,
  size = 'medium',
  showRating = false,
}: DivisionBadgeProps) {
  const meta =
    RANKED_DIVISIONS.find((item) => item.key === division) ??
    divisionForRating(typeof rating === 'number' ? rating : 0, 0);
  const accent = accentFor(division);
  const dims =
    size === 'small'
      ? { pad: 6, icon: 14, name: 10, rating: 10, gap: 4 }
      : size === 'large'
        ? { pad: 12, icon: 28, name: 16, rating: 18, gap: 8 }
        : { pad: 8, icon: 20, name: 12, rating: 13, gap: 6 };

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: accent,
          paddingVertical: dims.pad,
          paddingHorizontal: dims.pad + 4,
          gap: dims.gap,
        },
      ]}
      accessibilityLabel={`${meta.displayName}${
        showRating && typeof rating === 'number' ? `, rating ${rating}` : ''
      }`}
    >
      <DivisionGlyph division={division} color={accent} size={dims.icon} />
      <View style={styles.copy}>
        <Text style={[styles.name, { fontSize: dims.name, color: accent }]}>
          {meta.displayName}
        </Text>
        {showRating && typeof rating === 'number' ? (
          <Text style={[styles.rating, { fontSize: dims.rating }]}>
            {rating.toLocaleString()}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.28)',
    maxWidth: '100%',
  },
  copy: {
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1,
  },
  rating: {
    ...typography.label,
    color: colors.textSecondary,
  },
});
