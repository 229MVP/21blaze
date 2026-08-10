import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BlazeButton } from '../../components/buttons/BlazeButton';
import { ScreenHeader } from '../../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../../components/ScreenContainer';
import { livePvpChannelSession } from '../../livePvp/livePvpChannel';
import {
  estimateServerClockOffset,
  type ClockSample,
} from '../../livePvp/livePvpClock';
import { livePvpDeckFingerprint } from '../../livePvp/createLivePvpDeck';
import type { LiveMatchRealtimeEvent, LiveMatchSnapshot } from '../../livePvp/livePvpTypes';
import type { LivePvpHarnessScreenProps } from '../../navigation/navigationTypes';
import {
  acceptLiveMatch,
  cancelLiveMatch,
  completeLiveMatchAttempt,
  createLiveMatchInvite,
  declineLiveMatch,
  forfeitLiveMatch,
  getLiveMatchSnapshot,
  getLivePvpServerTime,
  setLiveMatchReady,
  submitLiveMatchProgress,
  LivePvpServiceError,
} from '../../services/livePvpService';
import { useAuthStore } from '../../store/useAuthStore';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

/**
 * DEV-ONLY two-client simulation harness for Live PvP Phase 1.
 * Not a player-facing UI. Disabled outside __DEV__.
 */
