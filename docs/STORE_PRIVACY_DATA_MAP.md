# Store Privacy & Data Map — Version 1.2.0

Based on **actual code paths** in this repository. Resolve any **BLOCKER**
items with legal review before store submission.

---

## Data categories

| Data type | Collected? | Purpose | Storage | User control |
|-----------|------------|---------|---------|--------------|
| Display name | Optional | Global leaderboard, profile row | Supabase `profiles` | Editable in app when online |
| Anonymous auth session | Optional | Online sync | Supabase Auth + device | Local mode without account |
| Solo match scores (local) | Yes | Local high scores | AsyncStorage | Device only |
| Verified global scores | Optional | Global leaderboard | Supabase | Requires online session |
| Blaze Coin balance | Optional | Locker economy | Supabase + local cache | Server authoritative |
| Cosmetic ownership / equipped | Optional | Locker, gameplay visuals | Supabase + local cache | Server authoritative |
| Daily reward / mission state | Optional | Blaze Rewards | Supabase | Server authoritative |
| Settings (sound, haptics, motion) | Yes | UX preferences | AsyncStorage | Settings screen |
| Ad consent (UMP) | When ads load | AdMob compliance | Google SDK + local | Privacy options when required |
| In-app analytics events | Yes | Debug ring buffer only | **In-memory only** — no third-party analytics SDK | Not persisted to server |

## Third-party services

| Service | Used in 1.2.0 store build? | Data shared |
|---------|---------------------------|-------------|
| **Supabase** | Yes (when URL/key configured) | Auth session, gameplay sync per RLS policies |
| **Google AdMob** | Yes (when monetization + ad flags on) | Device/ad identifiers per Google policies |
| **Google UMP** | Yes (Android; iOS consent path per implementation) | Consent status |
| **RevenueCat** | **No** — `STORE_PURCHASES=false`, SDK not configured |
| **Firebase Analytics / Crashlytics** | **No** — not integrated |
| **Push notifications** | **No** — no push SDK in startup path for store profiles |

## Analytics (`src/monetization/analytics.ts`)

- Lightweight **in-memory** event ring (max 100 events).
- **No** network upload in current implementation.
- Payloads must not include tokens, emails, raw user IDs, wallet rows, or ad secrets (enforced by event design).

## Diagnostics

- Startup diagnostics: sanitized stage names only (`startupDiagnostics.ts`).
- ErrorBoundary: user-facing message only; dev `console.warn` in `__DEV__`.
- Feedback screen: user-submitted text (optional screen name / error code).

## Purchases

- **Disabled** for 1.2.0 public release.
- No payment data collected.
- No restore purchases flow exposed.

## ATT (App Tracking Transparency — iOS)

- `NSUserTrackingUsageDescription` present in `Info.plist`.
- Personalized ads on iOS use non-personalized path per `adConsentService` audit — **developer must confirm** App Store privacy answers match final ad behavior.
- **BLOCKER for legal review:** Confirm ATT prompt timing and disclosure if personalized ads are enabled in production.

## Account deletion

- Anonymous Supabase accounts may exist.
- **BLOCKER if required by policy:** Confirm whether in-app account deletion is implemented or document web/support deletion path for App Store / Play requirements.

## Children's privacy

- Game is a skill-based card title with ads (when enabled).
- Age rating questionnaire must be completed by developer — not auto-generated here.

## Encryption

- `ITSAppUsesNonExemptEncryption: false` declared for iOS.

## Unresolved disclosure questions (blockers)

- [ ] Final production AdMob app IDs and unit IDs confirmed in EAS production env
- [ ] ATT / personalized ads disclosure matches live build behavior
- [ ] Account deletion support path documented if accounts are created
- [ ] Privacy policy URL published and matches this map
- [ ] Google Play Data safety form completed from this map
