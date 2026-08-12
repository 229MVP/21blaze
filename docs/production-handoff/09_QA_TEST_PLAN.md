# QA and Acceptance Test Plan

## Core engine

- Same seed and action list produces byte-equivalent final state across repeated runs.
- Ace selects 11 when legal and 1 when 11 would bust.
- Five cards fit and a sixth placement is rejected for every lane and theme.
- Score formula, streak tiers, exact-21, five-card, recovery, completion, and time bonuses match fixtures.
- Placement timeout Auto-Routes deterministically.
- All tie-breakers and sudden death resolve deterministically.

## Powers

- Each power validates cost, cooldown, ownership, loadout, target, phase, and revision.
- Shield blocks exactly one hostile power and expires correctly.
- Freeze, heat, redirect, and double-blaze expire at server time despite app backgrounding.
- Cleanse removes the oldest supported hostile status.
- Swap recalculates Aces and score atomically.
- Two simultaneous intents resolve in server revision order.
- No power activates during prohibited final seconds.

## Networking

- Simulate 50/100/250/500 ms latency, 5% packet loss, duplicate events, reordered events, and clock skew.
- Reconnect from every match phase and both platforms.
- Replayed intent IDs do not duplicate effects or charges.
- Stale revisions recover through delta or snapshot.
- Server restart either restores durable match state or invalidates without rating loss.

## Economy/security

- Client cannot grant currency, inventory, XP, rank, rewards, or match results.
- Negative balance and duplicate receipt are impossible.
- RLS denies cross-user private data and unauthorized writes.
- Refund/revocation removes entitlement where policy permits.
- Rate limits and report abuse controls work.

## Device matrix

- Current and previous two major iOS versions.
- Android API levels supported by current Expo policy, including low/mid/high devices.
- Small phones, tall phones, display cutouts, tablets if supported, 60/90/120 Hz screens.
- Wi-Fi, cellular, offline launch, network switching, low-power mode, background/foreground, call interruption.

## Visual QA

- Twelve themes at iPhone and Pixel reference dimensions.
- Five occupied cards visibly remain inside all 48 lane layouts.
- Status bar, camera cutout, navigation bar, and home indicator remain clear.
- Long localized labels do not cover cards, timers, or power cost.
- Low/medium/high graphics and reduced-motion states are legible.
- Compare implementation and reference in the same image input for each theme.

## Accessibility QA

- VoiceOver and TalkBack complete tutorial, practice, loadout, matchmaking, and result.
- External keyboard focus is visible and ordered.
- High Contrast, Large HUD, four-color deck, reduced motion, flash off, and haptics off function independently and together.

## Launch gates

- Zero critical or high-severity open defects.
- Crash-free sessions ≥99.5% in beta.
- Match completion ≥97% excluding user forfeits.
- Invalid match rate <0.5%.
- P95 matchmaking under 20 seconds in supported regions or transparent queue messaging.
- P95 accepted action acknowledgement under 350 ms in primary region.
- No launch power outside the agreed balance band without documented approval.
- Purchases, restore, privacy, account deletion, support, and legal links verified on both stores.
