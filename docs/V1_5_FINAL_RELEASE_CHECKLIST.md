# Version 1.5 Final Release Checklist

Consolidates release-freeze + RC validation status. Check only when verified.

## Code / config (RC branch)

- [x] Expo SDK 57 packages aligned (`expo install --fix`)
- [x] Expo Doctor 20/20
- [x] AdMob environment-specific native config
- [x] Production ads disabled without verified EAS AdMob app IDs
- [x] Microphone / foreground-service permissions removed
- [x] Kotlin 2.3.0 plugin
- [x] Full automated regression (see RC validation report)
- [x] `@supabase/supabase-js` 2.109.0 pinned

## Database

- [ ] Full migration replay (local Docker or staging)
- [ ] Staging privilege verification
- [ ] Advisors / lint on 21blaze staging
- [ ] Rollback drill on staging

## Device QA

- [ ] Two-device matrix (all combinations)
- [ ] Reconnect + force-close recovery on device
- [ ] Accessibility (VoiceOver / TalkBack / large text)

## Load

- [ ] Soak test ≥ 50 matches / 10 concurrent pairs

## Release gates

- [ ] `live-pvp-qa` EAS build with staging Supabase env
- [ ] EAS `project:info` verified interactively
- [ ] Production AdMob IDs configured **or** production ads stay off
- [ ] Live PvP flags OFF for production until owner sign-off

## Decision log

| Date | Decision | Owner |
|------|----------|-------|
| 2026-08-10 | RC local blockers resolved; staging/device/soak outstanding | Agent RC run |
