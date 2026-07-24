import { StyleSheet, View } from 'react-native';

import type { CardModel } from '../cards';
import { spacing } from '../../theme/uiKit';
import { LaneBox } from './LaneBox';

export type LaneData = {
  laneNumber: number;
  total: number;
  cards: readonly CardModel[];
};

type Props = {
  lanes: readonly LaneData[];
  onSelect?: (lane: number) => void;
  disabled?: boolean;
};

export function LanesGrid({ lanes, onSelect, disabled = false }: Props) {
  return (
    <View style={styles.grid}>
      {lanes.map((lane) => (
        <View key={lane.laneNumber} style={styles.cell}>
          <LaneBox
            laneNumber={lane.laneNumber}
            total={lane.total}
            cards={[...lane.cards]}
            disabled={disabled}
            onPress={() => onSelect?.(lane.laneNumber)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: '48.5%', flexGrow: 1 },
});
