import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Circle, Path } from 'react-native-svg';

import { PlayingCard } from '../components/Card/PlayingCard';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { ConfirmationModal } from '../components/modals/ConfirmationModal';
import { BlazeModal } from '../components/Settings/BlazeModal';
import { SettingsActionRow } from '../components/settings/SettingsActionRow';
import { SettingsToggleRow } from '../components/settings/SettingsToggleRow';
import { SvgRoot as Svg } from '../components/svg/SvgRoot';
import { BlazeButton } from '../components/ui/BlazeButton';
import { BlazePanel } from '../components/ui/BlazePanel';
import { isPurchaseDiagnosticsEnabled } from '../config/featureFlags';
import type { Card } from '../game/types';
import { openPrivacyOptions } from '../monetization/adConsentService';
import type { RootStackParamList } from '../navigation/navigationTypes';
import {
  CARD_STYLE_LABELS,
  CARD_STYLES,
  type CardStyle,
} from '../settings/types';
import { useGameStore } from '../store/useGameStore';
import {
  useHasRemoveAdsEntitlement,
  usePurchaseStore,
} from '../store/usePurchaseStore';
import { useScoreHistoryStore } from '../store/useScoreHistoryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

type SettingsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'Settings'
>;

const PREVIEW_CARD: Card = {
  id: 'settings-preview',
  rank: 'A',
  suit: 'hearts',
};

const CONTENT_MAX = 410;

