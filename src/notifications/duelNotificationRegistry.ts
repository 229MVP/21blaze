/**
 * Central registry for Async Duel notification types.
 * Screens must not invent titles, recipients, or deep-link destinations.
 */

export type PlayerNotificationType =
  | 'DUEL_CHALLENGE_RECEIVED'
  | 'DUEL_COMPLETED'
  | 'DUEL_DECLINED'
  | 'DUEL_EXPIRED';

export type NotificationPreferenceCategory =
  | 'duel_challenges'
  | 'duel_results'
  | 'duel_status';

export type NotificationDeepLinkScreen =
  | 'AsyncDuelChallengeDetails'
  | 'AsyncDuelResult'
  | 'AsyncDuelHub';

export type NotificationDeepLink = {
  screen: NotificationDeepLinkScreen;
  duelId: string;
};

export type PlayerNotificationBodyData = {
  opponentDisplayName?: string;
  challengerScore?: number;
  outcome?: string;
  duelId?: string;
};

export type PlayerNotification = {
  id: string;
  notificationType: PlayerNotificationType;
  duelId: string | null;
  titleKey: string;
  bodyData: PlayerNotificationBodyData;
  deepLinkData: NotificationDeepLink | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPreferences = {
  duelChallengesInApp: boolean;
  duelChallengesPush: boolean;
  duelResultsInApp: boolean;
  duelResultsPush: boolean;
  duelStatusInApp: boolean;
  duelStatusPush: boolean;
};

export type PushPermissionState =
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'provisional'
  | 'unavailable';

export type PushRegistrationState =
  | 'idle'
  | 'registering'
  | 'registered'
  | 'revoked'
  | 'error';

export type PushDeliveryStatus =
  | 'pending'
  | 'processing'
  | 'submitted'
  | 'delivered'
  | 'failed'
  | 'suppressed';

type RegistryEntry = {
  key: PlayerNotificationType;
  intendedRecipient: 'opponent' | 'challenger' | 'both_participants';
  inAppTitle: string;
  /** Template uses {name} for opponent display name (rendered as plain text). */
  inAppBody: string;
  pushEligible: boolean;
  deepLinkScreen: NotificationDeepLinkScreen;
  preferenceCategory: NotificationPreferenceCategory;
  dedupePattern: string;
};

export const DUEL_NOTIFICATION_REGISTRY: Record<PlayerNotificationType, RegistryEntry> = {
  DUEL_CHALLENGE_RECEIVED: {
    key: 'DUEL_CHALLENGE_RECEIVED',
    intendedRecipient: 'opponent',
    inAppTitle: 'NEW DUEL',
    inAppBody: '{name} challenged you.',
    pushEligible: true,
    deepLinkScreen: 'AsyncDuelChallengeDetails',
    preferenceCategory: 'duel_challenges',
    dedupePattern: 'duel_challenge_received:{duelId}:{recipientUserId}',
  },
  DUEL_COMPLETED: {
    key: 'DUEL_COMPLETED',
    intendedRecipient: 'challenger',
    inAppTitle: 'DUEL COMPLETE',
    inAppBody: 'Your duel with {name} is ready.',
    pushEligible: true,
    deepLinkScreen: 'AsyncDuelResult',
    preferenceCategory: 'duel_results',
    dedupePattern: 'duel_completed:{duelId}:{recipientUserId}',
  },
  DUEL_DECLINED: {
    key: 'DUEL_DECLINED',
    intendedRecipient: 'challenger',
    inAppTitle: 'CHALLENGE DECLINED',
    inAppBody: '{name} declined your challenge.',
    pushEligible: true,
    deepLinkScreen: 'AsyncDuelChallengeDetails',
    preferenceCategory: 'duel_status',
    dedupePattern: 'duel_declined:{duelId}:{recipientUserId}',
  },
  DUEL_EXPIRED: {
    key: 'DUEL_EXPIRED',
    intendedRecipient: 'both_participants',
    inAppTitle: 'CHALLENGE EXPIRED',
    inAppBody: 'A duel challenge has expired.',
    pushEligible: false,
    deepLinkScreen: 'AsyncDuelChallengeDetails',
    preferenceCategory: 'duel_status',
    dedupePattern: 'duel_expired:{duelId}:{recipientUserId}',
  },
};

export function formatNotificationTitle(type: PlayerNotificationType): string {
  return DUEL_NOTIFICATION_REGISTRY[type]?.inAppTitle ?? 'DUEL UPDATE';
}

export function formatNotificationBody(
  type: PlayerNotificationType,
  bodyData: PlayerNotificationBodyData,
): string {
  const entry = DUEL_NOTIFICATION_REGISTRY[type];
  const name =
    typeof bodyData.opponentDisplayName === 'string' && bodyData.opponentDisplayName.trim()
      ? bodyData.opponentDisplayName.trim()
      : 'A player';
  return (entry?.inAppBody ?? 'You have a duel update.').replace('{name}', name);
}

export function parseNotificationDeepLink(
  value: unknown,
): NotificationDeepLink | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const screen = record.screen;
  const duelId = record.duelId;
  if (
    (screen === 'AsyncDuelChallengeDetails' ||
      screen === 'AsyncDuelResult' ||
      screen === 'AsyncDuelHub') &&
    typeof duelId === 'string' &&
    duelId.length > 0
  ) {
    return { screen, duelId };
  }
  return null;
}
