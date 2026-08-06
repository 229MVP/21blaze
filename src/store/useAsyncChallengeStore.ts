import { create } from 'zustand';

import {
  attemptStatusLabel,
  hubSectionForChallenge,
  shouldShowAsyncHubBadge,
} from '../async/asyncChallengePolicy';
import type {
  AsyncChallengeInvitePreview,
  AsyncChallengeSession,
  AsyncChallengeSummary,
  AsyncChallengeVerifiedStats,
} from '../async/types';
import { trackEvent } from '../monetization/analytics';
import type { MoveLogEntry } from '../online/types';
import {
  AsyncChallengeServiceError,
  acceptAsyncChallenge,
  abandonAsyncChallengeAttempt,
  completeAsyncChallengeAttempt,
  createAsyncChallenge,
  fetchAsyncChallenge,
  fetchAsyncChallenges,
  recordAsyncChallengeFirstMove,
  resolveAsyncInvite,
  startAsyncChallengeAttempt,
  toAsyncChallengeSession,
} from '../services/asyncChallengeService';
import {
  loadCachedAsyncChallenges,
  saveCachedAsyncChallenges,
} from '../storage/asyncChallengeStorage';

type CreateStatus = 'idle' | 'creating' | 'created' | 'error';
type AcceptStatus = 'idle' | 'resolving' | 'accepting' | 'accepted' | 'error';
type AttemptStatus = 'idle' | 'starting' | 'active' | 'submitting' | 'completed' | 'error';
type VerificationStatus = 'idle' | 'submitting' | 'verified' | 'rejected' | 'failed';

type AsyncChallengeStore = {
  activeChallenges: AsyncChallengeSummary[];
  completedChallenges: AsyncChallengeSummary[];
  selectedChallenge: AsyncChallengeSummary | null;
  pendingInviteCode: string | null;
  invitePreview: AsyncChallengeInvitePreview | null;
  lastCreatedInviteCode: string | null;
  activeSession: AsyncChallengeSession | null;
  verifiedResult: AsyncChallengeVerifiedStats | null;
  createStatus: CreateStatus;
  acceptStatus: AcceptStatus;
  attemptStatus: AttemptStatus;
  verificationStatus: VerificationStatus;
  lastUpdatedAt: string | null;
  isLoading: boolean;
  error: string | null;
  loadChallenges: () => Promise<void>;
  createChallenge: () => Promise<AsyncChallengeSummary>;
  resolveInvite: (inviteCode: string) => Promise<AsyncChallengeInvitePreview>;
  acceptChallenge: (inviteCode: string) => Promise<AsyncChallengeSummary>;
  startAttempt: (challengeId: string, viewerUserId: string) => Promise<AsyncChallengeSession>;
  recordFirstMove: () => Promise<void>;
  completeAttempt: (moves: MoveLogEntry[]) => Promise<void>;
  abandonActiveAttempt: () => Promise<void>;
  refreshChallenge: (challengeId: string) => Promise<AsyncChallengeSummary>;
  selectChallenge: (challenge: AsyncChallengeSummary | null) => void;
  setPendingInviteCode: (code: string | null) => void;
  clearPendingInvite: () => void;
  clearActiveSession: () => void;
  clearError: () => void;
  shouldShowBadge: () => boolean;
};

function partitionChallenges(challenges: AsyncChallengeSummary[]) {
  const active: AsyncChallengeSummary[] = [];
  const completed: AsyncChallengeSummary[] = [];
  for (const challenge of challenges) {
    if (challenge.status === 'completed' || challenge.status === 'expired') {
      completed.push(challenge);
    } else {
      active.push(challenge);
    }
  }
  return { active, completed };
}

