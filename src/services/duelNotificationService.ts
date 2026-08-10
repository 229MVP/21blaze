import { supabase } from '../lib/supabase';
import type {
  NotificationDeepLink,
  NotificationPreferences,
  PlayerNotification,
  PlayerNotificationBodyData,
  PlayerNotificationType,
} from '../notifications/duelNotificationRegistry';
import { parseNotificationDeepLink } from '../notifications/duelNotificationRegistry';
import type {
  AsyncDuelRematchResult,
  AsyncDuelSeriesSummary,
  HeadToHeadRecord,
  PlayerDuelRecord,
} from '../asyncDuel/asyncDuelRecords';
import { AsyncDuelServiceError } from './asyncDuelService';

const TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AsyncDuelServiceError('UNKNOWN', `${label} timed out.`));
    }, TIMEOUT_MS);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function rpcJson(
  name: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const { data, error } = await withTimeout(
    Promise.resolve(supabase.rpc(name as never, args as never)),
    name,
  );
  if (error) {
    const message = `${error.message ?? ''} ${error.details ?? ''}`.toUpperCase();
    if (/not_authenticated/i.test(message)) {
      throw new AsyncDuelServiceError('NOT_AUTHENTICATED');
    }
    if (message.includes('NOT_PARTICIPANT')) {
      throw new AsyncDuelServiceError('NOT_PARTICIPANT');
    }
    if (message.includes('DUEL_NOT_FOUND')) {
      throw new AsyncDuelServiceError('DUEL_NOT_FOUND');
    }
    if (message.includes('DUPLICATE_ACTIVE_DUEL')) {
      throw new AsyncDuelServiceError('DUPLICATE_ACTIVE_DUEL');
    }
    if (message.includes('ACTIVE_DUEL_LIMIT')) {
      throw new AsyncDuelServiceError('ACTIVE_DUEL_LIMIT');
    }
    if (message.includes('INVALID_DUEL_STATE')) {
      throw new AsyncDuelServiceError('INVALID_DUEL_STATE');
    }
    if (message.includes('PLAYER_NOT_FOUND')) {
      throw new AsyncDuelServiceError('PLAYER_NOT_FOUND');
    }
    if (message.includes('PLAYER_NOT_ELIGIBLE')) {
      throw new AsyncDuelServiceError('PLAYER_NOT_ELIGIBLE');
    }
    throw new AsyncDuelServiceError('UNKNOWN', error.message ?? `${name} failed`);
  }
  if (!isRecord(data)) {
    throw new AsyncDuelServiceError('UNKNOWN', `${name} returned invalid payload`);
  }
  return data;
}

