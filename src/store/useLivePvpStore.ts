import { create } from 'zustand';

import {
  livePvpMatchCoordinator,
  type LivePvpAppChannelStatus,
} from '../livePvp/livePvpCoordinator';
import type { LivePvpSession } from '../livePvp/livePvpSession';
import type { LiveMatchSnapshot } from '../livePvp/livePvpTypes';
import { trackEvent } from '../monetization/analytics';
import {
  acceptLiveMatch,
  cancelLiveMatch,
  completeLiveMatchAttempt,
  createLiveMatchInvite,
  createLivePvpRematch,
  declineLiveMatch,
  forfeitLiveMatch,
  getLiveMatchHub,
  getLiveMatchSnapshot,
  getLivePvpOpsStatus,
  getLivePvpPlayerRecord,
  LivePvpServiceError,
  setLiveMatchReady,
  submitLiveMatchProgress,
  type LivePvpHubItem,
  type LivePvpHubSection,
} from '../services/livePvpService';
import { clearLivePvpCheckpoint, loadLivePvpCheckpoint } from '../livePvp/livePvpCheckpointStorage';
import { evaluateLivePvpRecovery } from '../livePvp/livePvpRecovery';
import { livePvpDiagnostics } from '../livePvp/livePvpDiagnostics';
import type { LivePvpPlayerRecord, LivePvpRematchResult } from '../livePvp/livePvpTypes';
import { useAuthStore } from './useAuthStore';

type MutationKind = 'idle' | 'pending' | 'success' | 'error';

type LivePvpStore = {
  hubTab: LivePvpHubSection;
  incoming: LivePvpHubItem[];
  active: LivePvpHubItem[];
  recent: LivePvpHubItem[];
  attentionCount: number;
  creationEnabled: boolean;
  snapshot: LiveMatchSnapshot | null;
  connectionState: LivePvpAppChannelStatus;
  opponentPresenceConnected: boolean | null;
  isLoadingHub: boolean;
  mutationStatus: MutationKind;
  errorMessage: string | null;
  playerRecord: LivePvpPlayerRecord | null;
  resumeMatchId: string | null;
  setHubTab: (tab: LivePvpHubSection) => void;
  refreshHub: () => Promise<void>;
  refreshOps: () => Promise<void>;
  refreshSnapshot: (matchId?: string) => Promise<LiveMatchSnapshot | null>;
  loadSnapshot: (matchId: string) => Promise<LiveMatchSnapshot | null>;
  createInvite: (opponentId: string, opponentDisplayName: string) => Promise<string | null>;
  acceptInvite: (matchId: string) => Promise<LiveMatchSnapshot | null>;
  declineInvite: (matchId: string) => Promise<boolean>;
  cancelInvite: (matchId: string) => Promise<boolean>;
  setReady: (matchId: string) => Promise<LiveMatchSnapshot | null>;
  forfeit: (matchId: string) => Promise<LiveMatchSnapshot | null>;
  submitCompletion: (
    session: LivePvpSession,
    result: {
      score: number;
      exact21Count: number;
      fiveCardClearCount: number;
      bustCount: number;
      cardsPlayed: number;
      lanesCleared: number;
      completionMs: number;
    },
  ) => Promise<LiveMatchSnapshot | null>;
  joinMatchChannel: (matchId: string) => Promise<void>;
  leaveMatchChannel: () => Promise<void>;
  notifyMatchForeground: () => void;
  evaluateResumeOffer: () => Promise<string | null>;
  createRematch: (sourceMatchId: string) => Promise<LivePvpRematchResult | null>;
  loadPlayerRecord: () => Promise<void>;
  clearError: () => void;
  resetForAccountSwitch: () => void;
};

let coordinatorUnsub: (() => void) | null = null;

function errCode(error: unknown): string {
  if (error instanceof LivePvpServiceError) {
    return error.code;
  }
  return 'UNKNOWN';
}

function bindCoordinator(): void {
  if (coordinatorUnsub) {
    return;
  }
  coordinatorUnsub = livePvpMatchCoordinator.subscribe({
    onSnapshot: (snapshot) => {
      useLivePvpStore.setState({ snapshot });
    },
    onStatus: (status) => {
      useLivePvpStore.setState({ connectionState: status });
    },
    onPresence: (rows) => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) {
        useLivePvpStore.setState({ opponentPresenceConnected: null });
        return;
      }
      const opponentOnline = rows.some(
        (row) => row.userId != null && row.userId !== userId,
      );
      useLivePvpStore.setState({ opponentPresenceConnected: opponentOnline });
    },
  });
}

