import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  getAppEnv,
  isPurchaseDiagnosticsEnabled,
  isStorePurchasesEnabled,
} from '../config/featureFlags';
import {
  RC_OFFERING_ID,
  RC_PACKAGE_IDS,
  RC_PRODUCTS,
} from '../monetization/productIds.pure';
import { loadOfferings, refreshCustomerInfo } from '../monetization/purchaseService';
import {
  getRevenueCatApiKey,
  isNativePurchasesSupported,
  wasPurchasesConfigured,
} from '../monetization/revenueCatClient';
import type { PurchaseDiagnosticsScreenProps } from '../navigation/navigationTypes';
import { useAuthStore } from '../store/useAuthStore';
import { usePurchaseStore } from '../store/usePurchaseStore';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { fontFamilies } from '../theme/typography';

type DiagnosticsSnapshot = {
  appEnv: string;
  revenueCatConfigured: boolean;
  apiKeyPresent: boolean;
  /** true when key looks like RevenueCat Test Store (test_…) — never shows the key. */
  testStoreKeyDetected: boolean;
  nativeSupported: boolean;
  storePurchasesEnabled: boolean;
  offeringFound: boolean;
  offeringId: string | null;
  packageIdentifiers: string[];
  productIdentifiers: string[];
  activeEntitlements: string[];
  lastPurchaseError: string | null;
  expectedPackages: string[];
  expectedProducts: string[];
};

/**
 * Development / preview only. Never shows receipts, tokens, webhook secrets,
 * service-role keys, or full customer payloads.
 */
export function PurchaseDiagnosticsScreen({
  navigation,
}: PurchaseDiagnosticsScreenProps) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const error = usePurchaseStore((state) => state.error);
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isPurchaseDiagnosticsEnabled()) {
      return;
    }
    setBusy(true);
    try {
      const offerings = userId ? await loadOfferings(userId) : null;
      const customer = userId ? await refreshCustomerInfo(userId) : null;
      const apiKey = getRevenueCatApiKey();
      setSnapshot({
        appEnv: getAppEnv(),
        revenueCatConfigured: wasPurchasesConfigured(),
        apiKeyPresent: Boolean(apiKey),
        testStoreKeyDetected: Boolean(apiKey?.startsWith('test_')),
        nativeSupported: isNativePurchasesSupported(),
        storePurchasesEnabled: isStorePurchasesEnabled(),
        offeringFound: Boolean(offerings),
        offeringId: offerings?.identifier ?? null,
        packageIdentifiers: offerings?.packages.map((pkg) => pkg.identifier) ?? [],
        productIdentifiers: offerings?.packages.map((pkg) => pkg.productId) ?? [],
        activeEntitlements: customer
          ? [...customer.active]
          : usePurchaseStore.getState().serverEntitlements,
        lastPurchaseError: error,
        expectedPackages: Object.values(RC_PACKAGE_IDS),
        expectedProducts: Object.values(RC_PRODUCTS),
      });
    } finally {
      setBusy(false);
    }
  }, [error, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!isPurchaseDiagnosticsEnabled()) {
    return (
      <ScreenContainer style={styles.container} intensity="subtle">
        <ScreenHeader title="DIAGNOSTICS" />
        <Text style={styles.body}>
          Purchase diagnostics are disabled in production builds.
        </Text>
        <BlazeButton title="BACK" onPress={() => navigation.goBack()} fullWidth />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container} intensity="subtle" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="PURCHASE DIAGNOSTICS" />
        <Text style={styles.warning}>
          Dev/preview only. No receipts, tokens, or secrets are shown.
        </Text>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Row label="Platform" value={Platform.OS} />
          <Row label="App env" value={snapshot?.appEnv ?? '—'} />
          <Row
            label="RevenueCat configured"
            value={String(snapshot?.revenueCatConfigured ?? false)}
          />
          <Row
            label="API key present"
            value={String(snapshot?.apiKeyPresent ?? false)}
          />
          <Row
            label="Test Store environment"
            value={
              snapshot?.testStoreKeyDetected
                ? 'Test Store key detected (test_…)'
                : snapshot?.apiKeyPresent
                  ? 'Non-test key present (not displaying value)'
                  : 'No key'
            }
          />
          <Row
            label="Native purchases supported"
            value={String(snapshot?.nativeSupported ?? false)}
          />
          <Row
            label="Store purchases enabled"
            value={String(snapshot?.storePurchasesEnabled ?? false)}
          />
          <Row
            label="Current Offering found"
            value={String(snapshot?.offeringFound ?? false)}
          />
          <Row
            label="Offering id"
            value={snapshot?.offeringId ?? `(expected ${RC_OFFERING_ID})`}
          />
          <Row
            label="Package identifiers found"
            value={(snapshot?.packageIdentifiers ?? []).join(', ') || 'none'}
          />
          <Row
            label="Expected packages"
            value={(snapshot?.expectedPackages ?? []).join(', ')}
          />
          <Row
            label="Store product availability"
            value={(snapshot?.productIdentifiers ?? []).join(', ') || 'none'}
          />
          <Row
            label="Expected products"
            value={(snapshot?.expectedProducts ?? []).join(', ')}
          />
          <Row
            label="Active entitlement identifiers"
            value={(snapshot?.activeEntitlements ?? []).join(', ') || 'none'}
          />
          <Row
            label="Last purchase error"
            value={snapshot?.lastPurchaseError ?? 'none'}
          />
        </ScrollView>
        <View style={styles.actions}>
          <BlazeButton
            title={busy ? 'REFRESHING…' : 'REFRESH'}
            onPress={() => {
              void refresh();
            }}
            loading={busy}
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
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  padded: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  warning: {
    fontFamily: fontFamilies.body,
    color: colors.gold,
    fontSize: 13,
  },
  body: {
    fontFamily: fontFamilies.body,
    color: colors.textSecondary,
    marginVertical: spacing.lg,
  },
  scroll: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.25)',
    gap: 4,
  },
  label: {
    fontFamily: fontFamilies.display,
    color: colors.primary,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  value: {
    fontFamily: fontFamilies.body,
    color: colors.textPrimary,
    fontSize: 13,
  },
  actions: {
    gap: spacing.sm,
  },
});
