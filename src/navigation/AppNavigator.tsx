import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createNavigationContainerRef } from '@react-navigation/native';

import {
  isAsyncDuelEnabled,
  isDailyChallengeEnabled,
  isLivePvpEnabled,
  isPurchaseDiagnosticsEnabled,
  isThemePreviewDevEnabled,
  isV1_1LockerEnabled,
} from '../config/featureFlags';
import { AsyncDuelChallengeDetailsScreen } from '../screens/AsyncDuelChallengeDetailsScreen';
import { AsyncDuelChallengeSentScreen } from '../screens/AsyncDuelChallengeSentScreen';
import { AsyncDuelConfirmChallengeScreen } from '../screens/AsyncDuelConfirmChallengeScreen';
import { AsyncDuelHubScreen } from '../screens/AsyncDuelHubScreen';
import { AsyncDuelResultScreen } from '../screens/AsyncDuelResultScreen';
import { AsyncDuelSelectOpponentScreen } from '../screens/AsyncDuelSelectOpponentScreen';
import { LivePvpConfirmChallengeScreen } from '../screens/LivePvpConfirmChallengeScreen';
import { LivePvpHubScreen } from '../screens/LivePvpHubScreen';
import { LivePvpInviteDetailsScreen } from '../screens/LivePvpInviteDetailsScreen';
import { LivePvpLobbyScreen } from '../screens/LivePvpLobbyScreen';
import { LivePvpResultScreen } from '../screens/LivePvpResultScreen';
import { LivePvpSelectOpponentScreen } from '../screens/LivePvpSelectOpponentScreen';
import { LivePvpWaitingRoomScreen } from '../screens/LivePvpWaitingRoomScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { BlazeLockerScreen } from '../screens/BlazeLockerScreen';
import { BlazeStoreScreen } from '../screens/BlazeStoreScreen';
import { CreateLiveRoomScreen } from '../screens/CreateLiveRoomScreen';
import { DailyChallengeLeaderboardScreen } from '../screens/DailyChallengeLeaderboardScreen';
import { DailyChallengeScreen } from '../screens/DailyChallengeScreen';
import { DailyMissionsScreen } from '../screens/DailyMissionsScreen';
import { DailyRewardScreen } from '../screens/DailyRewardScreen';
import { BlazeUIKitPreviewScreen } from '../screens/dev/BlazeUIKitPreviewScreen';
import { DailyChallengeDiagnosticsScreen } from '../screens/dev/DailyChallengeDiagnosticsScreen';
import { AsyncDuelDiagnosticsScreen } from '../screens/dev/AsyncDuelDiagnosticsScreen';
import { LivePvpHarnessScreen } from '../screens/dev/LivePvpHarnessScreen';
import { FeedbackScreen } from '../screens/FeedbackScreen';
import { GameScreen } from '../screens/GameScreen';
import { HighScoresScreen } from '../screens/HighScoresScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HowRankedWorksScreen } from '../screens/HowRankedWorksScreen';
import { HowToPlayScreen } from '../screens/HowToPlayScreen';
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
import { ProductionPracticeScreen } from '../productionGame/ProductionPracticeScreen';
import { ProductionLobbyScreen } from '../productionGame/ProductionLobbyScreen';
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
      <Stack.Screen name="ProductionPractice" component={ProductionPracticeScreen} />
      <Stack.Screen name="ProductionLobby" component={ProductionLobbyScreen} />
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
            component={DailyChallengeLeaderboardScreen}
          />
        </>
      ) : null}
      {isAsyncDuelEnabled() ? (
        <>
          <Stack.Screen name="AsyncDuelHub" component={AsyncDuelHubScreen} />
          <Stack.Screen
            name="AsyncDuelSelectOpponent"
            component={AsyncDuelSelectOpponentScreen}
          />
          <Stack.Screen
            name="AsyncDuelConfirmChallenge"
            component={AsyncDuelConfirmChallengeScreen}
          />
          <Stack.Screen
            name="AsyncDuelChallengeDetails"
            component={AsyncDuelChallengeDetailsScreen}
          />
          <Stack.Screen
            name="AsyncDuelChallengeSent"
            component={AsyncDuelChallengeSentScreen}
          />
          <Stack.Screen name="AsyncDuelResult" component={AsyncDuelResultScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      ) : null}
      {isLivePvpEnabled() ? (
        <>
          <Stack.Screen name="LivePvpHub" component={LivePvpHubScreen} />
          <Stack.Screen
            name="LivePvpSelectOpponent"
            component={LivePvpSelectOpponentScreen}
          />
          <Stack.Screen
            name="LivePvpConfirmChallenge"
            component={LivePvpConfirmChallengeScreen}
          />
          <Stack.Screen
            name="LivePvpWaitingRoom"
            component={LivePvpWaitingRoomScreen}
          />
          <Stack.Screen
            name="LivePvpInviteDetails"
            component={LivePvpInviteDetailsScreen}
          />
          <Stack.Screen name="LivePvpLobby" component={LivePvpLobbyScreen} />
          <Stack.Screen name="LivePvpResult" component={LivePvpResultScreen} />
          {!isAsyncDuelEnabled() ? (
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
          ) : null}
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
        <>
          <Stack.Screen
            name="BlazeUIKitPreview"
            component={BlazeUIKitPreviewScreen}
          />
          <Stack.Screen
            name="DailyChallengeDiagnostics"
            component={DailyChallengeDiagnosticsScreen}
          />
          <Stack.Screen
            name="AsyncDuelDiagnostics"
            component={AsyncDuelDiagnosticsScreen}
          />
          <Stack.Screen name="LivePvpHarness" component={LivePvpHarnessScreen} />
        </>
      ) : null}
      {isThemePreviewDevEnabled() ? (
        <Stack.Screen name="ThemePreview" component={ThemePreviewScreen} />
      ) : null}
    </Stack.Navigator>
  );
}
