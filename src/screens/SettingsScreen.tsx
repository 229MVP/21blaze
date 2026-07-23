import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Circle, Path } from 'react-native-svg';

import { PlayingCard } from '../components/Card/PlayingCard';
import { SvgRoot as Svg } from '../components/svg/SvgRoot';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { BlazeModal } from '../components/Settings/BlazeModal';
import { SettingsRow } from '../components/Settings/SettingsRow';
import { SettingsToggle } from '../components/Settings/SettingsToggle';
import { ScreenContainer } from '../components/ScreenContainer';
import type { Card } from '../game/types';
import type { RootStackParamList } from '../navigation/navigationTypes';
import {
  CARD_STYLE_LABELS,
  CARD_STYLES,
  type CardStyle,
} from '../settings/types';
import { isPurchaseDiagnosticsEnabled } from '../config/featureFlags';
import { openPrivacyOptions } from '../monetization/adConsentService';
import { usePurchaseStore } from '../store/usePurchaseStore';
import { useGameStore } from '../store/useGameStore';
import { useScoreHistoryStore } from '../store/useScoreHistoryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies } from '../theme/typography';

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const PREVIEW_CARD: Card = {
  id: 'settings-preview',
  rank: 'A',
  suit: 'hearts',
};

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
          stroke={colors.primary}
          strokeWidth={1.8}
        />
        <Path
          d="M19.4 13.5a7.6 7.6 0 0 0 .05-1l2-1.5-2-3.5-2.4 1a7.7 7.7 0 0 0-1.7-1l-.3-2.5H9.9l-.3 2.5a7.7 7.7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.7 7.7 0 0 0 1.7 1l.3 2.5h4.2l.3-2.5a7.7 7.7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5z"
          fill="none"
          stroke={colors.gold}
          strokeWidth={1.4}
        />
        <Circle cx="12" cy="12" r="1.2" fill={colors.gold} />
      </Svg>
    </View>
  );
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const settings = useSettingsStore((state) => state.settings);
  const setSoundEffectsEnabled = useSettingsStore((s) => s.setSoundEffectsEnabled);
  const setMusicEnabled = useSettingsStore((s) => s.setMusicEnabled);
  const setHapticsEnabled = useSettingsStore((s) => s.setHapticsEnabled);
  const setTutorialHintsEnabled = useSettingsStore((s) => s.setTutorialHintsEnabled);
  const setReducedMotionEnabled = useSettingsStore((s) => s.setReducedMotionEnabled);
  const setCardStyle = useSettingsStore((s) => s.setCardStyle);
  const resetSettings = useSettingsStore((s) => s.resetSettings);
  const resetHighScore = useGameStore((s) => s.resetHighScore);
  const clearHistory = useScoreHistoryStore((s) => s.clearHistory);

  const [cardModalVisible, setCardModalVisible] = useState(false);
  const [pendingCardStyle, setPendingCardStyle] = useState<CardStyle>(
    settings.cardStyle,
  );

  const openCardModal = () => {
    setPendingCardStyle(settings.cardStyle);
    setCardModalVisible(true);
  };

  const confirmCardStyle = () => {
    setCardStyle(pendingCardStyle);
    setCardModalVisible(false);
  };

  const confirmResetHighScore = () => {
    Alert.alert(
      'Reset High Score?',
      'This permanently deletes your high score and local Top 10 history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await resetHighScore();
              await clearHistory();
              Alert.alert('Cleared', 'High score and local history were reset.');
            })();
          },
        },
      ],
    );
  };

  const confirmResetSettings = () => {
    Alert.alert(
      'Reset All Settings?',
      'This restores default preferences only. Your high score and local history are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Settings',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await resetSettings();
              Alert.alert('Restored', 'Settings were reset to defaults.');
            })();
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer style={styles.container} intensity="subtle" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="SETTINGS" icon={<GearIcon />} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panel}>
            <SettingsToggle
              label="SOUND EFFECTS"
              description="Preference only — audio not wired yet."
              value={settings.soundEffectsEnabled}
              onValueChange={setSoundEffectsEnabled}
            />
            <SettingsToggle
              label="MUSIC"
              description="Preference only — music not wired yet."
              value={settings.musicEnabled}
              onValueChange={setMusicEnabled}
            />
            <SettingsToggle
              label="HAPTICS"
              description="Preference only — vibration not wired yet."
              value={settings.hapticsEnabled}
              onValueChange={setHapticsEnabled}
            />
            <SettingsToggle
              label="TUTORIAL HINTS"
              value={settings.tutorialHintsEnabled}
              onValueChange={setTutorialHintsEnabled}
            />
            <SettingsToggle
              label="REDUCED MOTION"
              description="Shortens decorative animations."
              value={settings.reducedMotionEnabled}
              onValueChange={setReducedMotionEnabled}
              isLast
            />
          </View>

          <View style={[styles.panel, styles.panelSpaced]}>
            <Text style={styles.sectionLabel}>PURCHASES</Text>
            <SettingsRow
              label="RESTORE PURCHASES"
              onPress={() => {
                void usePurchaseStore.getState().restorePurchases().then((status) => {
                  if (status === 'success') {
                    Alert.alert('Restored', 'Eligible purchases were restored.');
                  } else if (status === 'unavailable') {
                    Alert.alert(
                      'Unavailable',
                      'Purchases require a native development build.',
                    );
                  } else if (status !== 'cancelled') {
                    Alert.alert('Restore failed', 'Please try again later.');
                  }
                });
              }}
              accessibilityLabel="Restore purchases"
              isFirst
            />
            <SettingsRow
              label="MANAGE SUBSCRIPTION"
              onPress={() => {
                void usePurchaseStore.getState().openCustomerCenter().then((status) => {
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
              accessibilityLabel="Manage subscription in Customer Center"
            />
            <SettingsRow
              label="PURCHASE SUPPORT"
              onPress={() => {
                Alert.alert(
                  'Purchase Support',
                  'Purchases are optional. Cosmetics and Pro do not affect gameplay. Store prices come from the app store. Use Restore Purchases or Manage Subscription after reinstalling. Remove Ads / Pro do not remove optional rewarded ads you choose to watch.',
                );
              }}
              accessibilityLabel="Purchase support information"
              isLast={!isPurchaseDiagnosticsEnabled()}
            />
            {isPurchaseDiagnosticsEnabled() ? (
              <SettingsRow
                label="PURCHASE DIAGNOSTICS"
                onPress={() => navigation.navigate('PurchaseDiagnostics')}
                accessibilityLabel="Open purchase diagnostics (development builds only)"
                isLast
              />
            ) : null}
          </View>

          <View style={[styles.panel, styles.panelSpaced]}>
            <Text style={styles.sectionLabel}>ADS</Text>
            <SettingsRow
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
              accessibilityLabel="Open privacy options"
              isFirst
              isLast
            />
          </View>

          <View style={[styles.panel, styles.panelSpaced]}>
            <SettingsRow
              label="CARD STYLE"
              value={CARD_STYLE_LABELS[settings.cardStyle]}
              onPress={openCardModal}
              accessibilityLabel={`Card style, ${CARD_STYLE_LABELS[settings.cardStyle]}`}
              isFirst
            />
            <SettingsRow
              label="RESET HIGH SCORE"
              onPress={confirmResetHighScore}
              danger
              accessibilityLabel="Reset high score and local history"
            />
            <SettingsRow
              label="RESET ALL SETTINGS"
              onPress={confirmResetSettings}
              danger
              accessibilityLabel="Reset all settings preferences"
              isLast
            />
          </View>
        </ScrollView>

        <BlazeButton
          title="BACK"
          variant="secondary"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back to home"
          fullWidth
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
              <View key={style} style={[styles.cardOption, selected && styles.cardOptionSelected]}>
                <PlayingCard card={PREVIEW_CARD} size="small" cardStyle={style} />
                <View style={styles.cardOptionCopy}>
                  <Text style={styles.cardOptionTitle}>{CARD_STYLE_LABELS[style]}</Text>
                  <BlazeButton
                    title={selected ? 'SELECTED' : 'SELECT'}
                    variant={selected ? 'primary' : 'outline'}
                    onPress={() => setPendingCardStyle(style)}
                    accessibilityLabel={`${CARD_STYLE_LABELS[style]} card style${selected ? ', selected' : ''}`}
                    style={styles.selectBtn}
                  />
                </View>
              </View>
            );
          })}
        </View>
        <BlazeButton title="SAVE" onPress={confirmCardStyle} fullWidth />
        <BlazeButton
          title="CANCEL"
          variant="secondary"
          onPress={() => setCardModalVisible(false)}
          fullWidth
        />
      </BlazeModal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  scroll: {
    paddingBottom: spacing.md,
  },
  panel: {
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  panelSpaced: {
    marginTop: spacing.md,
  },
  sectionLabel: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.gold,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },
  cardOptions: {
    gap: spacing.sm,
  },
  cardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.whiteSubtle,
    backgroundColor: colors.backgroundElevated,
  },
  cardOptionSelected: {
    borderColor: colors.blazeStrong,
  },
  cardOptionCopy: {
    flex: 1,
    gap: 6,
  },
  cardOptionTitle: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 15,
    color: colors.textPrimary,
  },
  selectBtn: {
    minHeight: 40,
  },
});
