# Version 1.3B — Test Matrix

Automated: `npm run test:leaderboards`, `npm run test:daily-challenge`, plus existing game/monetization suites.

## Policy tests (leaderboards self-test)

1. Verified-only daily ranking tie-breakers
2. Challenge Points table
3. Weekly tie-breakers
4. UTC week boundaries
5. Display name validation and reserved terms
6. Friends leaderboard flag default false
7. RevenueCat disabled default
8. Ads blocked on leaderboard screen
9. Pagination duplicate guard

## Manual / QA

- Daily and Weekly tabs
- Pull to refresh (online only)
- Offline cached label
- Verification pending hides official rank
- Practice results never show rank/points
- Responsive layouts 320–430px and tablet
- Finalization after UTC day + 10m grace

See also `V1_3A_TEST_MATRIX.md` for Daily Challenge gameplay tests.
