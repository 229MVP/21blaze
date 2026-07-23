# Database Rollback Plan — 21 Blaze RC 0.9.0

Use this when a migration or data backfill misbehaves on staging/production.  
Migrations `0001`–`0006` are **forward-only** SQL (create tables/functions/policies). There are no automated down-migrations in-repo.

**Remote deployment unverified** at audit time — practice this plan on staging before production apply.

---

## Principles

1. Prefer **restore from snapshot** over hand-written DROP scripts for production incidents.
2. Never run destructive rollback on production without a confirmed backup.
3. Edge function rollback is independent: redeploy previous function bundle; DB may still need restore.
4. Client app rollback (store version) does not undo schema changes.

---

## Pre-deploy safeguards

| Step | Action | Owner |
|------|--------|-------|
| 1 | Take Supabase project backup / PITR note (timestamp) before applying new migrations | Ops |
| 2 | Apply to **staging** first; run smoke tests | Eng |
| 3 | Record migration versions applied (`supabase_migrations.schema_migrations` or dashboard history) | Eng |
| 4 | Deploy edge functions only after schema checks pass | Eng |
| 5 | Keep previous app binary available (TestFlight / internal track) | Release |

---

## Rollback options (ordered)

### Option A — Point-in-time / snapshot restore (preferred)

1. Stop or pause traffic that writes (optional: disable risky flags / take app offline message).
2. Restore database to pre-migration snapshot.
3. Redeploy edge functions that match restored schema.
4. Verify auth, a solo submit, wallet SELECT, and one live-room create.
5. Communicate RC delay; do not ship store build on unrestored state.

**Use when:** Migration corrupted data, broke RLS, or functions depend on half-applied schema.

### Option B — Targeted forward fix (preferred if restore costly)

1. Ship a new migration (`0007+`) that corrects logic (e.g. solo score trust) without dropping tables.
2. Redeploy affected edge functions (`claim-match-coins`, etc.).
3. Add monitor/query for bad wallet grants; reverse with service-role ledger corrections if needed.

**Use when:** Bug is logical (trusting client score) and schema is intact.

### Option C — Disable feature at edge / flags (mitigation, not rollback)

1. Turn off client flags (`EXPO_PUBLIC_ENABLE_STORE_PURCHASES`, progression, ranked) via EAS update / new build.
2. Optionally return 503 from broken edge functions.
3. Keeps DB as-is; buys time for Option A/B.

**Use when:** Exploit or outage in progress; immediate user-facing stop needed.

---

## Per-migration risk notes

| Migration | Risk if rolled back poorly | Notes |
|-----------|----------------------------|-------|
| 0001 Leaderboard | Drops profiles/matches if forced DROP | High coupling to auth profiles |
| 0002 Live duels | Orphan live rooms / results | Coordinate with live edge functions |
| 0003 Quick match | History snapshot columns | Casual queue may break |
| 0004 Ranked | Ratings / history loss | Competitive integrity — prefer restore |
| 0005 Monetization | **Wallet & entitlement data** | Highest care — never DROP without backup |
| 0006 Progression | XP / daily claim state | Users may re-claim if poorly reset |
| 0007 (planned) | Score verification change | Prefer forward fix; test claim idempotency |

---

## Data correction playbook (monetization)

If bad coin grants occur before 0007:

1. Identify `wallet_transactions` rows by `idempotency_key` / time window.
2. Use service-role only to apply compensating negative deltas via existing helpers (do not open client writes).
3. Document user IDs affected; do not silently delete ledger rows if audit trail required.
4. Re-test `claim-match-coins` with mismatched score after fix.

---

## Edge function rollback

| Action | Command / steps |
|--------|-----------------|
| Redeploy previous version | Deploy last known-good function source from git tag |
| Disable webhook | Remove/pause RevenueCat webhook URL until auth/schema healthy |
| Verify | Hit health/auth paths; confirm 401 without user, 200 with authed smoke |

---

## Decision tree

```
Incident after deploy?
├─ Data corruption / cannot query core tables → Option A (restore)
├─ Logic bug, schema OK → Option B (forward migration)
└─ Active exploit / store risk → Option C (disable) then A or B
```

---

## Post-rollback checklist

- [ ] Schema matches intended git tag
- [ ] Edge functions match schema
- [ ] Client env points to healthy project
- [ ] No leftover placeholder secrets rotated if exposure suspected
- [ ] Incident notes filed; RC gates re-opened only after re-validation
