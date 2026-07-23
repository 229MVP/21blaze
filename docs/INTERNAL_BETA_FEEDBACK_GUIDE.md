# Internal Beta Feedback Guide — 21 Blaze 0.9.0

**Audience:** Internal testers on preview / development EAS builds  
**Branch:** `cursor/internal-beta-0-9-0-1a6b`  
**Version:** `0.9.0` (`versionCode` / `buildNumber` = `901`)  
**Package:** `com.twentyoneblaze.app` · slug `21-blaze` · scheme `twentyoneblaze`

This build is a **Solo-focused Internal Beta**. It is **not** production-ready and does **not** claim store certification, live multiplayer, or remote backend deploy.

---

## What to test (in scope)

| Area | What to exercise |
|------|------------------|
| Launch & Home | Cold start, navigation, version string `0.9.0` |
| Solo Play | Full 4-lane run: Ace, exact 21, five-card, bust, timer, pause, results |
| Local progress | High score save, local leaderboard |
| Settings / How to Play | Audio/motion prefs, help screens |
| Purchases (Test Store) | `blaze_ad_free`, `blaze_inferno_pack`, `blaze_neon_pack`, `blaze_founders_pack` |
| Restore | Restore Purchases → cosmetic / ad-free entitlements display |
| Purchase Diagnostics | Preview/dev only — confirm it opens and reports useful state |
| Interstitial ads | Google **TEST** IDs only — verify Ad-Free suppresses them |
| Auth fallback | Anonymous online **or** local mode; Solo must never be blocked |

---

## What not to test (disabled / out of scope)

Do **not** file “missing feature” bugs for these — they are **intentionally OFF** for Internal Beta:

- Live Duel, Quick Match, Ranked (two-device untested; deploy unverified)
- Progression, Daily rewards, Daily missions (backend deploy unverified)
- Rewarded ads / rewarded currency (SSV incomplete)
- Production store purchases / production AdMob IDs

---

## How to report feedback

For each issue, include:

1. **Device** — OS version, phone/tablet model  
2. **Build** — Android `901` / iOS `901`, preview or development profile  
3. **Steps** — numbered reproduce path  
4. **Expected vs actual**  
5. **Severity** — Blocker / Major / Minor / Suggestion  
6. **Screenshot or short clip** when UI-related  
7. **PurchaseDiagnostics** snapshot if the bug involves IAP or ads  

### Severity guide

| Severity | Use when |
|----------|----------|
| **Blocker** | Crash, Solo unplayable, purchases corrupt entitlements, data loss |
| **Major** | Core Solo flow broken; restore fails; Ad-Free does not suppress test interstitials |
| **Minor** | Cosmetic/UI glitch; non-blocking UX friction |
| **Suggestion** | Nice-to-have polish |

---

## Known limitations (do not re-report as new discoveries)

- EAS `projectId` may still be a placeholder until linked; builds may be unavailable until auth + project link complete  
- RevenueCat **Test Store** only — not production App Store / Play Billing  
- AdMob uses Google **TEST** app/unit IDs by design for this beta  
- Online leaderboards / wallet / progression depend on remote Supabase — **deployment unverified**; local Solo remains the source of truth  
- Multiplayer entry points should be hidden or inert  

---

## Pass criteria for a useful beta session

- [ ] Solo run completes without crash  
- [ ] Local high score persists after kill-restart  
- [ ] At least one Test Store purchase path attempted (or blocked with clear error)  
- [ ] Restore attempted once  
- [ ] Ad-Free path checked against test interstitial (if purchase available)  
- [ ] Solo still playable if online auth fails  

Thank you — honest, scoped feedback beats speculative “production ready” claims.
