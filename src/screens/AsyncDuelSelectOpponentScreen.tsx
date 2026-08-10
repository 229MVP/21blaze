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

import { mapAsyncDuelErrorMessage } from '../asyncDuel/asyncDuelErrorMap';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { AsyncDuelSelectOpponentScreenProps } from '../navigation/navigationTypes';
import { useAsyncDuelStore } from '../store/useAsyncDuelStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

export function AsyncDuelSelectOpponentScreen({
  navigation,
}: AsyncDuelSelectOpponentScreenProps) {
  const [query, setQuery] = useState('');
  const searchOpponents = useAsyncDuelStore((s) => s.searchOpponents);
  const searchResults = useAsyncDuelStore((s) => s.searchResults);
  const isSearching = useAsyncDuelStore((s) => s.isSearching);
  const errorMessage = useAsyncDuelStore((s) => s.errorMessage);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      void searchOpponents(query);
    }, 350);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query, searchOpponents]);

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.inner}>
        <ScreenHeader title="CHOOSE OPPONENT" />
        <Text style={styles.hint}>Search by display name (min 2 characters).</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Display name"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Search players by display name"
        />
        {isSearching ? <ActivityIndicator color={colors.gold} /> : null}
        {errorMessage ? (
          <Text style={styles.error}>{mapAsyncDuelErrorMessage(errorMessage)}</Text>
        ) : null}
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.userId}
          ListEmptyComponent={
            query.trim().length >= 2 && !isSearching ? (
              <Text style={styles.empty}>No players found.</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              disabled={!item.eligible}
              onPress={() =>
                navigation.navigate('AsyncDuelConfirmChallenge', {
                  opponentId: item.userId,
                  opponentDisplayName: item.displayName,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Challenge ${item.displayName}, level ${item.level}`}
            >
              <View>
                <Text style={styles.name}>{item.displayName}</Text>
                <Text style={styles.meta}>Level {item.level}</Text>
              </View>
              <Text style={styles.cta}>{item.eligible ? 'CHALLENGE' : 'UNAVAILABLE'}</Text>
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
    gap: spacing.sm,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  hint: { ...typography.body, color: colors.textSecondary, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.blazeSubtle,
  },
  name: { fontFamily: fontFamilies.bodyBold, color: colors.textPrimary, fontSize: 16 },
  meta: { ...typography.label, color: colors.textSecondary, textTransform: 'none' },
  cta: { fontFamily: fontFamilies.bodyBold, color: colors.gold, fontSize: 12 },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg },
  error: { ...typography.body, color: '#FF8A80', textAlign: 'center' },
});