function GearIcon() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 28, height: 28 }}
    >
      <Svg width={28} height={28} viewBox="0 0 24 24">
        <Path
          d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"
          fill="none"
          stroke={kitColors.fire.orange}
          strokeWidth={1.8}
        />
        <Path
          d="M19.4 13.5a7.6 7.6 0 0 0 .05-1l2-1.5-2-3.5-2.4 1a7.7 7.7 0 0 0-1.7-1l-.3-2.5H9.9l-.3 2.5a7.7 7.7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.7 7.7 0 0 0 1.7 1l.3 2.5h4.2l.3-2.5a7.7 7.7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5z"
          fill="none"
          stroke={kitColors.fire.gold}
          strokeWidth={1.4}
        />
        <Circle cx="12" cy="12" r="1.2" fill={kitColors.fire.gold} />
      </Svg>
    </View>
  );
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);

  const settings = useSettingsStore((state) => state.settings);
  const isHydrated = useSettingsStore((state) => state.isHydrated);
  const hydrateSettings = useSettingsStore((state) => state.hydrateSettings);
  const setSoundEffectsEnabled = useSettingsStore(
    (s) => s.setSoundEffectsEnabled,
  );
  const setMusicEnabled = useSettingsStore((s) => s.setMusicEnabled);
  const setHapticsEnabled = useSettingsStore((s) => s.setHapticsEnabled);
  const setTutorialHintsEnabled = useSettingsStore(
    (s) => s.setTutorialHintsEnabled,
  );
  const setReducedMotionEnabled = useSettingsStore(
    (s) => s.setReducedMotionEnabled,
  );
  const setCardStyle = useSettingsStore((s) => s.setCardStyle);
  const resetSettings = useSettingsStore((s) => s.resetSettings);
  const resetHighScore = useGameStore((s) => s.resetHighScore);
  const clearHistory = useScoreHistoryStore((s) => s.clearHistory);
  const hasRemoveAds = useHasRemoveAdsEntitlement();
  const restoreStatus = usePurchaseStore((s) => s.restoreStatus);
  const restoreBusy = restoreStatus === 'restoring';

  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [pendingCardStyle, setPendingCardStyle] = useState<CardStyle>(
    settings.cardStyle,
  );
  const [confirmKind, setConfirmKind] = useState<
    'highScore' | 'settings' | null
  >(null);

  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  const openCardModal = () => {
    setPendingCardStyle(settings.cardStyle);
    setCardModalVisible(true);
  };

  const confirmCardStyle = () => {
    setCardStyle(pendingCardStyle);
    setCardModalVisible(false);
  };

  const performResetHighScore = () => {
    setConfirmKind(null);
    void (async () => {
      await resetHighScore();
      await clearHistory();
      Alert.alert('Cleared', 'High score and local history were reset.');
    })();
  };

  const performResetSettings = () => {
    setConfirmKind(null);
    void (async () => {
      await resetSettings();
      Alert.alert('Restored', 'Settings were reset to defaults.');
    })();
  };

  return (
    <BlazeScreenBackground variant="plain">
      <View
        style={[
          styles.column,
          { width: columnWidth, maxWidth: CONTENT_MAX, alignSelf: 'center' },
        ]}
      >
        <ScreenHeader title="SETTINGS" icon={<GearIcon />} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {!isHydrated ? (
            <View
              style={styles.loadingBlock}
              accessibilityLiveRegion="polite"
              accessibilityLabel="Loading settings"
            >
              <ActivityIndicator color={kitColors.fire.orange} />
              <Text style={styles.loadingText}>Loading settings…</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>GAMEPLAY</Text>
              <BlazePanel padding={0} style={styles.panel}>
                <SettingsToggleRow
                  label="SOUND EFFECTS"
                  description="Preference only — audio not wired yet."
                  value={settings.soundEffectsEnabled}
                  onValueChange={setSoundEffectsEnabled}
                />
                <SettingsToggleRow
                  label="MUSIC"
                  description="Preference only — music not wired yet."
                  value={settings.musicEnabled}
                  onValueChange={setMusicEnabled}
                />
                <SettingsToggleRow
                  label="HAPTICS"
                  description="Preference only — vibration not wired yet."
                  value={settings.hapticsEnabled}
                  onValueChange={setHapticsEnabled}
                />
                <SettingsToggleRow
                  label="TUTORIAL HINTS"
                  value={settings.tutorialHintsEnabled}
                  onValueChange={setTutorialHintsEnabled}
                />
                <SettingsToggleRow
                  label="REDUCED MOTION"
                  description="Shortens decorative animations."
                  value={settings.reducedMotionEnabled}
                  onValueChange={setReducedMotionEnabled}
                />
              </BlazePanel>

              <Text style={styles.sectionLabel}>APPEARANCE</Text>
              <BlazePanel padding={0} style={styles.panel}>
                <SettingsActionRow
                  label="CARD STYLE"
                  value={CARD_STYLE_LABELS[settings.cardStyle]}
                  onPress={openCardModal}
                />
              </BlazePanel>

              <Text style={styles.sectionLabel}>ACCOUNT AND PURCHASES</Text>
              <BlazePanel padding={0} style={styles.panel}>
                <SettingsActionRow
                  label="RESTORE PURCHASES"
                  value={
                    restoreBusy
                      ? 'WORKING…'
                      : restoreStatus === 'success'
                        ? 'RESTORED'
                        : undefined
                  }
                  disabled={restoreBusy}
                  onPress={() => {
                    if (restoreBusy) {
                      return;
                    }
                    void usePurchaseStore
                      .getState()
                      .restorePurchases()
                      .then((status) => {
                        if (status === 'success') {
                          Alert.alert(
                            'Restored',
                            'Eligible purchases were restored.',
                          );
                        } else if (status === 'unavailable') {
                          Alert.alert(
                            'Unavailable',
                            'Purchases require a native development build.',
                          );
                        } else if (status !== 'cancelled') {
                          const message =
                            usePurchaseStore.getState().error ??
                            'Please try again later.';
                          Alert.alert('Restore failed', message);
                        }
                      });
                  }}
                />
                <SettingsActionRow
                  label="MANAGE SUBSCRIPTION"
                  onPress={() => {
                    void usePurchaseStore
                      .getState()
                      .openCustomerCenter()
                      .then((status) => {
                        if (status === 'unavailable') {
                          Alert.alert(
                            'Unavailable',
                            'Customer Center requires a native development build with RevenueCat configured.',
                          );
                        } else if (status === 'error') {
                          Alert.alert(
                            'Unable to open',
                            'Customer Center could not be opened. Try Restore Purchases.',
                          );
                        }
                      });
                  }}
                />
                <SettingsActionRow
                  label="AD-FREE STATUS"
                  value={hasRemoveAds ? 'ACTIVE' : 'NOT OWNED'}
                  onPress={() => {
                    Alert.alert(
                      'Ad-Free Status',
                      hasRemoveAds
                        ? 'Remove Ads / Pro is active on this device.'
                        : 'No Remove Ads entitlement is active.',
                    );
                  }}
                />
                <SettingsActionRow
                  label="PRIVACY OPTIONS"
                  onPress={() => {
                    void openPrivacyOptions().then((opened) => {
                      if (!opened) {
                        Alert.alert(
                          'Privacy Options',
                          'Privacy options are unavailable on this platform.',
                        );
                      }
                    });
                  }}
                />
                <SettingsActionRow
                  label="PURCHASE SUPPORT"
                  onPress={() => {
                    Alert.alert(
                      'Purchase Support',
                      'Purchases are optional. Cosmetics and Pro do not affect gameplay. Store prices come from the app store. Use Restore Purchases or Manage Subscription after reinstalling. Remove Ads / Pro do not remove optional rewarded ads you choose to watch.',
                    );
                  }}
                />
                {isPurchaseDiagnosticsEnabled() ? (
                  <SettingsActionRow
                    label="PURCHASE DIAGNOSTICS"
                    onPress={() => navigation.navigate('PurchaseDiagnostics')}
                  />
                ) : null}
              </BlazePanel>

              <Text style={styles.sectionLabel}>DATA</Text>
              <BlazePanel padding={0} style={styles.panel}>
                <SettingsActionRow
                  label="RESET HIGH SCORE"
                  danger
                  onPress={() => setConfirmKind('highScore')}
                />
                <SettingsActionRow
                  label="RESET SETTINGS"
                  danger
                  onPress={() => setConfirmKind('settings')}
                />
                {__DEV__ ? (
                  <SettingsActionRow
                    label="OPEN UI KIT PREVIEW"
                    onPress={() => navigation.navigate('BlazeUIKitPreview')}
                  />
                ) : null}
              </BlazePanel>
            </>
          )}
        </ScrollView>

        <BlazeButton
          label="BACK"
          variant="secondary"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back to home"
        />
      </View>

      <BlazeModal
        visible={cardModalVisible}
        title="CARD STYLE"
        message="Choose how playing cards look. Game values stay the same."
        onRequestClose={() => setCardModalVisible(false)}
      >
        <View style={styles.cardOptions}>
          {CARD_STYLES.map((style) => {
            const selected = pendingCardStyle === style;
            return (
              <View
                key={style}
                style={[
                  styles.cardOption,
                  selected && styles.cardOptionSelected,
                ]}
              >
                <PlayingCard
                  card={PREVIEW_CARD}
                  size="small"
                  cardStyle={style}
                />
                <View style={styles.cardOptionCopy}>
                  <Text style={styles.cardOptionTitle}>
                    {CARD_STYLE_LABELS[style]}
                  </Text>
                  <BlazeButton
                    label={selected ? 'SELECTED' : 'SELECT'}
                    variant={selected ? 'primary' : 'secondary'}
                    size="sm"
                    onPress={() => setPendingCardStyle(style)}
                    accessibilityLabel={`${CARD_STYLE_LABELS[style]} card style${
                      selected ? ', selected' : ''
                    }`}
                  />
                </View>
              </View>
            );
          })}
        </View>
        <BlazeButton label="SAVE" onPress={confirmCardStyle} />
        <BlazeButton
          label="CANCEL"
          variant="secondary"
          onPress={() => setCardModalVisible(false)}
        />
      </BlazeModal>

      <ConfirmationModal
        visible={confirmKind === 'highScore'}
        title="RESET HIGH SCORE?"
        message="This will permanently clear your saved high score and local score history on this device."
        confirmLabel="RESET"
        cancelLabel="CANCEL"
        danger
        onConfirm={performResetHighScore}
        onCancel={() => setConfirmKind(null)}
      />
      <ConfirmationModal
        visible={confirmKind === 'settings'}
        title="RESET SETTINGS?"
        message="This will restore game preferences to their defaults. Scores and purchases will not be removed."
        confirmLabel="RESET"
        cancelLabel="CANCEL"
        danger
        onConfirm={performResetSettings}
        onCancel={() => setConfirmKind(null)}
      />
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    paddingHorizontal: kitSpacing.md,
    paddingBottom: kitSpacing.md,
    gap: kitSpacing.sm,
  },
  scroll: {
    paddingBottom: kitSpacing.md,
    gap: 4,
  },
  loadingBlock: {
    alignItems: 'center',
    gap: kitSpacing.sm,
    paddingVertical: kitSpacing.xl,
  },
  loadingText: {
    fontFamily: kitTypography.families.body,
    fontSize: 14,
    color: kitColors.text.secondary,
  },
  sectionLabel: {
    marginTop: kitSpacing.sm,
    marginBottom: 4,
    paddingHorizontal: 4,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.4,
    color: kitColors.fire.gold,
  },
  panel: {
    width: '100%',
    overflow: 'hidden',
  },
  cardOptions: {
    gap: kitSpacing.sm,
  },
  cardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kitSpacing.md,
    padding: kitSpacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: kitColors.border.default,
    backgroundColor: kitColors.background.elevated,
  },
  cardOptionSelected: {
    borderColor: kitColors.border.active,
  },
  cardOptionCopy: {
    flex: 1,
    gap: 6,
  },
  cardOptionTitle: {
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 15,
    color: kitColors.text.primary,
  },
});
