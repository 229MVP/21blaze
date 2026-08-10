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

import { mapAsyncDuelErrorMessage } from '../asyncDuel/asyncDuelErrorMap';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { isAsyncDuelEnabled, isLivePvpEnabled } from '../config/featureFlags';
import type { NotificationsScreenProps } from '../navigation/navigationTypes';
import {
  formatNotificationBody,
  formatNotificationTitle,
} from '../notifications/duelNotificationRegistry';
import { useAuthStore } from '../store/useAuthStore';
import { useDuelNotificationStore } from '../store/useDuelNotificationStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

function friendlyAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) {
    return '';
  }
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const authStatus = useAuthStore((s) => s.authStatus);
  const items = useDuelNotificationStore((s) => s.items);
  const unreadCount = useDuelNotificationStore((s) => s.unreadCount);
  const isLoading = useDuelNotificationStore((s) => s.isLoading);
  const errorMessage = useDuelNotificationStore((s) => s.errorMessage);
  const refreshNotifications = useDuelNotificationStore((s) => s.refreshNotifications);
  const openNotification = useDuelNotificationStore((s) => s.openNotification);
  const markAllRead = useDuelNotificationStore((s) => s.markAllRead);
  const [promptVisible, setPromptVisible] = useState(false);

  const refresh = useCallback(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  const notificationsEnabled = isAsyncDuelEnabled() || isLivePvpEnabled();

  useFocusEffect(
    useCallback(() => {
      if (authStatus === 'online' && notificationsEnabled) {
        refresh();
      }
    }, [authStatus, notificationsEnabled, refresh]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && authStatus === 'online' && notificationsEnabled) {
        refresh();
      }
    });
    return () => sub.remove();
  }, [authStatus, notificationsEnabled, refresh]);

  if (!notificationsEnabled) {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <ScreenHeader title="NOTIFICATIONS" />
        <Text style={styles.empty}>Competitive notifications are not enabled.</Text>
      </ScreenContainer>
    );
  }

  if (authStatus !== 'online') {
    return (
      <ScreenContainer style={styles.container} intensity="normal" padded={false}>
        <ScreenHeader title="NOTIFICATIONS" />
        <Text style={styles.empty}>SIGN IN TO VIEW DUEL NOTIFICATIONS</Text>
        <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.gold} />
        }
      >
        <ScreenHeader title="NOTIFICATIONS" />
        <Text
          style={styles.meta}
          accessibilityLabel={`${unreadCount} unread notifications`}
        >
          {unreadCount} unread
        </Text>

        {errorMessage ? (
          <Text style={styles.error}>{mapAsyncDuelErrorMessage(errorMessage)}</Text>
        ) : null}

        {unreadCount > 0 ? (
          <BlazeButton
            title="MARK ALL READ"
            variant="secondary"
            onPress={() => void markAllRead()}
            fullWidth
          />
        ) : null}

        <BlazeButton
          title="NOTIFICATION SETTINGS"
          variant="secondary"
          onPress={() => setPromptVisible(true)}
          fullWidth
        />

        {promptVisible ? (
          <View style={styles.prompt}>
            <Text style={styles.promptTitle}>STAY IN THE DUEL</Text>
            <Text style={styles.body}>
              Get notified when someone challenges you, your opponent finishes, or a
              challenge needs attention.
            </Text>
            <BlazeButton
              title="OPEN SETTINGS"
              onPress={() => {
                setPromptVisible(false);
                navigation.navigate('Settings');
              }}
              fullWidth
            />
            <BlazeButton
              title="NOT NOW"
              variant="secondary"
              onPress={() => setPromptVisible(false)}
              fullWidth
            />
          </View>
        ) : null}

        {isLoading && items.length === 0 ? <ActivityIndicator color={colors.gold} /> : null}

        {!isLoading && items.length === 0 ? (
          <Text style={styles.empty}>No duel notifications yet.</Text>
        ) : null}

        {items.map((item) => {
          const unread = item.readAt == null;
          return (
            <Pressable
              key={item.id}
              style={[styles.card, unread && styles.cardUnread]}
              accessibilityRole="button"
              accessibilityState={{ selected: unread }}
              accessibilityLabel={`${formatNotificationTitle(item.notificationType)}. ${formatNotificationBody(item.notificationType, item.bodyData)}. ${unread ? 'Unread' : 'Read'}. ${friendlyAgo(item.createdAt)}`}
              onPress={() => {
                void (async () => {
                  await openNotification(item.id);
                  const link = item.deepLinkData;
                  if (!link) {
                    return;
                  }
                  if (link.screen === 'AsyncDuelResult') {
                    navigation.navigate('AsyncDuelResult', { duelId: link.duelId! });
                    return;
                  }
                  if (link.screen === 'AsyncDuelChallengeDetails') {
                    navigation.navigate('AsyncDuelChallengeDetails', {
                      duelId: link.duelId!,
                    });
                    return;
                  }
                  if (link.screen === 'LivePvpInviteDetails' && link.matchId) {
                    navigation.navigate('LivePvpInviteDetails', {
                      matchId: link.matchId,
                    });
                    return;
                  }
                  if (link.screen === 'LivePvpResult' && link.matchId) {
                    navigation.navigate('LivePvpResult', { matchId: link.matchId });
                    return;
                  }
                  if (link.screen === 'LivePvpHub') {
                    navigation.navigate('LivePvpHub');
                    return;
                  }
                  navigation.navigate('AsyncDuelHub');
                })();
              }}
            >
              <Text style={styles.cardKicker}>
                {formatNotificationTitle(item.notificationType)}
                {unread ? ' · UNREAD' : ''}
              </Text>
              <Text style={styles.cardBody}>
                {formatNotificationBody(item.notificationType, item.bodyData)}
              </Text>
              <Text style={styles.cardMeta}>{friendlyAgo(item.createdAt)}</Text>
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
  meta: { ...typography.body, color: colors.textSecondary },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  error: { ...typography.body, color: colors.danger, textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  cardUnread: { borderColor: colors.gold },
  cardKicker: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 1,
  },
  cardBody: { ...typography.body, color: colors.textPrimary },
  cardMeta: { ...typography.body, color: colors.textSecondary, fontSize: 12 },
  prompt: {
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  promptTitle: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    color: colors.gold,
    textAlign: 'center',
  },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