export function LivePvpHarnessScreen({ navigation }: LivePvpHarnessScreenProps) {
  const userId = useAuthStore((s) => s.user?.id);
  const [opponentId, setOpponentId] = useState('');
  const [matchId, setMatchId] = useState('');
  const [snapshot, setSnapshot] = useState<LiveMatchSnapshot | null>(null);
  const [channelStatus, setChannelStatus] = useState('idle');
  const [events, setEvents] = useState<string[]>([]);
  const [presence, setPresence] = useState<string>('—');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clockSamples, setClockSamples] = useState<ClockSample[]>([]);
  const [progressSeq, setProgressSeq] = useState(1);

  const clock = useMemo(() => estimateServerClockOffset(clockSamples), [clockSamples]);

  const pushEvent = useCallback((line: string) => {
    setEvents((prev) => [`${new Date().toISOString().slice(11, 19)} ${line}`, ...prev].slice(0, 40));
  }, []);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        pushEvent(`ok:${label}`);
      } catch (err) {
        const message =
          err instanceof LivePvpServiceError
            ? `${err.code}: ${err.message}`
            : err instanceof Error
              ? err.message
              : 'unknown';
        setError(message);
        pushEvent(`err:${label}:${message}`);
      } finally {
        setBusy(false);
      }
    },
    [pushEvent],
  );

  const applySnapshot = useCallback((next: LiveMatchSnapshot) => {
    setSnapshot(next);
    setMatchId(next.matchId);
  }, []);

  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <ScreenHeader title="LIVE PVP HARNESS" />
        <Text style={styles.body}>Development harness is unavailable.</Text>
        <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="LIVE PVP HARNESS (DEV)" />
        <Text style={styles.body}>You: {userId ?? 'signed out'}</Text>
        <TextInput
          style={styles.input}
          placeholder="Opponent user UUID"
          placeholderTextColor={colors.textSecondary}
          value={opponentId}
          onChangeText={setOpponentId}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Match UUID"
          placeholderTextColor={colors.textSecondary}
          value={matchId}
          onChangeText={setMatchId}
          autoCapitalize="none"
        />

        {busy ? <ActivityIndicator color={colors.gold} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <BlazeButton
          title="CREATE INVITE"
          disabled={busy || !opponentId}
          onPress={() =>
            void run('create', async () => {
              const created = await createLiveMatchInvite(opponentId.trim());
              setMatchId(created.matchId);
              const snap = await getLiveMatchSnapshot(created.matchId);
              applySnapshot(snap);
            })
          }
          fullWidth
        />
        <BlazeButton
          title="ACCEPT"
          disabled={busy || !matchId}
          onPress={() =>
            void run('accept', async () => {
              applySnapshot(await acceptLiveMatch(matchId.trim()));
            })
          }
          fullWidth
        />
        <BlazeButton
          title="DECLINE"
          disabled={busy || !matchId}
          onPress={() =>
            void run('decline', async () => {
              await declineLiveMatch(matchId.trim());
              applySnapshot(await getLiveMatchSnapshot(matchId.trim()));
            })
          }
          fullWidth
        />
        <BlazeButton
          title="CANCEL"
          disabled={busy || !matchId}
          onPress={() =>
            void run('cancel', async () => {
              await cancelLiveMatch(matchId.trim());
              applySnapshot(await getLiveMatchSnapshot(matchId.trim()));
            })
          }
          fullWidth
        />
        <BlazeButton
          title="JOIN PRIVATE CHANNEL"
          disabled={busy || !matchId}
          onPress={() =>
            void run('join', async () => {
              await livePvpChannelSession.join({
                matchId: matchId.trim(),
                getStateVersion: () => snapshot?.stateVersion ?? 0,
                presencePayload: { userId: userId ?? 'unknown' },
                onStatus: (status, detail) => {
                  setChannelStatus(detail ? `${status}:${detail}` : status);
                },
                onPresence: (rows) => {
                  setPresence(rows.map((r) => r.userId ?? r.key).join(', ') || 'none');
                },
                onEvent: (event: LiveMatchRealtimeEvent, action) => {
                  pushEvent(`${action} ${event.eventType} v${event.stateVersion}`);
                  if (action === 'refetch' || action === 'apply') {
                    void getLiveMatchSnapshot(matchId.trim()).then(applySnapshot);
                  }
                },
              });
              applySnapshot(await getLiveMatchSnapshot(matchId.trim()));
            })
          }
          fullWidth
        />
        <BlazeButton
          title="LEAVE CHANNEL"
          disabled={busy}
          onPress={() =>
            void run('leave', async () => {
              await livePvpChannelSession.leave();
              setChannelStatus('closed');
              setPresence('—');
            })
          }
          fullWidth
        />
        <BlazeButton
          title="READY"
          disabled={busy || !matchId}
          onPress={() =>
            void run('ready', async () => {
              applySnapshot(await setLiveMatchReady(matchId.trim()));
            })
          }
          fullWidth
        />
        <BlazeButton
          title="SAMPLE SERVER CLOCK"
          disabled={busy}
          onPress={() =>
            void run('clock', async () => {
              const started = Date.now();
              const { serverNow } = await getLivePvpServerTime();
              const received = Date.now();
              setClockSamples((prev) => [
                ...prev,
                {
                  localRequestStartedAt: started,
                  localResponseReceivedAt: received,
                  serverNowMs: Date.parse(serverNow),
                },
              ].slice(-5));
            })
          }
          fullWidth
        />
        <BlazeButton
          title="SUBMIT PROGRESS"
          disabled={busy || !matchId}
          onPress={() =>
            void run('progress', async () => {
              await submitLiveMatchProgress(matchId.trim(), {
                sequence: progressSeq,
                score: progressSeq * 100,
                exact21Count: 0,
                fiveCardClearCount: 0,
                bustCount: 0,
                cardsPlayed: Math.min(progressSeq, 52),
                lanesCleared: 0,
                clientElapsedMs: progressSeq * 1000,
              });
              setProgressSeq((n) => n + 1);
              applySnapshot(await getLiveMatchSnapshot(matchId.trim()));
            })
          }
          fullWidth
        />
        <BlazeButton
          title="COMPLETE ATTEMPT"
          disabled={busy || !matchId || !snapshot?.seed}
          onPress={() =>
            void run('complete', async () => {
              applySnapshot(
                await completeLiveMatchAttempt(matchId.trim(), {
                  score: 12000,
                  exact21Count: 1,
                  fiveCardClearCount: 0,
                  bustCount: 0,
                  cardsPlayed: 20,
                  lanesCleared: 2,
                  completionMs: 90000,
                  rulesVersion: snapshot?.rulesVersion ?? '1',
                  deckVersion: snapshot?.deckVersion ?? '1',
                  submissionVersion: 'live-pvp-phase1',
                }),
              );
            })
          }
          fullWidth
        />
        <BlazeButton
          title="FORFEIT"
          disabled={busy || !matchId}
          onPress={() =>
            void run('forfeit', async () => {
              applySnapshot(await forfeitLiveMatch(matchId.trim()));
            })
          }
          fullWidth
        />
        <BlazeButton
          title="REFRESH SNAPSHOT"
          disabled={busy || !matchId}
          onPress={() =>
            void run('snapshot', async () => {
              applySnapshot(await getLiveMatchSnapshot(matchId.trim()));
            })
          }
          fullWidth
        />

        <Text style={styles.kicker}>DIAGNOSTICS</Text>
        <Text style={styles.mono}>channel: {channelStatus}</Text>
        <Text style={styles.mono}>presence: {presence}</Text>
        <Text style={styles.mono}>
          clockOffsetMs: {clock ? Math.round(clock.offsetMs) : 'n/a'} rtt:{' '}
          {clock ? Math.round(clock.rttMs) : 'n/a'}
        </Text>
        {snapshot ? (
          <>
            <Text style={styles.mono}>match: {snapshot.matchId}</Text>
            <Text style={styles.mono}>
              role: {snapshot.participantRole} status: {snapshot.status} v
              {snapshot.stateVersion}
            </Text>
            <Text style={styles.mono}>protocol: {snapshot.protocolVersion}</Text>
            <Text style={styles.mono}>
              seedAvailable: {String(snapshot.seedAvailable)} deckHash:{' '}
              {snapshot.seed ? livePvpDeckFingerprint(snapshot.seed) : '—'}
            </Text>
            <Text style={styles.mono}>
              start: {snapshot.scheduledStartAt ?? '—'}
            </Text>
            <Text style={styles.mono}>
              outcome: {snapshot.outcome ?? '—'} reason:{' '}
              {snapshot.completionReason ?? '—'}
            </Text>
          </>
        ) : null}

        <Text style={styles.kicker}>EVENTS</Text>
        {events.map((line) => (
          <Text key={line} style={styles.mono}>
            {line}
          </Text>
        ))}

        <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: spacing.md,
    gap: spacing.sm,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  body: { ...typography.body, color: colors.textSecondary },
  kicker: {
    ...typography.body,
    color: colors.gold,
    marginTop: spacing.md,
    fontWeight: '700',
  },
  mono: { ...typography.body, color: colors.textPrimary, fontSize: 12 },
  error: { ...typography.body, color: '#FF8A80' },
  input: {
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    borderRadius: 8,
    padding: spacing.sm,
    color: colors.textPrimary,
  },
});
