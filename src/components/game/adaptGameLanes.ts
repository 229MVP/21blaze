import { calculateHandTotal } from '../../game/cardValues';
import type { Lane, LaneId, MoveEventType } from '../../game/types';
import { toKitCardProps } from '../cards/adaptGameCard';
import type { LaneData } from './LanesGrid';

/** Map engine lanes → UI-kit LanesGrid data without changing game totals. */
export function toKitLaneData(lanes: readonly Lane[], laneIds: readonly LaneId[]): LaneData[] {
  return laneIds.map((laneId) => {
    const lane = lanes.find((item) => item.id === laneId) ?? {
      id: laneId,
      cards: [],
    };
    return {
      laneNumber: laneId,
      total: calculateHandTotal(lane.cards),
      cards: lane.cards.map(toKitCardProps),
    };
  });
}

export function laneVisualFlags(
  laneId: LaneId,
  feedbackLaneId: number | null | undefined,
  feedbackType: MoveEventType | null | undefined,
): { selected: boolean; danger: boolean; cleared: boolean } {
  const isEventLane = feedbackLaneId === laneId;
  if (!isEventLane || !feedbackType) {
    return { selected: false, danger: false, cleared: false };
  }
  return {
    selected: feedbackType === 'placed',
    danger: feedbackType === 'bust',
    cleared:
      feedbackType === 'cleared21' || feedbackType === 'clearedFiveCard',
  };
}
