import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createNavigationContainerRef } from '@react-navigation/native';

import {
  isAsyncChallengesEnabled,
  isDailyChallengeEnabled,
  isChallengeRewardsEnabled,
  isPurchaseDiagnosticsEnabled,
  isThemePreviewDevEnabled,
  isV1_1LockerEnabled,
} from '../config/featureFlags';
import { AsyncChallengeDetailScreen } from '../screens/AsyncChallengeDetailScreen';
import { AsyncChallengeHubScreen } from '../screens/AsyncChallengeHubScreen';
import { BlazeLockerScreen } from '../screens/BlazeLockerScreen';
import { BlazeStoreScreen } from '../screens/BlazeStoreScreen';
import { CreateAsyncChallengeScreen } from '../screens/CreateAsyncChallengeScreen';
import { CreateLiveRoomScreen } from '../screens/CreateLiveRoomScreen';
import { ChallengeRewardsScreen } from '../screens/ChallengeRewardsScreen';
import { DailyLeaderboardScreen } from '../screens/DailyLeaderboardScreen';
import { DailyChallengeScreen } from '../screens/DailyChallengeScreen';
import { DailyMissionsScreen } from '../screens/DailyMissionsScreen';
import { DailyRewardScreen } from '../screens/DailyRewardScreen';
import { BlazeUIKitPreviewScreen } from '../screens/dev/BlazeUIKitPreviewScreen';
import { FeedbackScreen } from '../screens/FeedbackScreen';
import { GameScreen } from '../screens/GameScreen';
import { HighScoresScreen } from '../screens/HighScoresScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HowRankedWorksScreen } from '../screens/HowRankedWorksScreen';
import { HowToPlayScreen } from '../screens/HowToPlayScreen';
import { JoinAsyncChallengeScreen } from '../screens/JoinAsyncChallengeScreen';
import { JoinLiveRoomScreen } from '../screens/JoinLiveRoomScreen';
import { LiveDuelHomeScreen } from '../screens/LiveDuelHomeScreen';
import { LiveDuelResultsScreen } from '../screens/LiveDuelResultsScreen';
import { LiveGameScreen } from '../screens/LiveGameScreen';
import { LiveLobbyScreen } from '../screens/LiveLobbyScreen';
import { PlayerProgressionScreen } from '../screens/PlayerProgressionScreen';
import { PurchaseDiagnosticsScreen } from '../screens/PurchaseDiagnosticsScreen';
import { QuickMatchFoundScreen } from '../screens/QuickMatchFoundScreen';
import { QuickMatchSearchScreen } from '../screens/QuickMatchSearchScreen';
import { RankedFoundScreen } from '../screens/RankedFoundScreen';
import { RankedHomeScreen } from '../screens/RankedHomeScreen';
import { RankedLeaderboardScreen } from '../screens/RankedLeaderboardScreen';
import { RankedMatchHistoryScreen } from '../screens/RankedMatchHistoryScreen';
import { RankedResultsScreen } from '../screens/RankedResultsScreen';
import { RankedSearchScreen } from '../screens/RankedSearchScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ThemePreviewScreen } from '../screens/dev/ThemePreviewScreen';
import { colors } from '../theme/colors';
import type { RootStackParamList } from './navigationTypes';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
      <Stack.Screen name="RankedHome" component={RankedHomeScreen} />
      <Stack.Screen name="RankedSearch" component={RankedSearchScreen} />
      <Stack.Screen name="RankedFound" component={RankedFoundScreen} />
      <Stack.Screen name="RankedResults" component={RankedResultsScreen} />
      <Stack.Screen name="RankedLeaderboard" component={RankedLeaderboardScreen} />
      <Stack.Screen name="RankedMatchHistory" component={RankedMatchHistoryScreen} />
      <Stack.Screen name="HowRankedWorks" component={HowRankedWorksScreen} />
      <Stack.Screen name="BlazeStore" component={BlazeStoreScreen} />
      {isV1_1LockerEnabled() ? (
        <Stack.Screen name="BlazeLocker" component={BlazeLockerScreen} />
      ) : null}
      <Stack.Screen name="PlayerProgression" component={PlayerProgressionScreen} />
      <Stack.Screen name="DailyReward" component={DailyRewardScreen} />
      <Stack.Screen name="DailyMissions" component={DailyMissionsScreen} />
      {isDailyChallengeEnabled() ? (
        <>
          <Stack.Screen name="DailyChallenge" component={DailyChallengeScreen} />
          <Stack.Screen
            name="DailyChallengeLeaderboard"
            component={DailyLeaderboardScreen}
          />
          {isChallengeRewardsEnabled() ? (
            <Stack.Screen name="ChallengeRewards" component={ChallengeRewardsScreen} />
          ) : null}
        </>
      ) : null}
      {isAsyncChallengesEnabled() ? (
        <>
          <Stack.Screen name="AsyncChallengeHub" component={AsyncChallengeHubScreen} />
          <Stack.Screen name="CreateAsyncChallenge" component={CreateAsyncChallengeScreen} />
          <Stack.Screen name="JoinAsyncChallenge" component={JoinAsyncChallengeScreen} />
          <Stack.Screen name="AsyncChallengeDetail" component={AsyncChallengeDetailScreen} />
        </>
      ) : null}
      <Stack.Screen name="Feedback" component={FeedbackScreen} />
      {isPurchaseDiagnosticsEnabled() ? (
        <Stack.Screen
          name="PurchaseDiagnostics"
          component={PurchaseDiagnosticsScreen}
        />
      ) : null}
      {__DEV__ ? (
        <Stack.Screen
          name="BlazeUIKitPreview"
          component={BlazeUIKitPreviewScreen}
        />
      ) : null}
      {isThemePreviewDevEnabled() ? (
        <Stack.Screen name="ThemePreview" component={ThemePreviewScreen} />
      ) : null}
    </Stack.Navigator>
  );
}
