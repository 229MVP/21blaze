import { StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import type { LiveDuelHomeScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

export function LiveDuelHomeScreen({ navigation }: LiveDuelHomeScreenProps) {
  const authStatus = useAuthStore((state) => state.authStatus);
  const online = authStatus === 'online';

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="LIVE DUEL" />
        <Text style={styles.subtitle}>Private friend matches · Beta 0.3</Text>

        {!online ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>ONLINE REQUIRED</Text>
            <Text style={styles.noticeBody}>
              Live Duel needs a connected guest session. Solo play still works offline.
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <BlazeButton
            title="CHALLENGE A FRIEND"
            onPress={() => navigation.navigate('CreateLiveRoom')}
            disabled={!online}
            fullWidth
          />
          <BlazeButton
            title="JOIN WITH CODE"
            variant="secondary"
            onPress={() => navigation.navigate('JoinLiveRoom')}
            disabled={!online}
            fullWidth
          />
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonTitle}>QUICK MATCH</Text>
            <Text style={styles.comingSoonBody}>Coming Next</Text>
          </View>
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonTitle}>MATCH HISTORY</Text>
            <Text style={styles.comingSoonBody}>Coming Later</Text>
          </View>
        </View>

        <BlazeButton
          title="BACK"
          variant="outline"
          onPress={() => navigation.goBack()}
          fullWidth
        />
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
  subtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  notice: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: 'rgba(0,0,0,0.28)',
    padding: spacing.md,
    gap: 4,
  },
  noticeTitle: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.gold,
    letterSpacing: 1,
    textAlign: 'center',
  },
  noticeBody: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  comingSoon: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.backgroundCard,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: 2,
    opacity: 0.72,
  },
  comingSoonTitle: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: colors.textPrimary,
  },
  comingSoonBody: {
    ...typography.label,
    fontSize: 11,
    color: colors.textMuted,
  },
});
