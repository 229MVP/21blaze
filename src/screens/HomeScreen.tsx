import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { blazeAssets } from '../assets/blazeAssets';
import { FlameIcon } from '../components/branding/FlameIcon';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { EditDisplayNameModal } from '../components/Profile/EditDisplayNameModal';
import { LevelUpOverlay } from '../components/Progression/LevelUpOverlay';
import { XpProgressBar } from '../components/Progression/XpProgressBar';
import { SvgRoot as Svg } from '../components/svg/SvgRoot';
import { BlazeButton } from '../components/ui/BlazeButton';
import {
  isDailyMissionsEnabled,
  isDailyRewardsEnabled,
  isLiveDuelEnabled,
  isMonetizationBetaEnabled,
  isProgressionBetaEnabled,
  isRankedBetaEnabled,
} from '../config/featureFlags';
import { getCosmetic } from '../cosmetics/catalog';
import { APP_VERSION } from '../game/constants';
import type { HomeScreenProps } from '../navigation/navigationTypes';
import {
  maybeShowInterstitialAfterSoloHome,
  recordSoloMatchCompletedForInterstitial,
} from '../monetization/interstitialAdService';
import { loadHighScore } from '../storage/highScoreStorage';
import { useAuthStore } from '../store/useAuthStore';
import { useCosmeticStore } from '../store/useCosmeticStore';
import { useGameStore } from '../store/useGameStore';
import {
  useHasRemoveAdsEntitlement,
  usePurchaseStore,
} from '../store/usePurchaseStore';
import { useProgressionStore } from '../store/useProgressionStore';
import { useScoreHistoryStore } from '../store/useScoreHistoryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useWalletStore } from '../store/useWalletStore';
import { colors as kitColors, spacing as kitSpacing } from '../theme/uiKit';

const CONTENT_MAX_WIDTH = 410;

function TrophyIcon({ size = 16 }: { size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M7 4h10v2h3v2c0 2.2-1.5 4-3.5 4.6A4.5 4.5 0 0 1 14 15.9V18h2v2H8v-2h2v-2.1A4.5 4.5 0 0 1 7.5 12.6C5.5 12 4 10.2 4 8V6h3V4zm2 2v1.5H6.1c.2 1 .9 1.8 1.9 2.1V6zm8.9 0H15v3.6c1-.3 1.7-1.1 1.9-2.1H17.9z"
          fill={kitColors.fire.gold}
        />
      </Svg>
    </View>
  );
}

function statusLabel(authStatus: 'connecting' | 'online' | 'local'): string {
  if (authStatus === 'online') {
    return 'ONLINE';
  }
  if (authStatus === 'connecting') {
    return 'CONNECTING';
  }
  return 'LOCAL MODE';
}

function statusDetail(authStatus: 'connecting' | 'online' | 'local'): string {
  if (authStatus === 'online') {
    return 'Verified scores enabled';
  }
  if (authStatus === 'connecting') {
    return 'Connecting…';
  }
  return 'Scores stay on this device';
}

