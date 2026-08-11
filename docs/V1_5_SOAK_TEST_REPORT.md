# Version 1.5 Soak Test Report

**Status:** **UNPERFORMED**

## Target

| Metric | Target | Achieved |
|--------|--------|----------|
| Completed matches | ≥ 50 | 0 |
| Concurrent pairs | ≥ 10 | 0 |
| Reconnect cycles | repeated | 0 |
| Invitation expiration | repeated | 0 |
| Rematch chains | repeated | 0 |
| Finalizer under load | yes | UNPERFORMED |

## Reason

Requires staging Supabase with Live PvP migrations applied and load-generation tooling or coordinated testers. No 21blaze staging project was available in the RC agent environment.

## Monitoring checklist (when run)

- Channel join success / latency
- Realtime auth errors
- State-version gaps
- Reconnect success rate
- Duplicate channels / settlements
- Stuck matches / active slots
- Notification deduplication
- Finalizer batch duration
- DB errors
- Broadcast delivery lag
