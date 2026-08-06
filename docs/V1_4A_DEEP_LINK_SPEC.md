# Version 1.4A — Deep Link Specification

## Native scheme (existing)

- App scheme: `twentyoneblaze` (from `app.json`)
- Challenge path: `twentyoneblaze://challenge/BLAZE-XXXX-XXXX`

## Universal link (when configured)

- `https://21blaze.app/challenge/BLAZE-XXXX-XXXX`

## Behavior

- Opening link navigates to `JoinAsyncChallenge` with `inviteCode` param
- Does **not** auto-accept; shows preview + ACCEPT
- Logged-out users must authenticate; pending code preserved in store
- Invalid codes show visible error
- Web: share falls back to copy; native share when available
- Requires `EXPO_PUBLIC_ENABLE_ASYNC_CHALLENGE_DEEP_LINKS=true`

## Flag gating

Deep linking config registered only when deep-link flag is enabled (see `App.tsx`).
