# Version 1.4 Release Checklist — Async Duel

Use before internal TestFlight / Play testing or production cut. Check items only when verified.

## Backend

- [ ] Migrations applied in order: `0015` → `0016` → `0017` → `0018`
- [ ] Fresh-install path verified on empty project
- [ ] Upgrade path verified from latest v1.3 schema (`0014`)
- [ ] RLS enabled on Async Duel + notification + stats tables
- [ ] Function grants verified (authenticated RPCs only as intended)
- [ ] `expire_async_duels` **not** executable by `authenticated`
- [ ] `diagnose_async_duel_integrity` service_role only
- [ ] Edge Function `async-duel-push-dispatch` deployed
- [ ] Server secrets configured (push provider); **not** in git
- [ ] Service-role key absent from mobile env / bundle
- [ ] Push credentials present; development vs production separated
- [ ] Kill switches tested:
  - [ ] Creation disabled → RPC reject + Hub unavailable UX
  - [ ] Rematch disabled → Result unavailable UX + RPC reject
  - [ ] Push disabled → outbox suppressed; settlement unaffected
- [ ] Stat reconciliation / integrity scan completed on staging data
- [ ] Production logs reviewed (no seeds, tokens, service role)

## Client

- [ ] Marketing version `1.4.0` in `package.json` / `app.json`
- [ ] iOS `buildNumber` bumped by release manager (current committed value not auto-invented)
- [ ] Android `versionCode` bumped by release manager
- [ ] `EXPO_PUBLIC_ENABLE_ASYNC_DUEL` set intentionally for the build
- [ ] Development harness / diagnostics only behind `__DEV__`
- [ ] Privacy metadata / store disclosures reviewed for Async Duel + notifications
- [ ] Notification plugin / channels configured if shipping push (manual)
- [ ] Deep-link scheme `twentyoneblaze` reviewed

## Automated checks

Record exact command results in `V1_4_RELEASE_VALIDATION_REPORT.md`.

- [ ] `npx tsc --noEmit`
- [ ] `npm run test:async-duel-phase1`
- [ ] `npm run test:async-duel-phase2`
- [ ] `npm run test:async-duel-phase3`
- [ ] `npm run test:async-duel-release`
- [ ] `npm run test:v1.3-release`
- [ ] `npm run test:game`
- [ ] `npm run test:daily-challenge`
- [ ] `npm run test:progression`
- [ ] `npm run validate:visual-assets`
- [ ] Production bundle/export if available (`npx expo export` / EAS)

No project ESLint script is defined in `package.json` — do not claim lint passed.

## Manual / device

- [ ] Physical-device push tests recorded (or explicitly deferred)
- [ ] iOS QA recorded
- [ ] Android QA recorded
- [ ] Accessibility VoiceOver / TalkBack recorded honestly
- [ ] Known risks approved by owner
- [ ] Rollback plan acknowledged (`V1_4_ASYNC_DUEL_OPERATIONS.md`)

## Release decision

- [ ] Decision recorded: `READY` / `READY WITH DOCUMENTED RISKS` / `NOT READY`
- [ ] Decision owner + date recorded in validation report

## Rollback plan (summary)

1. Disable creation / rematch / push kill switches server-side.
2. Hide client feature flag on next build if needed.
3. Do not drop tables or rewrite live player economy / Daily Challenge data.
