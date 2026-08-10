import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { mapAsyncDuelErrorMessage } from '../asyncDuel/asyncDuelErrorMap';
import {
  asyncDuelPerspectiveForUser,
  asyncDuelPerspectiveTitle,
  mapAsyncDuelFacingStatus,
} from '../asyncDuel/asyncDuelPresentation';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { isAsyncDuelEnabled } from '../config/featureFlags';
import { trackEvent } from '../monetization/analytics';
import type { AsyncDuelHubScreenProps } from '../navigation/navigationTypes';
import { useAsyncDuelStore } from '../store/useAsyncDuelStore';
import { useAuthStore } from '../store/useAuthStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function formatExpires(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) {
    return 'Expired';
  }
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export function AsyncDuelHubScreen({ navigation }: AsyncDuelHubScreenProps) {
  const authStatus = useAuthStore((s) => s.authStatus);
  const userId = useAuthStore((s) => s.user?.id);
  const hubTab = useAsyncDuelStore((s) => s.hubTab);
  const setHubTab = useAsyncDuelStore((s) => s.setHubTab);
  const inbox = useAsyncDuelStore((s) => s.inbox);
  const active = useAsyncDuelStore((s) => s.active);
  const history = useAsyncDuelStore((s) => s.history);
  const isLoadingHub = useAsyncDuelStore((s) => s.isLoadingHub);
  const errorMessage = useAsyncDuelStore((s) => s.errorMessage);
  const refreshHub = useAsyncDuelStore((s) => s.refreshHub);

  const refresh = useCallback(() => {
    void refreshHub();
  }, [refreshHub]);

  useFocusEffect(
    useCallback(() => {
      if (!isAsyncDuelEnabled() || authStatus !== 'online') {
        return;
      }
      refresh();
      trackEvent('duel_hub_viewed');
      trackEvent('duel_inbox_viewed');
    }, [authStatus, refresh]),
  );

  useEffect(() => {
    if (!isAsyncDuelEnabled() || authStatus !== 'online') {
      return;
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => sub.remove();
  }, [authStatus, refresh]);

  if (!isAsyncDuelEnabled()) {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <ScreenHeader title="ASYNC DUEL" />
        <Text style={styles.empty}>Async Duel is not enabled.</Text>
        <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
      </ScreenContainer>
    );
  }

  if (authStatus !== 'online') {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ScreenHeader title="ASYNC DUEL" />
          <Text style={styles.empty}>SIGN IN TO CHALLENGE PLAYERS</Text>
          <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoadingHub} onRefresh={refresh} tintColor={colors.gold} />
        }
      >
        <ScreenHeader title="DUEL HUB" />
        <Text style={styles.subtitle}>Same deck. Same timer. Highest score wins.</Text>

        <BlazeButton
          title="CHALLENGE PLAYER"
          onPress={() => navigation.navigate('AsyncDuelSelectOpponent')}
          fullWidth
        />

        <View style={styles.tabs}>
          {(['incoming', 'active', 'history'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setHubTab(tab)}
              style={[styles.tab, hubTab === tab && styles.tabActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: hubTab === tab }}
            >
              <Text style={[styles.tabText, hubTab === tab && styles.tabTextActive]}>
                {tab.toUpperCase()}
                {tab === 'incoming' && inbox.length > 0 ? ` (${inbox.length})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        {errorMessage ? (
          <Text style={styles.error}>{mapAsyncDuelErrorMessage(errorMessage)}</Text>
        ) : null}

        {isLoadingHub && inbox.length === 0 && active.length === 0 ? (
          <ActivityIndicator color={colors.gold} />
        ) : null}

        {hubTab === 'incoming' ? (
          inbox.length === 0 ? (
            <Text style={styles.empty}>No incoming challenges.</Text>
          ) : (
            inbox.map((item) => (
              <Pressable
                key={item.duelId}
                style={styles.card}
                onPress={() =>
                  navigation.navigate('AsyncDuelChallengeDetails', { duelId: item.duelId })
                }
                accessibilityRole="button"
                accessibilityLabel={`Challenge from ${item.challenger.displayName}`}
              >
                <Text style={styles.cardKicker}>CHALLENGE FROM</Text>
                <Text style={styles.cardTitle}>{item.challenger.displayName}</Text>
                {item.challengerScore != null ? (
                  <Text style={styles.cardMeta}>Score to beat: {item.challengerScore.toLocaleString()}</Text>
                ) : null}
                <Text style={styles.cardMeta}>Expires in {formatExpires(item.expiresAt)}</Text>
                <Text style={styles.link}>VIEW</Text>
              </Pressable>
            ))
          )
        ) : null}

        {hubTab === 'active' ? (
          active.length === 0 ? (
            <Text style={styles.empty}>No active duels.</Text>
          ) : (
            active.map((item) => {
              const facing = mapAsyncDuelFacingStatus({
                status: item.status,
                participantRole: item.participantRole,
              });
              return (
                <Pressable
                  key={item.duelId}
                  style={styles.card}
                  onPress={() => {
                    if (item.status === 'awaiting_opponent' && item.participantRole === 'opponent') {
                      navigation.navigate('AsyncDuelChallengeDetails', { duelId: item.duelId });
                      return;
                    }
                    if (item.status === 'challenger_playing' && item.participantRole === 'challenger') {
                      // Attempt in progress — Phase 1 resume: not auto-resume from hub without start payload
                      navigation.navigate('AsyncDuelChallengeDetails', { duelId: item.duelId });
                      return;
                    }
                    navigation.navigate('AsyncDuelChallengeDetails', { duelId: item.duelId });
                  }}
                >
                  <Text style={styles.cardKicker}>{facing}</Text>
                  <Text style={styles.cardTitle}>{item.opponent.displayName}</Text>
                  {item.challengerScore != null ? (
                    <Text style={styles.cardMeta}>
                      {item.participantRole === 'challenger' ? 'Your' : 'Their'} score:{' '}
                      {item.challengerScore.toLocaleString()}
                    </Text>
                  ) : null}
                  <Text style={styles.cardMeta}>Expires in {formatExpires(item.expiresAt)}</Text>
                </Pressable>
              );
            })
          )
        ) : null}

        {hubTab === 'history' ? (
          history.length === 0 ? (
            <Text style={styles.empty}>No duel history yet.</Text>
          ) : (
            history.map((item) => {
              const perspective =
                item.status === 'completed'
                  ? asyncDuelPerspectiveForUser({
                      outcome: item.outcome,
                      winnerUserId: item.winnerUserId,
                      currentUserId: userId,
                    })
                  : null;
              const statusLabel =
                item.status === 'completed' && perspective
                  ? asyncDuelPerspectiveTitle(perspective)
                  : mapAsyncDuelFacingStatus({
                      status: item.status,
                      participantRole: 'challenger',
                    });
              const yourScore =
                item.challengerScore != null || item.opponentScore != null
                  ? `${item.challengerScore ?? '—'} vs ${item.opponentScore ?? '—'}`
                  : null;
              return (
                <Pressable
                  key={item.duelId}
                  style={styles.card}
                  onPress={() => {
                    if (item.status === 'completed') {
                      navigation.navigate('AsyncDuelResult', { duelId: item.duelId });
                    } else {
                      navigation.navigate('AsyncDuelChallengeDetails', {
                        duelId: item.duelId,
                      });
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Duel with ${item.opponent.displayName}, ${statusLabel}`}
                >
                  <Text style={styles.cardKicker}>{statusLabel}</Text>
                  <Text style={styles.cardTitle}>{item.opponent.displayName}</Text>
                  {yourScore ? (
                    <Text style={styles.cardMeta}>Scores: {yourScore}</Text>
                  ) : null}
                  {item.settledAt || item.updatedAt ? (
                    <Text style={styles.cardMeta}>
                      {new Date(item.settledAt ?? item.updatedAt).toLocaleDateString()}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )
        ) : null}

        <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  subtitle: { ...typography.body, color: colors.textSecondary },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    alignItems: 'center',
  },
  tabActive: { borderColor: colors.gold, backgroundColor: 'rgba(0,0,0,0.25)' },
  tabText: { fontFamily: fontFamilies.bodyBold, fontSize: 11, color: colors.textSecondary },
  tabTextActive: { color: colors.gold },
  card: {
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  cardKicker: { fontFamily: fontFamilies.bodyBold, fontSize: 11, color: colors.gold, letterSpacing: 1 },
  cardTitle: { fontFamily: fontFamilies.display, fontSize: 22, color: colors.textPrimary },
  cardMeta: { ...typography.body, color: colors.textSecondary, fontSize: 13 },
  link: { fontFamily: fontFamilies.bodyBold, color: colors.primary, marginTop: 4 },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  error: { ...typography.body, color: colors.danger ?? '#FF6B6B', textAlign: 'center' },
});
