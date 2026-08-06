# Version 1.4A — Async Challenge Specification

## Lifecycle

1. **Create** — Authenticated player creates challenge; server assigns seed, expiry (48h), invite code.
2. **Share** — Creator shares `BLAZE-XXXX-XXXX` or deep link (no auto-accept).
3. **Accept** — Opponent validates code, accepts atomically (one opponent slot).
4. **Start attempt** — Each participant starts once; server returns seed + attempt id.
5. **First move** — Official attempt consumed after first meaningful card play.
6. **Complete** — Move log replayed server-side; verified stats stored.
7. **Finalize** — When both attempts verify, server compares and sets winner/draw.
8. **Expire** — Open/accepted challenges expire at `expires_at` (server time).

## Rules (authoritative server)

- Two players, one official attempt each
- Same seed, duration (120s), rules v1, scoring v1
- Free — no wallet changes in 1.4A
- No ads during async flows
- No rewards in 1.4A
- Guest/anonymous cannot create, accept, or submit

## Rate limits (initial)

- 5 open outgoing challenges per creator
- 10 creations per UTC day
- 30 invite lookups per hour per actor key

## Feature flags (fail closed)

- `EXPO_PUBLIC_ENABLE_ASYNC_CHALLENGES`
- `EXPO_PUBLIC_ENABLE_ASYNC_CHALLENGE_CREATION`
- `EXPO_PUBLIC_ENABLE_ASYNC_CHALLENGE_JOIN`
- `EXPO_PUBLIC_ENABLE_ASYNC_CHALLENGE_DEEP_LINKS`
- `EXPO_PUBLIC_ENABLE_ASYNC_REMATCH` (default false)
