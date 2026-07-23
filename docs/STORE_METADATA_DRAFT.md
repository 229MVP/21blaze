# Store Metadata Draft — 21 Blaze RC 0.9.0

Draft copy for App Store / Google Play. Not final legal/marketing approval.  
**Version for RC builds:** `0.9.0` (repo currently shows `1.0.0` — bump before packaging).  
**Bundle ID:** `com.twentyoneblaze.app`

---

## App name

**21 Blaze**

---

## Subtitle (iOS) / Short description (Play)

**Play hot. Don’t bust. Climb the Blaze.**

(Alt) Fast card runs, live duels, and ranked climbs.

---

## Promotional text (iOS, editable)

RC 0.9.0 hardens online play, store purchases, and progression for the road to 1.0. Cosmetics are cosmetic — skill decides the board.

---

## Full description (draft)

21 Blaze is a high-energy card run where every lane pushes your score — and one bust can end it all.

**Play your way**
- Solo runs built for quick sessions and personal bests
- Live Duels for private matches with friends
- Quick Match casual lobbies
- Ranked mode for competitive climbs (beta features may evolve)

**Make it yours**
- Unlock card themes and arenas (Inferno, Neon, and more)
- Equip cosmetics that never change fairness or card odds
- Progress with XP, daily rewards, and missions when online features are available

**Optional Blaze Store**
- Remove interstitial ads
- Cosmetic packs and Founders bundle
- 21 Blaze Pro (monthly, yearly, or lifetime) — present for supporters; does not buy wins

Internet connection required for online, ranked, cloud wallet, and store features. Guest play may fall back to local mode if the server is unreachable.

---

## Keywords (iOS, comma-separated draft)

cards,arcade,multiplayer,ranked,duel,score,blaze,competitive,cosmetics,solo

---

## Category

Primary: Games → Card (or Arcade if Card unavailable)  
Secondary: Games → Casino **avoid** if it implies gambling — prefer **Puzzle** / **Arcade** over Casino.

---

## What’s New (RC 0.9.0)

- Production RC hardening on the Progression + Monetization foundation
- Reliability and compliance fixes toward store readiness
- Versioned as 0.9.0 release candidate (not a claim of full production certification)

Do **not** claim: verified remote deploy, sandbox purchase success, or two-device multiplayer certification until those gates pass.

---

## Support & legal URLs (placeholders)

| Field | Value |
|-------|-------|
| Support URL | `https://example.com/support` (replace) |
| Privacy Policy | `https://example.com/privacy` (replace — required) |
| Marketing URL | Optional |
| Account deletion | In-app path + web URL when [ACCOUNT_DELETION_PLAN.md](./ACCOUNT_DELETION_PLAN.md) ships |

---

## Pricing

Free download with optional ads and IAPs / subscriptions.

---

## Review notes (for App Review / Play review)

- Anonymous/guest sign-in may be used; provide demo account if anonymous is disabled in review region
- IAP via RevenueCat; use sandbox accounts
- Ads use AdMob — ensure **production** IDs before review build (currently test IDs are a **blocker**)
- Multiplayer requires two devices/accounts for Live/Quick/Ranked
- Feature flags default ON in client; server remains authoritative for grants

---

## Explicit non-claims

Metadata must not state that production backend deploy or purchase sandbox testing is complete until evidence exists.
