# Version 1.5 Staging Database Report

**Status:** **UNPERFORMED — staging project not linked**

## Attempted identification

Available Supabase MCP connections in the RC agent environment:

| MCP server | Project URL | Migration tail | 21blaze match |
|------------|-------------|----------------|---------------|
| `supabase` | `https://qpxtntvnripddmspsckp.supabase.co` | fantasy/chat tables, `0013` only | **No** |
| `DraftsPicks.com` | `https://mgplqovylfaziwnugzvh.supabase.co` | beta application system | **No** |
| `Undefeated Draft Picks` | `https://wckflnjvzyppctkzlqkc.supabase.co` | account deletion / v1 security | **No** |

None contain `live_pvp_*` migrations or `20260810185335_v1_5_live_pvp_privilege_closure.sql`.

**Action required:** Link the 21blaze **staging** project (non-production, test accounts only) before applying v1.5 migrations.

## Local replay

| Check | Result |
|-------|--------|
| Docker | **Not available** in RC agent VM |
| `supabase db reset` | **UNPERFORMED** |
| Privilege SQL on replayed DB | **UNPERFORMED** |
| `supabase db lint` | **UNPERFORMED** |
| Advisors | **UNPERFORMED** on 21blaze staging |

## Expected migration order (22 files)

`0001` … `0018` → `20260810143545` → `20260810151826` → `20260810183000` → `20260810185335`

Privilege closure SHA-256: `e755e2d97346e6a4123259ebc084a8d86ea65c45948d2be282a7ff6ecefa05fa`

## Staging verification checklist (when linked)

- [ ] `supabase migration list` matches repo
- [ ] `has_function_privilege` matrix for Live PvP RPCs
- [ ] `anon` denied on `finalize_live_pvp_deadlines`
- [ ] `enqueue_player_notification` overloads service_role only
- [ ] RLS on all `live_pvp_*` tables
- [ ] Rematch idempotency + record isolation (two test users)
- [ ] Realtime participant isolation (A/B join, C rejected)
- [ ] Seed not in notifications/records before countdown
- [ ] Service-role finalizer cron on staging
