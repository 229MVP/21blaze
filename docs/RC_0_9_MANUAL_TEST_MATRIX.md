# RC 0.9.0 Manual Test Matrix — 21 Blaze

Manual / device QA matrix for Production RC 0.9.0 (`cursor/rc-0-9-0-1a6b`).  
Automated coverage: pure unit self-tests (`test:game`, `test:ranked`, `test:monetization`, `test:progression`) — **PASS**. `tsc --noEmit` — **PASS**.

**Baselines (honest):**

- No two-device multiplayer tests performed  
- No purchase sandbox tests performed  
- Native EAS builds blocked by placeholder projectId (**P1-1**)  
- Remote Supabase deploy unverified (incl. migration `0007`)  
- Expo doctor / web export in progress — not claimed succeeded  

Legend: **Pass / Fail / Blocked / Not run / N/A**

---

## A. Build & boot

| ID | Case | iOS | Android | Web | Notes |
|----|------|-----|---------|-----|-------|
| A1 | Install release/preview build | Blocked | Blocked | N/A | EAS projectId placeholder |
| A2 | Cold start to Home | Not run | Not run | In progress | Solo never gated by flags |
| A3 | ErrorBoundary shows recoverable UI | Not run | Not run | Not run | Boundary **present** (wraps NavigationContainer) |
| A4 | Version shows 0.9.0 | Not run | Not run | Not run | Repo: `0.9.0` / build `900` |

---

## B. Auth & local fallback

| ID | Case | Status | Notes |
|----|------|--------|-------|
| B1 | Online anonymous sign-in | Not run | Needs deployed Supabase |
| B2 | Missing env → local mode | Not run | Expected fallback |
| B3 | Connect timeout → local mode | Not run | Auth store race |
| B4 | Retry after failed init | Not run | Code: `initializePromise` cleared; Home **Retry Online** |
| B5 | Update display name | Not run | Online only |
| B6 | Sign out / new guest | Not run | |

---

## C. Solo game

| ID | Case | Status |
|----|------|--------|
| C1 | Complete solo run | Not run |
| C2 | Quit run | Not run |
| C3 | Local high score saves | Not run |
| C4 | Online submit + leaderboard | Not run — deploy unverified |
| C5 | Solo coin claim (honest score) | Not run — needs remote `0007` |
| C6 | Solo coin claim (inflated score ignored) | Not run — local fix in `0007`; remote pending |
| C7 | Rewarded double coins | **Blocked / OFF** — rewarded currency OFF until SSV; AdMob test IDs |

---

## D. Multiplayer (requires two devices)

Flags: default OFF; enable via development/preview EAS or env for QA.

| ID | Case | Status |
|----|------|--------|
| D1 | Live Duel create + join | **Not run** — never two-device tested |
| D2 | Ready → play → both results | Not run |
| D3 | Leave mid-match | Not run |
| D4 | Quick Match pair + finish | Not run |
| D5 | Ranked search → match → rating update | Not run |
| D6 | Ranked history / leaderboard UI | Not run |

---

## E. Monetization & ads

Production EAS disables monetization UX. Use development/preview for QA.

| ID | Case | Status |
|----|------|--------|
| E1 | Store offerings load (`default`) | Not run — dashboard match unverified |
| E2 | Purchase `blaze_ad_free` | **Not run** — sandbox untested |
| E3 | Purchase Inferno / Neon packs | Not run |
| E4 | Founders → ad_free + inferno + neon | Not run — remapped in code; sandbox untested |
| E5 | Pro monthly/yearly/lifetime | Not run — present; don’t expand |
| E6 | Restore purchases | Not run |
| E7 | Interstitial / remove-ads suppress | Blocked for prod — test AdMob IDs |
| E8 | PurchaseDiagnosticsScreen (dev/preview only) | Not run — must refuse production |
| E9 | Web purchase stubs safe | In progress — not claimed |

---

## F. Progression

| ID | Case | Status |
|----|------|--------|
| F1 | XP grant after match (online) | Not run — deploy unverified; flags default OFF |
| F2 | Level-up overlay | Not run |
| F3 | Daily reward claim | Not run |
| F4 | Daily missions progress/claim | Not run |
| F5 | Flags OFF hide UX | Not run — expected for production profile |

---

## G. Wallet integrity / RLS

| ID | Case | Status |
|----|------|--------|
| G1 | Client cannot UPDATE `player_wallets` | Not run — expected deny by RLS |
| G2 | Casual results do **not** show unverified coin grants | Not run |
| G3 | Ranked results do **not** show unverified coin grants | Not run |

---

## H. Self-tests (automated smoke)

| ID | Command | Status |
|----|---------|--------|
| H1 | `npm run test:game` | **PASS** |
| H2 | `npm run test:ranked` | **PASS** |
| H3 | `npm run test:monetization` | **PASS** |
| H4 | `npm run test:progression` | **PASS** |
| H5 | `npx tsc --noEmit` | **PASS** |
| H6 | expo-doctor / web export | In progress — not claimed |

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| QA | | | |
| Eng | | | |
| Release | | | |

**Cannot sign off RC** while P1 items in [PRODUCTION_BLOCKERS.md](./PRODUCTION_BLOCKERS.md) remain open.  
**Current verdict:** **NO-GO** (blocked by P1-1 for native preview builds).
