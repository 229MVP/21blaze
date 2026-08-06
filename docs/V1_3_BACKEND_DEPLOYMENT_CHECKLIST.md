# Version 1.3 — Backend Deployment Checklist

## Migration order

1. `0011_v1_3a_daily_challenge.sql`
2. `0012_v1_3b_leaderboards.sql`
3. `0013_v1_3c_challenge_rewards.sql`

## Edge Functions

- `daily-challenge` (attempts, leaderboards, rewards, participation grants)

## Cron / scheduled jobs

**Not deployed in-repo.** Production should schedule `SELECT finalize_expired_daily_challenges();` at least hourly. Lazy finalization runs on leaderboard/reward reads as fallback.

## Required secrets

- Service role (Edge only) — never in client
- `EXPO_PUBLIC_SUPABASE_URL` + publishable key

## Client flags (QA)

- `EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE`
- `EXPO_PUBLIC_ENABLE_DAILY_LEADERBOARD` / `WEEKLY_LEADERBOARD`
- `EXPO_PUBLIC_ENABLE_CHALLENGE_REWARDS` (+ streak/placement/weekly/badge subflags)

## Rollback

- Do not drop `daily_challenge_attempts` in production
- Disabling flags reverts client UX; server grants remain safe if flags OFF on client
