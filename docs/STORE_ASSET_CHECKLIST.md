# Store Asset Checklist — 1.2.0

Do not fabricate screenshots. Capture from a **release-profile** build or
production-minified web at representative phone sizes.

## Required assets in repo

| Asset | Path | Status |
|-------|------|--------|
| App icon | `assets/icon.png` | Present |
| Android adaptive icon | `assets/android-icon-*.png` | Present |
| Splash icon | `assets/splash-icon.png` | Present |
| Web favicon | `assets/favicon.png` | Present |

## Apple App Store

| Asset | Size / notes | Status |
|-------|--------------|--------|
| iPhone 6.7" screenshots | 1290×2796 or 1284×2778 | **NEEDED** |
| iPhone 6.5" screenshots | 1242×2688 etc. | **NEEDED** |
| iPad screenshots | Only if marketing tablet — app supports tablet | Optional |
| App preview video | Optional | Not required |

## Google Play

| Asset | Notes | Status |
|-------|-------|--------|
| Phone screenshots | Min 2; 16:9 or 9:16 | **NEEDED** |
| 7" tablet | Optional | |
| 10" tablet | Optional | |
| Feature graphic | 1024×500 | **NEEDED** |
| App icon | 512×512 high-res export from master | **NEEDED** for console |

## Recommended screenshot sequence

Capture only **shipping** features:

1. **Home** — Solo Play prominent; no deferred mode buttons
2. **Gameplay** — four lanes, timer, score, active card
3. **Exact 21 or lane clear** — feedback visible
4. **Results** — real score summary
5. **High Scores** — Local or Global tab
6. **Settings** or **How to Play**
7. **Blaze Locker** — only if locker flag enabled on capture build

Do not screenshot: Live Duel, Ranked, Daily Challenge, paywall, dev tools, Friends tab.

## Marketing / support

| Item | Status |
|------|--------|
| Privacy policy page | **BLOCKER — URL needed** |
| Support email or web form | **BLOCKER — URL needed** |
| App review notes | See `APP_REVIEW_NOTES.md` |

## Test credentials

| Item | Notes |
|------|-------|
| Demo account | **Not required** — Solo works without login |
| Optional online test | Anonymous auth auto-created; document if reviewer needs global scores |

## Pre-capture build

Use `testflight` (iOS, test ads) or `preview` APK (Android internal) for QA captures.
Use `production` / `android-production` only for final metadata accuracy review.
