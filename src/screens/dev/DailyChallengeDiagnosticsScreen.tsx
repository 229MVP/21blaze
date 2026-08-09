import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BlazeButton } from '../../components/buttons/BlazeButton';
import { BlazeScreenBackground } from '../../components/layout/BlazeScreenBackground';
import { BlazePanel } from '../../components/ui/BlazePanel';
import { hashDailyChallengeDeckOrder } from '../../challenge/dailyChallengeDeckHash';
import {
  completeDailyChallenge,
  getTodayDailyChallenge,
  startDailyChallenge,
} from '../../challenge/dailyChallengeClient';
import { hashAuthoritativeSeedFingerprint } from '../../challenge/seedFingerprint';
import { getUtcChallengeDate } from '../../challenge/utcChallengeDate';
import { createDailyChallengeDeck } from '../../game/challenge/createDailyChallengeDeck';
import type { RootStackParamList } from '../../navigation/navigationTypes';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyChallengeDiagnostics'>;

type DiagnosticsState = {
  challengeId?: string;
  challengeDate?: string;
  rulesVersion?: string;
  deckVersion?: string;
  seedFingerprint?: string;
  deckHash?: string;
  attemptId?: string;
  attemptStatus?: string;
  startError?: string;
  completionStatus?: string;
};

/**
 * Development-only Daily Challenge diagnostics. Never registered in production navigation.
 */
export function DailyChallengeDiagnosticsScreen({ navigation }: Props) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const challenge = await getTodayDailyChallenge();
      const start = await startDailyChallenge();

      let attemptId: string | undefined;
      let attemptStatus: string | undefined;
      let startError: string | undefined;
      let deckHash: string | undefined;
      let seedFingerprint: string | undefined;

      if ('error' in start) {
        startError = start.error;
      } else {
        attemptId = start.attemptId;
        attemptStatus = start.resumed ? 'started (resumed)' : 'started';
        seedFingerprint = hashAuthoritativeSeedFingerprint(start.seed);
        deckHash = hashDailyChallengeDeckOrder(
          createDailyChallengeDeck(start.seed).map((card) => card.id),
        );
      }

      setDiagnostics({
        challengeId: challenge.id,
        challengeDate: challenge.challengeDate,
        rulesVersion: challenge.rulesVersion,
        deckVersion: challenge.deckVersion,
        seedFingerprint,
        deckHash,
        attemptId,
        attemptStatus,
        startError,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Daily Challenge diagnostics failed', message);
    } finally {
      setLoading(false);
    }
  }, []);

  const runCompletionProbe = useCallback(async () => {
    if (!diagnostics.attemptId) {
      Alert.alert('No attempt', 'Start or resume an attempt first.');
      return;
    }

    setLoading(true);
    try {
      const result = await completeDailyChallenge({
        attemptId: diagnostics.attemptId,
        score: 0,
        exact21Count: 0,
        fiveCardClearCount: 0,
        bustCount: 0,
        cardsPlayed: 0,
        completionMs: 1000,
        rulesVersion: diagnostics.rulesVersion ?? '1',
      });
      setDiagnostics((current) => ({
        ...current,
        completionStatus: result.alreadyCompleted
          ? 'already completed (idempotent)'
          : 'completed (probe)',
        attemptStatus: 'completed',
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Completion probe failed', message);
    } finally {
      setLoading(false);
    }
  }, [diagnostics.attemptId, diagnostics.rulesVersion]);

  return (
    <BlazeScreenBackground variant="home">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Daily Challenge Diagnostics</Text>
        <Text style={styles.subtitle}>Development only — no raw seeds displayed.</Text>

        <BlazePanel style={styles.panel}>
          <Text style={styles.label}>UTC challenge date</Text>
          <Text style={styles.value}>{getUtcChallengeDate()}</Text>
          <Text style={styles.label}>Challenge ID</Text>
          <Text style={styles.value}>{diagnostics.challengeId ?? '—'}</Text>
          <Text style={styles.label}>Challenge date</Text>
          <Text style={styles.value}>{diagnostics.challengeDate ?? '—'}</Text>
          <Text style={styles.label}>Rules version</Text>
          <Text style={styles.value}>{diagnostics.rulesVersion ?? '—'}</Text>
          <Text style={styles.label}>Deck version</Text>
          <Text style={styles.value}>{diagnostics.deckVersion ?? '—'}</Text>
          <Text style={styles.label}>Seed fingerprint</Text>
          <Text style={styles.value}>{diagnostics.seedFingerprint ?? '—'}</Text>
          <Text style={styles.label}>Deterministic deck hash</Text>
          <Text style={styles.value}>{diagnostics.deckHash ?? '—'}</Text>
          <Text style={styles.label}>Attempt ID</Text>
          <Text style={styles.value}>{diagnostics.attemptId ?? '—'}</Text>
          <Text style={styles.label}>Attempt status</Text>
          <Text style={styles.value}>
            {diagnostics.attemptStatus ?? diagnostics.startError ?? '—'}
          </Text>
          <Text style={styles.label}>Completion probe</Text>
          <Text style={styles.value}>{diagnostics.completionStatus ?? '—'}</Text>
        </BlazePanel>

        <BlazeButton
          title={loading ? 'LOADING…' : 'REFRESH DIAGNOSTICS'}
          onPress={() => {
            void refresh();
          }}
        />
        <BlazeButton
          title="RUN COMPLETION PROBE"
          variant="secondary"
          onPress={() => {
            void runCompletionProbe();
          }}
        />
        <BlazeButton
          title="BACK"
          variant="secondary"
          onPress={() => navigation.goBack()}
        />
      </ScrollView>
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  panel: {
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
});
