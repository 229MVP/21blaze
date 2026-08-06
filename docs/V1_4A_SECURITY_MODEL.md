# Version 1.4A — Security Model

## Client cannot

- Choose official seed, duration, or expiration
- Submit authoritative score or winner
- Accept own challenge
- Replace assigned opponent
- Read opponent private attempt rows via RLS
- Insert challenge/attempt rows directly (service role Edge only)

## Server

- Seeds from `crypto.getRandomValues` (Edge), not `Math.random`
- Invite codes hashed (SHA-256) at rest
- Invalid lookup returns generic 404 (no leak of existence beyond valid format)
- Idempotent create/accept/start/complete
- RLS: participants SELECT challenges; SELECT own attempts only
- Rate limits via `async_challenge_rate_limits` RPC

## RLS

- `async_challenges`: SELECT for creator or opponent only
- `async_challenge_attempts`: SELECT own rows only
- No client INSERT/UPDATE on challenge tables

## Edge Function

- `async-challenge` uses service role after JWT auth
- `resolve_invite` allows unauthenticated preview (public creator info only)
