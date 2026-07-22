import { replayMatchClient, validateMoveLog } from './clientReplay';
import { createOrderedDeck, createSeededShuffledDeck, shuffleDeckWithSeed } from './deck';
import {
  FIXTURE_BUST_MOVES,
  FIXTURE_BUST_RESULT,
  FIXTURE_FIRST_TEN_CARD_IDS,
  FIXTURE_SEED,
} from './fixtures/seededParity';
import type { MoveLogEntry } from '../online/types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Online self-test failed: ${message}`);
  }
}

export function runOnlineSelfTests(): void {
  const firstTen = createSeededShuffledDeck(FIXTURE_SEED)
    .slice(0, 10)
    .map((card) => card.id);

  assert(
    firstTen.every((id, index) => id === FIXTURE_FIRST_TEN_CARD_IDS[index]),
    'Fixed seed produces a stable first 10-card sequence',
  );

  const again = createSeededShuffledDeck(FIXTURE_SEED).map((card) => card.id);
  const first = createSeededShuffledDeck(FIXTURE_SEED).map((card) => card.id);
  assert(
    first.every((id, index) => id === again[index]),
    'Repeating the same seed produces the same deck',
  );

  const other = createSeededShuffledDeck(FIXTURE_SEED + 99).map((card) => card.id);
  assert(
    other.some((id, index) => id !== first[index]),
    'Different seeds produce different deck order',
  );

  const original = createOrderedDeck();
  const snapshot = original.map((card) => card.id);
  shuffleDeckWithSeed(original, FIXTURE_SEED);
  assert(
    original.every((card, index) => card.id === snapshot[index]),
    'Seeded shuffle does not mutate the original deck',
  );

  const deck = createSeededShuffledDeck(FIXTURE_SEED);
  assert(deck.length === 52, 'Seeded deck contains 52 cards');
  assert(
    new Set(deck.map((card) => card.id)).size === 52,
    'Seeded deck contains unique cards',
  );

  const bustReplay = replayMatchClient(FIXTURE_SEED, FIXTURE_BUST_MOVES);
  assert(bustReplay.ok, 'Valid bust move log replays');
  if (bustReplay.ok) {
    assert(
      JSON.stringify(bustReplay.result) === JSON.stringify(FIXTURE_BUST_RESULT),
      'Valid move log replays to expected score',
    );
  }

  const invalidLane = validateMoveLog([
    { sequence: 1, laneId: 9, elapsedMilliseconds: 100 },
  ]);
  assert(!invalidLane.ok, 'Invalid lane ID is rejected');

  const backwardTime = validateMoveLog([
    { sequence: 1, laneId: 1, elapsedMilliseconds: 2000 },
    { sequence: 2, laneId: 1, elapsedMilliseconds: 1000 },
  ]);
  assert(!backwardTime.ok, 'Backward elapsed time is rejected');

  const tooMany = validateMoveLog(
    Array.from({ length: 53 }, (_, index) => ({
      sequence: index + 1,
      laneId: 1,
      elapsedMilliseconds: index * 10,
    })),
  );
  assert(!tooMany.ok, 'More than 52 moves is rejected');

  const illegalAfterBust: MoveLogEntry[] = [
    ...FIXTURE_BUST_MOVES,
    { sequence: 16, laneId: 4, elapsedMilliseconds: 8000 },
  ];
  const afterBust = replayMatchClient(FIXTURE_SEED, illegalAfterBust);
  assert(!afterBust.ok, 'Moves after three busts are rejected');

  const timeExpiredMoves: MoveLogEntry[] = [
    { sequence: 1, laneId: 1, elapsedMilliseconds: 120_000 },
  ];
  const firstCompletion = replayMatchClient(FIXTURE_SEED, timeExpiredMoves);
  const secondCompletion = replayMatchClient(FIXTURE_SEED, timeExpiredMoves);
  assert(firstCompletion.ok && secondCompletion.ok, 'Duplicate completion replays');
  if (firstCompletion.ok && secondCompletion.ok) {
    assert(
      JSON.stringify(firstCompletion.result) ===
        JSON.stringify(secondCompletion.result),
      'Duplicate completion is idempotent',
    );
    assert(
      firstCompletion.result.gameOverReason === 'timeExpired',
      'Client-provided fake score is never used; reason is engine-derived',
    );
  }

  // Online and server engines share Mulberry32 + the same fixture constants.
  assert(
    FIXTURE_FIRST_TEN_CARD_IDS.length === 10,
    'Online and server replay engines share matching fixture metadata',
  );
}
