import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { ProfileFrameBadge } from '../components/cosmetics/ProfileFrameBadge';
import { BlazeScreenBackground } from '../components/layout/BlazeScreenBackground';
import { BottomActionBar } from '../components/Navigation/BottomActionBar';
import { BlazeButton } from '../components/ui/BlazeButton';
import { BlazePanel } from '../components/ui/BlazePanel';
import {
  formatAsyncTimeRemaining,
  isValidAsyncInviteCodeFormat,
  millisecondsUntilExpiration,
  normalizeAsyncInviteCode,
} from '../async/asyncChallengePolicy';
import { getCosmetic } from '../cosmetics/catalog';
import { useInterstitialScreenTracking } from '../hooks/useInterstitialScreenTracking';
import type { JoinAsyncChallengeScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { useAsyncChallengeStore } from '../store/useAsyncChallengeStore';
import {
  colors as kitColors,
  spacing as kitSpacing,
  typography as kitTypography,
} from '../theme/uiKit';

const CONTENT_MAX = 410;

export function JoinAsyncChallengeScreen({ navigation, route }: JoinAsyncChallengeScreenProps) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(CONTENT_MAX, width - 24);
  const authStatus = useAuthStore((state) => state.authStatus);
  const isAnonymous = useAuthStore((state) => state.isAnonymous);
  const resolveInvite = useAsyncChallengeStore((state) => state.resolveInvite);
  const acceptChallenge = useAsyncChallengeStore((state) => state.acceptChallenge);
  const invitePreview = useAsyncChallengeStore((state) => state.invitePreview);
  const acceptStatus = useAsyncChallengeStore((state) => state.acceptStatus);
  const error = useAsyncChallengeStore((state) => state.error);
  const clearPendingInvite = useAsyncChallengeStore((state) => state.clearPendingInvite);

  const [codeInput, setCodeInput] = useState(route.params?.inviteCode ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useInterstitialScreenTracking('other');

  const online = authStatus === 'online' && !isAnonymous;

  useEffect(() => {
    const deepLinkCode = route.params?.inviteCode;
    if (deepLinkCode && online) {
      void (async () => {
        setBusy(true);
        try {
          await resolveInvite(normalizeAsyncInviteCode(deepLinkCode));
        } catch (err) {
          setLocalError(err instanceof Error ? err.message : 'Invalid invite code.');
        } finally {
          setBusy(false);
        }
      })();
    }
  }, [online, resolveInvite, route.params?.inviteCode]);

  const handleResolve = useCallback(async () => {
    const normalized = normalizeAsyncInviteCode(codeInput);
    if (!isValidAsyncInviteCodeFormat(normalized)) {
      setLocalError('Enter a valid BLAZE invite code.');
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await resolveInvite(normalized);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Invalid invite code.');
    } finally {
      setBusy(false);
    }
  }, [codeInput, resolveInvite]);

  const handleAccept = useCallback(async () => {
    const normalized = normalizeAsyncInviteCode(codeInput);
    setBusy(true);
    setLocalError(null);
    try {
      const challenge = await acceptChallenge(normalized);
      navigation.replace('AsyncChallengeDetail', { challengeId: challenge.challengeId });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to accept challenge.');
    } finally {
      setBusy(false);
    }
  }, [acceptChallenge, codeInput, navigation]);

  const creator = invitePreview?.creator;
  const titleName =
    creator?.playerTitleId
      ? getCosmetic(creator.playerTitleId)?.displayName ?? creator.playerTitleId
      : null;

  return (
    <BlazeScreenBackground>
      <View style={[styles.column, { width: columnWidth }]}>
        <Text style={styles.title}>JOIN ASYNC DUEL</Text>

        {!online ? (
          <BlazePanel style={styles.panel}>
            <Text style={styles.offline}>CONNECT ONLINE FOR ASYNC DUELS</Text>
            <Text style={styles.offlineDetail}>
              Create an account to accept official challenges.
            </Text>
          </BlazePanel>
        ) : (
          <>
            <TextInput
              value={codeInput}
              onChangeText={setCodeInput}
              placeholder="BLAZE-XXXX-XXXX"
              placeholderTextColor={kitColors.text.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />
            <BlazeButton
              label={busy ? 'LOADING…' : 'LOOK UP CODE'}
              variant="secondary"
              disabled={busy}
              onPress={() => void handleResolve()}
            />
          </>
        )}

        {busy || acceptStatus === 'resolving' ? (
          <ActivityIndicator color={kitColors.fire.gold} />
        ) : null}

        {(localError || error) ? (
          <Text style={styles.errorText}>{localError ?? error}</Text>
        ) : null}

        {invitePreview ? (
          <BlazePanel style={styles.panel}>
            <View style={styles.creatorRow}>
              <ProfileFrameBadge
                size={48}
                variant={
                  creator?.profileFrameId === 'flame_profile_frame' ? 'flame' : 'default'
                }
              />
              <View style={styles.creatorText}>
                <Text style={styles.creatorName}>{creator?.displayName}</Text>
                {titleName ? <Text style={styles.creatorTitle}>{titleName}</Text> : null}
              </View>
            </View>
            <Text style={styles.rules}>
              Same deck · {invitePreview.durationSeconds}s · One official attempt
            </Text>
            <Text style={styles.warning}>One attempt only. No replay after first move.</Text>
            <Text style={styles.expires}>
              Expires in{' '}
              {formatAsyncTimeRemaining(
                millisecondsUntilExpiration(invitePreview.expiresAt),
              )}
            </Text>
            {invitePreview.canAccept ? (
              <BlazeButton
                label="ACCEPT CHALLENGE"
                disabled={!online || busy}
                onPress={() => void handleAccept()}
              />
            ) : (
              <Text style={styles.unavailable}>This challenge cannot be accepted.</Text>
            )}
          </BlazePanel>
        ) : null}

        <BlazeButton
          label="CANCEL"
          variant="ghost"
          onPress={() => {
            clearPendingInvite();
            navigation.goBack();
          }}
        />
      </View>
      <BottomActionBar
        primaryAction={{ label: 'BACK', onPress: () => navigation.goBack() }}
      />
    </BlazeScreenBackground>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    alignSelf: 'center',
    paddingHorizontal: kitSpacing.md,
    paddingTop: kitSpacing.lg,
    gap: kitSpacing.md,
  },
  title: {
    color: kitColors.text.primary,
    fontSize: 32,
    fontFamily: kitTypography.families.display,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: kitColors.border.default,
    borderRadius: 8,
    paddingHorizontal: kitSpacing.md,
    paddingVertical: kitSpacing.sm,
    color: kitColors.text.primary,
    fontSize: 16,
  },
  panel: {
    padding: kitSpacing.md,
    gap: kitSpacing.sm,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kitSpacing.sm,
  },
  creatorText: {
    flex: 1,
    minWidth: 0,
  },
  creatorName: {
    color: kitColors.text.primary,
    fontSize: 16,
    fontFamily: kitTypography.families.condensed,
    fontWeight: '700',
  },
  creatorTitle: {
    color: kitColors.text.secondary,
    fontSize: 13,
  },
  rules: {
    color: kitColors.text.secondary,
    fontSize: 14,
  },
  warning: {
    color: kitColors.fire.gold,
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: kitTypography.families.condensed,
  },
  expires: {
    color: kitColors.text.secondary,
    fontSize: 14,
  },
  unavailable: {
    color: kitColors.status.danger,
    fontSize: 14,
  },
  offline: {
    color: kitColors.fire.gold,
    fontSize: 12,
    letterSpacing: 1.2,
    fontFamily: kitTypography.families.condensed,
  },
  offlineDetail: {
    color: kitColors.text.secondary,
    fontSize: 14,
  },
  errorText: {
    color: kitColors.status.danger,
    fontSize: 14,
    textAlign: 'center',
  },
});
