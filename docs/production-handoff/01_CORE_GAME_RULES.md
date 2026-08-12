# Core Game Rules

## Objective

Build the highest verified score before the 90-second match clock expires. Players route revealed cards into four independent lanes. Each lane can hold zero to five cards and should finish as close to 21 as possible without exceeding it.

## Deck and fairness

- Standard 52-card deck: Ace through King in four suits.
- Numeric cards use face value. Jack, Queen, and King equal 10. Ace equals 1 or 11, whichever produces the best non-busting lane total; it becomes 1 when 11 would bust.
- The match server creates `seed`, `rulesVersion`, and a deterministic shuffled deck.
- Each player has an independent cursor over an equivalent deterministic sequence. A power may alter a card after reveal, but it never changes the opponent's hidden sequence unless its definition explicitly says so.
- Deck exhaustion reshuffles a second deterministic deck derived from the original seed and cycle number.

## Match format

| Property | Launch value |
|---|---:|
| Players | 2 |
| Lanes per player | 4 |
| Maximum cards per lane | 5 |
| Match clock | 90 seconds |
| Card placement clock | 8 seconds |
| Powers equipped | 3 |
| Starting Blaze energy | 0 |
| Maximum Blaze energy | 100 |
| Reconnect grace | 20 seconds |

The next card is revealed only after the previous card resolves. If the placement timer expires, Auto-Route places the card into the legal lane that maximizes projected base points; if all lanes are full, it safely discards the card with no score and no energy.

## Lane resolution

- A lane is `open` while it has fewer than five cards and is not locked by an effect.
- A lane is `full` at five cards.
- A lane is `blazed` when its effective total is exactly 21.
- A lane is `bust` when its effective total exceeds 21.
- A bust lane may still receive restorative powers where allowed, but it earns no base lane points until restored.
- When all four lanes are full, the player enters Final Blaze and receives no more ordinary cards. Remaining time may still be used for legal powers.

## Score formula

For each non-bust lane:

`baseLaneScore = effectiveTotal × 10`

Bonuses:

| Event | Points | Blaze energy |
|---|---:|---:|
| Place a card | 0 | 3 |
| Reach exactly 21 | +150 | +20 |
| Reach 21 using five cards | +100 additional | +15 additional |
| Five-card lane at 16–20 | +50 | +8 |
| Recover a busted lane | +40 | +8 |
| Complete all four lanes without a bust | +200 | +20 |
| Each unused whole second | +2 | 0 |

Streak multiplier applies to bonus points only. Consecutive non-busting placements build the streak: 3 placements = ×2, 6 = ×3, 10 = ×4 maximum. A bust resets the streak to ×1.

Final score:

`sum(baseLaneScore) + sum(bonusPoints × multiplierAtAward) + timeBonus`

## Win and tie-breakers

1. Higher verified score.
2. More lanes exactly at 21.
3. Fewer busted lanes.
4. More remaining milliseconds.
5. Deterministic sudden-death card: both players receive the same card and have five seconds to place it; repeat until the verified score differs.

## Validity rules

- A card may enter only one legal lane.
- A sixth card can never be placed in a lane.
- Clients send intents, never authoritative score or deck results.
- Each accepted action increments the match revision.
- Duplicate or stale actions are idempotently rejected.
- All random choices are reproducible from seed, cycle, action number, and rules version.

## Game modes

- `tutorial`: guided, no rewards, powers introduced gradually.
- `practice`: AI or solo, no rank changes, normal progression XP at 50%.
- `casual_pvp`: skill-based matchmaking without rank loss.
- `ranked_pvp`: full server authority, seasonal rating changes.
- `private_duel`: invite code, no rank changes.
- `daily_blaze`: identical daily seed, score leaderboard, one ranked attempt and unlimited practice attempts.
