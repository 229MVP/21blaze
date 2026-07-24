import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Path } from 'react-native-svg';

import { FlameIcon } from '../components/branding/FlameIcon';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import {
  LeaderboardTable,
  type LeaderboardEntry,
} from '../components/leaderboard/LeaderboardTable';
import { BlazeSegmentedControl } from '../components/Navigation/BlazeSegmentedControl';
import { SvgRoot as Svg } from '../components/svg/SvgRoot';
import { BlazeButton } from '../components/ui/BlazeButton';
import { BlazePanel } from '../components/ui/BlazePanel';
import type { GlobalLeaderboardRow } from '../lib/database.types';
import type { RootStackParamList } from '../navigation/navigationTypes';
import { loadGlobalLeaderboard } from '../services/leaderboardService';
import { useAuthStore } from '../store/useAuthStore';
import { useScoreHistoryStore } from '../store/useScoreHistoryStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';
import { formatCompletedDate } from '../utils/formatCompletedDate';

type HighScoresScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'HighScores'
>;

type LeaderboardTab = 'local' | 'global' | 'friends';

const TAB_OPTIONS: { label: string; value: LeaderboardTab }[] = [
  { label: 'LOCAL', value: 'local' },
  { label: 'GLOBAL', value: 'global' },
  { label: 'FRIENDS', value: 'friends' },
];

const GLOBAL_TIMEOUT_MS = 12000;
const CONTENT_MAX = 410;

function TrophyIcon() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 28, height: 28 }}
    >
      <Svg width={28} height={28} viewBox="0 0 24 24">
        <Path
          d="M7 4h10v2h3v2c0 2.2-1.5 4-3.5 4.6A4.5 4.5 0 0 1 14 15.9V18h2v2H8v-2h2v-2.1A4.5 4.5 0 0 1 7.5 12.6C5.5 12 4 10.2 4 8V6h3V4zm2 2v1.5H6.1c.2 1 .9 1.8 1.9 2.1V6zm8.9 0H15v3.6c1-.3 1.7-1.1 1.9-2.1H17.9z"
          fill={kitColors.fire.gold}
        />
      </Svg>
    </View>
  );
}

