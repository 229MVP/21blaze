# Version 1.4A — Test Matrix

Automated: `npm run test:async-challenge` (`src/async/v1_4aAsyncChallengeSelfTest.ts`)

Covers (client/policy):

- Same seed → same deck
- Invite normalization and format
- Result comparison and draw
- Server-time expiration math
- Feature flags fail closed
- Interstitial blocked on async screens
- Hub badge/section logic

Manual / backend (requires deployed migration + Edge):

- RLS opponent isolation
- Concurrent accept race
- Rate limits
- Full create → accept → play → finalize on two accounts

Regression suites: `test:game`, `test:daily-challenge`, `test:monetization`, `test:v1.1c-ads`, etc.
