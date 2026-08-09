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
import { createDailyChallengeConfig } from '../../game/challenge/createDailyChallenge';
import type { RootStackParamList } from '../../navigation/navigationTypes';
import {
  useDailyChallengeStore,
  type DailyChallengeUiStatus,
} from '../../store/useDailyChallengeStore';
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

  const applyUiFixture = (fixture: DailyChallengeUiStatus) => {
    const date = getUtcChallengeDate();
    const config = createDailyChallengeConfig(date, `fixture-${date}`);
    const base = {
      challenge: config,
      errorMessage: null as string | null,
      activeSession: null,
      rankedAttempt: null,
      completionSummary: null,
      submissionStatus: 'idle' as const,
      isStarting: false,
    };

    switch (fixture) {
      case 'available':
        useDailyChallengeStore.setState({ ...base, uiStatus: 'available' });
        break;
      case 'in_progress':
        useDailyChallengeStore.setState({
          ...base,
          uiStatus: 'in_progress',
          activeSession: {
            challengeId: config.challengeId,
            attemptId: 'fixture-attempt',
            attemptType: 'ranked',
            authoritativeSeed: config.authoritativeSeed!,
            rulesVersion: config.rulesVersion,
            deckVersion: config.deckVersion,
            durationSeconds: config.durationSeconds,
            bustLimit: config.bustLimit,
            serverStartTime: new Date().toISOString(),
            expiresAt: new Date().toISOString(),
            challengeDate: date,
          },
          rankedAttempt: {
            id: 'fixture-attempt',
            status: 'started',
            verifiedScore: null,
            exact21Count: null,
            fiveCardClearCount: null,
            bustCount: null,
            completionMs: null,
            startedAt: new Date().toISOString(),
            completedAt: null,
          },
        });
        break;
      case 'completed':
        useDailyChallengeStore.setState({
          ...base,
          uiStatus: 'completed',
          rankedAttempt: {
            id: 'fixture-attempt',
            status: 'completed',
            verifiedScore: 12480,
            exact21Count: 4,
            fiveCardClearCount: 2,
            bustCount: 1,
            completionMs: 95000,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
          completionSummary: {
            score: 12480,
            exact21Count: 4,
            fiveCardClearCount: 2,
            bustCount: 1,
            completionMs: 95000,
            rulesVersion: config.rulesVersion,
            alreadyCompleted: true,
          },
          submissionStatus: 'completed',
        });
        break;
      case 'practice_available':
        useDailyChallengeStore.setState({
          ...base,
          uiStatus: 'practice_available',
          rankedAttempt: {
            id: 'fixture-attempt',
            status: 'completed',
            verifiedScore: 12480,
            exact21Count: 4,
            fiveCardClearCount: 2,
            bustCount: 1,
            completionMs: 95000,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
        });
        break;
      case 'offline':
        useDailyChallengeStore.setState({
          ...base,
          uiStatus: 'offline',
          errorMessage: 'CONNECT ONLINE FOR A RANKED ATTEMPT',
        });
        break;
      case 'error':
        useDailyChallengeStore.setState({
          challenge: null,
          rankedAttempt: null,
          activeSession: null,
          completionSummary: null,
          submissionStatus: 'idle',
          isStarting: false,
          uiStatus: 'error',
          errorMessage: 'Fixture error state',
        });
        break;
      case 'sign_in_required':
        useDailyChallengeStore.setState({
          challenge: config,
          rankedAttempt: null,
          activeSession: null,
          completionSummary: null,
          submissionStatus: 'idle',
          isStarting: false,
          uiStatus: 'sign_in_required',
          errorMessage: 'SIGN IN TO COMPETE',
        });
        break;
      default:
        useDailyChallengeStore.setState({ ...base, uiStatus: fixture });
    }
    Alert.alert('UI fixture applied', fixture);
  };

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

        <Text style={styles.label}>UI state fixtures (dev only)</Text>
        <View style={styles.fixtureRow}>
          {(
            [
              'available',
              'in_progress',
              'completed',
              'practice_available',
              'offline',
              'error',
              'sign_in_required',
            ] as DailyChallengeUiStatus[]
          ).map((fixture) => (
            <BlazeButton
              key={fixture}
              title={fixture.toUpperCase()}
              variant="secondary"
              onPress={() => applyUiFixture(fixture)}
            />
          ))}
        </View>

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
  fixtureRow: {
    gap: spacing.xs,
  },
});
