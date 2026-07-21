import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  Game: undefined;
  Results: {
    score?: number;
    highScore?: number;
    clearedLanes?: number;
    busts?: number;
  };
};

export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type GameScreenProps = NativeStackScreenProps<RootStackParamList, 'Game'>;
export type ResultsScreenProps = NativeStackScreenProps<RootStackParamList, 'Results'>;