export function HomeScreen({ navigation, route }: HomeScreenProps) {
  const { width, height } = useWindowDimensions();
  const compactHeight = height < 780;
  const logoSize = width < 360 ? 132 : compactHeight ? 152 : 176;

  const highScore = useGameStore((state) => state.highScore);
  const setHighScore = useGameStore((state) => state.setHighScore);
  const hydrateSettings = useSettingsStore((state) => state.hydrateSettings);
  const hydrateScoreHistory = useScoreHistoryStore(
    (state) => state.hydrateScoreHistory,
  );
  const authStatus = useAuthStore((state) => state.authStatus);
  const authError = useAuthStore((state) => state.authError);
  const retryOnlineAuth = useAuthStore((state) => state.retryOnlineAuth);
  const isInitializingAuth = useAuthStore((state) => state.isInitializing);
  const balance = useWalletStore((state) => state.balance);
  const hydrateWallet = useWalletStore((state) => state.hydrateWallet);
  const hydrateCosmetics = useCosmeticStore((state) => state.hydrateCosmetics);
  const equipped = useCosmeticStore((state) => state.equippedCosmetics);
  const initializePurchases = usePurchaseStore(
    (state) => state.initializePurchases,
  );
  const hasRemoveAds = useHasRemoveAdsEntitlement();
  const storeEnabled = isMonetizationBetaEnabled();
  const progressionEnabled = isProgressionBetaEnabled();
  const profile = useAuthStore((state) => state.profile);
  const progression = useProgressionStore((state) => state.progression);
  const dailyRewardStatus = useProgressionStore(
    (state) => state.dailyRewardStatus,
  );
  const dailyMissions = useProgressionStore((state) => state.dailyMissions);
  const pendingLevelUp = useProgressionStore((state) => state.pendingLevelUp);
  const hydrateProgression = useProgressionStore(
    (state) => state.hydrateProgression,
  );
  const acknowledgeLevelUp = useProgressionStore(
    (state) => state.acknowledgeLevelUp,
  );

  const [nameEditorOpen, setNameEditorOpen] = useState(false);

  const dailyReady =
    Boolean(dailyRewardStatus?.isAvailable) ||
    Boolean(progression?.isDailyRewardAvailable);
  const missionClaimable = dailyMissions?.claimableCount ?? 0;
  const showDailyLink = isDailyRewardsEnabled() && dailyReady;
  const showMissionsLink = isDailyMissionsEnabled() && missionClaimable > 0;

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      const savedScore = await loadHighScore();
      await hydrateSettings();
      await hydrateScoreHistory();
      await hydrateWallet();
      await hydrateCosmetics();
      await initializePurchases();
      if (progressionEnabled) {
        void hydrateProgression();
      }
      if (isMounted) {
        setHighScore(savedScore);
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [
    hydrateCosmetics,
    hydrateProgression,
    hydrateScoreHistory,
    hydrateSettings,
    hydrateWallet,
    initializePurchases,
    progressionEnabled,
    setHighScore,
  ]);

  useEffect(() => {
    const fromSolo = route.params?.fromSoloComplete === true;
    if (!fromSolo) {
      return;
    }
    recordSoloMatchCompletedForInterstitial();
    void maybeShowInterstitialAfterSoloHome(hasRemoveAds);
    navigation.setParams({ fromSoloComplete: undefined });
  }, [hasRemoveAds, navigation, route.params?.fromSoloComplete]);

  const showRetry = authStatus === 'local' && Boolean(authError);

  return (
    <BlazeScreenBackground variant="home" embers>
      <View style={styles.shell} pointerEvents="box-none">
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', 'rgba(255,101,0,0.18)', 'rgba(5,7,9,0.55)']}
          locations={[0.45, 0.78, 1]}
          style={styles.bottomGlow}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.column,
            compactHeight && styles.columnCompact,
            { maxWidth: Math.min(CONTENT_MAX_WIDTH, width - 24) },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={blazeAssets.logoMain}
            style={[styles.logo, { width: logoSize, height: logoSize }]}
            resizeMode="contain"
            accessibilityLabel="21 Blaze"
            accessibilityRole="image"
          />

          <Text style={styles.tagline}>BUILD YOUR STREAK. BEAT 21.</Text>

          <View style={styles.statusPill} accessibilityRole="text">
            <View
              style={[
                styles.statusDot,
                authStatus === 'online' && styles.statusDotOnline,
                authStatus === 'connecting' && styles.statusDotConnecting,
                authStatus === 'local' && styles.statusDotLocal,
              ]}
            />
            <View style={styles.statusCopy}>
              <Text style={styles.statusLabel}>{statusLabel(authStatus)}</Text>
              <Text style={styles.statusDetail} numberOfLines={1}>
                {statusDetail(authStatus)}
              </Text>
            </View>
            {showRetry ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry online authentication"
                disabled={isInitializingAuth}
                onPress={() => {
                  void retryOnlineAuth();
                }}
                style={({ pressed }) => [
                  styles.retryChip,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.retryChipText}>
                  {isInitializingAuth ? '…' : 'RETRY'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {progressionEnabled ? (
            <View style={styles.profileRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Level ${progression?.level ?? 1}. Open progression.`}
                onPress={() => navigation.navigate('PlayerProgression')}
                style={({ pressed }) => [
                  styles.levelBadge,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.levelBadgeText}>
                  LVL {progression?.level ?? 1}
                </Text>
              </Pressable>

              <View style={styles.profileCopy}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    profile?.display_name
                      ? `Player ${profile.display_name}. Edit display name.`
                      : 'Player'
                  }
                  disabled={authStatus !== 'online' || !profile?.display_name}
                  onPress={() => setNameEditorOpen(true)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text style={styles.profileName} numberOfLines={1}>
                    {profile?.display_name ?? 'Player'}
                  </Text>
                </Pressable>
                {equipped.playerTitle ? (
                  <Text style={styles.profileTitle} numberOfLines={1}>
                    {getCosmetic(equipped.playerTitle)?.displayName ??
                      equipped.playerTitle}
                  </Text>
                ) : null}
                <XpProgressBar
                  compact
                  level={progression?.level ?? 1}
                  currentLevelXp={progression?.currentLevelXp ?? 0}
                  xpRequiredForNextLevel={
                    progression?.xpRequiredForNextLevel ?? 100
                  }
                />
                {showDailyLink || showMissionsLink ? (
                  <View style={styles.claimRow}>
                    {showDailyLink ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Open daily rewards"
                        onPress={() => navigation.navigate('DailyReward')}
                        style={({ pressed }) => pressed && styles.pressed}
                      >
                        <Text style={styles.claimLink}>DAILY READY</Text>
                      </Pressable>
                    ) : null}
                    {showMissionsLink ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Open daily missions"
                        onPress={() => navigation.navigate('DailyMissions')}
                        style={({ pressed }) => pressed && styles.pressed}
                      >
                        <Text style={styles.claimLink}>
                          MISSIONS · {missionClaimable}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>

              {storeEnabled ? (
                <View style={styles.coinChip} accessibilityRole="text">
                  <Text style={styles.coinValue}>{balance.toLocaleString()}</Text>
                  <Text style={styles.coinLabel}>COINS</Text>
                  {hasRemoveAds ? (
                    <Text style={styles.adFree}>AD-FREE</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : storeEnabled ? (
            <View style={styles.coinOnlyRow}>
              <Text style={styles.coinValue}>{balance.toLocaleString()} COINS</Text>
              {hasRemoveAds ? <Text style={styles.adFree}>AD-FREE</Text> : null}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`High score ${highScore}. Open high scores.`}
            onPress={() => navigation.navigate('HighScores')}
            style={({ pressed }) => [
              styles.highScorePanel,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.highScoreLabelRow}>
              <TrophyIcon />
              <Text style={styles.highScoreLabel}>HIGH SCORE</Text>
            </View>
            <Text style={styles.highScoreValue}>
              {highScore.toLocaleString()}
            </Text>
          </Pressable>

          <View style={styles.actions}>
            <BlazeButton
              label="SOLO PLAY"
              size="lg"
              onPress={() => navigation.navigate('Game')}
              accessibilityLabel="Solo play 21 Blaze"
            />
            {isLiveDuelEnabled() ? (
              <BlazeButton
                label="LIVE DUEL"
                variant="secondary"
                onPress={() => navigation.navigate('LiveDuelHome')}
                accessibilityLabel="Live Duel friend matches"
              />
            ) : null}
            {isRankedBetaEnabled() ? (
              <BlazeButton
                label="RANKED"
                variant="ghost"
                onPress={() => navigation.navigate('RankedHome')}
                accessibilityLabel="Ranked competitive matches"
              />
            ) : null}
            {storeEnabled ? (
              <BlazeButton
                label="BLAZE STORE"
                variant="secondary"
                onPress={() => navigation.navigate('BlazeStore')}
                accessibilityLabel="Open Blaze Store"
              />
            ) : null}
            <View style={styles.secondaryRow}>
              <View style={styles.halfButton}>
                <BlazeButton
                  label="HOW TO PLAY"
                  variant="secondary"
                  onPress={() => navigation.navigate('HowToPlay')}
                />
              </View>
              <View style={styles.halfButton}>
                <BlazeButton
                  label="SETTINGS"
                  variant="secondary"
                  onPress={() => navigation.navigate('Settings')}
                />
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <FlameIcon width={10} height={14} />
            <Text style={styles.version}>v{APP_VERSION}</Text>
          </View>
        </ScrollView>
      </View>

      <EditDisplayNameModal
        visible={nameEditorOpen}
        onClose={() => setNameEditorOpen(false)}
      />

      {progressionEnabled ? (
        <LevelUpOverlay
          pending={pendingLevelUp}
          onContinue={acknowledgeLevelUp}
        />
      ) : null}
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: 'rgba(5,7,9,0.35)',
  },
  bottomGlow: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  column: {
    flexGrow: 1,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: kitSpacing.lg,
    paddingVertical: kitSpacing.md,
    gap: kitSpacing.sm,
  },
  columnCompact: {
    gap: 6,
    paddingVertical: kitSpacing.sm,
  },
  logo: {
    alignSelf: 'center',
  },
  tagline: {
    color: kitColors.fire.gold,
    textAlign: 'center',
    fontFamily: 'RobotoCondensed_700Bold',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1.4,
  },
  statusPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.28)',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: kitColors.text.muted,
  },
  statusDotOnline: { backgroundColor: '#3DDC84' },
  statusDotConnecting: { backgroundColor: kitColors.fire.gold },
  statusDotLocal: { backgroundColor: kitColors.fire.brightOrange },
  statusCopy: {
    flexShrink: 1,
    minWidth: 0,
  },
  statusLabel: {
    color: kitColors.text.primary,
    fontFamily: 'RobotoCondensed_700Bold',
    fontSize: 11,
    letterSpacing: 1.1,
  },
  statusDetail: {
    color: kitColors.text.secondary,
    fontFamily: 'RobotoCondensed_400Regular',
    fontSize: 11,
  },
  retryChip: {
    minHeight: 28,
    minWidth: 52,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: kitColors.border.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryChipText: {
    color: kitColors.fire.gold,
    fontFamily: 'RobotoCondensed_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  profileRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: kitSpacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.28)',
    backgroundColor: 'rgba(0,0,0,0.42)',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  levelBadge: {
    minWidth: 54,
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.55)',
    backgroundColor: 'rgba(255,101,0,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: {
    color: kitColors.fire.orange,
    fontFamily: 'Anton_400Regular',
    fontSize: 15,
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  profileName: {
    color: kitColors.text.primary,
    fontFamily: 'RobotoCondensed_700Bold',
    fontSize: 14,
  },
  profileTitle: {
    color: kitColors.fire.gold,
    fontFamily: 'RobotoCondensed_400Regular',
    fontSize: 11,
  },
  claimRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  claimLink: {
    color: kitColors.fire.brightOrange,
    fontFamily: 'RobotoCondensed_700Bold',
    fontSize: 11,
    letterSpacing: 0.7,
  },
  coinChip: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 1,
  },
  coinOnlyRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coinValue: {
    color: kitColors.fire.gold,
    fontFamily: 'RobotoCondensed_700Bold',
    fontSize: 13,
    letterSpacing: 0.6,
  },
  coinLabel: {
    color: kitColors.text.secondary,
    fontFamily: 'RobotoCondensed_400Regular',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  adFree: {
    color: kitColors.status.success,
    fontFamily: 'RobotoCondensed_700Bold',
    fontSize: 10,
    letterSpacing: 0.7,
  },
  highScorePanel: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
    paddingVertical: 10,
    paddingHorizontal: kitSpacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.45)',
    backgroundColor: 'rgba(0,0,0,0.5)',
    shadowColor: '#FF6500',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  highScoreLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  highScoreLabel: {
    color: kitColors.text.secondary,
    fontFamily: 'RobotoCondensed_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  highScoreValue: {
    color: kitColors.fire.orange,
    fontFamily: 'Anton_400Regular',
    fontSize: 34,
    lineHeight: 38,
    textShadowColor: 'rgba(255,182,41,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  actions: {
    width: '100%',
    gap: kitSpacing.sm,
    marginTop: 2,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfButton: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  version: {
    color: kitColors.text.muted,
    fontFamily: 'RobotoCondensed_400Regular',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.88,
  },
});
