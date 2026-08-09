import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../ui/BlazeButton';
import { BlazePanel } from '../ui/BlazePanel';
import {
  formatUtcResetCountdown,
  formatFriendlyChallengeDate,
} from '../../challenge/utcResetCountdown';
import type { DailyChallengeUiStatus } from '../../challenge/dailyChallengePolicy';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../../theme/uiKit';

type DailyBlazeHomeCardProps = {
  uiStatus: DailyChallengeUiStatus;
  challengeDate: string | null;
  officialScore: number | null;
  errorMessage: string | null;
  countdownNowMs: number;
  onPress: () => void;
  onPrimaryAction: () => void;
  onSignIn?: () => void;
  primaryBusy?: boolean;
};

function statusMeta(
  uiStatus: DailyChallengeUiStatus,
  officialScore: number | null,
  errorMessage: string | null,
): { icon: string; label: string; detail: string } {
  switch (uiStatus) {
    case 'available':
      return {
        icon: '🔥',
        label: 'AVAILABLE',
        detail: 'Same deck. Same rules. One official attempt.',
      };
    case 'in_progress':
      return {
        icon: '⏳',
        label: 'ATTEMPT IN PROGRESS',
        detail: 'Resume your official ranked run.',
      };
    case 'completed':
      return {
        icon: '✓',
        label: 'COMPLETED',
        detail:
          officialScore != null
            ? `Your score: ${officialScore.toLocaleString()}. Official attempt used.`
            : 'Official attempt used. Leaderboard coming in the next phase.',
      };
    case 'practice_available':
      return {
        icon: '🎯',
        label: 'PRACTICE AVAILABLE',
        detail: 'Official attempt complete. Practice the same deck.',
      };
    case 'offline':
      return {
        icon: '📡',
        label: 'OFFLINE',
        detail: errorMessage ?? 'Daily Blaze requires a connection for ranked play.',
      };
    case 'sign_in_required':
      return {
        icon: '🔐',
        label: 'SIGN IN TO COMPETE',
        detail: 'Ranked Daily Blaze requires an account.',
      };
    case 'error':
      return {
        icon: '⚠',
        label: 'UNAVAILABLE',
        detail: errorMessage ?? "We couldn't load today's challenge.",
      };
    case 'disabled':
      return {
        icon: '—',
        label: 'DISABLED',
        detail: "Today's challenge is not active.",
      };
    case 'abandoned':
      return {
        icon: '—',
        label: 'ATTEMPT USED',
        detail: 'Your official attempt for today has been consumed.',
      };
  case 'unavailable':
      return {
        icon: '—',
        label: 'UNAVAILABLE',
        detail: errorMessage ?? 'Daily Blaze is not available right now.',
      };
    default:
      return {
        icon: '…',
        label: 'LOADING',
        detail: 'Fetching today\'s challenge…',
      };
  }
}

function primaryButtonLabel(uiStatus: DailyChallengeUiStatus): string | null {
  switch (uiStatus) {
    case 'available':
      return 'PLAY';
    case 'in_progress':
      return 'RESUME';
    case 'completed':
    case 'practice_available':
      return 'RESULTS';
    case 'sign_in_required':
      return 'SIGN IN';
    case 'error':
      return 'TRY AGAIN';
    case 'offline':
      return null;
    default:
      return null;
  }
}

export function DailyBlazeHomeCard({
  uiStatus,
  challengeDate,
  officialScore,
  errorMessage,
  countdownNowMs,
  onPress,
  onPrimaryAction,
  onSignIn,
  primaryBusy,
}: DailyBlazeHomeCardProps) {
  const meta = statusMeta(uiStatus, officialScore, errorMessage);
  const primaryLabel = primaryButtonLabel(uiStatus);
  const friendlyDate = challengeDate
    ? formatFriendlyChallengeDate(challengeDate)
    : 'Today';
  const resetCountdown = formatUtcResetCountdown(countdownNowMs);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Daily Blaze. ${meta.label}. ${friendlyDate}. New challenge in ${resetCountdown}.`}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <BlazePanel style={styles.panel}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>DAILY BLAZE</Text>
          <Text style={styles.resetLabel} accessibilityLabel={`New challenge in ${resetCountdown}`}>
            NEW IN {resetCountdown}
          </Text>
        </View>

        <Text style={styles.subtitle}>Today&apos;s Challenge</Text>
        <Text style={styles.date}>{friendlyDate}</Text>

        <View style={styles.statusRow} accessibilityRole="text">
          <Text style={styles.statusIcon} accessibilityElementsHidden>
            {meta.icon}
          </Text>
          <View style={styles.statusCopy}>
            <Text style={styles.statusLabel}>{meta.label}</Text>
            <Text style={styles.statusDetail} numberOfLines={2}>{meta.detail}</Text>
          </View>
        </View>

        {uiStatus === 'completed' && officialScore != null ? (
          <View style={styles.scoreRow} accessibilityRole="text">
            <Text style={styles.scoreLabel}>YOUR SCORE</Text>
            <Text style={styles.scoreValue}>{officialScore.toLocaleString()}</Text>
          </View>
        ) : null}

        {primaryLabel ? (
          <View style={styles.actionRow}>
            <BlazeButton
              label={primaryLabel}
              size="sm"
              loading={primaryBusy}
              disabled={primaryBusy}
              onPress={() => {
                if (uiStatus === 'sign_in_required' && onSignIn) {
                  onSignIn();
                  return;
                }
                onPrimaryAction();
              }}
              accessibilityLabel={
                uiStatus === 'in_progress'
                  ? 'Resume Daily Blaze attempt'
                  : uiStatus === 'completed' || uiStatus === 'practice_available'
                    ? 'View Daily Blaze results'
                    : uiStatus === 'sign_in_required'
                      ? 'Sign in to compete in Daily Blaze'
                      : 'Play Daily Blaze'
              }
            />
          </View>
        ) : null}
      </BlazePanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  pressed: {
    opacity: 0.92,
  },
  panel: {
    gap: kitSpacing.xs,
    borderColor: 'rgba(255,138,0,0.35)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    color: kitColors.fire.orange,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1.4,
  },
  resetLabel: {
    color: kitColors.text.muted,
    fontFamily: kitTypography.families.condensed,
    fontSize: 10,
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  subtitle: {
    color: kitColors.text.secondary,
    fontFamily: kitTypography.families.condensed,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  date: {
    color: kitColors.text.primary,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 15,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
  },
  statusIcon: {
    fontSize: 16,
    lineHeight: 20,
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  statusLabel: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  statusDetail: {
    color: kitColors.text.secondary,
    fontFamily: kitTypography.families.body,
    fontSize: 12,
    lineHeight: 16,
  },
  scoreRow: {
    marginTop: 4,
    gap: 2,
  },
  scoreLabel: {
    color: kitColors.text.secondary,
    fontFamily: kitTypography.families.condensed,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  scoreValue: {
    color: kitColors.fire.gold,
    fontFamily: kitTypography.families.display,
    fontSize: 24,
  },
  actionRow: {
    marginTop: kitSpacing.xs,
  },
});
