import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { GameOverReason } from '../game/types';

export type RootStackParamList = {
  Home: { fromSoloComplete?: boolean } | undefined;
  Game: undefined;
  Results: {
    score?: number;
    highScore?: number;
    clearedLanes?: number;
    busts?: number;
    gameOverReason?: GameOverReason;
    timeRemainingSeconds?: number;
    cardsPlayed?: number;
    matchId?: string;
  };
  HowToPlay: undefined;
  Settings: undefined;
  HighScores: undefined;
  LiveDuelHome: undefined;
  CreateLiveRoom: undefined;
  JoinLiveRoom: undefined;
  LiveLobby: undefined;
  LiveGame: undefined;
  LiveDuelResults: undefined;
  QuickMatchSearch: undefined;
  QuickMatchFound: undefined;
  RankedHome: undefined;
  RankedSearch: undefined;
  RankedFound: undefined;
  RankedResults: undefined;
  RankedLeaderboard: undefined;
  RankedMatchHistory: undefined;
  HowRankedWorks: undefined;
  BlazeStore: undefined;
  PlayerProgression: undefined;
  DailyReward: undefined;
  DailyMissions: undefined;
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type GameScreenProps = NativeStackScreenProps<RootStackParamList, 'Game'>;
export type ResultsScreenProps = NativeStackScreenProps<RootStackParamList, 'Results'>;
export type HowToPlayScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'HowToPlay'
>;
export type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export type HighScoresScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'HighScores'
>;
export type LiveDuelHomeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'LiveDuelHome'
>;
export type CreateLiveRoomScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'CreateLiveRoom'
>;
export type JoinLiveRoomScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'JoinLiveRoom'
>;
export type LiveLobbyScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'LiveLobby'
>;
export type LiveGameScreenProps = NativeStackScreenProps<RootStackParamList, 'LiveGame'>;
export type LiveDuelResultsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'LiveDuelResults'
>;
export type QuickMatchSearchScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'QuickMatchSearch'
>;
export type QuickMatchFoundScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'QuickMatchFound'
>;
export type RankedHomeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'RankedHome'
>;
export type RankedSearchScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'RankedSearch'
>;
export type RankedFoundScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'RankedFound'
>;
export type RankedResultsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'RankedResults'
>;
export type RankedLeaderboardScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'RankedLeaderboard'
>;
export type RankedMatchHistoryScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'RankedMatchHistory'
>;
export type HowRankedWorksScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'HowRankedWorks'
>;
export type BlazeStoreScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'BlazeStore'
>;
export type PlayerProgressionScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'PlayerProgression'
>;
export type DailyRewardScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'DailyReward'
>;
export type DailyMissionsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'DailyMissions'
>;
