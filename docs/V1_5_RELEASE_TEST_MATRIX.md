# Version 1.5 Release Test Matrix

| Area | Automated | Manual / staging |
|------|-----------|------------------|
| Game engine | `npm run test:game` | — |
| Countdown layout | `npm run test:countdown-layout` | Visual on device |
| Monetization | `npm run test:monetization` | — |
| Progression | `npm run test:progression` | — |
| v1.1 rewards / locker / ads | `test:v1.1-*` | — |
| Visual theme | `test:v1.2a-visual-theme` | Asset validation |
| Daily Challenge | all `test:daily-challenge*` + `test:v1.3-release` | — |
| Async Duel | phase1–3 + release freeze | Staging RPC smoke |
| Live PvP Phase 1 | `test:live-pvp-phase1` | — |
| Live PvP Phase 2 | `test:live-pvp-phase2` | Lobby + gameplay |
| Live PvP Phase 3 | `test:live-pvp-phase3` | Recovery + rematch |
| Live PvP release freeze | `test:live-pvp-release` | Reconnect on device |
| Privilege closure | migration assertions (local replay) | Staging `has_function_privilege` |
| Checkpoint v2 | release self-test | Force-close resume |
| Native config | expo config public | EAS build smoke |
| Startup hotfix | **not in tree** — unperformed | testflight-rescue profile |
| TypeScript | `npx tsc --noEmit` | — |
| Expo doctor | `npx expo-doctor` | — |

## EAS profile matrix

| Profile | Live PvP | Async Duel | Live Duel | Store purchases | Test ads |
|---------|----------|------------|-----------|-----------------|----------|
| development | off | off | off | on | on |
| preview | off | off | off | on | on |
| live-pvp-qa | **on** | off | off | off | on |
| testflight | off | off | off | off | on |
| testflight-rescue | off | off | off | off | on |
| production | off | off | off | off | off |
