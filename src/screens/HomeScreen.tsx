import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BlazeLogo } from '../components/branding/BlazeLogo';
import { FlameIcon } from '../components/branding/FlameIcon';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { PlayerProfileButton } from '../components/Profile/PlayerProfileButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { isMonetizationBetaEnabled } from '../config/featureFlags';
import { APP_VERSION } from '../game/constants';
import type { HomeScreenProps } from '../navigation/navigationTypes';
import { loadHighScore } from '../storage/highScoreStorage';
import { useAuthStore } from '../store/useAuthStore';
import { useCosmeticStore } from '../store/useCosmeticStore';
import { useGameStore } from '../store/useGameStore';
import { useHasRemoveAdsEntitlement, usePurchaseStore } from '../store/usePurchaseStore';
import { useScoreHistoryStore } from '../store/useScoreHistoryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useWalletStore } from '../store/useWalletStore';
import {
  maybeShowInterstitialAfterSoloHome,
  recordSoloMatchCompletedForInterstitial,
} from '../monetization/interstitialAdService';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function TrophyIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        d="M7 4h10v2h3v2c0 2.2-1.5 4-3.5 4.6A4.5 4.5 0 0 1 14 15.9V18h2v2H8v-2h2v-2.1A4.5 4.5 0 0 1 7.5 12.6C5.5 12 4 10.2 4 8V6h3V4zm2 2v1.5H6.1c.2 1 .9 1.8 1.9 2.1V6zm8.9 0H15v3.6c1-.3 1.7-1.1 1.9-2.1H17.9z"
        fill={colors.gold}
      />
    </Svg>
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
    return 'Verified matches available';
  }
  if (authStatus === 'connecting') {
    return 'Authentication is initializing';
  }
  return 'Scores stay on this device';
}

export function HomeScreen({ navigation, route }: HomeScreenProps) {
  const { width } = useWindowDimensions();
  const logoSize = width < 360 ? 'md' : 'lg';
  const highScore = useGameStore((state) => state.highScore);
  const setHighScore = useGameStore((state) => state.setHighScore);
  const hydrateSettings = useSettingsStore((state) => state.hydrateSettings);
  const hydrateScoreHistory = useScoreHistoryStore((state) => state.hydrateScoreHistory);
  const authStatus = useAuthStore((state) => state.authStatus);
  const balance = useWalletStore((state) => state.balance);
  const hydrateWallet = useWalletStore((state) => state.hydrateWallet);
  const hydrateCosmetics = useCosmeticStore((state) => state.hydrateCosmetics);
  const initializePurchases = usePurchaseStore((state) => state.initializePurchases);
  const hasRemoveAds = useHasRemoveAdsEntitlement();
  const storeEnabled = isMonetizationBetaEnabled();

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      const savedScore = await loadHighScore();
      await hydrateSettings();
      await hydrateScoreHistory();
      await hydrateWallet();
      await hydrateCosmetics();
      await initializePurchases();

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
    hydrateScoreHistory,
    hydrateSettings,
    hydrateWallet,
    initializePurchases,
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

  return (
    <ScreenContainer style={styles.container} intensity="intense">
      <View style={styles.content}>
        <BlazeLogo size={logoSize} showTagline />

        <View style={styles.statusChip} accessibilityRole="text">
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
            <Text style={styles.statusDetail}>{statusDetail(authStatus)}</Text>
          </View>
        </View>

        <PlayerProfileButton />

        {storeEnabled ? (
          <View style={styles.economyRow}>
            <Text style={styles.coinBalance}>{balance.toLocaleString()} COINS</Text>
            {hasRemoveAds ? <Text style={styles.adFreeBadge}>AD-FREE</Text> : null}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`High score ${highScore}. Open high scores.`}
          onPress={() => navigation.navigate('HighScores')}
          style={({ pressed }) => [styles.highScoreBox, pressed && styles.pressed]}
        >
          <View style={styles.highScoreLabelRow}>
            <TrophyIcon />
            <Text style={styles.highScoreLabel}>HIGH SCORE</Text>
          </View>
          <Text style={styles.highScoreValue}>{highScore.toLocaleString()}</Text>
        </Pressable>

        <View style={styles.actions}>
          <BlazeButton
            title="SOLO PLAY"
            onPress={() => navigation.navigate('Game')}
            accessibilityLabel="Solo play 21 Blaze"
            fullWidth
          />
          <BlazeButton
            title="LIVE DUEL"
            variant="secondary"
            onPress={() => navigation.navigate('LiveDuelHome')}
            accessibilityLabel="Live Duel friend matches"
            fullWidth
          />
          {storeEnabled ? (
            <BlazeButton
              title="BLAZE STORE"
              variant="outline"
              onPress={() => navigation.navigate('BlazeStore')}
              accessibilityLabel="Open Blaze Store"
              fullWidth
            />
          ) : null}
          <View style={styles.secondaryRow}>
            <BlazeButton
              title="HOW TO PLAY"
              variant="outline"
              onPress={() => navigation.navigate('HowToPlay')}
              style={styles.halfButton}
            />
            <BlazeButton
              title="SETTINGS"
              variant="outline"
              onPress={() => navigation.navigate('Settings')}
              style={styles.halfButton}
            />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <FlameIcon width={10} height={14} />
        <Text style={styles.version}>v{APP_VERSION}</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: spacing.md,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.22)',
    width: '100%',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  statusDotOnline: {
    backgroundColor: '#3DDC84',
  },
  statusDotConnecting: {
    backgroundColor: colors.gold,
  },
  statusDotLocal: {
    backgroundColor: colors.brightOrange,
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  statusLabel: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.textPrimary,
  },
  statusDetail: {
    ...typography.label,
    fontSize: 11,
    textTransform: 'none',
    color: colors.textSecondary,
  },
  highScoreBox: {
    width: '100%',
    backgroundColor: colors.backgroundCard,
    borderColor: colors.blazeSubtle,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    minHeight: 88,
    justifyContent: 'center',
  },
  economyRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  coinBalance: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 13,
    color: colors.gold,
    letterSpacing: 1,
  },
  adFreeBadge: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 11,
    color: colors.success,
    letterSpacing: 1,
  },
  pressed: {
    opacity: 0.9,
  },
  highScoreLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  highScoreLabel: {
    ...typography.label,
    letterSpacing: 1,
  },
  highScoreValue: {
    fontFamily: fontFamilies.display,
    fontSize: 36,
    lineHeight: 40,
    color: colors.primary,
    textShadowColor: colors.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
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
    paddingBottom: spacing.md,
  },
  version: {
    ...typography.version,
  },
});
