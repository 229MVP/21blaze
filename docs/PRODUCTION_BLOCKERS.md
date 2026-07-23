# Production Blockers — 21 Blaze 0.9.0

Honest status for **Internal Beta 0.9.0** on `cursor/internal-beta-0-9-0-1a6b` (and remaining store/RC gaps). Do **not** treat open items as done without evidence.

**Open P0:** none confirmed (no confirmed secret exposure).  
**Internal Beta:** feature freeze set — multiplayer / progression **OFF** in preview/dev; Solo + Test Store monetization **ON**.  
**Build auth blocker:** placeholder EAS `projectId` + missing `EXPO_TOKEN` / `eas login` → native preview builds **NOT RUN**.  
**Verdict:** **CONDITIONAL** for Solo-focused internal testing once EAS is linked and APK/IPA exist; **NO-GO** for store / production.

See also: [INTERNAL_BETA_0_9_BUILD_REPORT.md](./INTERNAL_BETA_0_9_BUILD_REPORT.md).

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
| P1-1 | EAS `projectId` is placeholder + build auth missing | `app.json` → `extra.eas.projectId` = `00000000-0000-0000-0000-000000000000`; no `EXPO_TOKEN` / `eas login` in this environment | **OPEN** — blocks native preview/production builds | Real projectId linked; authenticated `eas build` succeeds for preview |
| P1-2 | AdMob Google **TEST** app IDs in config | `app.json` iOS `GADApplicationIdentifier` + plugin use `ca-app-pub-3940256099942544~…` | **OPEN for store** — acceptable for Internal Beta Ad-Free verification only | Store build contains only production AdMob IDs |
| P1-3 | RevenueCat product configuration | Client remapped to `blaze_ad_free`, `blaze_inferno_pack`, `blaze_neon_pack`, `blaze_founders_pack` | **CODE READY; dashboard unverified** | Sandbox/Test Store purchase of each SKU grants expected entitlements |
| P1-4 | Remote Supabase deployment unverified | Migrations `0001`–`0007` and edge functions exist **locally only** | **OPEN** | [SUPABASE_DEPLOYMENT_CHECKLIST.md](./SUPABASE_DEPLOYMENT_CHECKLIST.md) fully checked with evidence |
| P1-5 | Purchase / restore untested on device | No native preview purchase tests performed | **OPEN** | Critical paths Pass in [INTERNAL_BETA_0_9_TEST_MATRIX.md](./INTERNAL_BETA_0_9_TEST_MATRIX.md) / [PURCHASE_TEST_MATRIX.md](./PURCHASE_TEST_MATRIX.md) |
| P1-6 | Multiplayer two-device untested | No two-device Live/Quick/Ranked tests | **OPEN** — **Disabled for Internal Beta** (preview/dev flags OFF) | Re-enable only after deploy + two-device Pass |
| P1-7 | Solo coin claim trusts client score | Local migration `0007_rc_solo_coin_verified.sql` uses `verified_scores` | **Fixed in local migration; remote apply pending** | Exploit with inflated score fails on deployed project |

---

## P2 — Should fix before or immediately after RC

| ID | Issue | Status |
|----|-------|--------|
| P2-1 | Casual/Ranked coins are client formulas only (no server grant) | **Open** — multiplayer Disabled for Internal Beta |
| P2-2 | React `ErrorBoundary` | **Done** — wraps `NavigationContainer` |
| P2-3 | Auth `initializePromise` blocks retry after failure | **Done** — cleared on failure; Home Retry Online without blocking Solo |
| P2-4 | Package/app version | **Done** — `0.9.0`; `versionCode`/`buildNumber` = `901` (Internal Beta) |
| P2-5 | Feature flags for Internal Beta | **Done** — preview/dev: monetization/interstitials/store/diagnostics **ON**; Live/Quick/Ranked/progression/dailies/rewarded **OFF**; production profile keeps monetization OFF |
| P2-6 | Native EAS builds not verified | **Open** — blocked by P1-1 (auth + projectId) |
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
| Google TEST AdMob IDs in Internal Beta preview | Intentional for Ad-Free verification; still a store P1 |

---

## Closure rule

A P1 is closed only when:

1. Code/config change is merged, **and**
2. Evidence is attached (build log, SQL verify, sandbox screenshot, two-device notes), **and**
3. Relevant gate / matrix row is checked with Pass evidence.
