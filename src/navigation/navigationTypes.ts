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
  BlazeLocker: undefined;
  PlayerProgression: undefined;
  DailyReward: undefined;
  DailyMissions: undefined;
  DailyChallenge: undefined;
  DailyChallengeLeaderboard: undefined;
  ChallengeRewards: undefined;
  AsyncChallengeHub: undefined;
  CreateAsyncChallenge: undefined;
  JoinAsyncChallenge: { inviteCode?: string } | undefined;
  AsyncChallengeDetail: { challengeId?: string } | undefined;
  PurchaseDiagnostics: undefined;
  Feedback: undefined;
  /** Development-only UI kit gallery. Registered only when __DEV__ is true. */
  BlazeUIKitPreview: undefined;
  /** Development-only theme gallery. Registered only when the dev-preview flag + __DEV__ are both true. */
  ThemePreview: undefined;
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
export type BlazeLockerScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'BlazeLocker'
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
export type DailyChallengeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'DailyChallenge'
>;
export type DailyChallengeLeaderboardScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'DailyChallengeLeaderboard'
>;
export type ChallengeRewardsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ChallengeRewards'
>;
export type AsyncChallengeHubScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AsyncChallengeHub'
>;
export type CreateAsyncChallengeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'CreateAsyncChallenge'
>;
export type JoinAsyncChallengeScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'JoinAsyncChallenge'
>;
export type AsyncChallengeDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AsyncChallengeDetail'
>;
export type PurchaseDiagnosticsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'PurchaseDiagnostics'
>;
export type FeedbackScreenProps = NativeStackScreenProps<RootStackParamList, 'Feedback'>;
export type BlazeUIKitPreviewScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'BlazeUIKitPreview'
>;
export type ThemePreviewScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ThemePreview'
>;
