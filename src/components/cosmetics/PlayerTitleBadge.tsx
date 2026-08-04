import { StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  emphasized?: boolean;
};

/**
 * Version 1.1B "Blaze Locker" — small orange-gold player title badge shown
 * below the player name. Never implies staff/moderator/administrator
 * status; purely cosmetic.
 */
export function PlayerTitleBadge({ label, emphasized = false }: Props) {
  return (
    <View
      style={[styles.badge, emphasized && styles.badgeEmphasized]}
      accessibilityRole="text"
      accessibilityLabel={`Player title: ${label}`}
    >
      <Text style={styles.text} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,182,41,0.55)',
    backgroundColor: 'rgba(255,101,0,0.14)',
  },
  badgeEmphasized: {
    borderColor: 'rgba(255,182,41,0.85)',
    backgroundColor: 'rgba(255,101,0,0.22)',
  },
  text: {
    color: '#FFD24A',
    fontFamily: 'RobotoCondensed_700Bold',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.8,
  },
});
