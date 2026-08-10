import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { LivePvpSelectOpponentScreenProps } from '../navigation/navigationTypes';
import { searchAsyncDuelOpponents } from '../services/asyncDuelService';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

type OpponentRow = {
  userId: string;
  displayName: string;
};

/**
 * Reuses the approved Async Duel opponent discovery RPC (public profile search).
 */
export function LivePvpSelectOpponentScreen({
  navigation,
}: LivePvpSelectOpponentScreenProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OpponentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      const q = query.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      void searchAsyncDuelOpponents({ query: q })
        .then((data) => {
          setResults(
            data.items.map((item) => ({
              userId: item.userId,
              displayName: item.displayName,
            })),
          );
        })
        .catch(() => {
          setError('Could not search players. Try again.');
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query]);

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.inner}>
        <ScreenHeader title="CHALLENGE PLAYER" />
        <TextInput
          style={styles.input}
          placeholder="Search display name"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          accessibilityLabel="Search players by display name"
        />
        {loading ? <ActivityIndicator color={colors.gold} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && query.trim().length >= 2 && results.length === 0 ? (
          <Text style={styles.empty}>No players found.</Text>
        ) : null}
        <FlatList
          data={results}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={`Challenge ${item.displayName} live`}
              onPress={() =>
                navigation.navigate('LivePvpConfirmChallenge', {
                  opponentId: item.userId,
                  opponentDisplayName: item.displayName,
                })
              }
            >
              <Text style={styles.name}>{item.displayName}</Text>
              <Text style={styles.cta}>LIVE CHALLENGE</Text>
            </Pressable>
          )}
        />
        <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} fullWidth />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.textPrimary,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 4,
  },
  name: { fontFamily: fontFamilies.display, fontSize: 22, color: colors.textPrimary },
  cta: { fontFamily: fontFamilies.bodyBold, color: colors.gold, fontSize: 12 },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  error: { ...typography.body, color: '#FF8A80', textAlign: 'center' },
});
