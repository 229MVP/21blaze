import { create } from 'zustand';

import { trackEvent } from '../monetization/analytics';
import {
  fetchRewardedAdRequestStatus,
  MonetizationServiceError,
  requestRewardedAdGrant,
} from '../services/monetizationService';
import {
  showRewardedAdForServerVerification,
} from '../services/adService';
import { useAuthStore } from './useAuthStore';
import { useWalletStore } from './useWalletStore';

/**
 * Version 1.1C — the flat "25 Blaze Coins" rewarded-ad reward. Separate
 * from the pre-existing "double the match reward" flow
 * (`useWalletStore.claimRewardedDouble`), which is untouched.
 *
 * The coin grant is never applied optimistically: `verified` is only ever
 * reached after polling confirms the server (via the SSV callback +
 * `verify_and_grant_rewarded_ad`) already applied it.
 */
export type RewardedCoinStatus =
  | 'idle'
  | 'requesting'
  | 'loading'
  | 'showing'
  | 'dismissedEarly'
  | 'verifying'
  | 'verified'
  | 'verificationFailed'
  | 'dailyLimitReached'
  | 'offline'
  | 'noAdAvailable';

export const REWARDED_COIN_MESSAGES: Record<string, string> = {
  idle: 'WATCH AD — EARN 25 COINS',
  requesting: 'PREPARING AD…',
  loading: 'LOADING AD…',
  showing: 'WATCHING AD…',
  dismissedEarly: 'AD CLOSED EARLY — NO REWARD',
  verifying: 'REWARD VERIFYING…',
  verified: '25 COINS ADDED',
  verificationFailed: 'VERIFICATION FAILED — TRY AGAIN',
  dailyLimitReached: 'DAILY AD REWARD LIMIT REACHED',
  offline: 'CONNECT ONLINE TO EARN COINS',
  noAdAvailable: 'AD NOT READY — TRY AGAIN SOON',
};

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 25000;

let watchInFlight = false;

type RewardedCoinStore = {
  status: RewardedCoinStatus;
  lastGrantedAmount: number | null;
  dailyRemaining: number | null;
  error: string | null;
  watchAdForCoins: () => Promise<void>;
  reset: () => void;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useRewardedCoinStore = create<RewardedCoinStore>((set, get) => ({
  status: 'idle',
  lastGrantedAmount: null,
  dailyRemaining: null,
  error: null,

  watchAdForCoins: async () => {
    if (watchInFlight) {
      return;
    }
    if (useAuthStore.getState().authStatus !== 'online') {
      set({ status: 'offline' });
      return;
    }

    watchInFlight = true;
    set({ status: 'requesting', error: null });

    try {
      const request = await requestRewardedAdGrant();
      if (!request.ok) {
        set({
          status: request.reason === 'daily_limit_reached' ? 'dailyLimitReached' : 'noAdAvailable',
          dailyRemaining: request.dailyRemaining,
        });
        return;
      }

      set({ status: 'loading', dailyRemaining: request.dailyRemaining });

      const userId = useAuthStore.getState().profile?.id ?? null;
      if (!userId) {
        set({ status: 'noAdAvailable' });
        return;
      }

      const outcome = await showRewardedAdForServerVerification({
        userId,
        customData: request.requestId,
      });

      if (outcome.status === 'failed') {
        set({ status: 'noAdAvailable' });
        return;
      }
      if (outcome.status === 'dismissed') {
        set({ status: 'dismissedEarly' });
        trackEvent('rewarded_ad_dismissed');
        return;
      }

      // Earned locally — never grant yet. Poll the server for the
      // SSV-verified outcome only.
      set({ status: 'verifying' });
      trackEvent('rewarded_ad_verification_started');

      const deadline = Date.now() + POLL_TIMEOUT_MS;
      let verified = false;
      while (Date.now() < deadline) {
        await delay(POLL_INTERVAL_MS);
        const statusRow = await fetchRewardedAdRequestStatus(request.requestId);
        if (!statusRow) {
          continue;
        }
        if (statusRow.status === 'verified') {
          verified = true;
          set({
            status: 'verified',
            lastGrantedAmount: statusRow.rewardAmount,
          });
          trackEvent('rewarded_ad_verified', { amount: statusRow.rewardAmount });
          await useWalletStore.getState().refreshWallet();
          break;
        }
        if (statusRow.status === 'expired' || statusRow.status === 'failed') {
          break;
        }
      }

      if (!verified && get().status === 'verifying') {
        set({ status: 'verificationFailed' });
        trackEvent('rewarded_ad_verification_failed');
      }
    } catch (error) {
      set({
        status: 'verificationFailed',
        error:
          error instanceof MonetizationServiceError
            ? error.message
            : 'Unable to watch rewarded ad.',
      });
      trackEvent('rewarded_ad_verification_failed');
    } finally {
      watchInFlight = false;
    }
  },

  reset: () => set({ status: 'idle', error: null }),
}));
