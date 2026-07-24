import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../../theme/uiKit';
import { BlazePanel } from '../ui/BlazePanel';
import { LeaderboardRow } from './LeaderboardRow';

export type LeaderboardEntry = {
  rank: number;
  playerName: string;
  score: number;
  isCurrentPlayer?: boolean;
  badge?: string;
  subtitle?: string;
  meta?: string;
};

type Props = {
  entries: LeaderboardEntry[];
  loading?: boolean;
  emptyText?: string;
};

/** Non-virtualized panel list — safe inside a parent ScrollView. */
export function LeaderboardTable({
  entries,
  loading = false,
  emptyText = 'NO SCORES YET',
}: Props) {
  return (
    <BlazePanel padding={0} style={styles.panel}>
      {loading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : entries.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        <View>
          {entries.map((item) => (
            <LeaderboardRow
              key={`${item.rank}-${item.playerName}-${item.score}`}
              {...item}
            />
          ))}
        </View>
      )}
    </BlazePanel>
  );
}

const styles = StyleSheet.create({
  panel: {
    overflow: 'hidden',
    width: '100%',
  },
  empty: {
    color: colors.text.secondary,
    padding: spacing.xl,
    textAlign: 'center',
  },
});