export const useLivePvpStore = create<LivePvpStore>((set, get) => ({
  hubTab: 'incoming',
  incoming: [],
  active: [],
  recent: [],
  attentionCount: 0,
  creationEnabled: true,
  snapshot: null,
  connectionState: 'idle',
  opponentPresenceConnected: null,
  isLoadingHub: false,
  mutationStatus: 'idle',
  errorMessage: null,
  playerRecord: null,
  resumeMatchId: null,

  setHubTab: (tab) => set({ hubTab: tab }),
  clearError: () => set({ errorMessage: null }),

  resetForAccountSwitch: () => {
    coordinatorUnsub?.();
    coordinatorUnsub = null;
    livePvpMatchCoordinator.cancelReconnect();
    void livePvpMatchCoordinator.leave({ reason: 'account_switch' });
    void clearLivePvpCheckpoint();
    livePvpDiagnostics.clear();
    set({
      hubTab: 'incoming',
      incoming: [],
      active: [],
      recent: [],
      attentionCount: 0,
      snapshot: null,
      connectionState: 'idle',
      opponentPresenceConnected: null,
      isLoadingHub: false,
      mutationStatus: 'idle',
      errorMessage: null,
      playerRecord: null,
      resumeMatchId: null,
    });
  },

  refreshOps: async () => {
    try {
      const ops = await getLivePvpOpsStatus();
      set({ creationEnabled: ops.creationEnabled && ops.configActive });
    } catch {
      set({ creationEnabled: false });
    }
  },

  refreshHub: async () => {
    set({ isLoadingHub: true, errorMessage: null });
    try {
      const [incoming, active, recent] = await Promise.all([
        getLiveMatchHub({ section: 'incoming' }),
        getLiveMatchHub({ section: 'active' }),
        getLiveMatchHub({ section: 'recent' }),
      ]);
      set({
        incoming: incoming.items,
        active: active.items,
        recent: recent.items,
        attentionCount: Math.max(
          incoming.attentionCount,
          active.attentionCount,
          recent.attentionCount,
        ),
        isLoadingHub: false,
      });
      trackEvent('live_pvp_hub_viewed', { attention: incoming.attentionCount });
    } catch (error) {
      set({ isLoadingHub: false, errorMessage: errCode(error) });
    }
  },

  loadSnapshot: async (matchId) => {
    try {
      const snapshot = await getLiveMatchSnapshot(matchId);
      set({ snapshot, errorMessage: null });
      return snapshot;
    } catch (error) {
      set({ errorMessage: errCode(error) });
      return null;
    }
  },

  refreshSnapshot: async (matchId) => {
    const id = matchId ?? get().snapshot?.matchId;
    if (!id) {
      return null;
    }
    const fromCoordinator = await livePvpMatchCoordinator.refreshSnapshot();
    if (fromCoordinator && fromCoordinator.matchId === id) {
      set({ snapshot: fromCoordinator, errorMessage: null });
      return fromCoordinator;
    }
    return get().loadSnapshot(id);
  },

  createInvite: async (opponentId, _opponentDisplayName) => {
    if (get().mutationStatus === 'pending') {
      return null;
    }
    set({ mutationStatus: 'pending', errorMessage: null });
    try {
      const created = await createLiveMatchInvite(opponentId);
      set({ mutationStatus: 'success' });
      trackEvent('live_invite_created');
      return created.matchId;
    } catch (error) {
      set({ mutationStatus: 'error', errorMessage: errCode(error) });
      return null;
    }
  },

  acceptInvite: async (matchId) => {
    if (get().mutationStatus === 'pending') {
      return null;
    }
    set({ mutationStatus: 'pending', errorMessage: null });
    try {
      const snapshot = await acceptLiveMatch(matchId);
      set({ mutationStatus: 'success', snapshot });
      trackEvent('live_invite_accepted');
      return snapshot;
    } catch (error) {
      set({ mutationStatus: 'error', errorMessage: errCode(error) });
      return null;
    }
  },

  declineInvite: async (matchId) => {
    if (get().mutationStatus === 'pending') {
      return false;
    }
    set({ mutationStatus: 'pending', errorMessage: null });
    try {
      await declineLiveMatch(matchId);
      set({ mutationStatus: 'success' });
      return true;
    } catch (error) {
      set({ mutationStatus: 'error', errorMessage: errCode(error) });
      return false;
    }
  },

  cancelInvite: async (matchId) => {
    if (get().mutationStatus === 'pending') {
      return false;
    }
    set({ mutationStatus: 'pending', errorMessage: null });
    try {
      await cancelLiveMatch(matchId);
      set({ mutationStatus: 'success' });
      return true;
    } catch (error) {
      set({ mutationStatus: 'error', errorMessage: errCode(error) });
      return false;
    }
  },

  setReady: async (matchId) => {
    if (get().mutationStatus === 'pending') {
      return null;
    }
    set({ mutationStatus: 'pending', errorMessage: null });
    try {
      const snapshot = await setLiveMatchReady(matchId);
      set({ mutationStatus: 'success', snapshot });
      trackEvent('live_player_ready');
      return snapshot;
    } catch (error) {
      set({ mutationStatus: 'error', errorMessage: errCode(error) });
      return null;
    }
  },

  forfeit: async (matchId) => {
    if (get().mutationStatus === 'pending') {
      return null;
    }
    set({ mutationStatus: 'pending', errorMessage: null });
    try {
      const snapshot = await forfeitLiveMatch(matchId);
      set({ mutationStatus: 'success', snapshot });
      trackEvent('live_match_forfeited');
      return snapshot;
    } catch (error) {
      set({ mutationStatus: 'error', errorMessage: errCode(error) });
      return null;
    }
  },

  submitCompletion: async (session, result) => {
    if (get().mutationStatus === 'pending') {
      return get().snapshot;
    }
    set({ mutationStatus: 'pending', errorMessage: null });
    try {
      const snapshot = await completeLiveMatchAttempt(session.matchId, {
        ...result,
        rulesVersion: session.rulesVersion,
        deckVersion: session.deckVersion,
        submissionVersion: 'live-pvp-phase2',
      });
      set({ mutationStatus: 'success', snapshot });
      trackEvent('live_match_completed');
      return snapshot;
    } catch (error) {
      set({ mutationStatus: 'error', errorMessage: errCode(error) });
      return null;
    }
  },

  joinMatchChannel: async (matchId) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      set({ errorMessage: 'NOT_AUTHENTICATED', connectionState: 'channel_error' });
      return;
    }
    bindCoordinator();
    try {
      await livePvpMatchCoordinator.ensureJoined({ userId, matchId });
      const snapshot = livePvpMatchCoordinator.getSnapshot();
      if (snapshot) {
        set({ snapshot, connectionState: livePvpMatchCoordinator.getChannelStatus() });
      }
      trackEvent('live_lobby_joined');
    } catch (error) {
      const code = errCode(error);
      set({
        errorMessage: code === 'UNKNOWN' ? 'CHANNEL_AUTH_FAILED' : code,
        connectionState: livePvpMatchCoordinator.getChannelStatus(),
      });
      void livePvpMatchCoordinator.reconnectWithBackoff('join_failed');
    }
  },

  evaluateResumeOffer: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      set({ resumeMatchId: null });
      return null;
    }
    const checkpoint = await loadLivePvpCheckpoint();
    if (!checkpoint) {
      set({ resumeMatchId: null });
      return null;
    }
    try {
      const snapshot = await getLiveMatchSnapshot(checkpoint.matchId);
      const evaluation = evaluateLivePvpRecovery({ checkpoint, userId, snapshot });
      if (evaluation.kind === 'discard') {
        livePvpDiagnostics.checkpointDiscarded(evaluation.reason);
        void clearLivePvpCheckpoint();
        set({ resumeMatchId: null });
        return null;
      }
      livePvpDiagnostics.checkpointAccepted(checkpoint.matchId);
      set({ resumeMatchId: checkpoint.matchId });
      return checkpoint.matchId;
    } catch {
      livePvpDiagnostics.checkpointDiscarded('snapshot_fetch_failed');
      void clearLivePvpCheckpoint();
      set({ resumeMatchId: null });
      return null;
    }
  },

  createRematch: async (sourceMatchId) => {
    if (get().mutationStatus === 'pending') {
      return null;
    }
    set({ mutationStatus: 'pending', errorMessage: null });
    try {
      const result = await createLivePvpRematch(sourceMatchId);
      livePvpDiagnostics.rematchOutcome(
        result.alreadyExisted ? 'existing' : 'created',
      );
      set({ mutationStatus: 'success' });
      trackEvent('live_rematch_created', { alreadyExisted: result.alreadyExisted });
      return result;
    } catch (error) {
      const code = errCode(error);
      livePvpDiagnostics.rematchOutcome(code);
      set({ mutationStatus: 'error', errorMessage: code });
      return null;
    }
  },

  loadPlayerRecord: async () => {
    try {
      const record = await getLivePvpPlayerRecord();
      set({ playerRecord: record });
    } catch {
      set({ playerRecord: null });
    }
  },

  leaveMatchChannel: async () => {
    await livePvpMatchCoordinator.leave({ reason: 'explicit' });
    set({
      connectionState: 'closed',
      opponentPresenceConnected: null,
    });
  },

  notifyMatchForeground: () => {
    const snapshot = get().snapshot;
    if (!snapshot?.matchId) {
      return;
    }
    livePvpMatchCoordinator.notifyForegroundActiveMatch();
    void get().refreshSnapshot(snapshot.matchId);
  },
}));

export function __resetLivePvpStoreForTests(): void {
  useLivePvpStore.getState().resetForAccountSwitch();
}

export { submitLiveMatchProgress };
