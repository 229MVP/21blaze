import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isVictoryEffectsEnabled } from '../../config/featureFlags';
import { EMBER_COLLECTION_PIECES } from '../../themes/emberBlazeTheme';
import { getLockerCatalogEntry, tabForCosmeticType, type LockerTab } from '../../cosmetics/lockerCatalog';
import { trackEvent } from '../../monetization/analytics';
import { useCosmeticStore } from '../../store/useCosmeticStore';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';
import { CosmeticPreview } from './CosmeticPreview';
import { ThemedVictoryEffect } from '../themes/ThemedVictoryEffect';

type Props = {
  onSelectTab: (tab: LockerTab) => void;
};

/**
 * Version 1.2B — read-only "EMBER BLAZE COLLECTION" showcase for the top
 * of the Locker. Shows the five coordinated pieces using the same real,
 * reusable preview components as the cosmetic cards below (never a
 * screenshot) plus a live owned-count derived from the real wallet/
 * ownership store — never a fabricated number.
 *
 * Explicitly NOT a purchase surface: no price, no bundle-purchase or
 * limited-time-value copy, no RevenueCat paywall, no restore-purchases
 * affordance.
 * Tapping a piece only jumps to the Locker tab where it can be earned
 * with Blaze Coins or the daily streak exactly as today. The optional
 * effect preview requires an explicit tap, plays once, and is hidden
 * entirely when victory effects are disabled or Reduced Motion is on
 * (handled inside `ThemedVictoryEffect` itself).
 */
export function EmberCollectionPreview({ onSelectTab }: Props) {
  const owned = useCosmeticStore((state) => state.ownedCosmetics);
  const [previewTrigger, setPreviewTrigger] = useState<'standardWin' | null>(null);

  const ownedCount = EMBER_COLLECTION_PIECES.filter((piece) => owned.includes(piece.cosmeticId)).length;
  const total = EMBER_COLLECTION_PIECES.length;

  const onPreviewEffects = () => {
    trackEvent('cosmetic_preview_started', { cosmeticId: 'ember_blaze', cosmeticType: 'collection' });
    setPreviewTrigger('standardWin');
    // ThemedVictoryEffect's own duration constants remove the burst
    // automatically; this local reset only clears React state so a
    // second tap can re-trigger the same preview.
    setTimeout(() => setPreviewTrigger(null), 1600);
  };

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel="Ember Blaze Collection preview">
      <View style={styles.headerRow}>
        <Text style={styles.title}>EMBER BLAZE COLLECTION</Text>
        <Text style={styles.progress} accessibilityLabel={`${ownedCount} of ${total} pieces collected`}>
          {ownedCount}/{total}
        </Text>
      </View>
      <Text style={styles.subtitle}>
        Earn every piece with Blaze Coins or your daily streak. No purchase required.
      </Text>

      <View style={styles.row}>
        {EMBER_COLLECTION_PIECES.map((piece) => {
          const entry = getLockerCatalogEntry(piece.cosmeticId);
          if (!entry) {
            return null;
          }
          const isOwned = owned.includes(piece.cosmeticId);
          return (
            <Pressable
              key={piece.cosmeticId}
              style={styles.piece}
              onPress={() => onSelectTab(tabForCosmeticType(piece.cosmeticType))}
              accessibilityRole="button"
              accessibilityLabel={`${entry.name}, ${isOwned ? 'owned' : 'not yet owned'}. View in Locker.`}
            >
              <View style={styles.swatch}>
                <CosmeticPreview cosmeticId={piece.cosmeticId} cosmeticType={piece.cosmeticType} name={entry.name} />
              </View>
              <Text style={styles.pieceLabel} numberOfLines={1}>
                {entry.name}
              </Text>
              <Text style={[styles.pieceStatus, isOwned && styles.pieceStatusOwned]}>
                {isOwned ? 'OWNED' : 'LOCKED'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isVictoryEffectsEnabled() ? (
        <View style={styles.previewSection}>
          <Pressable
            style={styles.previewButton}
            onPress={onPreviewEffects}
            accessibilityRole="button"
            accessibilityLabel="Preview Ember Blaze board and victory effects"
          >
            <Text style={styles.previewButtonText}>PREVIEW EFFECTS</Text>
          </Pressable>
          <View style={styles.previewSurface}>
            <ThemedVictoryEffect trigger={previewTrigger} themeId="ember_victory_effect" />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.35)',
    backgroundColor: colors.backgroundCard,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 15,
    letterSpacing: 0.8,
    color: colors.gold,
  },
  progress: {
    ...typography.label,
    fontSize: 12,
    color: colors.textSecondary,
  },
  subtitle: {
    ...typography.body,
    fontSize: 11,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  piece: {
    width: 66,
    alignItems: 'center',
    gap: 2,
  },
  swatch: {
    width: 60,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pieceLabel: {
    ...typography.label,
    fontSize: 8,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  pieceStatus: {
    ...typography.label,
    fontSize: 8,
    color: colors.textMuted,
  },
  pieceStatusOwned: {
    color: colors.success,
  },
  previewSection: {
    gap: 6,
    alignItems: 'center',
  },
  previewButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,138,0,0.5)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  previewButtonText: {
    ...typography.label,
    fontSize: 10,
    color: colors.gold,
  },
  previewSurface: {
    width: '100%',
    height: 36,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
