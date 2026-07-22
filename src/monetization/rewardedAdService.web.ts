import type { AdRewardType } from './types';

export type RewardedAdOutcome =
  | { status: 'earned'; clientRewardId: string }
  | { status: 'dismissed' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

/** Web stub — rewarded ads require a native development build. */
export async function showRewardedAd(
  _rewardType: AdRewardType,
): Promise<RewardedAdOutcome> {
  return {
    status: 'unavailable',
    message: 'Rewarded ads require a native development build.',
  };
}
