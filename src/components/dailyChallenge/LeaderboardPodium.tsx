import { StyleSheet, Text, View } from 'react-native';

import type { DailyLeaderboardEntry } from '../../challenge/dailyLeaderboardTypes';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../../theme/uiKit';

type LeaderboardPodiumProps = {
  entries: DailyLeaderboardEntry[];
  reduceMotion?: boolean;
};

export function LeaderboardPodium({ entries }: LeaderboardPodiumProps) {
  const first = entries.find((e) => e.rank === 1);
  const second = entries.find((e) => e.rank === 2);
  const third = entries.find((e) => e.rank === 3);

  if (!first && !second && !third) {
    return null;
  }

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.row}>
        <PodiumSlot rank={2} entry={second} height={64} />
        <PodiumSlot rank={1} entry={first} height={88} highlight />
        <PodiumSlot rank={3} entry={third} height={56} />
      </View>
    </View>
  );
}

function PodiumSlot({
  rank,
  entry,
  height,
  highlight = false,
}: {
  rank: number;
  entry?: DailyLeaderboardEntry;
  height: number;
  highlight?: boolean;
}) {
  return (
    <View
      style={styles.slot}
      accessibilityLabel={
        entry
          ? `Rank ${rank}, ${entry.displayName}, ${entry.score}`
          : `Rank ${rank}, empty`
      }
    >
      <Text style={[styles.rank, highlight && styles.rankGold]}>#{rank}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {entry?.displayName ?? '—'}
      </Text>
      <Text style={styles.score}>
        {entry ? entry.score.toLocaleString() : '—'}
      </Text>
      <View style={[styles.bar, { height }, highlight && styles.barGold]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginBottom: kitSpacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 120,
    gap: 4,
  },
  rank: {
    color: kitColors.text.secondary,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 12,
  },
  rankGold: {
    color: kitColors.fire.gold,
  },
  name: {
    color: kitColors.text.primary,
    fontFamily: kitTypography.families.condensed,
    fontSize: 11,
    textAlign: 'center',
  },
  score: {
    color: kitColors.fire.orange,
    fontFamily: kitTypography.families.display,
    fontSize: 16,
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: 'rgba(255,138,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.35)',
  },
  barGold: {
    backgroundColor: 'rgba(255,182,41,0.28)',
    borderColor: kitColors.fire.gold,
  },
});
