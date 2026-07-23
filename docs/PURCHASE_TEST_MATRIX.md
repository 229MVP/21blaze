# Purchase Test Matrix — 21 Blaze RC 0.9.0

**Audit status:** No purchase sandbox tests performed.  
All rows below are **Not run** until executed on iOS Sandbox and Google Play license testers.

**Blockers before meaningful runs:**

- P1-1 — EAS `projectId` placeholder (native store/preview builds)
- P1-3 — RevenueCat **dashboard** match unverified (client remapped in code)
- P1-4 — Remote `revenuecat-webhook` / `sync-entitlements` deployment unverified
- P1-2 — AdMob test IDs (ads adjacent; not IAP, but store config)
- Rewarded currency OFF everywhere until SSV complete

---

## Product catalog under test (client remapped — dashboard unverified)

| Catalog / product ID | Package ID | Offering | Entitlements expected (code) |
|----------------------|------------|----------|------------------------------|
| `blaze_ad_free` | `ad_free` | `default` | `ad_free` (+ legacy `remove_ads` alias) |
| `blaze_inferno_pack` | `inferno` | `default` | `inferno_pack` (+ legacy `cards_inferno`) |
| `blaze_neon_pack` | `neon` | `default` | `neon_pack` (+ blue flame / neon casino aliases) |
| `blaze_founders_pack` | `founders` | `default` | `founders_pack` + `ad_free` + `inferno_pack` + `neon_pack` + founder cosmetics + one-time coins |
| Pro monthly / yearly / lifetime | (existing) | — | `pro` + ad-free; **present — feature freeze, do not expand** |

Legacy SKUs remain mapped for restore/webhook compatibility only. Confirm RevenueCat dashboard + App Store / Play Console products match the `blaze_*` IDs before marking Pass.

---

## Matrix

Legend: **Pass / Fail / Blocked / Not run**

| # | Scenario | iOS Sandbox | Android License | Server entitlement | Notes |
|---|----------|-------------|-----------------|--------------------|-------|
| 1 | Cold start → offerings load (`default`) | Not run | Not run | N/A | Fail if empty offerings |
| 2 | Purchase `blaze_ad_free` | Not run | Not run | Not run | Interstitials suppressed |
| 3 | Purchase `blaze_inferno_pack` | Not run | Not run | Not run | Cosmetic unlock + equip |
| 4 | Purchase `blaze_neon_pack` | Not run | Not run | Not run | Cards + neon arena |
| 5 | Purchase `blaze_founders_pack` | Not run | Not run | Not run | Must grant ad_free + inferno + **neon** (not volcano) |
| 6 | Purchase Pro monthly | Not run | Not run | Not run | Present; do not expand |
| 7 | Purchase Pro yearly | Not run | Not run | Not run | Present; do not expand |
| 8 | Purchase Pro lifetime | Not run | Not run | Not run | Present; do not expand |
| 9 | Restore purchases (same account) | Not run | Not run | Not run | Entitlements return |
| 10 | Restore on second device | Not run | Not run | Not run | Same store account |
| 11 | Webhook grant after purchase | Not run | Not run | Not run | `revenuecat-webhook` must be deployed |
| 12 | `sync-entitlements` refresh | Not run | Not run | Not run | Client matches server |
| 13 | Duplicate purchase / idempotent grant | Not run | Not run | Not run | No double coin grant on Founders |
| 14 | Cancelled / failed purchase UX | Not run | Not run | N/A | No false “owned” |
| 15 | Offline purchase error handling | Not run | Not run | N/A | Clear error, retry safe |
| 16 | Subscription renew / expire (Pro) | Not run | Not run | Not run | Expire removes Pro (not cosmetics if separate) |
| 17 | PurchaseDiagnosticsScreen (dev/preview) | Not run | Not run | N/A | Must refuse / hide in production |

---

## Ad adjacency (not IAP, store-critical)

| # | Scenario | Status |
|---|----------|--------|
| A1 | Production AdMob IDs in release build | **Blocked** — test IDs in `app.json` |
| A2 | Rewarded double-coins after verified solo claim | **Blocked / OFF** — `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY` OFF until SSV |
| A3 | Remove-ads suppresses interstitial only (rewarded optional remains) | Not run |

---

## Evidence required per Pass

- Screenshot of store sheet + success
- RevenueCat customer timeline event
- Supabase `player_entitlements` / `purchase_events` row (if deployed)
- App UI showing owned/equipped state after kill-restart

---

## Explicit non-claims

- No sandbox purchase success is claimed.
- Client remapping is **not** the same as dashboard/store configuration verified.
- Do not mark RC purchase gate green until dashboard match + webhook deploy + matrix Pass.
