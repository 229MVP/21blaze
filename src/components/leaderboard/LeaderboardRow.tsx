import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, shadows, spacing, typography } from '../../theme/uiKit';

type Props = {
  rank: number;
  playerName: string;
  score: number;
  isCurrentPlayer?: boolean;
  badge?: string;
  subtitle?: string;
  meta?: string;
  onPress?: () => void;
};

function rankColor(rank: number): string {
  if (rank === 1) {
    return colors.fire.gold;
  }
  if (rank === 2) {
    return '#C8CDD3';
  }
  if (rank === 3) {
    return '#CD7F32';
  }
  return colors.text.secondary;
}

export function LeaderboardRow({
  rank,
  playerName,
  score,
  isCurrentPlayer = false,
  badge,
  subtitle,
  meta,
  onPress,
}: Props) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Rank ${rank}, ${playerName}, ${score.toLocaleString()} points${
        isCurrentPlayer ? ', current player' : ''
      }${subtitle ? `, ${subtitle}` : ''}`}
      style={({ pressed }) => [
        styles.row,
        rank === 1 && styles.topRow,
        rank === 1 && shadows.glow,
        isCurrentPlayer && styles.current,
        { opacity: pressed && onPress ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.rank, { color: rankColor(rank) }]}>{rank}</Text>
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          {badge ? <Text style={styles.badge}>{badge}</Text> : null}
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.name, isCurrentPlayer && styles.currentText]}
          >
            {playerName}
            {isCurrentPlayer ? ' (YOU)' : ''}
          </Text>
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Text
        style={[styles.score, rank <= 3 && { color: rankColor(rank) }]}
        numberOfLines={1}
      >
        {score.toLocaleString()}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
  },
  topRow: {
    backgroundColor: 'rgba(255,138,0,0.08)',
  },
  current: {
    backgroundColor: 'rgba(255,182,41,0.1)',
  },
  rank: {
    width: 28,
    fontFamily: typography.families.condensed,
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    color: colors.fire.gold,
    fontSize: 12,
  },
  name: {
    flexShrink: 1,
    color: colors.text.primary,
    fontFamily: typography.families.condensed,
    fontWeight: '700',
    fontSize: 14,
  },
  currentText: {
    color: colors.fire.gold,
  },
  subtitle: {
    color: colors.text.secondary,
    fontFamily: typography.families.body,
    fontSize: 11,
  },
  meta: {
    color: colors.text.muted,
    fontFamily: typography.families.body,
    fontSize: 11,
  },
  score: {
    color: colors.fire.gold,
    fontFamily: typography.families.condensed,
    fontWeight: '800',
    fontSize: 16,
    flexShrink: 0,
    maxWidth: '34%',
    textAlign: 'right',
  },
});
