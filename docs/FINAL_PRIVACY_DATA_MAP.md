# Version 1.2.0 Final Privacy & Data Map

High-level map for store privacy questionnaires. Confirm against actual SDK behavior
on device before submission.

## Data collected (when online features used)

| Data | Purpose | Storage | User control |
|------|---------|---------|--------------|
| Display name | Leaderboard / profile | Supabase | Editable in app |
| Game scores (verified) | Global leaderboard | Supabase | Auth optional |
| Auth session (anonymous) | Online services | Device + Supabase | Local mode available |
| Cosmetic ownership | Locker / gameplay | Supabase + local cache | Server authoritative |
| Blaze Coin balance | Locker economy | Supabase | Server authoritative |
| Settings (sound, haptics, motion) | UX | AsyncStorage | Settings screen |
| Local high scores | Local tab | AsyncStorage | Device only |
| Ad consent state | AdMob UMP | SDK + local | Privacy options when required |

## Not collected in diagnostics

Startup diagnostics and analytics must not log: access tokens, emails, raw user IDs,
wallet rows, ad identifiers, RevenueCat keys, or service-role secrets.

## Third-party SDKs (release build)

| SDK | When active | Notes |
|-----|-------------|-------|
| Google Mobile Ads | Monetization beta + ad flags | Test units on TestFlight |
| AdMob UMP | Before ad requests (Android) | Failure must not block gameplay |
| RevenueCat | Only when `STORE_PURCHASES=true` | **Disabled** for 1.2.0 release |
| Supabase | Online auth, scores, locker | Optional for Solo |

## ATT (iOS)

Tracking permission requested only when personalized ads configuration requires it.
Declining does not block Solo Play.

## Children's privacy

Game is not directed at children under 13; store age rating must reflect actual content.
