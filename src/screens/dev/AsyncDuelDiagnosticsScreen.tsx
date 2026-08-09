import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  asyncDuelDeckFingerprint,
  createAsyncDuelDeck,
} from '../../asyncDuel/createAsyncDuelDeck';
import { ASYNC_DUEL_CONFIG } from '../../asyncDuel/asyncDuelConfig';
import { BlazeButton } from '../../components/buttons/BlazeButton';
import { ScreenHeader } from '../../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../../components/ScreenContainer';
import type { RootStackParamList } from '../../navigation/navigationTypes';
import {
  AsyncDuelServiceError,
  createAsyncDuel,
  getAsyncDuelDetails,
  getAsyncDuelInbox,
} from '../../services/asyncDuelService';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'AsyncDuelDiagnostics'>;

/**
 * Development-only Async Duel harness.
 * Must never be reachable in production navigation (__DEV__ gate).
 * Does not log tokens or service-role credentials.
 */
export function AsyncDuelDiagnosticsScreen({ navigation }: Props) {
  const [opponentId, setOpponentId] = useState('');
  const [duelId, setDuelId] = useState('');
  const [seed, setSeed] = useState('');
  const [log, setLog] = useState<string>('Ready.');

  const append = (line: string) => {
    setLog((prev) => `${line}\n${prev}`.slice(0, 4000));
  };

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="ASYNC DUEL DIAG (DEV)" />
        <Text style={styles.warn}>Development only. Not a production UI.</Text>
        <Text style={styles.meta}>
          rules={ASYNC_DUEL_CONFIG.rulesVersion} deck={ASYNC_DUEL_CONFIG.deckVersion}{' '}
          duration={ASYNC_DUEL_CONFIG.durationSeconds}s bust={ASYNC_DUEL_CONFIG.bustLimit}
        </Text>

        <Text style={styles.label}>Opponent user id</Text>
        <TextInput
          style={styles.input}
          value={opponentId}
          onChangeText={setOpponentId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="uuid"
          placeholderTextColor={colors.textSecondary}
        />
        <BlazeButton
          title="CREATE DUEL"
          onPress={() => {
            void (async () => {
              try {
                const result = await createAsyncDuel(opponentId.trim());
                setDuelId(result.duelId);
                setSeed(result.seed);
                append(
                  `CREATED duel=${result.duelId} attempt=${result.attemptId} status=${result.status} fingerprint=${asyncDuelDeckFingerprint(result.seed)} cards=${createAsyncDuelDeck(result.seed).length}`,
                );
              } catch (error) {
                append(
                  `CREATE FAIL ${error instanceof AsyncDuelServiceError ? error.code : 'UNKNOWN'}`,
                );
              }
            })();
          }}
          fullWidth
        />

        <Text style={styles.label}>Duel id</Text>
        <TextInput
          style={styles.input}
          value={duelId}
          onChangeText={setDuelId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="duel uuid"
          placeholderTextColor={colors.textSecondary}
        />
        <BlazeButton
          title="LOAD DETAILS (NO SEED)"
          variant="secondary"
          onPress={() => {
            void (async () => {
              try {
                const details = await getAsyncDuelDetails(duelId.trim());
                const hasSeed = 'seed' in details && details.seed != null;
                append(
                  `DETAILS status=${String(details.status)} seedExposed=${hasSeed ? 'YES' : 'no'}`,
                );
              } catch (error) {
                append(
                  `DETAILS FAIL ${error instanceof AsyncDuelServiceError ? error.code : 'UNKNOWN'}`,
                );
              }
            })();
          }}
          fullWidth
        />
        <BlazeButton
          title="LOAD INBOX"
          variant="secondary"
          onPress={() => {
            void (async () => {
              try {
                const inbox = await getAsyncDuelInbox({ limit: 10 });
                append(`INBOX count=${inbox.items.length}`);
              } catch (error) {
                append(
                  `INBOX FAIL ${error instanceof AsyncDuelServiceError ? error.code : 'UNKNOWN'}`,
                );
              }
            })();
          }}
          fullWidth
        />

        {seed ? (
          <Text style={styles.seedNote}>
            Local seed fingerprint (challenger start only):{' '}
            {asyncDuelDeckFingerprint(seed)}
          </Text>
        ) : null}

        <Text style={styles.log}>{log}</Text>
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
    padding: spacing.md,
    gap: spacing.sm,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  warn: { ...typography.body, color: colors.gold },
  meta: { ...typography.label, color: colors.textSecondary, textTransform: 'none' },
  label: { ...typography.label, color: colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    borderRadius: 8,
    padding: spacing.sm,
    color: colors.textPrimary,
  },
  seedNote: { ...typography.body, color: colors.textSecondary, fontSize: 12 },
  log: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
