import { useEffect } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { CreateLiveRoomScreenProps } from '../navigation/navigationTypes';
import { useLiveMatchStore } from '../store/useLiveMatchStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

export function CreateLiveRoomScreen({ navigation }: CreateLiveRoomScreenProps) {
  const createRoom = useLiveMatchStore((state) => state.createRoom);
  const leaveMatch = useLiveMatchStore((state) => state.leaveMatch);
  const roomCode = useLiveMatchStore((state) => state.roomCode);
  const matchState = useLiveMatchStore((state) => state.matchState);
  const error = useLiveMatchStore((state) => state.error);
  const isBusy = useLiveMatchStore((state) => state.isBusy);

  useEffect(() => {
    if (!roomCode) {
      void createRoom();
    }
  }, [createRoom, roomCode]);

  useEffect(() => {
    if (matchState?.opponent) {
      navigation.replace('LiveLobby');
    }
  }, [matchState?.opponent, navigation]);

  const shareCode = async () => {
    if (!roomCode) {
      return;
    }
    await Share.share({
      message: `Join my 21 Blaze Live Duel room: ${roomCode}`,
    });
  };

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="CREATE ROOM" />
        <View style={styles.card}>
          <Text style={styles.label}>ROOM CODE</Text>
          <Text style={styles.code}>{roomCode ?? '······'}</Text>
          <Text style={styles.waiting}>
            {matchState?.opponent
              ? 'Opponent joined!'
              : 'Waiting for opponent…'}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.actions}>
          <BlazeButton
            title="SHARE CODE"
            onPress={() => {
              void shareCode();
            }}
            disabled={!roomCode || isBusy}
            fullWidth
          />
          <BlazeButton
            title="CANCEL"
            variant="secondary"
            onPress={() => {
              void leaveMatch().then(() => navigation.goBack());
            }}
            fullWidth
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  card: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.blazeSubtle,
    backgroundColor: colors.backgroundCard,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    letterSpacing: 1.4,
  },
  code: {
    fontFamily: fontFamilies.display,
    fontSize: 48,
    letterSpacing: 8,
    color: colors.gold,
  },
  waiting: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  error: {
    ...typography.body,
    fontSize: 13,
    color: colors.warningRed,
    textAlign: 'center',
  },
  actions: {
    marginTop: 'auto',
    gap: 10,
  },
});
