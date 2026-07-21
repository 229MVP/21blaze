import { create } from 'zustand';

type GameStore = {
  highScore: number;
  setHighScore: (score: number) => void;
  resetGame: () => void;
};

export const useGameStore = create<GameStore>((set) => ({
  highScore: 0,
  setHighScore: (score) => {
    const normalized = Number.isFinite(score) && score > 0 ? Math.floor(score) : 0;
    set({ highScore: normalized });
  },
  resetGame: () => {
    // Full game session state will be reset here once gameplay is implemented.
  },
}));
