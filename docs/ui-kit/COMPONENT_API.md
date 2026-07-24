
# Component API

## PlayingCard
```tsx
<PlayingCard rank="Q" suit="hearts" size="large" accessibilityLabel="Queen of Hearts" />
```
Props: `rank`, `suit`, `size`, `faceDown`, `disabled`, `selected`, `highlighted`, `accessibilityLabel`.

## LaneBox
```tsx
<LaneBox laneNumber={1} total={18} cards={[{ rank: '8', suit: 'hearts' }, { rank: 'Q', suit: 'hearts' }]} onPress={() => selectLane(1)} />
```
Props: lane data, interaction state, `maxCards`, and accessibility hint.

## BlazeButton
```tsx
<BlazeButton label="PLAY" variant="primary" onPress={startGame} />
```
Variants: primary, secondary, danger, ghost, disabled.

## StatCounterRow
Pass four `StatItem` records for Score, Multiplier, Busts, and Cards.

## BlazeStreak
`current`, `maximum`, `compact`, `animateChanges`, `label`.

## LanesGrid
Pass four `LaneData` items and an optional `onSelect` callback.

## PauseModal / ConfirmationModal
Controlled `visible` props and independent callbacks. No navigation logic is embedded.

## LeaderboardTable
Pass normalized entries. It is FlatList-compatible and includes loading/empty states.

## ResultsTable / ResultHero
All values are props; no hardcoded game state.

## BlazeScreenBackground
Variants: home, gameplay, plain, dramatic. Decorative embers are optional.
