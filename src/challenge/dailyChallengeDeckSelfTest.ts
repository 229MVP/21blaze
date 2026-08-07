import { RANKS, SUITS } from '../game/constants';
import { createOrderedDeck } from '../game/deck';
import { createDailyChallengeDeck } from '../game/challenge/createDailyChallengeDeck';
import { deriveAuthoritativeSeed } from '../challenge/seedDerivation';
import { hashDailyChallengeDeckOrder } from '../challenge/dailyChallengeDeckHash';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Daily Challenge deck self-test failed: ${message}`);
  }
}

function countCards(deck: { id: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of deck) {
    counts.set(card.id, (counts.get(card.id) ?? 0) + 1);
  }
  return counts;
}

export function runDailyChallengeDeckSelfTests(): void {
  const dateA = '2026-08-05';
  const dateB = '2026-08-06';
  const seedA = deriveAuthoritativeSeed(dateA);
  const seedB = deriveAuthoritativeSeed(dateB);

  const ordered = createOrderedDeck();
  const orderedSnapshot = ordered.map((card) => card.id);

  const deckA1 = createDailyChallengeDeck(seedA);
  const deckA2 = createDailyChallengeDeck(seedA);
  const deckB = createDailyChallengeDeck(seedB);

  const idsA1 = deckA1.map((card) => card.id);
  const idsA2 = deckA2.map((card) => card.id);
  const idsB = deckB.map((card) => card.id);

  assert(idsA1.every((id, index) => id === idsA2[index]), 'same seed produces identical card order');
  assert(idsB.some((id, index) => id !== idsA1[index]), 'different seed produces different order');
  assert(deckA1.length === 52, 'full deck contains 52 cards');

  const expectedIds = new Set<string>();
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      expectedIds.add(`${rank}-${suit}`);
    }
  }

  const countsA = countCards(deckA1);
  assert(countsA.size === 52, 'no card disappears');
  for (const expectedId of expectedIds) {
    assert(countsA.get(expectedId) === 1, `expected one copy of ${expectedId}`);
  }
  assert(
    [...countsA.values()].every((count) => count === 1),
    'no card duplicates unexpectedly',
  );

  const orderedAfter = createOrderedDeck().map((card) => card.id);
  assert(
    orderedAfter.every((id, index) => id === orderedSnapshot[index]),
    'canonical ordered deck is not mutated',
  );

  const run1 = hashDailyChallengeDeckOrder(idsA1);
  const run2 = hashDailyChallengeDeckOrder(
    createDailyChallengeDeck(seedA).map((card) => card.id),
  );
  assert(run1 === run2, 'repeated runs produce identical deck hash');

  const source = createDailyChallengeDeck.toString();
  assert(!source.includes('Math.random'), 'official deck helper does not reference Math.random');
  assert(
    source.includes('shuffleDeckWithSeed'),
    'official deck helper uses deterministic shuffleDeckWithSeed',
  );
}

void (async () => {
  runDailyChallengeDeckSelfTests();
  console.log('Daily Challenge deck self-tests passed.');
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
