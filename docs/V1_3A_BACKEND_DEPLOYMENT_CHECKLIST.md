# Version 1.3A — Backend Deployment Checklist

Apply before enabling Daily Challenge flags in a preview/TestFlight build.

## 1. Migration

```bash
supabase db push
# or apply supabase/migrations/0011_v1_3a_daily_challenge.sql manually
```

Verify tables:

- `daily_challenges`
- `daily_challenge_attempts`
- `daily_challenge_streaks`
- view `daily_challenge_leaderboard`

## 2. Edge Function

```bash
supabase functions deploy daily-challenge
```

Confirm `supabase/config.toml` includes:

```toml
[functions.daily-challenge]
verify_jwt = true
```

## 3. Smoke Tests (authenticated)

1. `action: get_status` → returns today's challenge + null ranked attempt  
2. `action: start_attempt`, `attemptType: ranked` → returns seed + attemptId  
3. Play client match, `action: complete_attempt` with move log → verified + rank  
4. Second ranked start same day → 409 or idempotent open attempt  
5. `action: get_leaderboard` → includes verified entry  

## 4. RLS Verification

- User A cannot select/update User B's `daily_challenge_attempts`
- Anonymous client cannot insert challenges

## 5. Client Flags (preview only when ready)

```
EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE=true
EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_RANKED=true
EXPO_PUBLIC_ENABLE_DAILY_CHALLENGE_PRACTICE=true
EXPO_PUBLIC_ENABLE_DAILY_LEADERBOARD=true
```

Keep purchases disabled:

```
EXPO_PUBLIC_ENABLE_STORE_PURCHASES=false
```

## 6. Rollback

- Disable client flags
- Leave schema in place (historical attempts preserved)
- Optionally mark `daily_challenges.status = closed` for a date if needed
