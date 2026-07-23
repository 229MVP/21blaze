# Privacy Data Map — 21 Blaze RC 0.9.0

Inventory of data categories processed by the app and backends as of the RC audit.  
Use for privacy policy, store questionnaires, and [ACCOUNT_DELETION_PLAN.md](./ACCOUNT_DELETION_PLAN.md).

**Remote deployment unverified** — tables/functions exist in local migrations; production residency follows whichever Supabase project is configured.

---

## Controllers / processors (typical)

| Party | Role | Data |
|-------|------|------|
| 21 Blaze / publisher | Controller | Game accounts, gameplay, support |
| Supabase | Processor (DB/Auth/Edge) | Profiles, matches, wallets, entitlements |
| RevenueCat | Processor | Purchase receipts, entitlements sync |
| Apple / Google | Processor | Store billing, sandbox/production IAP |
| Google AdMob | Processor | Ad requests, advertising ID / ATT-related where applicable |

---

## Data categories

| Category | Examples | Collected? | Stored where | Client writable? | Notes |
|----------|----------|------------|--------------|------------------|-------|
| Account identifiers | Supabase `user_id`, anonymous auth session | Yes (online) | Supabase Auth | Auth APIs | Guest/anonymous supported |
| Display name | Profile display name | Yes (optional online) | `profiles` | Via profile update | Pattern-validated |
| Gameplay metrics | Score, lanes, cards, busts, timers | Yes | Local storage + `online_matches` / live tables | Match submit via edge | Leaderboards |
| Competitive data | Ranked rating, division, history | Yes (ranked) | Ranked tables | Via edge RPCs | Feature-flagged UX |
| Live multiplayer | Room codes, ready state, results | Yes | Live match tables | Via edge | Two-device untested |
| Wallet / coins | Balances, ledger | Yes | `player_wallets`, `wallet_transactions` | **No** — RLS SELECT only | Mutations service_role |
| Entitlements | `remove_ads`, packs, `pro`, founders | Yes | `player_entitlements` | **No** — SELECT only | RevenueCat webhook/sync |
| Cosmetics | Owned/equipped cosmetics | Yes | cosmetics tables | Equip/purchase via edge | |
| Progression | XP, level, daily claims, missions | Yes | Progression tables (0006) | **No** client direct writes (RLS) | Deploy unverified |
| Purchase events | Store product events | Yes | `purchase_events` / RC | Server | Sandbox untested |
| Ad reward claims | Rewarded claim records | Yes | `ad_reward_claims` | Server | Test AdMob IDs today |
| Device / ad IDs | Advertising ID, ATT (iOS) | Via AdMob SDK | AdMob | SDK | Disclose in stores |
| Local settings | Reduced motion, toggles | Yes | AsyncStorage | Yes | Device-local |
| Local scores | Offline high scores/history | Yes | AsyncStorage | Yes | May exist without account |
| Diagnostics | Crash logs (if added later) | Not confirmed | TBD | TBD | No ErrorBoundary yet; no crash SaaS claimed |

---

## Processing purposes

| Purpose | Data used |
|---------|-----------|
| Provide solo / multiplayer gameplay | Account, match state, scores |
| Leaderboards & ranked integrity | Scores, ratings, history |
| Cosmetics & progression | Wallet, XP, cosmetics |
| Monetization (IAP + ads) | Entitlements, ad/purchase signals |
| Fraud prevention | Server-side wallet/score rules (solo score trust still **P1** until 0007) |
| Legal / store compliance | Account deletion, privacy disclosures |

---

## Cross-border / retention (draft — legal to finalize)

| Topic | RC audit note |
|-------|---------------|
| Hosting region | Whatever region the Supabase project uses — document before store submit |
| Retention | Active account + legal retention for purchases; define purge windows in deletion plan |
| Children | Content rating assumes not directed at children under 13 — confirm in [CONTENT_RATING_NOTES.md](./CONTENT_RATING_NOTES.md) |
| Sale of personal data | Ads may involve advertising partners — disclose “ads” and tracking where required |

---

## Security notes tied to privacy

- RLS appears to block client wallet/XP/score **writes** — good for integrity; still disclose server processing.
- Solo coin claim currently trusts client `score` until migration 0007 — integrity risk, not itself a privacy leak.
- No confirmed secret exposure (P0) in this audit.
- Publishable Supabase key is expected in client; **service role must never ship**.

---

## Data subject rights (implementation status)

| Right | Status |
|-------|--------|
| Access | Partial — profile/wallet readable to owner when online |
| Correction | Display name update exists |
| Deletion | **Not implemented** — see Account Deletion Plan |
| Portability | Not implemented |
| Opt-out of personalized ads | Privacy options entry exists in Settings UI; full ATT/UMP flows must be verified on device |

---

## Explicit non-claims

- This map does not claim a published privacy policy is complete.
- This map does not claim GDPR/CCPA legal review is done.
