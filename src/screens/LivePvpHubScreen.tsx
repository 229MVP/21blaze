import { useCallback, useEffect, useState } from 'react';
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

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { isLivePvpEnabled } from '../config/featureFlags';
import { mapLivePvpErrorMessage } from '../livePvp/livePvpErrorMap';
import {
  acknowledgeLivePvpIntro,
  hasAcknowledgedLivePvpIntro,
} from '../livePvp/livePvpIntro';
import {
  livePvpPerspective,
  livePvpPerspectiveTitle,
  mapLivePvpFacingStatus,
} from '../livePvp/livePvpPresentation';
import type { LiveMatchStatus } from '../livePvp/livePvpTypes';
import { trackEvent } from '../monetization/analytics';
import type { LivePvpHubScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { useLivePvpStore } from '../store/useLivePvpStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function formatExpires(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) {
    return 'Expired';
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function LivePvpHubScreen({ navigation }: LivePvpHubScreenProps) {
  const authStatus = useAuthStore((s) => s.authStatus);
  const userId = useAuthStore((s) => s.user?.id);
  const hubTab = useLivePvpStore((s) => s.hubTab);
  const setHubTab = useLivePvpStore((s) => s.setHubTab);
  const incoming = useLivePvpStore((s) => s.incoming);
  const active = useLivePvpStore((s) => s.active);
  const recent = useLivePvpStore((s) => s.recent);
  const isLoadingHub = useLivePvpStore((s) => s.isLoadingHub);
  const errorMessage = useLivePvpStore((s) => s.errorMessage);
  const creationEnabled = useLivePvpStore((s) => s.creationEnabled);
  const refreshHub = useLivePvpStore((s) => s.refreshHub);
  const refreshOps = useLivePvpStore((s) => s.refreshOps);
  const resumeMatchId = useLivePvpStore((s) => s.resumeMatchId);
  const evaluateResumeOffer = useLivePvpStore((s) => s.evaluateResumeOffer);
  const loadPlayerRecord = useLivePvpStore((s) => s.loadPlayerRecord);
  const playerRecord = useLivePvpStore((s) => s.playerRecord);
  const [showIntro, setShowIntro] = useState(false);

  const refresh = useCallback(() => {
    void refreshHub();
    void refreshOps();
  }, [refreshHub, refreshOps]);

  useFocusEffect(
    useCallback(() => {
      if (!isLivePvpEnabled() || authStatus !== 'online') {
        return;
      }
      refresh();
      void evaluateResumeOffer();
      void loadPlayerRecord();
      trackEvent('live_pvp_hub_viewed');
      void hasAcknowledgedLivePvpIntro().then((ack) => {
        if (!ack) {
          setShowIntro(true);
        }
      });
    }, [authStatus, refresh]),
  );

  useEffect(() => {
    if (!isLivePvpEnabled() || authStatus !== 'online') {
      return;
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
        useLivePvpStore.getState().notifyMatchForeground();
      }
    });
    return () => sub.remove();
  }, [authStatus, refresh]);

  if (!isLivePvpEnabled()) {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <ScreenHeader title="LIVE PVP" />
        <Text style={styles.empty}>Live PvP is not enabled.</Text>
        <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
      </ScreenContainer>
    );
  }

  if (authStatus !== 'online') {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <ScreenHeader title="LIVE PVP" />
        <Text style={styles.empty}>SIGN IN TO PLAY LIVE</Text>
        <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
      </ScreenContainer>
    );
  }

  if (showIntro) {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ScreenHeader title="LIVE PVP" />
          <Text style={styles.title}>LIVE PVP</Text>
          <Text style={styles.body}>You and your opponent play at the same time.</Text>
          <Text style={styles.body}>• Same deck</Text>
          <Text style={styles.body}>• Same timer</Text>
          <Text style={styles.body}>• Live score updates</Text>
          <Text style={styles.body}>• Leaving after the countdown may forfeit the match</Text>
          <Text style={styles.body}>• The official timer continues during connection loss</Text>
          <BlazeButton
            title="CONTINUE"
            onPress={() => {
              void acknowledgeLivePvpIntro();
              setShowIntro(false);
            }}
            fullWidth
          />
        </ScrollView>
      </ScreenContainer>
    );
  }

  const items =
    hubTab === 'incoming' ? incoming : hubTab === 'active' ? active : recent;

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoadingHub} onRefresh={refresh} tintColor={colors.gold} />
        }
      >
        <ScreenHeader title="LIVE PVP" />
        <Text style={styles.subtitle}>Same deck. Same timer. One winner.</Text>

        {playerRecord ? (
          <Text style={styles.recordMeta}>
            Record {playerRecord.wins}-{playerRecord.losses}
            {playerRecord.ties > 0 ? `-${playerRecord.ties}` : ''}
            {' · '}
            {playerRecord.completedMatches === 0
              ? 'No matches yet'
              : `${Math.round(playerRecord.winRate * 100)}% win rate`}
          </Text>
        ) : null}

        {resumeMatchId ? (
          <BlazeButton
            title="RESUME LIVE MATCH"
            onPress={() =>
              navigation.navigate('LivePvpLobby', { matchId: resumeMatchId })
            }
            fullWidth
          />
        ) : null}

        {!creationEnabled ? (
          <Text style={styles.unavailable}>
            Live PvP is temporarily unavailable. Existing matches remain available.
          </Text>
        ) : (
          <BlazeButton
            title="CHALLENGE PLAYER"
            onPress={() => navigation.navigate('LivePvpSelectOpponent')}
            fullWidth
            accessibilityLabel="Challenge player"
          />
        )}

        <View style={styles.tabs}>
          {(['incoming', 'active', 'recent'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setHubTab(tab)}
              style={[styles.tab, hubTab === tab && styles.tabActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: hubTab === tab }}
            >
              <Text style={[styles.tabText, hubTab === tab && styles.tabTextActive]}>
                {tab.toUpperCase()}
                {tab === 'incoming' && incoming.length > 0 ? ` (${incoming.length})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        {errorMessage ? (
          <Text style={styles.error}>{mapLivePvpErrorMessage(errorMessage)}</Text>
        ) : null}

        {isLoadingHub && items.length === 0 ? <ActivityIndicator color={colors.gold} /> : null}

        {items.length === 0 && !isLoadingHub ? (
          <Text style={styles.empty}>
            {hubTab === 'incoming'
              ? 'No incoming Live invitations.'
              : hubTab === 'active'
                ? 'No active Live matches.'
                : 'No recent Live matches.'}
          </Text>
        ) : null}

        {items.map((item) => {
          const facing = mapLivePvpFacingStatus({
            status: item.status as LiveMatchStatus,
            participantRole: item.participantRole,
            youReady: item.youReady,
            opponentReady: item.opponentReady,
          });
          const settledFacing =
            item.status === 'completed'
              ? livePvpPerspectiveTitle(
                  livePvpPerspective(
                    item.outcome as 'challenger_win' | 'opponent_win' | 'tie' | 'no_contest' | null,
                    item.participantRole,
                  ),
                )
              : facing;
          return (
            <Pressable
              key={item.matchId}
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`Live match with ${item.opponent.displayName}, ${settledFacing}`}
              onPress={() => {
                if (item.status === 'invited' && item.participantRole === 'opponent') {
                  navigation.navigate('LivePvpInviteDetails', { matchId: item.matchId });
                  return;
                }
                if (item.status === 'invited' && item.participantRole === 'challenger') {
                  navigation.navigate('LivePvpWaitingRoom', { matchId: item.matchId });
                  return;
                }
                if (
                  item.status === 'lobby' ||
                  item.status === 'countdown' ||
                  item.status === 'active' ||
                  item.status === 'settling'
                ) {
                  navigation.navigate('LivePvpLobby', { matchId: item.matchId });
                  return;
                }
                if (item.status === 'completed') {
                  navigation.navigate('LivePvpResult', { matchId: item.matchId });
                  return;
                }
                navigation.navigate('LivePvpInviteDetails', { matchId: item.matchId });
              }}
            >
              <Text style={styles.cardKicker}>{settledFacing}</Text>
              <Text style={styles.cardTitle}>{item.opponent.displayName}</Text>
              {item.status === 'invited' ? (
                <Text style={styles.cardMeta}>Expires in {formatExpires(item.expiresAt)}</Text>
              ) : null}
            </Pressable>
          );
        })}

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
  title: { fontFamily: fontFamilies.display, fontSize: 36, color: colors.gold, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary },
  recordMeta: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 13,
  },
  body: { ...typography.body, color: colors.textSecondary },
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
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  unavailable: { ...typography.body, color: colors.gold, textAlign: 'center' },
  error: { ...typography.body, color: '#FF8A80', textAlign: 'center' },
});
