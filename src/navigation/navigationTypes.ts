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