export const useAsyncChallengeStore = create<AsyncChallengeStore>((set, get) => ({
  activeChallenges: [],
  completedChallenges: [],
  selectedChallenge: null,
  pendingInviteCode: null,
  invitePreview: null,
  lastCreatedInviteCode: null,
  activeSession: null,
  verifiedResult: null,
  createStatus: 'idle',
  acceptStatus: 'idle',
  attemptStatus: 'idle',
  verificationStatus: 'idle',
  lastUpdatedAt: null,
  isLoading: false,
  error: null,

  loadChallenges: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetchAsyncChallenges();
      const { active, completed } = partitionChallenges(response.challenges);
      await saveCachedAsyncChallenges({
        challenges: response.challenges,
        serverTime: response.serverTime,
        cachedAtMs: Date.now(),
      });
      set({
        activeChallenges: active,
        completedChallenges: completed,
        lastUpdatedAt: response.serverTime,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const cached = await loadCachedAsyncChallenges();
      if (cached) {
        const { active, completed } = partitionChallenges(cached.challenges);
        set({
          activeChallenges: active,
          completedChallenges: completed,
          lastUpdatedAt: cached.serverTime,
          isLoading: false,
          error:
            error instanceof AsyncChallengeServiceError
              ? 'CONNECT ONLINE FOR ASYNC DUELS'
              : 'Unable to load challenges.',
        });
        return;
      }
      set({
        isLoading: false,
        error:
          error instanceof Error ? error.message : 'Unable to load async challenges.',
      });
    }
  },

  createChallenge: async () => {
    set({ createStatus: 'creating', error: null });
    trackEvent('async_challenge_created');
    const response = await createAsyncChallenge();
    const { active, completed } = partitionChallenges([response.challenge]);
    set((state) => ({
      createStatus: 'created',
      lastCreatedInviteCode: response.inviteCode,
      selectedChallenge: response.challenge,
      activeChallenges: [
        response.challenge,
        ...state.activeChallenges.filter(
          (row) => row.challengeId !== response.challenge.challengeId,
        ),
      ],
      completedChallenges: completed,
      lastUpdatedAt: response.serverTime,
    }));
    return response.challenge;
  },

  resolveInvite: async (inviteCode) => {
    set({ acceptStatus: 'resolving', error: null });
    trackEvent('async_challenge_code_entered');
    const response = await resolveAsyncInvite(inviteCode);
    set({
      acceptStatus: 'idle',
      invitePreview: response.preview,
      pendingInviteCode: response.inviteCode,
      selectedChallenge: response.challenge,
    });
    return response.preview;
  },

  acceptChallenge: async (inviteCode) => {
    set({ acceptStatus: 'accepting', error: null });
    const response = await acceptAsyncChallenge(inviteCode);
    trackEvent('async_challenge_accepted');
    set((state) => ({
      acceptStatus: 'accepted',
      selectedChallenge: response.challenge,
      activeChallenges: [
        response.challenge,
        ...state.activeChallenges.filter(
          (row) => row.challengeId !== response.challenge.challengeId,
        ),
      ],
      pendingInviteCode: null,
      invitePreview: null,
      lastUpdatedAt: response.serverTime,
    }));
    return response.challenge;
  },

  startAttempt: async (challengeId, viewerUserId) => {
    set({ attemptStatus: 'starting', error: null });
    trackEvent('async_challenge_attempt_started');
    const challenge =
      get().selectedChallenge ??
      get().activeChallenges.find((row) => row.challengeId === challengeId) ??
      (await fetchAsyncChallenge(challengeId)).challenge;
    const response = await startAsyncChallengeAttempt(challengeId);
    const session = toAsyncChallengeSession(response, challenge, viewerUserId);
    set({
      attemptStatus: 'active',
      activeSession: session,
      selectedChallenge: challenge,
    });
    return session;
  },

  recordFirstMove: async () => {
    const session = get().activeSession;
    if (!session) {
      return;
    }
    trackEvent('async_challenge_first_move');
    await recordAsyncChallengeFirstMove(session.attemptId);
  },

  completeAttempt: async (moves) => {
    const session = get().activeSession;
    if (!session) {
      return;
    }
    set({ verificationStatus: 'submitting', attemptStatus: 'submitting' });
    trackEvent('async_challenge_verification_started');
    try {
      const response = await completeAsyncChallengeAttempt(session.attemptId, moves);
      if (response.verified && response.result) {
        trackEvent('async_challenge_verified');
        if (response.waitingForOpponent) {
          trackEvent('async_challenge_attempt_completed');
        }
        if (response.challenge?.status === 'completed') {
          trackEvent('async_challenge_finalized');
          if (response.challenge.resultType === 'draw') {
            trackEvent('async_challenge_draw');
          }
        }
        set({
          verificationStatus: 'verified',
          attemptStatus: 'completed',
          verifiedResult: response.result,
          selectedChallenge: response.challenge ?? get().selectedChallenge,
          activeSession: null,
        });
        if (response.challenge) {
          const { active, completed } = partitionChallenges([response.challenge]);
          set((state) => ({
            activeChallenges: [
              ...active,
              ...state.activeChallenges.filter(
                (row) => row.challengeId !== response.challenge!.challengeId,
              ),
            ],
            completedChallenges: [
              ...completed,
              ...state.completedChallenges.filter(
                (row) => row.challengeId !== response.challenge!.challengeId,
              ),
            ],
          }));
        }
        return;
      }
      trackEvent('async_challenge_attempt_abandoned');
      set({
        verificationStatus: 'rejected',
        attemptStatus: 'error',
        error: response.rejectionReason ?? 'Verification failed.',
      });
    } catch (error) {
      set({
        verificationStatus: 'failed',
        attemptStatus: 'error',
        error: error instanceof Error ? error.message : 'Verification failed.',
      });
    }
  },

  abandonActiveAttempt: async () => {
    const session = get().activeSession;
    if (!session) {
      return;
    }
    trackEvent('async_challenge_attempt_abandoned');
    try {
      await abandonAsyncChallengeAttempt(session.attemptId);
    } catch {
      // Best-effort abandonment.
    }
    set({
      activeSession: null,
      attemptStatus: 'idle',
      verificationStatus: 'idle',
    });
  },

  refreshChallenge: async (challengeId) => {
    const response = await fetchAsyncChallenge(challengeId);
    set((state) => {
      const { active, completed } = partitionChallenges([response.challenge]);
      return {
        selectedChallenge: response.challenge,
        activeChallenges: [
          ...active,
          ...state.activeChallenges.filter((row) => row.challengeId !== challengeId),
        ],
        completedChallenges: [
          ...completed,
          ...state.completedChallenges.filter((row) => row.challengeId !== challengeId),
        ],
        lastUpdatedAt: response.serverTime,
      };
    });
    return response.challenge;
  },

  selectChallenge: (challenge) => set({ selectedChallenge: challenge }),

  setPendingInviteCode: (code) => set({ pendingInviteCode: code }),

  clearPendingInvite: () =>
    set({ pendingInviteCode: null, invitePreview: null, acceptStatus: 'idle' }),

  clearActiveSession: () =>
    set({
      activeSession: null,
      attemptStatus: 'idle',
      verificationStatus: 'idle',
      verifiedResult: null,
    }),

  clearError: () => set({ error: null, createStatus: 'idle', acceptStatus: 'idle' }),

  shouldShowBadge: () =>
    shouldShowAsyncHubBadge([
      ...get().activeChallenges,
      ...get().completedChallenges.filter((row) => row.finalizedAt !== null),
    ]),
}));

export function formatChallengeHubLabel(
  challenge: AsyncChallengeSummary,
  viewerUserId: string | null,
): string {
  const section = hubSectionForChallenge(challenge, viewerUserId);
  switch (section) {
    case 'your_turn':
      return 'YOUR TURN';
    case 'waiting':
      return 'WAITING FOR OPPONENT';
    case 'opponent_turn':
      return "OPPONENT'S TURN";
    case 'completed':
      return 'COMPLETED';
    case 'expired':
      return 'EXPIRED';
    default:
      return 'ACTIVE';
  }
}

export { attemptStatusLabel };
