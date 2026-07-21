import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontFamilies, typography } from '../../theme/typography';

type ResultsStatRowProps = {
  label: string;
  value: string;
  highlight?: boolean;
  showNewBadge?: boolean;
  isLast?: boolean;
};

export function ResultsStatRow({
  label,
  value,
  highlight = false,
  showNewBadge = false,
  isLast = false,
}: ResultsStatRowProps) {
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueWrap}>
        <Text style={[styles.value, highlight && styles.highlight]}>{value}</Text>
        {showNewBadge ? <Text style={styles.badge}>NEW!</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  label: {
    ...typography.label,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  value: {
    fontFamily: fontFamilies.display,
    fontSize: 14,
    color: colors.textPrimary,
  },
  highlight: {
    color: colors.gold,
  },
  badge: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 9,
    fontWeight: '700',
    backgroundColor: colors.successBadgeBg,
    color: colors.successBadgeText,
    overflow: 'hidden',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
});
