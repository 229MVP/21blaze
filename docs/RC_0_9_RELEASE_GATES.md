# RC 0.9.0 Release Gates — 21 Blaze

Hard gates for declaring Production RC 0.9.0 ready for store submission / wide TestFlight–Play testing.  
Branch: `cursor/rc-0-9-0-1a6b`. Checkboxes require evidence. Do not invent success.

Feature freeze remains in effect: [FEATURE_FREEZE.md](./FEATURE_FREEZE.md).

---

## Gate 0 — Version & scope

- [x] App version set to **0.9.0** (`app.json` / `package.json` / `APP_VERSION`; `versionCode`/`buildNumber` = `900`)
- [x] Bundle ID remains `com.twentyoneblaze.app`
- [x] No new major features beyond freeze-permitted hardening
- [x] Pro subscriptions documented as present; not expanded

---

## Gate 1 — P0 security

- [x] No **confirmed** secret exposure (open P0: none); no secrets printed in hardening
- [ ] Re-scan release branch for service role / webhook secrets in client
- [ ] `.env.local` not packaged; secrets only in EAS/Supabase
- [x] `.env.example` updated (defaults OFF; no secrets)

---

## Gate 2 — P1 blockers closed

- [ ] **EAS projectId** is a real UUID (not `00000000-0000-0000-0000-000000000000`) — **OPEN (P1-1)**
- [ ] **AdMob** production app + unit IDs in release config (no Google test app IDs) — **OPEN (P1-2)**
- [ ] **RevenueCat** dashboard matches client remap (`blaze_ad_free` / packs; Founders → ad_free + inferno + neon) — **code remapped; dashboard unverified (P1-3)**
- [ ] **Supabase** migrations `0001`–`0007` applied on target project — **local `0007` present; remote unverified (P1-4 / P1-7)**
- [ ] **Edge functions** all deployed and smoke-tested
- [ ] **Purchase sandbox** matrix critical paths Pass (iOS + Android)
- [ ] **Two-device** Live + Quick + Ranked critical paths Pass
- [ ] **Solo coin claim** rejects/ignores client-inflated scores on **deployed** project

---

## Gate 3 — Integrity & UX hardening

- [x] ErrorBoundary present wrapping NavigationContainer (**P2-2 done**)
- [x] Auth retry works after local fallback — `initializePromise` cleared; Home Retry Online (**P2-3 done**)
- [x] Feature flags default OFF; production EAS disables incomplete systems; rewarded currency OFF until SSV (**P2-5 done**)
- [ ] Casual/Ranked **unverified** coin claim UI disabled or server-backed
- [ ] RLS still blocks client wallet/XP/score writes (spot-checked on remote)

---

## Gate 4 — Builds

- [ ] `eas build` iOS production/preview — **not run / blocked by EAS projectId**
- [ ] `eas build` Android production/preview — **not run / blocked by EAS projectId**
- [ ] Web export — in progress; **not claimed succeeded**
- [x] TypeScript `tsc --noEmit` — **PASS**
- [ ] Expo doctor — in progress; **not claimed succeeded**
- [x] Self-tests game / ranked / monetization / progression — **PASS**

---

## Gate 5 — Compliance

- [ ] Privacy policy URL live
- [ ] Account deletion path implemented or approved web process live
- [ ] Store disclosure questionnaires drafted from [STORE_DISCLOSURE_CHECKLIST.md](./STORE_DISCLOSURE_CHECKLIST.md)
- [ ] Content rating questionnaire aligned with [CONTENT_RATING_NOTES.md](./CONTENT_RATING_NOTES.md)
- [ ] Screenshot set captured without test ads / dev banners

---

## Gate 6 — QA sign-off

- [ ] [RC_0_9_MANUAL_TEST_MATRIX.md](./RC_0_9_MANUAL_TEST_MATRIX.md) critical paths Pass
- [ ] [PURCHASE_TEST_MATRIX.md](./PURCHASE_TEST_MATRIX.md) critical paths Pass
- [x] Self-tests green locally — PASS
- [ ] [RC_0_9_READINESS_REPORT.md](./RC_0_9_READINESS_REPORT.md) updated with evidence links / final commit

---

## Go / No-Go

| Decision | Criteria |
|----------|----------|
| **NO-GO** (current) | Open P1s: EAS projectId, AdMob test IDs, RC dashboard unverified, remote deploy unverified, purchases untested, two-device untested, `0007` not applied remotely |
| **GO for internal RC testing** | P1-1 closed (real projectId) + backend deploy in progress; sandbox/multiplayer with known flags |
| **GO for store submit** | All gates 0–6 checked with evidence |

**Current recommendation:** **NO-GO** for store submit. Internal native preview testing **blocked by P1-1**.
