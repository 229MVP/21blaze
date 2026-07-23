# Production Blockers — 21 Blaze RC 0.9.0

Honest status after RC hardening on `cursor/rc-0-9-0-1a6b`. Do **not** treat open items as done without evidence.

**Open P0:** none confirmed (no confirmed secret exposure).  
**Verdict:** **NO-GO** for store / internal native testing blocked by **P1-1** (EAS projectId).

---

## P0 — Ship stoppers / security incidents

| ID | Issue | Status | Remediation |
|----|-------|--------|-------------|
| P0-1 | Confirmed secret exposure (API secret, service role, webhook auth, private keys in client or git) | **None confirmed** | Continue scanning PRs; keep service role / webhook auth server-only; never ship `.env.local` |

If a secret exposure is discovered later, promote immediately to open P0 and rotate keys before any store build.

---

## P1 — Must fix before production store / RC sign-off

| ID | Issue | Evidence | Status | Exit criteria |
|----|-------|----------|--------|---------------|
| P1-1 | EAS `projectId` is placeholder | `app.json` → `extra.eas.projectId` = `00000000-0000-0000-0000-000000000000` | **OPEN** — blocks native preview/production builds | Production/preview `eas build` succeeds with real projectId |
| P1-2 | AdMob Google **TEST** app IDs in production config | `app.json` iOS `GADApplicationIdentifier` + plugin use `ca-app-pub-3940256099942544~…` | **OPEN** | Store build contains only production AdMob IDs |
| P1-3 | RevenueCat product ID mismatch | Client remapped to `blaze_ad_free`, `blaze_inferno_pack`, `blaze_neon_pack`, `blaze_founders_pack`; packages `ad_free`/`inferno`/`neon`/`founders`; offering `default`; Founders → `founders_pack`+`ad_free`+`inferno_pack`+`neon_pack` | **Remapped in code; dashboard unverified** | Sandbox purchase of each SKU grants expected entitlements; RC dashboard matches client IDs |
| P1-4 | Remote Supabase deployment unverified | Migrations `0001`–`0007` and edge functions exist **locally only** | **OPEN** | [SUPABASE_DEPLOYMENT_CHECKLIST.md](./SUPABASE_DEPLOYMENT_CHECKLIST.md) fully checked with evidence |
| P1-5 | Purchase sandbox untested | No sandbox purchase tests performed | **OPEN** | Critical paths Pass in [PURCHASE_TEST_MATRIX.md](./PURCHASE_TEST_MATRIX.md) |
| P1-6 | Multiplayer two-device untested | No two-device Live/Quick/Ranked tests performed | **OPEN** | Critical multiplayer paths Pass in [RC_0_9_MANUAL_TEST_MATRIX.md](./RC_0_9_MANUAL_TEST_MATRIX.md) |
| P1-7 | Solo coin claim trusts client score | Local migration `0007_rc_solo_coin_verified.sql` uses `verified_scores`; ignores client score; Founders grant remapped to neon | **Fixed in local migration; remote apply pending** | Exploit with inflated score fails on deployed project; legitimate claim still works |

---

## P2 — Should fix before or immediately after RC

| ID | Issue | Status |
|----|-------|--------|
| P2-1 | Casual/Ranked coins are client formulas only (no server grant) | **Open** — disable display of unverified coin claims until server-backed |
| P2-2 | React `ErrorBoundary` | **Done** — wraps `NavigationContainer` |
| P2-3 | Auth `initializePromise` blocks retry after failure | **Done** — cleared on failure; Home Retry Online without blocking Solo |
| P2-4 | Package/app version | **Done** — `0.9.0`; `versionCode`/`buildNumber` = `900` |
| P2-5 | Feature flags default ON | **Done** — defaults **OFF**; production EAS disables Live/Quick/Ranked/monetization/progression/diagnostics; development/preview enable for QA; rewarded currency OFF everywhere until SSV |
| P2-6 | Native EAS builds not verified with real projectId | **Open** — blocked by P1-1 |
| P2-7 | Account deletion / privacy disclosures incomplete | **Open** — plans drafted; implementation incomplete |
| P2-8 | Web works; native store path unverified | **Open** — do not claim parity until device builds + QA pass |

---

## Intentionally not blockers (document only)

| Item | Why |
|------|-----|
| Pro lifetime/yearly/monthly present | Prior phase; feature freeze — document, do not expand |
| Self-tests are pure unit | Useful regression signal; do not replace device/sandbox QA |
| RLS blocking client wallet/XP/score writes | **By design** — not a bug |
| PurchaseDiagnosticsScreen | Dev/preview only; refuses production |

---

## Closure rule

A P1 is closed only when:

1. Code/config change is merged, **and**
2. Evidence is attached (build log, SQL verify, sandbox screenshot, two-device notes), **and**
3. [RC_0_9_RELEASE_GATES.md](./RC_0_9_RELEASE_GATES.md) checkbox for that item is checked.
