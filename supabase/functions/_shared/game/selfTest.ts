import { createSeededShuffledDeck } from './deck.ts';
import {
  FIXTURE_BUST_MOVES,
  FIXTURE_BUST_RESULT,
  FIXTURE_FIRST_TEN_CARD_IDS,
  FIXTURE_SEED,
} from './fixtures.ts';
import { replayMatch } from './replayMatch.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Server self-test failed: ${message}`);
  }
}

const firstTen = createSeededShuffledDeck(FIXTURE_SEED)
  .slice(0, 10)
  .map((card) => card.id);

assert(
  firstTen.every((id, index) => id === FIXTURE_FIRST_TEN_CARD_IDS[index]),
  'Server seed matches client fixture first-10',
);

const replay = replayMatch(FIXTURE_SEED, [...FIXTURE_BUST_MOVES]);
assert(replay.ok, 'Server bust fixture replays');
if (replay.ok) {
  assert(
    JSON.stringify(replay.result) === JSON.stringify(FIXTURE_BUST_RESULT),
    'Server and client fixture results match',
  );
}

const illegal = replayMatch(FIXTURE_SEED, [
  ...FIXTURE_BUST_MOVES,
  { sequence: 16, laneId: 4, elapsedMilliseconds: 8000 },
]);
assert(!illegal.ok, 'Server rejects moves after three busts');

console.log('Server game self-tests OK');
