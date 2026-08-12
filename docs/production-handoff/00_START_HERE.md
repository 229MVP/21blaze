# 21 Blaze — Complete Production Handoff

This folder is the source of truth for completing 21 Blaze after the twelve gameplay designs. Give the entire ZIP to the implementation chat and tell it to start with `production-handoff/15_IMPLEMENTATION_CHAT_PROMPT.md`.

## What is already complete

- Twelve selectable gameplay art directions and their source PNGs.
- Responsive interactive prototype and production web build.
- Four gameplay lanes with a hard five-card capacity.
- Theme manifest, design tokens, Figma assembly guidance, and 1×/2×/3× exports.
- Prototype interactions: theme selection, card placement, score updates, pause, and restart.

## What this production handoff adds

- Final core rules and deterministic scoring.
- Real-time PvP match format, reconnect rules, and server authority.
- Eight launch powers with exact costs, targets, counters, timing, and stacking rules.
- Card, power, UI, audio, and haptic effect specifications.
- Complete app screen inventory and navigation map.
- Supabase/Postgres data model, security rules, and realtime event contract.
- Progression, currencies, missions, ranked seasons, cosmetics, and fair monetization.
- Analytics taxonomy, accessibility requirements, QA matrix, launch gates, and phased backlog.
- A ready-to-paste prompt for the implementation chat.

## Locked launch decisions

1. Ranked PvP uses a server-generated deterministic seed. Both players receive equivalent card opportunities.
2. The server is authoritative for card order, placements, powers, scores, timers, rewards, and results.
3. A match uses four lanes, five cards maximum per lane, a 90-second clock, and an eight-second placement timer per revealed card.
4. Players equip three powers. Powers charge through skillful play and cannot be purchased for competitive strength.
5. Purchases are cosmetic or convenience-only; no paid stat boosts in ranked play.
6. Disconnects receive a 20-second reconnect window. Repeated or intentional disconnects can produce a forfeit.
7. Card effects and power animations are added after deterministic local rules, then validated again after two-client synchronization.

## Implementation order

1. Shared game engine and unit tests.
2. Offline practice using the same engine.
3. Accounts, profiles, inventory, and saved loadouts.
4. Server-authoritative private PvP rooms.
5. Matchmaking, ranked results, reconnects, and anti-cheat.
6. PvP powers with temporary effects.
7. Final effects, audio, haptics, and reduced-motion alternatives.
8. Progression, seasons, missions, cosmetics, shop, analytics, and release QA.

Do not start by rebuilding the twelve themes. Integrate the existing theme system into the real game engine.
