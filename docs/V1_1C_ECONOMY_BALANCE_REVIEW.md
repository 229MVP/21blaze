# Version 1.1C Economy Balance Review

**This document is analysis and recommendations only. No economy values
were changed by Version 1.1C.** All coin costs and earning amounts below
are the values already live in Version 1.1A/1.1B
(`supabase/migrations/0008_v1_1_rewards_economy.sql`,
`src/config/economyConfig.ts`, `src/progression/rewards.ts`,
`src/cosmetics/lockerCatalog.ts`). The repository has no "approved remote
economy configuration" mechanism (no remote-config table/flag for these
amounts), so per the Version 1.1C instructions, no values are implemented
here — only reviewed.

## Inputs used

**Cosmetic prices** (`src/cosmetics/lockerCatalog.ts`):

| Cosmetic | Cost |
|---|---|
| Ember Card Back | 150 |
| Gold Lane Glow | 250 |
| Midnight Card Style | 350 |
| Flame Profile Frame | 400 |
| Lava Arena | 500 |
| **Total (all five)** | **1,650** |

**Earning sources** (all server-authoritative; see
`docs/V1_1_REWARDS_SPEC.md` / `docs/V1_1B_COSMETIC_CATALOG.md`):

| Source | Amount | Cap |
|---|---|---|
| Completed Solo match | 10 coins | none (scales with matches played) |
| First Solo match of the UTC day | +20 bonus | once/day |
| Active completed play | 1 coin/minute | 20 coins/day (10 fully-active 2-minute matches) |
| Daily missions (3/day) | 25 + 35 + 50 = 110 coins | once/day, requires completing all 3 |
| Daily streak (7-day cycle) | 20 → 25 → 30 → 40 → 50 → 60 → 100 | once/day, cycle average ≈ 46.4/day |
| Verified rewarded ad | 25 coins | 3/day = 75 coins/day (currently **disabled** in production — see `docs/V1_1C_REWARDED_SSV.md`) |

A completed Solo match is `GAME_DURATION_SECONDS = 120` seconds, so a
single fully-active match yields at most 2 active-time coins.

## Days to first cosmetic

**Casual player** — plays exactly one fully-active Solo match per day,
does not engage with missions or the daily streak:

- Daily income: 10 (match) + 20 (first-of-day) + 2 (active time) = **32 coins/day**
- Days to the cheapest cosmetic (Ember Card Back, 150): `150 / 32 ≈ 4.7` → **~5 days**

**Active player** — plays 10 Solo matches/day (reaching the active-time
cap), completes and claims all 3 daily missions, and maintains the 7-day
streak (using the cycle's average daily coin value):

- Match coins: first match 30 (10+20) + 9 more × 10 = 120
- Active time: capped at 20
- Missions: 110
- Streak: ≈ 46 (325 total ÷ 7 days)
- Daily income: **≈ 296 coins/day**
- Days to the cheapest cosmetic: **same day** (well over the 150 threshold from a single day's play)

## Days to unlock all five cosmetics (1,650 coins total)

| Player profile | Daily income | Days to all five |
|---|---|---|
| Casual (1 match/day, no missions/streak) | 32 | `1650 / 32 ≈ 51.6` → **~52 days** |
| Active (10 matches/day + missions + streak) | 296 | `1650 / 296 ≈ 5.6` → **~6 days** |

The ~9x spread between casual and active pacing indicates the economy
rewards engagement with missions and the streak far more than raw match
volume — missions + streak alone account for ≈156 of the active player's
296 daily coins (53%), versus only 32 coins/day available to a player who
never touches those systems. This looks intentional (it is the retention
lever the milestone is designed to create) but is worth confirming against
design intent.

## Maximum theoretical daily earning

Treating only the **capped** sources (excluding open-ended match-volume
income, which scales indefinitely with time played):

| Capped source | Max/day |
|---|---|
| First-of-day match bonus | 20 |
| Active-time cap | 20 |
| Daily missions | 110 |
| Daily streak (Day 7 peak) | 100 |
| Rewarded ads (3×25, if enabled) | 75 |
| **Total capped ceiling (ads disabled, current production state)** | **250** |
| **Total capped ceiling (ads enabled)** | **325** |

On top of this, uncapped match-completion coins (10/match) can add an
arbitrary amount for a player willing to play many matches in one day —
that portion is intentionally not "capped," so it is not included above.

## Do rewarded ads overpower gameplay rewards?

**Finding: yes, disproportionately, if enabled at the current rate.**

- Three rewarded ads take roughly 60–120 seconds of watch time (including
  load/close) for 75 coins — a rate of **≈40–75 coins per minute of
  effort**.
- The best gameplay-driven rate is a completed Solo match: 10 coins per
  ~2-minute match if not the first of the day (**5 coins/minute**), or 30
  coins for the first match of the day (**15 coins/minute** for that one
  match only).
- Missions and the streak are flat, once-daily rewards, not a per-minute
  rate, so they are not directly comparable, but a rewarded ad alone
  (75 coins/day) is worth roughly **68% of a fully-claimed mission day**
  (110 coins) for a fraction of the time and no skill/attention
  requirement.

This does not break the bounded economy (rewarded ads remain capped at
75/day and cannot be repeated indefinitely), but it would meaningfully
reduce the incentive to actually play Solo matches for coins if enabled
at 25 coins × 3/day alongside the current match rewards. This is a
**recommendation for design review, not a blocker** — and moot for the
current TestFlight build, since rewarded-currency grants are disabled in
production pending AdMob SSV verification (see
`docs/V1_1C_REWARDED_SSV.md`).

## Recommendations (not implemented)

1. **If/when rewarded-ad currency ships**, consider either a lower
   per-ad amount (e.g. 10–15 coins) or a lower daily cap (e.g. 2/day) so
   the effective coins-per-minute rate is closer to the first-match-of-day
   rate (~15/minute) rather than 3–5x higher.
2. **Casual pacing** (~52 days for all five cosmetics) may be slower than
   intended for a free-to-play retention hook; if design wants a faster
   casual on-ramp, the cheapest lever is raising the base per-match coin
   amount slightly (e.g. 10 → 12–15), since that is the only source a
   fully casual player reliably touches.
3. **No change is recommended to cosmetic prices** — the current 150–500
   range already scales sensibly with rarity/visual complexity and the
   active-player pacing (~6 days for the full set) feels appropriate for
   a retention feature.

## Explicit non-goal

No values in `supabase/migrations/`, `src/config/economyConfig.ts`,
`src/cosmetics/lockerCatalog.ts`, or `src/progression/rewards.ts` were
changed by this review.
