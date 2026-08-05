import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlayerTitleBadge } from '../cosmetics/PlayerTitleBadge';
import { ProfileFrameBadge, type ProfileFrameVariant } from '../cosmetics/ProfileFrameBadge';
import { isV1_1LockerEnabled } from '../../config/featureFlags';
import { getCosmetic } from '../../cosmetics/catalog';
import { colors, shadows, spacing, typography } from '../../theme/uiKit';

export type LeaderboardRowMode = 'daily' | 'weekly';

type Props = {
  mode: LeaderboardRowMode;
  rank: number;
  playerName: string;
  score?: number;
  challengePoints?: number;
  exact21Count?: number;
  fiveCardClears?: number;
  bestMultiplier?: number;
  verifiedDaysCompleted?: number;
  bestDailyRank?: number;
  profileFrameId?: string | null;
  playerTitleId?: string | null;
  isCurrentPlayer?: boolean;
};

function rankColor(rank: number): string {
  if (rank === 1) {
    return colors.fire.gold;
  }
  if (rank === 2) {
    return '#C8CDD3';
  }
  if (rank === 3) {
    return '#CD7F32';
  }
  return colors.text.secondary;
}

function mapProfileFrame(profileFrameId?: string | null): ProfileFrameVariant {
  if (profileFrameId === 'flame_profile_frame') {
    return 'flame';
  }
  return 'default';
}

function buildSubtitle(mode: LeaderboardRowMode, props: Props): string | null {
  if (mode === 'weekly') {
    const days = props.verifiedDaysCompleted ?? 0;
    const best = props.bestDailyRank;
    if (best != null) {
      return `${days} day${days === 1 ? '' : 's'} · best #${best}`;
    }
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  const parts: string[] = [];
  if (props.exact21Count != null) {
    parts.push(`${props.exact21Count} exact-21`);
  }
  if (props.fiveCardClears != null) {
    parts.push(`${props.fiveCardClears} five-card`);
  }
  if (props.bestMultiplier != null && props.bestMultiplier > 1) {
    parts.push(`${props.bestMultiplier}x`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function ChallengeLeaderboardRow(props: Props) {
  const {
    mode,
    rank,
    playerName,
    score,
    challengePoints,
    isCurrentPlayer = false,
    profileFrameId,
    playerTitleId,
  } = props;

  const lockerOn = isV1_1LockerEnabled();
  const subtitle = buildSubtitle(mode, props);
  const primaryValue =
    mode === 'weekly'
      ? (challengePoints ?? 0)
      : (score ?? 0);
  const primaryLabel = mode === 'weekly' ? 'Challenge Points' : 'Score';
  const titleName =
    lockerOn && playerTitleId
      ? getCosmetic(playerTitleId)?.displayName ?? playerTitleId
      : null;

  return (
    <Pressable
      accessibilityRole="text"
      accessibilityLabel={`Rank ${rank}, ${playerName}, ${primaryLabel} ${primaryValue}${isCurrentPlayer ? ', current player' : ''}${subtitle ? `, ${subtitle}` : ''}`}
      style={({ pressed }) => [
        styles.row,
        rank === 1 && styles.topRow,
        rank === 1 && shadows.glow,
        isCurrentPlayer && styles.current,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <Text style={[styles.rank, { color: rankColor(rank) }]} accessibilityElementsHidden>
        {rank}
      </Text>
      {lockerOn ? (
        <ProfileFrameBadge
          variant={mapProfileFrame(profileFrameId)}
          initial={playerName}
          size={34}
        />
      ) : null}
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.name, isCurrentPlayer && styles.currentText]}
          >
            {playerName}
            {isCurrentPlayer ? ' (YOU)' : ''}
          </Text>
          {titleName ? <PlayerTitleBadge label={titleName} /> : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text
        style={[styles.score, rank <= 3 && { color: rankColor(rank) }]}
        numberOfLines={1}
        accessibilityLabel={`${primaryLabel}: ${primaryValue}`}
      >
        {primaryValue.toLocaleString()}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
  },
  topRow: {
    backgroundColor: 'rgba(255,138,0,0.08)',
  },
  current: {
    borderLeftWidth: 3,
    borderLeftColor: colors.fire.gold,
    backgroundColor: 'rgba(255,182,41,0.1)',
  },
  rank: {
    width: 28,
    fontFamily: typography.families.condensed,
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    flexShrink: 1,
    color: colors.text.primary,
    fontFamily: typography.families.condensed,
    fontWeight: '700',
    fontSize: 14,
    maxWidth: '100%',
  },
  currentText: {
    color: colors.fire.gold,
  },
  subtitle: {
    color: colors.text.secondary,
    fontFamily: typography.families.body,
    fontSize: 11,
  },
  score: {
    color: colors.fire.gold,
    fontFamily: typography.families.condensed,
    fontWeight: '800',
    fontSize: 16,
    flexShrink: 0,
    maxWidth: '34%',
    textAlign: 'right',
  },
});
