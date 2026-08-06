# Version 1.4A — Backend Deployment Checklist

## Required

1. Apply migration `supabase/migrations/0014_v1_4a_async_challenges.sql`
2. Deploy Edge Function `async-challenge` (`supabase/functions/async-challenge/index.ts`)
3. Verify `finalize_expired_async_challenges()` callable from Edge (lazy expiry)

## Optional

- Scheduled cron calling `finalize_expired_async_challenges()` (lazy finalization on requests is sufficient for beta)

## QA flags (non-production)

```
EXPO_PUBLIC_ENABLE_ASYNC_CHALLENGES=true
EXPO_PUBLIC_ENABLE_ASYNC_CHALLENGE_CREATION=true
EXPO_PUBLIC_ENABLE_ASYNC_CHALLENGE_JOIN=true
EXPO_PUBLIC_ENABLE_ASYNC_CHALLENGE_DEEP_LINKS=true
```

## Blockers if skipped

- Client hub shows offline errors
- Create/accept/start/complete return function errors
- No async data in database

## Not in 1.4A

- Rewards, rematch, push notifications, EAS build, RevenueCat
