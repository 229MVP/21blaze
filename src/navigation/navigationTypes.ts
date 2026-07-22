import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { GameOverReason } from '../game/types';

export type RootStackParamList = {
  Home: undefined;
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
