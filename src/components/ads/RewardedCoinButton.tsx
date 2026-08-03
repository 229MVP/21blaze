import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isRewardedCurrencyEnabled } from '../../config/featureFlags';
import { trackEvent } from '../../monetization/analytics';
import {
  REWARDED_COIN_MESSAGES,
  useRewardedCoinStore,
} from '../../store/useRewardedCoinStore';
import { colors } from '../../theme/colors';
import { fontFamilies, typography } from '../../theme/typography';
import { BlazeButton } from '../buttons/BlazeButton';

type Props = {
  /** Where this button is placed — for analytics/context only. */
  placement: 'locker' | 'results' | 'dailyReward' | 'missions';
};

const BUSY_STATUSES = new Set([
  'requesting',
  'loading',
  'showing',
  'verifying',
]);

/**
 * Version 1.1C — "WATCH AD — EARN 25 COINS" placement. Never shown when
 * rewarded-currency grants are disabled (the flag stays `false` in every
 * profile until AdMob SSV is live-verified — see
 * docs/V1_1C_REWARDED_SSV.md) so players are never promised a reward the
 * app cannot yet safely grant. Tapping is the only thing that ever
 * requests an ad — this component never auto-opens one.
 */
export function RewardedCoinButton({ placement }: Props) {
  const status = useRewardedCoinStore((state) => state.status);
  const watchAdForCoins = useRewardedCoinStore((state) => state.watchAdForCoins);
  const reset = useRewardedCoinStore((state) => state.reset);

  useEffect(() => {
    return () => {
      // Leaving the placement clears any terminal message so the next
      // mount starts from a clean "WATCH AD" state.
      if (!BUSY_STATUSES.has(useRewardedCoinStore.getState().status)) {
        reset();
      }
    };
  }, [reset]);

  if (!isRewardedCurrencyEnabled()) {
    return null;
  }

  const busy = BUSY_STATUSES.has(status);
  const message = REWARDED_COIN_MESSAGES[status] ?? REWARDED_COIN_MESSAGES.idle;
  const isTerminalMessage = status !== 'idle';

  return (
    <View style={styles.wrap} accessibilityRole="summary" accessibilityLabel={message}>
      <BlazeButton
        title={status === 'idle' ? 'WATCH AD — EARN 25 COINS' : message}
        onPress={() => {
          trackEvent('rewarded_ad_requested', { placement });
          void watchAdForCoins();
        }}
        disabled={busy || status === 'dailyLimitReached'}
        loading={busy}
        fullWidth
        accessibilityLabel={
          status === 'idle'
            ? 'Watch a rewarded ad to earn 25 Blaze Coins'
            : message
        }
      />
      {isTerminalMessage && !busy ? (
        <Text
          style={[
            styles.statusText,
            status === 'verified' && styles.statusSuccess,
            (status === 'verificationFailed' || status === 'dailyLimitReached') &&
              styles.statusWarn,
          ]}
          accessibilityLiveRegion="polite"
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  statusText: {
    ...typography.body,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statusSuccess: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.success,
  },
  statusWarn: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.gold,
  },
});
