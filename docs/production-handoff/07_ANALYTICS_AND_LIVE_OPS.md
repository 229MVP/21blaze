# Analytics and Live Operations

## Key product metrics

- Tutorial completion.
- First practice completion.
- First PvP completion.
- D1, D7, and D30 retention.
- Matches per daily active user.
- Match completion, disconnect, forfeit, and invalidation rates.
- Queue time and matchmaking rating spread.
- Average match length and placement decision time.
- Exact-21 rate, bust rate, five-card lane rate, and Auto-Route rate.
- Power pick, activation, counter, and normalized win rates.
- Ranked distribution and rating inflation.
- Conversion, average revenue per payer, refund rate, and cosmetic equip rate.

## Required events

- `app_opened`, `session_started`, `session_ended`
- `auth_started`, `auth_completed`, `guest_started`
- `tutorial_step_started`, `tutorial_step_completed`, `tutorial_abandoned`
- `screen_viewed`
- `mode_selected`, `loadout_changed`
- `matchmaking_started`, `matchmaking_cancelled`, `match_found`
- `match_started`, `match_completed`, `match_forfeited`, `match_invalidated`
- `card_revealed`, `card_placed`, `card_auto_routed`
- `lane_reached_21`, `lane_busted`, `lane_five_card_completed`
- `power_activated`, `power_blocked`, `power_cleansed`, `power_expired`
- `connection_lost`, `connection_restored`, `reconnect_failed`
- `mission_completed`, `reward_claimed`, `level_up`
- `shop_viewed`, `item_previewed`, `purchase_started`, `purchase_completed`, `purchase_failed`, `purchase_restored`
- `settings_changed`, `accessibility_changed`
- `report_submitted`, `support_opened`

## Common properties

`eventId`, `occurredAt`, `userId/anonymousId`, `sessionId`, `clientVersion`, `platform`, `deviceClass`, `country`, `rulesVersion`, `experimentAssignments`, and `networkType`.

Match events additionally carry `matchId`, `mode`, `seasonId`, `matchRevision`, `elapsedMs`, `ratingBand`, `selectedTheme`, and equipped power IDs. Do not send hidden deck contents before the match completes.

## Remote configuration

- Minimum supported app version.
- Maintenance mode and message.
- Rules and balance version.
- Match and placement timers.
- Power costs, cooldowns, and durations.
- Matchmaking expansion thresholds.
- Feature flags for modes, shop, ads, and effects quality.
- Catalog and event schedules.

Changes affecting ranked outcomes require a new rules version and should not occur during an active match. Clients receive the match's frozen rules at match creation.

## Experiments

Never A/B test competitive rule strength between matched players. Safe tests include onboarding copy, home hierarchy, cosmetic previews, mission presentation, store merchandising, and noncompetitive notification timing.
