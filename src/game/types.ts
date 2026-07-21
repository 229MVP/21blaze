export type LaneId = 1 | 2 | 3 | 4;

export type GameResultParams = {
  score?: number;
  highScore?: number;
  clearedLanes?: number;
  busts?: number;
};
