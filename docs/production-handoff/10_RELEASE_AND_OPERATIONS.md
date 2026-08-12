# Release and Operations Checklist

## Environments

- `local`: local services and deterministic fixtures.
- `dev`: shared integration environment.
- `staging`: production-like data shape, sandbox purchases, load tests.
- `production`: protected keys, audited migrations, monitored services.

Never share service-role secrets or store receipt secrets in the client. Separate Supabase projects or equivalent isolation is recommended for staging and production.

## Build pipeline

1. Format, lint, typecheck, unit tests.
2. Deterministic engine fixtures.
3. Database migration validation and RLS tests.
4. Integration tests against staging.
5. Mobile build and smoke tests.
6. Signed internal build.
7. Closed beta rollout.
8. Crash/performance review.
9. Staged production rollout with rollback plan.

## Store requirements

- App icon, adaptive Android icon, launch screen, screenshots, preview video optional.
- Privacy policy, terms, support URL, account deletion instructions.
- Age rating and declarations for ads, purchases, user interaction, loot-like mechanics, and data collection.
- Google Play data safety and Apple privacy nutrition labels must match actual SDK behavior.
- Test accounts and reviewer instructions for PvP/private rooms.
- Restore purchases and manage subscription entry if subscriptions are introduced.

## Monitoring

- Crash and ANR rate.
- API and realtime error/latency.
- Queue length and matchmaking time.
- Active matches, invalidation, reconnect, and forfeit rates.
- Purchase verification and ledger failures.
- Database saturation, storage, and migration health.
- Rules/config version adoption and minimum-client compliance.

## Incident controls

- Maintenance mode.
- Disable ranked queue.
- Disable individual power.
- Freeze shop purchases.
- Invalidate affected matches with no rating loss.
- Roll back remote config.
- Force minimum client version only for security or data-integrity issues.
- Preserve audit logs and communicate status in-app.

## Beta sequence

1. Team-only practice and deterministic engine build.
2. Team private PvP with two powers: Shield and Frost Lock.
3. Closed Android beta with all eight powers and placeholder effects.
4. Balance update and final effects/audio integration.
5. Wider Android closed beta and iOS TestFlight when Mac/cloud build access is available.
6. Soft launch in a limited region before global ranked season.
