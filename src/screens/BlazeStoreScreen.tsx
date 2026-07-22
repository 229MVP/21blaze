import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ReactNode } from 'react';

import { ProductDetailModal } from '../components/Store/ProductDetailModal';
import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { isMonetizationTestMode, isStorePurchasesEnabled } from '../config/featureFlags';
import { COSMETIC_CATALOG } from '../cosmetics/catalog';
import { findPackageForCatalogId } from '../monetization/purchaseService';
import { STORE_PRODUCTS } from '../monetization/productIds';
import { isNativePurchasesSupported } from '../monetization/revenueCatClient';
import type { BlazeStoreScreenProps } from '../navigation/navigationTypes';
import { useCosmeticStore } from '../store/useCosmeticStore';
import {
  useHasBlazeProEntitlement,
  useHasRemoveAdsEntitlement,
  usePurchaseStore,
} from '../store/usePurchaseStore';
import { useWalletStore } from '../store/useWalletStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

type DetailTarget = {
  id: string;
  title: string;
  description: string;
  included: string[];
  priceLabel: string;
  kind: 'store' | 'coins' | 'owned';
  cosmeticKey?: string;
  category?: string;
};

export function BlazeStoreScreen({ navigation }: BlazeStoreScreenProps) {
  const balance = useWalletStore((state) => state.balance);
  const hydrateWallet = useWalletStore((state) => state.hydrateWallet);
  const owned = useCosmeticStore((state) => state.ownedCosmetics);
  const equipped = useCosmeticStore((state) => state.equippedCosmetics);
  const hydrateCosmetics = useCosmeticStore((state) => state.hydrateCosmetics);
  const equipCosmetic = useCosmeticStore((state) => state.equipCosmetic);
  const purchaseWithCoins = useCosmeticStore((state) => state.purchaseWithCoins);
  const offerings = usePurchaseStore((state) => state.offerings);
  const isLoadingOfferings = usePurchaseStore((state) => state.isLoadingOfferings);
  const activePurchaseProductId = usePurchaseStore(
    (state) => state.activePurchaseProductId,
  );
  const error = usePurchaseStore((state) => state.error);
  const loadOfferings = usePurchaseStore((state) => state.loadOfferings);
  const purchaseProduct = usePurchaseStore((state) => state.purchaseProduct);
  const restore = usePurchaseStore((state) => state.restorePurchases);
  const initializePurchases = usePurchaseStore((state) => state.initializePurchases);
  const presentProPaywall = usePurchaseStore((state) => state.presentProPaywall);
  const paywallStatus = usePurchaseStore((state) => state.paywallStatus);
  const hasRemoveAds = useHasRemoveAdsEntitlement();
  const hasPro = useHasBlazeProEntitlement();

  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void initializePurchases();
    void hydrateWallet();
    void hydrateCosmetics();
    void loadOfferings();
  }, [hydrateCosmetics, hydrateWallet, initializePurchases, loadOfferings]);

  const onRefresh = useCallback(() => {
    void loadOfferings();
    void hydrateWallet();
    void hydrateCosmetics();
  }, [hydrateCosmetics, hydrateWallet, loadOfferings]);

  const priceFor = useCallback(
    (catalogId: string): string => {
      const pkg = findPackageForCatalogId(offerings, catalogId);
      return pkg?.localizedPriceString ?? 'Store price unavailable';
    },
    [offerings],
  );

  const storeEnabled = isStorePurchasesEnabled();
  const nativeOk = isNativePurchasesSupported();
  const coinCosmetics = useMemo(
    () => COSMETIC_CATALOG.filter((item) => item.purchaseSource === 'coins'),
    [],
  );
  const foundersOwned = owned.includes('inferno_cards') && hasRemoveAds;

  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="BLAZE STORE" />
        <View style={styles.headerRow}>
          <Text style={styles.balance}>{balance.toLocaleString()} COINS</Text>
          {hasPro ? <Text style={styles.adFree}>PRO</Text> : null}
          {!hasPro && hasRemoveAds ? <Text style={styles.adFree}>AD-FREE</Text> : null}
        </View>
        {isMonetizationTestMode() ? (
          <Text style={styles.testBadge}>MONETIZATION TEST MODE</Text>
        ) : null}
        <Text style={styles.disclosure}>
          Purchases are optional. Cosmetics and Pro do not affect gameplay fairness.
          Store prices come from the app store. Restore Purchases is available for
          eligible products.
        </Text>

        {!nativeOk || Platform.OS === 'web' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>NATIVE STORE REQUIRED</Text>
            <Text style={styles.noticeBody}>
              In-app purchases and ads require a development build. They are unavailable
              in Expo Go and on web.
            </Text>
          </View>
        ) : null}

        {!storeEnabled ? (
          <Text style={styles.error}>Store purchases are currently disabled.</Text>
        ) : null}

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoadingOfferings}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <Section title="21 BLAZE PRO">
            <View style={styles.proCard}>
              <Text style={styles.proTitle}>
                {hasPro ? 'PRO ACTIVE' : 'UNLOCK 21 BLAZE PRO'}
              </Text>
              <Text style={styles.proBody}>
                Monthly, yearly, or lifetime. Includes ad-free interstitials. Does not
                change cards, ratings, or matchmaking.
              </Text>
              <BlazeButton
                title={hasPro ? 'MANAGE SUBSCRIPTION' : 'VIEW PRO PAYWALL'}
                loading={paywallStatus === 'purchasing' || busy}
                onPress={() => {
                  void (async () => {
                    setBusy(true);
                    if (hasPro) {
                      const status = await usePurchaseStore
                        .getState()
                        .openCustomerCenter();
                      if (status === 'unavailable') {
                        // Fall back to restore / paywall messaging.
                      }
                    } else {
                      await presentProPaywall();
                    }
                    setBusy(false);
                  })();
                }}
                fullWidth
              />
              {!hasPro ? (
                <View style={styles.proPriceRow}>
                  <Text style={styles.proPrice}>
                    Monthly {priceFor('pro_monthly')}
                  </Text>
                  <Text style={styles.proPrice}>
                    Yearly {priceFor('pro_yearly')}
                  </Text>
                  <Text style={styles.proPrice}>
                    Lifetime {priceFor('pro_lifetime')}
                  </Text>
                </View>
              ) : null}
            </View>
          </Section>

          <Section title="FEATURED">
            <StoreRow
              title="Founders Bundle"
              subtitle="Remove Ads + Inferno + Volcano + Founder perks + 2,500 coins"
              price={priceFor('bundle_founders')}
              owned={foundersOwned}
              onPress={() =>
                setDetail({
                  id: 'bundle_founders',
                  title: 'Founders Bundle',
                  description:
                    STORE_PRODUCTS.find((product) => product.id === 'bundle_founders')
                      ?.description ?? '',
                  included: [
                    'Remove Ads',
                    'Inferno Cards',
                    'Volcano Arena',
                    'Founder Frame',
                    'Founder Title',
                    '2,500 Blaze Coins (once)',
                  ],
                  priceLabel: priceFor('bundle_founders'),
                  kind: foundersOwned ? 'owned' : 'store',
                  cosmeticKey: 'inferno_cards',
                  category: 'card_theme',
                })
              }
            />
          </Section>

          <Section title="REMOVE ADS">
            <StoreRow
              title="Remove Ads"
              subtitle="Stops interstitial ads. Optional rewarded ads remain."
              price={priceFor('remove_ads')}
              owned={hasRemoveAds}
              onPress={() =>
                setDetail({
                  id: 'remove_ads',
                  title: 'Remove Ads',
                  description:
                    'Removes interstitial ads. Rewarded ads you choose to watch stay available.',
                  included: ['No interstitial ads'],
                  priceLabel: priceFor('remove_ads'),
                  kind: hasRemoveAds ? 'owned' : 'store',
                })
              }
            />
          </Section>

          <Section title="CARD THEMES">
            {STORE_PRODUCTS.filter((product) => product.category === 'card_theme').map(
              (product) => {
                const cosmeticKey = product.includedCosmetics[0] ?? product.id;
                const isOwned = owned.includes(cosmeticKey);
                return (
                  <StoreRow
                    key={product.id}
                    title={product.displayName}
                    subtitle={product.description}
                    price={priceFor(product.id)}
                    owned={isOwned}
                    equipped={equipped.cardTheme === cosmeticKey}
                    onPress={() =>
                      setDetail({
                        id: product.id,
                        title: product.displayName,
                        description: product.description,
                        included: product.includedCosmetics,
                        priceLabel: priceFor(product.id),
                        kind: isOwned ? 'owned' : 'store',
                        cosmeticKey,
                        category: 'card_theme',
                      })
                    }
                  />
                );
              },
            )}
          </Section>

          <Section title="ARENAS">
            {STORE_PRODUCTS.filter((product) => product.category === 'arena').map(
              (product) => {
                const cosmeticKey = product.includedCosmetics[0] ?? product.id;
                const isOwned = owned.includes(cosmeticKey);
                return (
                  <StoreRow
                    key={product.id}
                    title={product.displayName}
                    subtitle={product.description}
                    price={priceFor(product.id)}
                    owned={isOwned}
                    equipped={equipped.arena === cosmeticKey}
                    onPress={() =>
                      setDetail({
                        id: product.id,
                        title: product.displayName,
                        description: product.description,
                        included: product.includedCosmetics,
                        priceLabel: priceFor(product.id),
                        kind: isOwned ? 'owned' : 'store',
                        cosmeticKey,
                        category: 'arena',
                      })
                    }
                  />
                );
              },
            )}
          </Section>

          <Section title="COIN COSMETICS">
            {coinCosmetics.map((item) => {
              const isOwned = owned.includes(item.key);
              return (
                <StoreRow
                  key={item.key}
                  title={item.displayName}
                  subtitle={item.description}
                  price={`${item.coinPrice?.toLocaleString() ?? '—'} COINS`}
                  owned={isOwned}
                  onPress={() =>
                    setDetail({
                      id: item.key,
                      title: item.displayName,
                      description: item.description,
                      included: [item.displayName],
                      priceLabel: `${item.coinPrice?.toLocaleString()} Blaze Coins`,
                      kind: isOwned ? 'owned' : 'coins',
                      cosmeticKey: item.key,
                      category: item.category,
                    })
                  }
                />
              );
            })}
          </Section>

          {!offerings && !isLoadingOfferings && nativeOk ? (
            <Text style={styles.error}>
              Offerings could not be loaded. Check RevenueCat configuration.
            </Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {isLoadingOfferings ? <ActivityIndicator color={colors.primary} /> : null}
        </ScrollView>

        <View style={styles.actions}>
          <BlazeButton
            title="RESTORE PURCHASES"
            variant="secondary"
            onPress={() => {
              void restore();
            }}
            fullWidth
          />
          <BlazeButton
            title="BACK"
            variant="outline"
            onPress={() => navigation.goBack()}
            fullWidth
          />
        </View>
      </View>

      <ProductDetailModal
        visible={detail !== null}
        title={detail?.title ?? ''}
        description={detail?.description ?? ''}
        includedItems={detail?.included}
        priceLabel={detail?.priceLabel ?? ''}
        primaryLabel={
          detail?.kind === 'owned' ? 'EQUIP' : detail?.kind === 'coins' ? 'UNLOCK' : 'BUY'
        }
        loading={busy || activePurchaseProductId !== null}
        footnote="Cosmetics do not affect gameplay, ratings, or matchmaking."
        onClose={() => setDetail(null)}
        onPrimary={() => {
          if (!detail) {
            return;
          }
          void (async () => {
            setBusy(true);
            try {
              if (detail.kind === 'store') {
                await purchaseProduct(detail.id);
              } else if (detail.kind === 'coins' && detail.cosmeticKey) {
                await purchaseWithCoins(detail.cosmeticKey);
              } else if (
                detail.kind === 'owned' &&
                detail.cosmeticKey &&
                detail.category
              ) {
                await equipCosmetic(detail.cosmeticKey, detail.category);
              }
              setDetail(null);
            } finally {
              setBusy(false);
            }
          })();
        }}
      />
    </ScreenContainer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StoreRow({
  title,
  subtitle,
  price,
  owned,
  equipped,
  onPress,
}: {
  title: string;
  subtitle: string;
  price: string;
  owned?: boolean;
  equipped?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
        <Text style={styles.rowPrice} numberOfLines={2}>
          {owned ? (equipped ? 'EQUIPPED' : 'OWNED') : price}
        </Text>
      </View>
      <BlazeButton
        title={owned ? (equipped ? 'EQUIPPED' : 'EQUIP') : 'VIEW'}
        variant="outline"
        onPress={onPress}
        disabled={Boolean(owned && equipped)}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balance: {
    fontFamily: fontFamilies.display,
    fontSize: 20,
    color: colors.gold,
  },
  adFree: {
    ...typography.label,
    fontSize: 11,
    color: colors.success,
  },
  proCard: {
    borderWidth: 1,
    borderColor: colors.blazeStrong,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.28)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  proTitle: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 15,
    color: colors.gold,
    letterSpacing: 1,
  },
  proBody: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  proPriceRow: {
    gap: 4,
  },
  proPrice: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 12,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  testBadge: {
    ...typography.label,
    fontSize: 10,
    color: colors.brightOrange,
    textAlign: 'center',
  },
  disclosure: {
    ...typography.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
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
    textAlign: 'center',
  },
  noticeBody: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: { flex: 1 },
  listContent: { gap: spacing.md, paddingBottom: spacing.md },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1.2,
    color: colors.primary,
  },
  row: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.backgroundCard,
    padding: spacing.sm,
    gap: 8,
  },
  rowCopy: { gap: 4 },
  rowTitle: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowSubtitle: {
    ...typography.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  rowPrice: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 13,
    color: colors.gold,
  },
  error: {
    ...typography.body,
    fontSize: 13,
    color: colors.warningRed,
    textAlign: 'center',
  },
  actions: { gap: 10 },
});
