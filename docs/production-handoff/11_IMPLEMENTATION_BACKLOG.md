# Implementation Backlog

## P0 — Playable foundation

- Extract deterministic TypeScript game engine independent of React Native.
- Implement deck, Ace evaluation, four lanes, five-card limit, timers, Auto-Route, score, streaks, and match result.
- Build fixture generator and unit tests.
- Connect existing twelve-theme gameplay UI to engine state.
- Complete tutorial and practice mode.
- Add settings for audio, haptics, graphics, motion, flash, and accessibility.

## P1 — Multiplayer vertical slice

- Supabase Auth/profile/settings.
- Server-authoritative private room and two-client synchronization.
- Action revision/idempotency, snapshots, reconnects, forfeits.
- Match result persistence and history.
- Shield and Frost Lock with placeholder effects.
- Network simulation tests and basic abuse protections.

## P2 — Complete PvP

- Matchmaking and casual queue.
- Remaining six powers, loadouts, training sandbox, status UI.
- Ranked rating, tiers, leaderboard, seasons.
- Friends, invites, private rematches, block/report.
- Analytics and live configuration.

## P3 — Presentation and retention

- Final card/power effects, audio, haptics, quality tiers.
- Home, missions, levels, daily challenge, achievements, inbox.
- Collection, themes, card backs, effect skins, profile cosmetics.
- Shop, purchases, restore, wallet ledger, season pass.
- Push notifications with consent and quiet hours.

## P4 — Release

- Full accessibility/localization pass.
- Device and network QA.
- Security/RLS/purchase review.
- Performance, crash, load, and soak tests.
- Store assets, legal, data disclosures, reviewer flow.
- Closed beta, telemetry review, balance pass, staged release.

## Definition of done for every story

- Acceptance criteria met on iOS and Android target builds.
- Unit/integration tests added where applicable.
- Analytics and error handling included.
- Loading, empty, offline, permission, and failure states included.
- Accessibility labels/focus/contrast/reduced-motion behavior included.
- Server-authoritative fields cannot be mutated by the client.
- Documentation and remote-config defaults updated.
