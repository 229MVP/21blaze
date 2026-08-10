# Version 1.5 Release Notes (RC)

## Version 1.5.0 — Live PvP RC foundation

Marketing version **1.5.0** · iOS build **909** · Android versionCode **902**.

### Live PvP (internal QA only)

- Friend invite → lobby → synchronized countdown → timed competitive match.
- Realtime private channels, server-authoritative settlement, progress heartbeats.
- Disconnect recovery: checkpoint schema v2, bounded reconnect, foreground resync.
- Rematch and private player / head-to-head records (no public leaderboards).
- **Not enabled in production** — `EXPO_PUBLIC_ENABLE_LIVE_PVP=false` and server creation OFF until two-device RC QA completes.

### Security

- Privilege closure migration revokes client execution on internal `SECURITY DEFINER` helpers.
- Nine-argument `enqueue_player_notification` no longer callable by clients.
- Checkpoint no longer stores authoritative seed.

### Native / build

- Restored Kotlin 2.3.0 Gradle pin for AdMob / Purchases compatibility.
- Deduplicated iOS SKAdNetwork and Android permissions.
- Restored `testflight-rescue` and new `live-pvp-qa` EAS profiles.

### Known limitations

- No public matchmaking, ranking, rewards, spectators, or chat.
- Full deck in checkpoint for resume (documented in security audit).
- Manual device QA required before flag enablement.
