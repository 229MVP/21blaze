import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { FeedbackScreenProps } from '../navigation/navigationTypes';
import {
  formatDiagnosticsForClipboard,
  getAnonymizedDiagnostics,
  getAppVersion,
  getBuildNumber,
} from '../services/deviceInfo';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

/**
 * Version 1.1C — compact TestFlight feedback route. Deliberately never
 * includes access tokens, full database records, raw user IDs, ad
 * verification secrets, RevenueCat keys, or private match logs — only the
 * app version/build, platform, and whatever the player types below.
 */
const SUPPORT_EMAIL = 'support@twentyoneblaze.com';

export function FeedbackScreen({ navigation }: FeedbackScreenProps) {
  const [screenName, setScreenName] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const diagnostics = getAnonymizedDiagnostics();

  const copyVersion = async () => {
    await Clipboard.setStringAsync(`v${getAppVersion()} (build ${getBuildNumber()})`);
    Alert.alert('Copied', 'App version and build number copied to clipboard.');
  };

  const copyDiagnostics = async () => {
    await Clipboard.setStringAsync(formatDiagnosticsForClipboard(diagnostics));
    Alert.alert('Copied', 'Diagnostics copied to clipboard.');
  };

  const openSupportEmail = async () => {
    const subject = encodeURIComponent(
      `21 Blaze feedback — v${diagnostics.appVersion} (${diagnostics.buildNumber})`,
    );
    const bodyLines = [
      'Describe what happened:',
      '',
      '',
      '--- Diagnostics (safe to share) ---',
      formatDiagnosticsForClipboard(diagnostics),
    ];
    if (screenName.trim()) {
      bodyLines.push(`Screen: ${screenName.trim()}`);
    }
    if (errorCode.trim()) {
      bodyLines.push(`Error code: ${errorCode.trim()}`);
    }
    const body = encodeURIComponent(bodyLines.join('\n'));
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert(
        'No Mail App',
        `Please email ${SUPPORT_EMAIL} directly to report an issue.`,
      );
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="FEEDBACK" />

        <View style={styles.panel}>
          <Text style={styles.label}>APP VERSION</Text>
          <Text style={styles.value}>
            v{diagnostics.appVersion} (build {diagnostics.buildNumber})
          </Text>
          <BlazeButton
            title="COPY VERSION"
            variant="outline"
            onPress={() => {
              void copyVersion();
            }}
            fullWidth
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>ANONYMIZED DIAGNOSTICS</Text>
          <Text style={styles.value}>{formatDiagnosticsForClipboard(diagnostics)}</Text>
          <BlazeButton
            title="COPY DIAGNOSTICS"
            variant="outline"
            onPress={() => {
              void copyDiagnostics();
            }}
            fullWidth
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>OPTIONAL DETAILS</Text>
          <TextInput
            style={styles.input}
            placeholder="Screen name (optional)"
            placeholderTextColor={colors.textMuted}
            value={screenName}
            onChangeText={setScreenName}
            accessibilityLabel="Screen name"
          />
          <TextInput
            style={styles.input}
            placeholder="Error code (optional)"
            placeholderTextColor={colors.textMuted}
            value={errorCode}
            onChangeText={setErrorCode}
            accessibilityLabel="Error code"
          />
          <BlazeButton
            title="REPORT AN ISSUE"
            onPress={() => {
              void openSupportEmail();
            }}
            fullWidth
          />
        </View>

        <Text style={styles.disclosure}>
          Feedback never includes access tokens, account records, or private match logs.
        </Text>

        <BlazeButton
          title="BACK"
          variant="secondary"
          onPress={() => navigation.goBack()}
          fullWidth
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  panel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: colors.backgroundCard,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontFamily: fontFamilies.body,
  },
  disclosure: {
    ...typography.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
