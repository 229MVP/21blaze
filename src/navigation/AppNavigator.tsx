import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CreateLiveRoomScreen } from '../screens/CreateLiveRoomScreen';
import { GameScreen } from '../screens/GameScreen';
import { HighScoresScreen } from '../screens/HighScoresScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HowToPlayScreen } from '../screens/HowToPlayScreen';
import { JoinLiveRoomScreen } from '../screens/JoinLiveRoomScreen';
import { LiveDuelHomeScreen } from '../screens/LiveDuelHomeScreen';
import { LiveDuelResultsScreen } from '../screens/LiveDuelResultsScreen';
import { LiveGameScreen } from '../screens/LiveGameScreen';
import { LiveLobbyScreen } from '../screens/LiveLobbyScreen';
import { QuickMatchFoundScreen } from '../screens/QuickMatchFoundScreen';
import { QuickMatchSearchScreen } from '../screens/QuickMatchSearchScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors } from '../theme/colors';
import type { RootStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Game" component={GameScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="HowToPlay" component={HowToPlayScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="HighScores" component={HighScoresScreen} />
      <Stack.Screen name="LiveDuelHome" component={LiveDuelHomeScreen} />
      <Stack.Screen name="CreateLiveRoom" component={CreateLiveRoomScreen} />
      <Stack.Screen name="JoinLiveRoom" component={JoinLiveRoomScreen} />
      <Stack.Screen name="LiveLobby" component={LiveLobbyScreen} />
      <Stack.Screen name="LiveGame" component={LiveGameScreen} />
      <Stack.Screen name="LiveDuelResults" component={LiveDuelResultsScreen} />
      <Stack.Screen name="QuickMatchSearch" component={QuickMatchSearchScreen} />
      <Stack.Screen name="QuickMatchFound" component={QuickMatchFoundScreen} />
    </Stack.Navigator>
  );
}
