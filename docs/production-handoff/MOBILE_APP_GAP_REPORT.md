# 21 Blaze production handoff gap report

Review baseline: mobile repository `cursor/v1-5-rc-validation-1a6b` at `b3d1b29`.

## Executive finding

The handoff is a newer product specification, not a drop-in version of the
current Expo application. The current v1.5 Live PvP mode is a 120-second
simultaneous score race. The handoff locks a different 90-second,
server-authoritative, card-by-card match with an eight-second placement clock,
three equipped powers, eight power definitions, and twelve selectable themes.

The two models must not share a rules version or matchmaking pool. Preserve the
tested v1.5 mode while the new `production-v1` engine and backend are built and
validated behind a separate feature flag.

## Merged source material

- All production specifications and acceptance criteria under
  `docs/production-handoff/`.
- Machine-readable analytics, powers, and gameplay contracts under
  `src/productionContracts/`.
- Twelve approved 853x1844 theme source images under
  `assets/themes/production/`.

The web prototype runtime, generated web build, browser device chrome, and
Cloudflare worker were intentionally not copied into the React Native app.

## P0 — playable foundation

Implemented already: deterministic 52-card deck, four lanes, Ace handling,
Solo Play, timers, scoring, replay checks, tutorial/help, settings, audio and
haptics.

Gaps against the handoff:

- Existing lane behavior clears lanes at 21/five cards instead of keeping four
  final five-card lanes.
- Existing standard timer is 120 seconds, not the locked 90 seconds.
- No eight-second per-card placement deadline or Auto-Route.
- Existing score and streak formula differs from `production-v1`.
- Twelve approved themes are not registered in the native theme selector.
- A versioned replay fixture suite for the new rules is required.

## P1 — multiplayer vertical slice

Implemented already: Supabase auth/profile foundation, private Realtime
channels, participant authorization, snapshots, idempotent progress, reconnect
checkpoints, forfeits, results, rematches, and a server kill switch.

Gaps:

- The server currently issues a shared deck seed but clients play locally and
  submit progress/results. The new contract requires every card placement and
  score mutation to be server-authoritative.
- No authoritative action revision API matching `ClientIntent`.
- No 20-second disconnect-forfeit state machine matching the new rules.
- Ember Shield and Frost Lock are not implemented.

## P2 — complete PvP

Existing quick/ranked/async systems provide useful foundations but do not meet
the new contract. Missing: casual queue for the new rules, all eight powers,
three-power loadouts, training sandbox, friends/block/report, seasonal ranking
for the new mode, and production live configuration.

## P3 — presentation and retention

Progression, missions, daily challenge, cosmetics foundations, ads, purchases,
notifications, effects, audio, and haptics exist behind flags. Missing or not
complete against the handoff: twelve native themes, power effects/status UI,
achievement/friends surfaces, verified production purchases, push delivery,
and full bottom-navigation information architecture.

## P4 — release

Automated v1.5 suites pass and Live PvP-specific Supabase security has no error
advisor finding. Still required for the new product contract: VoiceOver and
TalkBack pass, localization, two-device/network matrix, power balance tests,
load/soak tests, production monitoring, legal/store disclosures, store assets,
closed beta, and staged release.

## Safe implementation sequence

1. Add `production-v1` deterministic engine and fixtures alongside the legacy
   engine; do not change current matchmaking.
2. Connect a new practice mode to it behind a client flag.
3. Add a new versioned authoritative match schema/RPC surface.
4. Implement two powers, run two-device vertical-slice QA, then add six more.
5. Register the twelve themes using native assets and accessible shared game
   semantics.
6. Only retire the v1.5 race protocol after migration and production approval.

