# Daily Challenge — Live Backend Verification (Phase 1.5)

Hosted project: **21 Blaze** (`ioxydgrcgtvrvoxjtupr`)

Run locally (requires keys in environment — never commit secrets):

```bash
EXPO_PUBLIC_SUPABASE_URL=https://ioxydgrcgtvrvoxjtupr.supabase.co \
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key> \
SUPABASE_SERVICE_ROLE_KEY=<service-role-for-test-user-lifecycle-only> \
npx tsx scripts/dailyChallengeLiveVerification.ts
```

`SUPABASE_SERVICE_ROLE_KEY` is used only to create/delete ephemeral test auth
users and clean up their attempt rows. It must never ship in the Expo app.

## Canonical architecture

```
Expo Client
  → src/challenge/dailyChallengeClient.ts
  → Supabase RPC (start_daily_challenge / complete_daily_challenge)
  → daily_challenges / daily_challenge_attempts
```

## Legacy (deprecated for ranked play)

| Path | Status |
|------|--------|
| `supabase/functions/daily-challenge` | Legacy Edge Function — move-log replay path; **not** canonical for Phase 2 ranked UI |
| `src/services/dailyChallengeService.ts` | Legacy client — invokes Edge Function; gated UI still references it until Phase 2 migration |
| Migration `0011` | Base tables — extended by `0012` RPC hardening |

Phase 2 UI must use `dailyChallengeClient.ts`, not the Edge Function service.

## Abandoned attempts

See `docs/DAILY_CHALLENGE_ABANDONED_ATTEMPT_POLICY.md`.
