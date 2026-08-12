# Product Acceptance Criteria

The app is feature-complete for launch when all statements below are true.

## Gameplay

- A new user can learn and finish a practice match without outside explanation.
- All four lanes accept zero through five cards and visibly reject a sixth.
- Every supported seed/action replay produces the same authoritative result.
- All scoring, Ace, streak, timer, Auto-Route, and tie rules match fixtures.
- All twelve themes preserve the same functionality and accessible information.

## PvP

- Two authenticated players can match, ready, play, use three equipped powers, disconnect/reconnect, finish, and rematch.
- No client can decide cards, score, energy, timers, rating, rewards, or ownership.
- All eight powers follow the timing/counter rules and expose complete UI states.
- Ranked matches remain fair across latency differences and app lifecycle events.

## Meta systems

- Profiles, settings, progression, missions, achievements, inventories, loadouts, cosmetics, match history, ranking, leaderboards, friends, private invites, and inbox persist correctly.
- Shop purchases verify server-side, restore, refund/revoke, and ledger correctly.
- Competitive strength is never sold.

## Quality

- Required analytics, crash handling, monitoring, and incident controls exist.
- Accessibility paths work with VoiceOver/TalkBack and reduced-motion/high-contrast settings.
- Privacy, account deletion, support, legal, reporting, and blocking flows are functional.
- Launch gates in `09_QA_TEST_PLAN.md` pass.
- Store listings and disclosures match actual behavior.
