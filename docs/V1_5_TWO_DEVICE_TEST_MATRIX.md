# Version 1.5 Two-Device Test Matrix

**Status:** **UNPERFORMED — requires physical devices and staging backend**

Do not mark rows PASS without device evidence.

## Device combinations

| Combo | Build profile | Status |
|-------|---------------|--------|
| iOS / iOS | `live-pvp-qa` | UNPERFORMED |
| Android / Android | `live-pvp-qa` | UNPERFORMED |
| iOS / Android | `live-pvp-qa` | UNPERFORMED |

## Network matrix

| Case | Status |
|------|--------|
| Same Wi-Fi | UNPERFORMED |
| Different Wi-Fi | UNPERFORMED |
| Cellular vs Wi-Fi | UNPERFORMED |
| Moderate latency | UNPERFORMED |
| Packet loss | UNPERFORMED |
| Airplane mode + recovery | UNPERFORMED |

## Lifecycle matrix

| Scenario | Status |
|----------|--------|
| Invite create / accept / decline / cancel | UNPERFORMED |
| Both Ready | UNPERFORMED |
| Synchronized countdown | UNPERFORMED |
| One finishes early | UNPERFORMED |
| Simultaneous completion | UNPERFORMED |
| Forfeit | UNPERFORMED |
| Timeout / finalizer | UNPERFORMED |
| Background / foreground | UNPERFORMED |
| Force-close + checkpoint recovery | UNPERFORMED |
| Recovery after deadline (must reject) | UNPERFORMED |
| Token refresh (lobby + gameplay) | UNPERFORMED |
| Account switch | UNPERFORMED |
| Stale push / deep link | UNPERFORMED |
| Simultaneous rematch | UNPERFORMED |
| Expired/declined rematch UX | UNPERFORMED |
| Private records accuracy | UNPERFORMED |

## Accessibility

| Case | Status |
|------|--------|
| Large text | UNPERFORMED |
| Smallest screen | UNPERFORMED |
| Tablet | UNPERFORMED |
| VoiceOver | UNPERFORMED |
| TalkBack | UNPERFORMED |
| Long display names | UNPERFORMED |
| Reduced motion | UNPERFORMED |
| Dark mode contrast | UNPERFORMED |
| Non-color-only status (ready/connection/error) | UNPERFORMED |

## Recording template

| Date | Device | OS | Build | Network | Scenario | Expected | Actual | Pass/Fail | Evidence |
|------|--------|----|-------|---------|----------|----------|--------|-----------|----------|
