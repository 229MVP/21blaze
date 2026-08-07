# Daily Challenge Operations

Operational guide for Version 1.3.0 Phase 1 backend.

## UTC reset

- Official challenge identity uses **UTC calendar date** (`00:00 UTC`).
- `utc_challenge_date()` in Postgres and `getUtcChallengeDate()` in TypeScript must agree.
- Players in different local time zones receive the same challenge for the same UTC instant.

## Creating today's challenge

### Automatic (production path)

`ensure_daily_challenge_for_date(date)` runs inside:

- `get_today_daily_challenge()`
- `start_daily_challenge()`

On first access for a UTC date, it inserts a row with:

- `authoritative_seed = derive_daily_challenge_authoritative_seed(date)`
- `seed = derive_daily_challenge_numeric_seed(authoritative_seed)`
- `rules_version = 1`, `deck_version = '1'`, `duration_seconds = 120`, `bust_limit = 3`
- `status = 'active'`

### Manual / dev SQL

```sql
SELECT public.ensure_daily_challenge_for_date(public.utc_challenge_date());
```

Or for a specific date:

```sql
SELECT public.ensure_daily_challenge_for_date('2026-08-07'::date);
```

### Local Supabase

After migrations:

```bash
supabase db reset   # local only
# or
supabase migration up
```

Then call the SQL above or use **Settings → Daily Challenge Diagnostics (DEV)** in a `__DEV__` build with Supabase configured.

## Pre-generating future challenges

```sql
SELECT public.ensure_daily_challenge_for_date('2026-12-25'::date);
```

Future phases may add a scheduled job (pg_cron / Edge Function) to pre-create rows and set `status = 'scheduled'` before flipping to `active` at UTC midnight.

## Publication

| Status | Player read (RLS) | Start RPC |
|--------|-------------------|-----------|
| `scheduled` | No | No |
| `active` | Yes | Yes |
| `published` | Yes | Yes |
| `closed` | No | No |

To publish early, set `published_at` and optionally `status = 'published'`.

## Disabling a broken challenge

```sql
UPDATE public.daily_challenges
SET status = 'closed'
WHERE challenge_date = '2026-08-07';
```

Players cannot start new ranked attempts while disabled. Existing in-progress attempts should be handled in a future ops playbook (abandon / invalidate).

## Rules version changes

1. Bump constants in `src/challenge/dailyChallengeRegistry.ts`.
2. Update `ensure_daily_challenge_for_date` defaults for **new** dates only.
3. Never retroactively change `rules_version` on existing `daily_challenges` rows.
4. Completion RPC rejects `p_rules_version` mismatch.

When scoring logic changes, increment `rules_version` (and possibly `deck_version`) so old leaderboards remain valid under old rules.

## Migrations

| File | Purpose |
|------|---------|
| `0011_v1_3a_daily_challenge.sql` | Tables, baseline RLS, leaderboard view |
| `0012_v1_3_phase1_daily_challenge_rpc.sql` | Authoritative seed, RPCs, hardened RLS |

Apply via Supabase CLI or dashboard migration pipeline. **Do not** alter hosted DB without committing migration files.

## Verification checklist

- `npm run test:daily-challenge-deck`
- `npm run test:daily-challenge-attempts`
- `npm run test:daily-challenge` (legacy 1.3A self-test + Solo isolation)
