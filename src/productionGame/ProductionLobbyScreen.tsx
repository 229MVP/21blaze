import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { ProductionLobbyScreenProps } from '../navigation/navigationTypes';
import { searchAsyncDuelOpponents } from '../services/asyncDuelService';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';
import { acceptProductionV1PrivateMatch, createProductionV1PrivateMatch, ProductionV1ServiceError } from './productionV1Service';

type Opponent = { userId: string; displayName: string };
const messageFor = (error: unknown) => {
  if (!(error instanceof ProductionV1ServiceError)) return 'Could not complete that request. Try again.';
  if (error.code === 'PRODUCTION_V1_DISABLED') return 'Production Live PvP is not open for testing yet.';
  if (error.code === 'ACTIVE_MATCH_LIMIT') return 'One of these players already has an active match.';
  if (error.code === 'OPPONENT_NOT_FOUND') return 'That player is no longer available.';
  if (error.code === 'NOT_PARTICIPANT') return 'This match invitation is not for this player.';
  if (error.code === 'ONLY_OPPONENT_ACCEPTS') return 'Only the challenged player can accept this match.';
  if (error.code === 'MATCH_NOT_FOUND') return 'Match not found. Check the match code.';
  return 'Could not complete that request. Try again.';
};

export function ProductionLobbyScreen({ navigation }: ProductionLobbyScreenProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Opponent[]>([]);
  const [matchId, setMatchId] = useState('');
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const value = query.trim();
      if (value.length < 2) { setResults([]); return; }
      setSearching(true);
      void searchAsyncDuelOpponents({ query: value })
        .then(data => setResults(data.items.map(item => ({ userId: item.userId, displayName: item.displayName }))))
        .catch(() => setError('Could not search players. Try again.'))
        .finally(() => setSearching(false));
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const createMatch = async (opponent: Opponent) => {
    setBusy(true); setError(null);
    try {
      const match = await createProductionV1PrivateMatch(opponent.userId);
      setCreatedMatchId(match.matchId);
      navigation.navigate('ProductionLiveGame', { matchId: match.matchId });
    } catch (reason) { setError(messageFor(reason)); }
    finally { setBusy(false); }
  };
  const acceptMatch = async () => {
    const code = matchId.trim();
    if (!code) { setError('Enter the match code from the other phone.'); return; }
    setBusy(true); setError(null);
    try {
      const snapshot = await acceptProductionV1PrivateMatch(code);
      setCreatedMatchId(snapshot.matchId);
      navigation.navigate('ProductionLiveGame', { matchId: snapshot.matchId });
    } catch (reason) { setError(messageFor(reason)); }
    finally { setBusy(false); }
  };

  return <ScreenContainer style={styles.container} intensity="normal" padded={false}>
    <View style={styles.inner}>
      <ScreenHeader title="PRODUCTION LIVE PVP" />
      <Text style={styles.note}>INTERNAL TWO-DEVICE TEST</Text>
      {createdMatchId ? <View style={styles.panel}>
        <Text style={styles.title}>MATCH READY</Text>
        <Text selectable style={styles.code}>{createdMatchId}</Text>
        <BlazeButton title="COPY MATCH CODE" onPress={() => void Clipboard.setStringAsync(createdMatchId)} fullWidth />
        <Text style={styles.body}>Share this code with the challenged player, then open the match.</Text>
        <BlazeButton title="OPEN MATCH" onPress={() => navigation.navigate('ProductionLiveGame', { matchId: createdMatchId })} fullWidth />
      </View> : <>
        <Text style={styles.heading}>CHALLENGE A PLAYER</Text>
        <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Search display name" placeholderTextColor={colors.textSecondary} autoCapitalize="none" />
        {searching ? <ActivityIndicator color={colors.gold} /> : null}
        <FlatList data={results} keyExtractor={item => item.userId} style={styles.list} renderItem={({ item }) => <Pressable disabled={busy} onPress={() => void createMatch(item)} style={styles.row} accessibilityRole="button">
          <Text style={styles.name}>{item.displayName}</Text><Text style={styles.action}>SEND CHALLENGE</Text>
        </Pressable>} />
        <Text style={styles.or}>OR ACCEPT A MATCH</Text>
        <TextInput style={styles.input} value={matchId} onChangeText={setMatchId} placeholder="Paste match code" placeholderTextColor={colors.textSecondary} autoCapitalize="none" autoCorrect={false} />
        <BlazeButton title="ACCEPT MATCH" onPress={() => void acceptMatch()} loading={busy} disabled={busy} fullWidth />
      </>}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <BlazeButton title="BACK" variant="secondary" onPress={() => navigation.goBack()} disabled={busy} fullWidth />
    </View>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  container:{flex:1}, inner:{flex:1,padding:spacing.md,gap:spacing.md,maxWidth:520,width:'100%',alignSelf:'center'},
  note:{...typography.body,color:colors.gold,textAlign:'center'}, heading:{fontFamily:fontFamilies.display,fontSize:22,color:colors.textPrimary},
  input:{borderWidth:1,borderColor:colors.blazeSubtle,borderRadius:radius.sm,padding:spacing.sm,color:colors.textPrimary},
  list:{maxHeight:220}, row:{borderWidth:1,borderColor:colors.blazeSubtle,borderRadius:radius.md,padding:spacing.md,marginBottom:spacing.sm},
  name:{fontFamily:fontFamilies.display,fontSize:21,color:colors.textPrimary}, action:{fontFamily:fontFamilies.bodyBold,fontSize:12,color:colors.gold},
  or:{fontFamily:fontFamilies.bodyBold,color:colors.textSecondary,textAlign:'center'}, error:{...typography.body,color:'#FF8A80',textAlign:'center'},
  panel:{borderWidth:1,borderColor:colors.gold,borderRadius:radius.md,padding:spacing.md,gap:spacing.md}, title:{fontFamily:fontFamilies.display,fontSize:28,color:colors.gold,textAlign:'center'},
  code:{fontFamily:fontFamilies.bodyBold,color:colors.textPrimary,textAlign:'center'}, body:{...typography.body,color:colors.textSecondary,textAlign:'center'},
});