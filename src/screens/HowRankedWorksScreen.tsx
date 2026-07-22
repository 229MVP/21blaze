import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BlazeButton } from '../components/buttons/BlazeButton';
import { ScreenHeader } from '../components/Navigation/ScreenHeader';
import { ScreenContainer } from '../components/ScreenContainer';
import { RANKED_DIVISIONS } from '../ranked/divisions';
import type { HowRankedWorksScreenProps } from '../navigation/navigationTypes';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamilies, typography } from '../theme/typography';

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: 'Placement matches',
    body: 'New ranked players play five placement matches. Your hidden rating starts at 1200. Division and rating are revealed only after the fifth completed placement.',
  },
  {
    title: 'Same deck, fair fight',
    body: 'Both players receive the same server-generated deck seed and play on independent boards for 120 seconds. Highest verified score wins.',
  },
  {
    title: 'Server-verified results',
    body: 'Official outcomes come from server replay of your move log. Client scores are never authoritative.',
  },
  {
    title: 'Rating gains and losses',
    body: 'After placements, wins and losses adjust your Elo-style rating. Stronger opponents yield larger gains. Draws split the result. Ratings never fall below 100.',
  },
  {
    title: 'Disconnects and forfeits',
    body: 'Leaving after the match has started counts as a ranked loss. Declining or timing out before the synchronized start does not change rating.',
  },
  {
    title: 'Seasons',
    body: 'Ranked progress lives inside seasons. Future seasons may soft-reset ratings toward 1200. The beta season stays active for this release.',
  },
  {
    title: 'No paid advantages',
    body: 'There are no entry fees, cash prizes, purchasable rating protection, or paid ranked retries. Skill and verified play decide results.',
  },
];

export function HowRankedWorksScreen({ navigation }: HowRankedWorksScreenProps) {
  return (
    <ScreenContainer style={styles.container} intensity="normal" padded={false}>
      <View style={styles.padded}>
        <ScreenHeader title="HOW RANKED WORKS" />
        <ScrollView contentContainerStyle={styles.content}>
          {SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.title}>{section.title.toUpperCase()}</Text>
              <Text style={styles.body}>{section.body}</Text>
            </View>
          ))}

          <View style={styles.section}>
            <Text style={styles.title}>DIVISIONS</Text>
            {RANKED_DIVISIONS.filter((division) => division.key !== 'unranked').map(
              (division) => (
                <Text key={division.key} style={styles.divisionLine}>
                  {division.displayName}
                  {': '}
                  {division.maximumRating === null
                    ? `${division.minimumRating}+`
                    : `${division.minimumRating}–${division.maximumRating}`}
                </Text>
              ),
            )}
          </View>
        </ScrollView>
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
    gap: spacing.sm,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  section: {
    gap: 6,
  },
  title: {
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 1.1,
    color: colors.gold,
  },
  body: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  divisionLine: {
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
  },
});
