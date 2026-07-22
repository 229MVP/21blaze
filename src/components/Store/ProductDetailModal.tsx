import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../buttons/BlazeButton';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';

type ProductDetailModalProps = {
  visible: boolean;
  title: string;
  description: string;
  includedItems?: string[];
  priceLabel: string;
  primaryLabel: string;
  onPrimary: () => void;
  onClose: () => void;
  loading?: boolean;
  disabled?: boolean;
  footnote?: string;
};

export function ProductDetailModal({
  visible,
  title,
  description,
  includedItems = [],
  priceLabel,
  primaryLabel,
  onPrimary,
  onClose,
  loading = false,
  disabled = false,
  footnote,
}: ProductDetailModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>PREVIEW</Text>
          </View>
          <Text style={styles.body}>{description}</Text>
          {includedItems.length > 0 ? (
            <View style={styles.included}>
              <Text style={styles.includedTitle}>INCLUDED</Text>
              {includedItems.map((item) => (
                <Text key={item} style={styles.includedItem}>
                  • {item}
                </Text>
              ))}
            </View>
          ) : null}
          <Text style={styles.price}>{priceLabel}</Text>
          {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
          <BlazeButton
            title={primaryLabel}
            onPress={onPrimary}
            loading={loading}
            disabled={disabled || loading}
            fullWidth
          />
          <BlazeButton title="CLOSE" variant="outline" onPress={onClose} fullWidth />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.md,
  },
  sheet: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.blazeSubtle,
    backgroundColor: colors.backgroundElevated,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.primary,
    textAlign: 'center',
  },
  preview: {
    minHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  body: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  included: { gap: 4 },
  includedTitle: {
    fontFamily: fontFamilies.bodyBold,
    color: colors.gold,
    letterSpacing: 1,
  },
  includedItem: {
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
  },
  price: {
    fontFamily: fontFamilies.display,
    fontSize: 22,
    color: colors.gold,
    textAlign: 'center',
  },
  footnote: {
    ...typography.label,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
