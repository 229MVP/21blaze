# Live PvP Phase 3 QA Matrix

**Status:** Automated static/self-tests run in CI-style scripts. Physical two-device cases below are **not executed** unless explicitly marked.

## Automated (run locally)

| Check | Command |
|-------|---------|
| Phase 1 | `npm run test:live-pvp-phase1` |
| Phase 2 | `npm run test:live-pvp-phase2` |
| Phase 3 | `npm run test:live-pvp-phase3` |
| Typecheck | `npx tsc --noEmit` |

## Physical device matrix (manual — not run in Phase 3 gate)

| Scenario | iOS/iOS | Android/Android | iOS/Android | Notes |
|----------|---------|-----------------|-------------|-------|
| Same Wi-Fi | Untested | Untested | Untested | |
| Different networks | Untested | Untested | Untested | |
| Cellular vs Wi-Fi | Untested | Untested | Untested | |
| Packet loss | Untested | Untested | Untested | |
| Background/foreground | Untested | Untested | Untested | |
| Force-close + recovery | Untested | Untested | Untested | Checkpoint + hub Resume |
| Recovery after deadline | Untested | Untested | Untested | Must discard checkpoint |
| Token refresh mid-match | Untested | Untested | Untested | |
| Account switch | Untested | Untested | Untested | Clears checkpoint |
| Simultaneous rematch | Untested | Untested | Untested | Idempotent RPC |
| Reconnect during countdown | Untested | Untested | Untested | |
| Reconnect during gameplay | Untested | Untested | Untested | |
| Reconnect after local completion | Untested | Untested | Untested | |
| Stale push/deep link | Untested | Untested | Untested | |
| Large text | Untested | Untested | Untested | |
| VoiceOver / TalkBack | Untested | Untested | Untested | |

## Staging database (manual)

1. Apply `20260810183000_v1_5_phase3_live_pvp_resilience.sql`
2. Confirm `authenticated` cannot execute `finalize_live_pvp_deadlines`
3. Run rematch idempotency with two sessions
4. Verify records RPCs return only caller-owned stats

## Sign-off criteria for release freeze

- All automated scripts pass
- Staging privilege checks pass
- At least one cross-platform physical smoke on internal build with flag enabled
