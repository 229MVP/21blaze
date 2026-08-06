# Version 1.3A — Daily Challenge Test Matrix

## Automated (`npm run test:daily-challenge`)

1. Same seed ⇒ same deck  
2. Different seeds ⇒ different decks  
3. Solo shuffle path unchanged  
4. UTC date helpers  
5. UI status derivation  
6. Cached challenge validity  
7. Missing feature flags fail safe  
8. Ads blocked on `dailyChallenge` screen  
9. Purchases remain disabled  

## Manual / QA (post-backend deploy)

| Scenario | Expected |
|----------|----------|
| Fresh install, flags on | Home shows Daily Challenge entry |
| Offline ranked start | Blocked with online message |
| Online ranked start | Countdown → gameplay → verification → rank |
| Practice | Results show PRACTICE RESULT, no rank |
| Duplicate ranked start | Same attempt or safe 409 |
| Quit before first move | Ranked not consumed (expired) |
| Quit after first move | Ranked abandoned |
| Leaderboard | Verified scores only |
| Next UTC day | New challenge date + seed |
| Flags off | Solo Play unchanged, no challenge routes |
| Wallet / cosmetics | Unchanged after challenge |

## Device Layout

- Daily Challenge screen fits 320×800 with Solo Play still visible on Home
- Gameplay label `DAILY RANKED` / `DAILY PRACTICE` readable on compact widths
