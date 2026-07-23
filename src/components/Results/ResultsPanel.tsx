import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { ResultsStatRow } from './ResultsStatRow';

export type ResultsStat = {
  label: string;
  value: string;
  highlight?: boolean;
  showNewBadge?: boolean;
};

type ResultsPanelProps = {
  rows: ResultsStat[];
};

export function ResultsPanel({ rows }: ResultsPanelProps) {
  return (
    <View style={styles.panel}>
      {rows.map((row, index) => (
        <ResultsStatRow
          key={row.label}
          label={row.label}
          value={row.value}
          highlight={row.highlight}
          showNewBadge={row.showNewBadge}
          isLast={index === rows.length - 1}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    backgroundColor: colors.backgroundCard,
    borderColor: colors.blazeSubtle,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
