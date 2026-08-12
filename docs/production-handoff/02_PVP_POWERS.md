# PvP Powers — Launch Specification

Players unlock powers through progression, equip three before matchmaking, and activate them with Blaze energy earned during the match. Ranked powers have fixed strength. Cosmetics may change their appearance but never their outcome.

## Global rules

- A player cannot equip duplicate powers.
- A power intent includes `powerId`, `target`, `clientActionId`, and `expectedRevision`.
- Server validates ownership, loadout, cost, cooldown, target, match phase, immunity, and revision.
- Activation spends energy only after validation succeeds.
- Unless stated otherwise, the same status refreshes duration but does not stack magnitude.
- Shield resolves before immunity. Cleanse resolves statuses in oldest-first order.
- Powers cannot affect hidden information retroactively.
- During the final 3 seconds, new hostile powers are disabled; defensive and self-targeted powers remain legal.

## Launch powers

| Power | Cost | Cooldown | Target | Effect | Primary counter |
|---|---:|---:|---|---|---|
| Ember Shield | 35 | 12s | Self | Blocks the next hostile power for 10s. Unused shield expires. | Opponent can bait it with a low-cost attack. |
| Frost Lock | 45 | 16s | Opponent lane | Locks one open lane for 5s. Existing cards remain. | Ember Shield or Cleanse. |
| Swap Spark | 30 | 10s | Two own lanes | Swaps the newest card in each selected non-empty lane. | No hostile counter; requires legal resulting states. |
| Scorch Mark | 40 | 14s | Opponent lane | Adds +3 temporary heat to effective total for 6s. Heat can create a temporary bust. | Ember Shield, Cleanse, or wait for expiry. |
| Wild Shift | 50 | 18s | Current card | Before placement, changes the current card to a selected value from 1–10; suit remains. | Telegraph is visible; no direct counter. |
| Redirect | 55 | 20s | Opponent | Opponent's next card must be placed into one server-selected legal lane, shown immediately. Expires after 8s. | Ember Shield or Cleanse before placement. |
| Cleanse | 30 | 12s | Self lane/player | Removes Frost Lock, Scorch Mark, or Redirect. Removes one oldest hostile status per activation. | Timing and energy pressure. |
| Double Blaze | 60 | 24s | Self | Doubles the next exact-21 bonus earned within 10s; does not double base lane points or five-card bonus. | Opponent pressure; expires if not triggered. |

## Target restrictions

- Frost Lock cannot target a full lane, a busted lane, or the same lane already locked by Frost Lock.
- Swap Spark requires two different lanes with at least one card each. Only the newest cards move. The server recalculates Aces and scores after the atomic swap.
- Scorch Mark does not alter the printed card values and disappears from final scoring if its timer expires before match end. If the match ends while active, it counts at that instant.
- Wild Shift must be activated while a current card is revealed and at least 750 ms remain on its placement clock.
- Redirect selects among legal opponent lanes using the deterministic match RNG. If that lane becomes illegal before placement, the server reselects from remaining legal lanes.
- Double Blaze is consumed only by an exact-21 event.

## Recommended unlock order

1. Ember Shield — tutorial reward.
2. Swap Spark — player level 3.
3. Cleanse — level 5.
4. Frost Lock — level 7.
5. Scorch Mark — level 9.
6. Wild Shift — level 12.
7. Redirect — level 16.
8. Double Blaze — level 20.

All powers are available in a standardized training sandbox before unlock. Private unranked rooms can optionally enable “all powers.”

## Power UI states

Every power button requires: `locked`, `ready`, `selected`, `targeting`, `insufficient_energy`, `cooldown`, `blocked`, `activated`, and `disabled_final_seconds`.

Each state needs a visible icon treatment, accessible label, numeric energy cost, cooldown progress, and non-color indicator. Hostile effects require an opponent-origin trail and a status badge on the affected lane or player.

## Balance telemetry

Track pick rate, activation rate, success rate, score swing, win rate with power equipped, win rate when activated, average energy at activation, counter rate, and abandonment after activation. Review any power outside 47–53% normalized win rate after sufficient sample size.