function mapNotification(raw: unknown): PlayerNotification | null {
  if (!isRecord(raw)) {
    return null;
  }
  const type = String(raw.notificationType ?? '');
  if (
    type !== 'DUEL_CHALLENGE_RECEIVED' &&
    type !== 'DUEL_COMPLETED' &&
    type !== 'DUEL_DECLINED' &&
    type !== 'DUEL_EXPIRED'
  ) {
    return null;
  }
  const bodyData = isRecord(raw.bodyData)
    ? (raw.bodyData as PlayerNotificationBodyData)
    : {};
  // Never trust seed-like fields if a server bug introduced them.
  const safeBody: PlayerNotificationBodyData = {
    opponentDisplayName:
      typeof bodyData.opponentDisplayName === 'string'
        ? bodyData.opponentDisplayName
        : undefined,
    challengerScore:
      typeof bodyData.challengerScore === 'number' ? bodyData.challengerScore : undefined,
    outcome: typeof bodyData.outcome === 'string' ? bodyData.outcome : undefined,
    duelId: typeof bodyData.duelId === 'string' ? bodyData.duelId : undefined,
  };
  return {
    id: String(raw.id),
    notificationType: type as PlayerNotificationType,
    duelId: raw.duelId == null ? null : String(raw.duelId),
    titleKey: String(raw.titleKey ?? type),
    bodyData: safeBody,
    deepLinkData: parseNotificationDeepLink(raw.deepLinkData),
    readAt: raw.readAt == null ? null : String(raw.readAt),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

export async function getPlayerNotifications(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: PlayerNotification[]; limit: number; offset: number }> {
  const data = await rpcJson('get_player_notifications', {
    p_limit: options?.limit ?? 20,
    p_offset: options?.offset ?? 0,
  });
  const items = Array.isArray(data.items)
    ? data.items.map(mapNotification).filter((n): n is PlayerNotification => n != null)
    : [];
  return {
    items,
    limit: Number(data.limit ?? 20),
    offset: Number(data.offset ?? 0),
  };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const data = await rpcJson('get_unread_notification_count');
  return Number(data.count ?? 0);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await rpcJson('mark_notification_read', { p_notification_id: notificationId });
}

export async function markAllNotificationsRead(): Promise<number> {
  const data = await rpcJson('mark_all_notifications_read');
  return Number(data.updated ?? 0);
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const data = await rpcJson('get_notification_preferences');
  return {
    duelChallengesInApp: Boolean(data.duelChallengesInApp),
    duelChallengesPush: Boolean(data.duelChallengesPush),
    duelResultsInApp: Boolean(data.duelResultsInApp),
    duelResultsPush: Boolean(data.duelResultsPush),
    duelStatusInApp: Boolean(data.duelStatusInApp),
    duelStatusPush: Boolean(data.duelStatusPush),
  };
}

export async function updateNotificationPreferences(
  input: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const data = await rpcJson('update_notification_preferences', { p_prefs: input });
  return {
    duelChallengesInApp: Boolean(data.duelChallengesInApp),
    duelChallengesPush: Boolean(data.duelChallengesPush),
    duelResultsInApp: Boolean(data.duelResultsInApp),
    duelResultsPush: Boolean(data.duelResultsPush),
    duelStatusInApp: Boolean(data.duelStatusInApp),
    duelStatusPush: Boolean(data.duelStatusPush),
  };
}

export async function registerPushToken(input: {
  token: string;
  platform: 'ios' | 'android' | 'web';
  appEnvironment: 'development' | 'preview' | 'production';
}): Promise<{ id: string; active: boolean }> {
  const data = await rpcJson('register_device_push_token', {
    p_token: input.token,
    p_platform: input.platform,
    p_environment: input.appEnvironment,
  });
  return { id: String(data.id), active: Boolean(data.active) };
}

export async function revokePushToken(token: string): Promise<boolean> {
  const data = await rpcJson('revoke_device_push_token', { p_token: token });
  return Boolean(data.revoked);
}

export async function getMyDuelRecord(): Promise<PlayerDuelRecord> {
  const data = await rpcJson('get_my_duel_record');
  return {
    completedDuels: Number(data.completedDuels ?? 0),
    wins: Number(data.wins ?? 0),
    losses: Number(data.losses ?? 0),
    ties: Number(data.ties ?? 0),
    winRate: data.winRate == null ? null : Number(data.winRate),
    highestDuelScore: Number(data.highestDuelScore ?? 0),
  };
}

export async function getPlayerDuelRecord(profileId: string): Promise<PlayerDuelRecord> {
  const data = await rpcJson('get_player_duel_record', { p_profile_id: profileId });
  return {
    completedDuels: Number(data.completedDuels ?? 0),
    wins: Number(data.wins ?? 0),
    losses: Number(data.losses ?? 0),
    ties: Number(data.ties ?? 0),
    winRate: data.winRate == null ? null : Number(data.winRate),
    highestDuelScore: Number(data.highestDuelScore ?? 0),
  };
}

export async function getHeadToHeadRecord(otherPlayerId: string): Promise<HeadToHeadRecord> {
  const data = await rpcJson('get_head_to_head_record', {
    p_other_player_id: otherPlayerId,
  });
  return {
    otherPlayerId: String(data.otherPlayerId),
    otherDisplayName: String(data.otherDisplayName ?? 'Blaze Player'),
    completedDuels: Number(data.completedDuels ?? 0),
    yourWins: Number(data.yourWins ?? 0),
    theirWins: Number(data.theirWins ?? 0),
    ties: Number(data.ties ?? 0),
  };
}

export async function getAsyncDuelSeriesSummary(
  duelId: string,
): Promise<AsyncDuelSeriesSummary> {
  const data = await rpcJson('get_async_duel_series_summary', { p_duel_id: duelId });
  const h2h = isRecord(data.headToHead) ? data.headToHead : {};
  return {
    duelId: String(data.duelId),
    rematchOfDuelId: data.rematchOfDuelId == null ? null : String(data.rematchOfDuelId),
    seriesRootDuelId: String(data.seriesRootDuelId),
    rematchIndex: Number(data.rematchIndex ?? 1),
    headToHead: {
      otherPlayerId: String(h2h.otherPlayerId ?? ''),
      otherDisplayName: String(h2h.otherDisplayName ?? 'Blaze Player'),
      completedDuels: Number(h2h.completedDuels ?? 0),
      yourWins: Number(h2h.yourWins ?? 0),
      theirWins: Number(h2h.theirWins ?? 0),
      ties: Number(h2h.ties ?? 0),
    },
  };
}

export async function createAsyncDuelRematch(
  sourceDuelId: string,
): Promise<AsyncDuelRematchResult> {
  const data = await rpcJson('create_async_duel_rematch', {
    p_source_duel_id: sourceDuelId,
  });
  return {
    duelId: String(data.duelId),
    attemptId: String(data.attemptId),
    seed: String(data.seed),
    rulesVersion: String(data.rulesVersion),
    deckVersion: String(data.deckVersion),
    durationSeconds: Number(data.durationSeconds),
    bustLimit: Number(data.bustLimit),
    status: String(data.status),
    expiresAt: String(data.expiresAt),
    participantRole: 'challenger',
    alreadyStarted: Boolean(data.alreadyStarted),
    rematchOfDuelId: String(data.rematchOfDuelId),
    seriesRootDuelId: String(data.seriesRootDuelId),
    alreadyExisted: Boolean(data.alreadyExisted),
  };
}

export type { NotificationDeepLink };
