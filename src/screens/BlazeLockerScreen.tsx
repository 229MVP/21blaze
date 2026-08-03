import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RewardedCoinButton } from '../components/ads/RewardedCoinButton';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { CosmeticPreview } from '../components/cosmetics/CosmeticPreview';
import { CosmeticUnlockOverlay } from '../components/cosmetics/CosmeticUnlockOverlay';
import { EmberCollectionPreview } from '../components/cosmetics/EmberCollectionPreview';
import { ConfirmationModal } from '../components/modals/ConfirmationModal';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  buttonTriggersEquip,
  buttonTriggersPurchase,
  cosmeticButtonLabel,
  resolveCosmeticButtonState,
  SLOT_FOR_COSMETIC_TYPE,
  tabForCosmeticType,
  type LockerCatalogEntry,
  type LockerTab,
} from '../cosmetics/lockerCatalog';
import { usePreloadLockerPreviewAssets } from '../cosmetics/useLockerCosmetics';
import { useInterstitialScreenTracking } from '../hooks/useInterstitialScreenTracking';
import { trackEvent } from '../monetization/analytics';
import type { BlazeLockerScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { useCosmeticStore } from '../store/useCosmeticStore';
import { useWalletStore } from '../store/useWalletStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

const TABS: LockerTab[] = ['FEATURED', 'CARDS', 'ARENA', 'PROFILE', 'OWNED'];

function unlockSourceLabel(entry: LockerCatalogEntry): string {
  switch (entry.unlockMethod) {
    case 'free':
      return 'Default';
    case 'blaze_coins':
      return 'Blaze Coins';
    case 'streak':
      return '7-Day Streak';
    case 'level':
      return 'Level Reward';
    default:
      return '';
  }
}

function rarityLabel(rarity: string): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

function typeLabel(type: LockerCatalogEntry['cosmeticType']): string {
  switch (type) {
    case 'card_face':
      return 'Card Face';
    case 'card_back':
      return 'Card Back';
    case 'arena':
      return 'Arena';
    case 'profile_frame':
      return 'Profile Frame';
    case 'player_title':
      return 'Player Title';
    case 'lane_effect':
      return 'Lane Effect';
    default:
      return '';
  }
}

export function BlazeLockerScreen({ navigation }: BlazeLockerScreenProps) {
  const authStatus = useAuthStore((state) => state.authStatus);
  const isOnline = authStatus === 'online';

  const balance = useWalletStore((state) => state.balance);
  const hydrateWallet = useWalletStore((state) => state.hydrateWallet);

  const catalog = useCosmeticStore((state) => state.catalog);
  const owned = useCosmeticStore((state) => state.ownedCosmetics);
  const equipped = useCosmeticStore((state) => state.equippedCosmetics);
  const purchaseStatus = useCosmeticStore((state) => state.purchaseStatus);
  const equipStatus = useCosmeticStore((state) => state.equipStatus);
  const error = useCosmeticStore((state) => state.error);
  const pendingUnlock = useCosmeticStore((state) => state.pendingUnlock);
  const hydrateCosmetics = useCosmeticStore((state) => state.hydrateCosmetics);
  const purchaseWithCoins = useCosmeticStore((state) => state.purchaseWithCoins);
  const equipCosmetic = useCosmeticStore((state) => state.equipCosmetic);
  const clearError = useCosmeticStore((state) => state.clearError);
  const acknowledgeUnlock = useCosmeticStore((state) => state.acknowledgeUnlock);
  const selectPreview = useCosmeticStore((state) => state.selectPreview);

  const [tab, setTab] = useState<LockerTab>('FEATURED');
  const [confirmTarget, setConfirmTarget] = useState<LockerCatalogEntry | null>(null);
  useInterstitialScreenTracking('cosmeticUnlock');
  usePreloadLockerPreviewAssets();

  useEffect(() => {
    trackEvent('blaze_locker_viewed');
    void hydrateWallet();
    void hydrateCosmetics();
  }, [hydrateCosmetics, hydrateWallet]);

  useEffect(() => {
    if (isOnline) {
      void hydrateWallet();
      void hydrateCosmetics();
    }
  }, [isOnline, hydrateCosmetics, hydrateWallet]);

  const entries = useMemo(() => {
    if (tab === 'OWNED') {
      return catalog.filter((entry) => owned.includes(entry.id));
    }
    if (tab === 'FEATURED') {
      return catalog.filter((entry) => entry.unlockMethod !== 'free');
    }
    return catalog.filter(
      (entry) => entry.unlockMethod !== 'free' && tabForCosmeticType(entry.cosmeticType) === tab,
    );
  }, [tab, catalog, owned]);

  const hasUnaffordableItem = catalog.some(
    (entry) =>
      entry.unlockMethod === 'blaze_coins' &&
      entry.blazeCoinCost != null &&
      !owned.includes(entry.id) &&
      balance < entry.blazeCoinCost,
  );

  const pendingUnlockEntry = pendingUnlock
    ? catalog.find((entry) => entry.id === pendingUnlock.cosmeticId) ?? null
    : null;

  const equippedSet = useMemo(
    () =>
      new Set(
        [
          equipped.cardFace,
          equipped.cardBack,
          equipped.arena,
          equipped.profileFrame,
          equipped.playerTitle,
          equipped.laneEffect,
        ].filter((value): value is string => Boolean(value)),
      ),
    [equipped],
  );

  const onPreview = (entry: LockerCatalogEntry) => {
    selectPreview(entry.id);
    trackEvent('cosmetic_previewed', { cosmeticId: entry.id, cosmeticType: entry.cosmeticType });
    trackEvent('cosmetic_preview_started', { cosmeticId: entry.id, cosmeticType: entry.cosmeticType });
  };

  const onCardButtonPress = (entry: LockerCatalogEntry) => {
    const state = resolveCosmeticButtonState({
      entry,
      owned: owned.includes(entry.id),
      equipped: equippedSet.has(entry.id),
      balance,
    });
    if (!isOnline) {
      return;
    }
    if (buttonTriggersPurchase(state)) {
      setConfirmTarget(entry);
      return;
    }
    if (buttonTriggersEquip(state)) {
      const slot = SLOT_FOR_COSMETIC_TYPE[entry.cosmeticType];
      void equipCosmetic(entry.id, slot);
    }
  };

  const confirmUnlock = () => {
    if (!confirmTarget) {
      return;
    }
    const target = confirmTarget;
    setConfirmTarget(null);
    void purchaseWithCoins(target.id);
  };

  const onEquipUnlockedNow = () => {
    if (!pendingUnlockEntry) {
      return;
    }
    const slot = SLOT_FOR_COSMETIC_TYPE[pendingUnlockEntry.cosmeticType];
    void equipCosmetic(pendingUnlockEntry.id, slot);
    acknowledgeUnlock();
  };

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="BLAZE LOCKER" />

        <View style={styles.headerRow} accessibilityRole="text">
          <Text
            style={styles.balance}
            accessibilityLabel={`${balance.toLocaleString()} Blaze Coins`}
          >
            {balance.toLocaleString()} COINS
          </Text>
        </View>

        {!isOnline ? (
          <Text style={styles.offlineBanner} accessibilityRole="alert">
            CONNECT ONLINE TO UNLOCK OR CHANGE COSMETICS
          </Text>
        ) : null}

        {hasUnaffordableItem ? <RewardedCoinButton placement="locker" /> : null}

        {tab === 'FEATURED' ? <EmberCollectionPreview onSelectTab={setTab} /> : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {TABS.map((t) => {
            const active = t === tab;
            return (
              <BlazeButton
                key={t}
                title={t}
                variant={active ? 'primary' : 'outline'}
                onPress={() => setTab(t)}
                accessibilityLabel={`${t} tab${active ? ', selected' : ''}`}
              />
            );
          })}
        </ScrollView>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {entries.length === 0 ? (
            <Text style={styles.emptyState}>No cosmetics in this tab yet.</Text>
          ) : (
            entries.map((entry) => (
              <CosmeticCard
                key={entry.id}
                entry={entry}
                owned={owned.includes(entry.id)}
                equipped={equippedSet.has(entry.id)}
                balance={balance}
                busy={
                  (purchaseStatus === 'purchasing' || equipStatus === 'equipping') &&
                  confirmTarget?.id !== entry.id
                }
                disabled={!isOnline}
                onPreview={() => onPreview(entry)}
                onButtonPress={() => onCardButtonPress(entry)}
              />
            ))
          )}
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <BlazeButton
            title="BACK"
            variant="outline"
            onPress={() => navigation.goBack()}
            fullWidth
          />
        </View>
      </View>

      <ConfirmationModal
        visible={confirmTarget !== null}
        title="UNLOCK COSMETIC?"
        message={
          confirmTarget
            ? `Unlock ${confirmTarget.name} for ${confirmTarget.blazeCoinCost?.toLocaleString()} Blaze Coins?`
            : ''
        }
        confirmLabel="UNLOCK"
        cancelLabel="CANCEL"
        onConfirm={confirmUnlock}
        onCancel={() => setConfirmTarget(null)}
      />

      <CosmeticUnlockOverlay
        entry={pendingUnlockEntry}
        onEquipNow={onEquipUnlockedNow}
        onContinue={() => {
          acknowledgeUnlock();
          clearError();
        }}
      />
    </ScreenContainer>
  );
}

function CosmeticCard({
  entry,
  owned,
  equipped,
  balance,
  busy,
  disabled,
  onPreview,
  onButtonPress,
}: {
  entry: LockerCatalogEntry;
  owned: boolean;
  equipped: boolean;
  balance: number;
  busy: boolean;
  disabled: boolean;
  onPreview: () => void;
  onButtonPress: () => void;
}) {
  const state = resolveCosmeticButtonState({ entry, owned, equipped, balance });
  const label = cosmeticButtonLabel(state);
  const buttonDisabled =
    disabled || state.kind === 'equipped' || state.kind === 'needCoins' ||
    state.kind === 'streakLocked' || state.kind === 'levelLocked' || busy;
  const trackedInsufficient = useRef(false);

  useEffect(() => {
    if (state.kind === 'needCoins' && !trackedInsufficient.current) {
      trackedInsufficient.current = true;
      trackEvent('insufficient_coins_shown', { cosmeticId: entry.id, missing: state.missing });
    }
  }, [entry.id, state]);

  const ownedLabel = equipped ? 'Equipped' : owned ? 'Owned' : 'Locked';
  const accessibilitySummary = `${entry.name}. ${typeLabel(entry.cosmeticType)}. ${rarityLabel(entry.rarity)}. ${
    entry.blazeCoinCost != null ? `${entry.blazeCoinCost} Blaze Coins.` : ''
  } ${ownedLabel}.`;

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={accessibilitySummary}
    >
      <Pressable
        style={styles.previewSlot}
        onPress={onPreview}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Preview ${entry.name}`}
      >
        <CosmeticPreview cosmeticId={entry.id} cosmeticType={entry.cosmeticType} name={entry.name} />
      </Pressable>
      <View style={styles.cardCopy}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {entry.name}
          </Text>
          {equipped ? <Text style={styles.equippedTag}>EQUIPPED</Text> : null}
        </View>
        <Text style={styles.cardDescription} numberOfLines={2}>
          {entry.description}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaChip}>{typeLabel(entry.cosmeticType)}</Text>
          <Text style={styles.metaChip}>{rarityLabel(entry.rarity)}</Text>
          <Text style={styles.metaChip}>{unlockSourceLabel(entry)}</Text>
        </View>
        <BlazeButton
          title={label}
          onPress={onButtonPress}
          variant={state.kind === 'equipped' ? 'secondary' : 'primary'}
          disabled={buttonDisabled}
          loading={busy}
          fullWidth
          accessibilityLabel={`${label} — ${entry.name}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  balance: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    color: colors.gold,
  },
  offlineBanner: {
    ...typography.body,
    fontSize: 12,
    color: colors.gold,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    borderRadius: radius.md,
    paddingVertical: 6,
  },
  tabRow: {
    gap: 8,
    paddingVertical: 4,
  },
  list: { flex: 1 },
  listContent: { gap: spacing.sm, paddingBottom: spacing.md },
  emptyState: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.backgroundCard,
    padding: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  previewSlot: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardName: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  equippedTag: {
    ...typography.label,
    fontSize: 9,
    color: colors.success,
  },
  cardDescription: {
    ...typography.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 2,
  },
  metaChip: {
    ...typography.label,
    fontSize: 9,
    color: colors.textMuted,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  error: {
    ...typography.body,
    fontSize: 13,
    color: colors.warningRed,
    textAlign: 'center',
  },
  actions: { gap: 10 },
});
