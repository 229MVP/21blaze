/**
 * Central registry for competitive notification types (Async Duel + Live PvP).
 * Screens must not invent titles, recipients, or deep-link destinations.
 */

export type PlayerNotificationType =
  | 'DUEL_CHALLENGE_RECEIVED'
  | 'DUEL_COMPLETED'
  | 'DUEL_DECLINED'
  | 'DUEL_EXPIRED'
  | 'LIVE_MATCH_INVITE_RECEIVED'
  | 'LIVE_MATCH_RESULT_READY'
  | 'LIVE_MATCH_CANCELLED';

export type NotificationPreferenceCategory =
  | 'duel_challenges'
  | 'duel_results'
  | 'duel_status';

export type NotificationDeepLinkScreen =
  | 'AsyncDuelChallengeDetails'
  | 'AsyncDuelResult'
  | 'AsyncDuelHub'
  | 'LivePvpInviteDetails'
  | 'LivePvpResult'
  | 'LivePvpHub';

export type NotificationDeepLink = {
  screen: NotificationDeepLinkScreen;
  duelId?: string;
  matchId?: string;
};

export type PlayerNotificationBodyData = {
  opponentDisplayName?: string;
  challengerScore?: number;
  outcome?: string;
  duelId?: string;
  matchId?: string;
};

export type PlayerNotification = {
  id: string;
  notificationType: PlayerNotificationType;
  duelId: string | null;
  matchId: string | null;
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
  entity: 'duel' | 'live_match';
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
    entity: 'duel',
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
    entity: 'duel',
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
    entity: 'duel',
  },
  DUEL_EXPIRED: {
    key: 'DUEL_EXPIRED',
    intendedRecipient: 'both_participants',
    inAppTitle: 'CHALLENGE EXPIRED',
    inAppBody: 'A duel invitation expired.',
    pushEligible: false,
    deepLinkScreen: 'AsyncDuelChallengeDetails',
    preferenceCategory: 'duel_status',
    dedupePattern: 'duel_expired:{duelId}:{recipientUserId}',
    entity: 'duel',
  },
  LIVE_MATCH_INVITE_RECEIVED: {
    key: 'LIVE_MATCH_INVITE_RECEIVED',
    intendedRecipient: 'opponent',
    inAppTitle: 'LIVE CHALLENGE',
    inAppBody: '{name} wants to play now.',
    pushEligible: true,
    deepLinkScreen: 'LivePvpInviteDetails',
    preferenceCategory: 'duel_challenges',
    dedupePattern: 'live_match_invite:{matchId}:{recipientUserId}',
    entity: 'live_match',
  },
  LIVE_MATCH_RESULT_READY: {
    key: 'LIVE_MATCH_RESULT_READY',
    intendedRecipient: 'both_participants',
    inAppTitle: 'LIVE RESULT',
    inAppBody: 'Your Live match with {name} is ready.',
    pushEligible: true,
    deepLinkScreen: 'LivePvpResult',
    preferenceCategory: 'duel_results',
    dedupePattern: 'live_match_result:{matchId}:{recipientUserId}',
    entity: 'live_match',
  },
  LIVE_MATCH_CANCELLED: {
    key: 'LIVE_MATCH_CANCELLED',
    intendedRecipient: 'both_participants',
    inAppTitle: 'LIVE CANCELLED',
    inAppBody: 'A Live challenge was cancelled.',
    pushEligible: true,
    deepLinkScreen: 'LivePvpHub',
    preferenceCategory: 'duel_status',
    dedupePattern: 'live_match_cancelled:{matchId}:{recipientUserId}',
    entity: 'live_match',
  },
};

export function formatNotificationTitle(type: PlayerNotificationType): string {
  return DUEL_NOTIFICATION_REGISTRY[type]?.inAppTitle ?? 'UPDATE';
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
  const matchId = record.matchId;

  if (
    (screen === 'AsyncDuelChallengeDetails' ||
      screen === 'AsyncDuelResult' ||
      screen === 'AsyncDuelHub') &&
    typeof duelId === 'string' &&
    duelId.length > 0
  ) {
    return { screen, duelId };
  }

  if (
    (screen === 'LivePvpInviteDetails' ||
      screen === 'LivePvpResult' ||
      screen === 'LivePvpHub') &&
    typeof matchId === 'string' &&
    matchId.length > 0
  ) {
    return { screen, matchId };
  }

  // Hub-only live deep link without match id
  if (screen === 'LivePvpHub') {
    return { screen, matchId: typeof matchId === 'string' ? matchId : undefined };
  }

  return null;
}