async function loadGlobalWithTimeout(
  limit: number,
): Promise<GlobalLeaderboardRow[]> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      loadGlobalLeaderboard(limit),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Request timed out. Try again.'));
        }, GLOBAL_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function HighScoresScreen({ navigation }: HighScoresScreenProps) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);
  const [tab, setTab] = useState<LeaderboardTab>('local');

  const entries = useScoreHistoryStore((state) => state.entries);
  const isHydrated = useScoreHistoryStore((state) => state.isHydrated);
  const hydrateScoreHistory = useScoreHistoryStore(
    (state) => state.hydrateScoreHistory,
  );
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const authStatus = useAuthStore((state) => state.authStatus);

  const [globalRows, setGlobalRows] = useState<GlobalLeaderboardRow[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalRefreshing, setGlobalRefreshing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [hasLoadedGlobal, setHasLoadedGlobal] = useState(false);

  useEffect(() => {
    void hydrateScoreHistory();
  }, [hydrateScoreHistory]);

  const fetchGlobal = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') {
      setGlobalRefreshing(true);
    } else {
      setGlobalLoading(true);
    }
    setGlobalError(null);

    try {
      const rows = await loadGlobalWithTimeout(25);
      setGlobalRows(rows);
      setHasLoadedGlobal(true);
    } catch (error) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : 'Unable to load global leaderboard.',
      );
      setHasLoadedGlobal(true);
    } finally {
      setGlobalLoading(false);
      setGlobalRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (
      tab === 'global' &&
      !hasLoadedGlobal &&
      !globalLoading &&
      authStatus === 'online'
    ) {
      void fetchGlobal('load');
    }
  }, [authStatus, fetchGlobal, globalLoading, hasLoadedGlobal, tab]);

  const localEntries: LeaderboardEntry[] = useMemo(
    () =>
      entries.map((entry, index) => ({
        rank: index + 1,
        playerName: 'YOU',
        score: entry.score,
        subtitle: `${entry.lanesCleared} lanes · ${entry.cardsPlayed} cards · ${entry.busts} busts`,
        meta: formatCompletedDate(entry.completedAt),
        isCurrentPlayer: index === 0,
      })),
    [entries],
  );

  const globalEntries: LeaderboardEntry[] = useMemo(
    () =>
      globalRows.map((entry) => {
        const rawName = entry.display_name?.trim() ?? '';
        const looksLikeUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            rawName,
          );
        return {
          rank: entry.rank,
          playerName: !rawName || looksLikeUuid ? 'Player' : rawName,
          score: entry.score,
          isCurrentPlayer: Boolean(userId && entry.user_id === userId),
          subtitle: `${entry.lanes_cleared} lanes · ${entry.cards_played} cards`,
        };
      }),
    [globalRows, userId],
  );

  const offline = authStatus === 'local';
  const connecting = authStatus === 'connecting';

  return (
    <BlazeScreenBackground variant="plain">
      <View
        style={[
          styles.column,
          { width: columnWidth, maxWidth: CONTENT_MAX, alignSelf: 'center' },
        ]}
      >
        <ScreenHeader title="HIGH SCORES" icon={<TrophyIcon />} />

        <BlazeSegmentedControl
          options={TAB_OPTIONS}
          selectedValue={tab}
          onChange={setTab}
        />

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            tab === 'global' && Platform.OS !== 'web' ? (
              <RefreshControl
                refreshing={globalRefreshing}
                onRefresh={() => {
                  void fetchGlobal('refresh');
                }}
                tintColor={kitColors.fire.orange}
              />
            ) : undefined
          }
        >
          {tab === 'local' ? (
            !isHydrated ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={kitColors.fire.orange} />
                <Text style={styles.stateText}>Loading local scores…</Text>
              </View>
            ) : localEntries.length === 0 ? (
              <View style={styles.empty}>
                <FlameIcon width={36} height={48} />
                <Text style={styles.emptyTitle}>NO SCORES YET</Text>
                <Text style={styles.emptyDetail}>
                  Finish a game to enter your local leaderboard.
                </Text>
                <BlazeButton
                  label="SOLO PLAY"
                  onPress={() => navigation.navigate('Game')}
                  accessibilityLabel="Solo play 21 Blaze"
                />
              </View>
            ) : (
              <LeaderboardTable entries={localEntries} />
            )
          ) : null}

          {tab === 'global' ? (
            connecting && !hasLoadedGlobal && !globalLoading ? (
              <View
                style={styles.loadingBlock}
                accessibilityLiveRegion="polite"
                accessibilityLabel="Connecting to load global scores"
              >
                <ActivityIndicator color={kitColors.fire.orange} />
                <Text style={styles.stateText}>Loading global scores…</Text>
              </View>
            ) : offline && !hasLoadedGlobal && !globalLoading ? (
              <View
                accessible
                accessibilityLabel="Offline. Connect online to view verified global scores."
              >
                <BlazePanel style={styles.statePanel}>
                  <Text style={styles.stateTitle}>OFFLINE</Text>
                  <Text style={styles.stateText}>
                    Connect online to view verified global scores.
                  </Text>
                </BlazePanel>
              </View>
            ) : globalLoading && !globalRefreshing ? (
              <View
                style={styles.loadingBlock}
                accessibilityLiveRegion="polite"
                accessibilityLabel="Loading global scores"
              >
                <ActivityIndicator color={kitColors.fire.orange} />
                <Text style={styles.stateText}>Loading global scores…</Text>
              </View>
            ) : globalError ? (
              <View
                accessible
                accessibilityLabel="Global scores unavailable"
              >
                <BlazePanel style={styles.statePanel}>
                  <Text style={styles.stateTitle}>GLOBAL SCORES UNAVAILABLE</Text>
                  <Text style={styles.stateText}>{globalError}</Text>
                  <Text style={styles.stateHint}>
                    Local scores remain available on the Local tab.
                  </Text>
                  <BlazeButton
                    label="RETRY"
                    onPress={() => {
                      void fetchGlobal('load');
                    }}
                  />
                </BlazePanel>
              </View>
            ) : globalEntries.length === 0 ? (
              <View style={styles.empty}>
                <FlameIcon width={36} height={48} />
                <Text style={styles.emptyTitle}>NO VERIFIED SCORES YET</Text>
                <Text style={styles.emptyDetail}>
                  Finish an online verified match to claim a position.
                </Text>
                <BlazeButton
                  label="SOLO PLAY"
                  onPress={() => navigation.navigate('Game')}
                />
              </View>
            ) : (
              <LeaderboardTable entries={globalEntries} />
            )
          ) : null}

          {tab === 'friends' ? (
            <BlazePanel style={styles.statePanel}>
              <Text style={styles.stateTitle}>FRIEND RANKINGS</Text>
              <Text style={styles.stateText}>
                Coming in a future update.
              </Text>
            </BlazePanel>
          ) : null}
        </ScrollView>

        <BlazeButton
          label="BACK"
          variant="secondary"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        />
      </View>
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    paddingHorizontal: kitSpacing.md,
    paddingBottom: kitSpacing.md,
    gap: kitSpacing.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: kitSpacing.sm,
    paddingBottom: kitSpacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: kitSpacing.xl,
    gap: kitSpacing.sm,
  },
  emptyTitle: {
    fontFamily: kitTypography.families.display,
    fontSize: 24,
    letterSpacing: 1,
    color: kitColors.text.primary,
  },
  emptyDetail: {
    fontFamily: kitTypography.families.body,
    fontSize: 14,
    color: kitColors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: kitSpacing.lg,
  },
  loadingBlock: {
    alignItems: 'center',
    gap: kitSpacing.sm,
    paddingVertical: kitSpacing.xl,
  },
  statePanel: {
    gap: kitSpacing.sm,
    alignItems: 'center',
  },
  stateTitle: {
    fontFamily: kitTypography.families.display,
    fontSize: 20,
    color: kitColors.fire.orange,
    textAlign: 'center',
  },
  stateText: {
    fontFamily: kitTypography.families.body,
    fontSize: 14,
    color: kitColors.text.secondary,
    textAlign: 'center',
  },
  stateHint: {
    fontFamily: kitTypography.families.body,
    fontSize: 12,
    color: kitColors.text.muted,
    textAlign: 'center',
  },
});
