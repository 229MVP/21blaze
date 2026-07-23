import { create } from 'zustand';

import type { ScoreEntry } from '../scores/types';
import {
  clearScoreHistory,
  loadScoreHistory,
  saveScoreEntry,
} from '../storage/scoreHistoryStorage';

type ScoreHistoryStore = {
  entries: ScoreEntry[];
  isHydrated: boolean;
  hydrateScoreHistory: () => Promise<void>;
  recordScore: (entry: ScoreEntry) => Promise<ScoreEntry[]>;
  clearHistory: () => Promise<void>;
};

let isHydrating = false;

export const useScoreHistoryStore = create<ScoreHistoryStore>((set, get) => ({
  entries: [],
  isHydrated: false,

  hydrateScoreHistory: async () => {
    if (get().isHydrated || isHydrating) {
      return;
    }

    isHydrating = true;

    try {
      const entries = await loadScoreHistory();
      set({ entries, isHydrated: true });
    } finally {
      isHydrating = false;
    }
  },

  recordScore: async (entry) => {
    const next = await saveScoreEntry(entry);
    set({ entries: next, isHydrated: true });
    return next;
  },

  clearHistory: async () => {
    await clearScoreHistory();
    set({ entries: [], isHydrated: true });
  },
}));

export function findLocalRank(
  entries: ScoreEntry[],
  matchId: string,
): number | null {
  const index = entries.findIndex((entry) => entry.id === matchId);
  return index >= 0 ? index + 1 : null;
}
