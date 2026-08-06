# Version 1.2.0 Startup Black-Screen Report

## Symptom

The Version 1.2.0 TestFlight build installs successfully, but opening it
produces a completely black screen indefinitely. Version 1.1 previously
launched correctly.

## Reproduction attempts and their limits

This cloud environment has no iOS/Android simulator or physical device,
so the literal on-device crash could not be observed directly. What WAS
run, and its result:

| Command | Result |
|---|---|
| `npx expo export --platform ios --clear` | Succeeds — 0 errors, 1958 modules bundled |
| `npx expo export --platform web --clear` | Succeeds — 0 errors, 1311 modules bundled |
| `npx expo start --no-dev --minify --clear`, then requesting `index.bundle?platform=ios&dev=false&minify=true` and `...platform=web...` directly from Metro | Both bundle successfully (HTTP 200), confirming the failure is a **runtime** issue, not a bundling/syntax issue — exactly the distinction the hotfix brief warned not to assume away. |

Since a successful export/bundle does **not** prove the app renders
correctly at runtime, the rest of this report is a structural audit of
the actual startup code path, cross-referenced against what changed
between the working Version 1.1 TestFlight build and Version 1.2.0.

## What changed between the last known-working build and 1.2.0

The single most significant, concrete difference: **Version 1.2C's
`eas.json` change flipped six feature flags from `false` to `true` in the
`testflight` build profile** — `EXPO_PUBLIC_ENABLE_V1_1_REWARDS`,
`EXPO_PUBLIC_ENABLE_DAILY_REWARDS`, `EXPO_PUBLIC_ENABLE_DAILY_MISSIONS`,
`EXPO_PUBLIC_ENABLE_V1_1_LOCKER`, `EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM`,
`EXPO_PUBLIC_ENABLE_BOARD_EFFECTS`, `EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS`.

Every one of Version 1.1's TestFlight builds shipped with **all** of
these flags `false`. That means the Locker/rewards/wallet/cosmetic
hydration code paths, and the entire Version 1.2 visual-theme resolution
path, had **never actually executed inside a real, installed TestFlight
binary before** — only inside local `tsx` unit tests (which cannot import
`react-native` at all) and Metro's bundler (which only proves the code
*parses*, never that it *runs* correctly). Version 1.2.0 is the first
build where this code runs for real, on-device, in release mode. This is
exactly why the hotfix brief is correct to treat the visual system (and,
by the same reasoning, the newly-live Locker/rewards hydration it now
runs alongside) as the primary suspect class, even without a captured
crash log.

## The complete startup chain (as it existed going into this hotfix)

1. `index.ts` — `registerRootComponent(App)`.
2. `App.tsx` module scope — `SplashScreen.preventAutoHideAsync()`.
3. `App()` component mounts:
   - `useFonts(...)` starts loading 4 custom font weights.
   - A `setTimeout(4000)` exists to force-proceed if fonts stall.
   - **Four `useEffect`s run unconditionally on mount**, regardless of
     font-load state: `hydrateSettings()`, `hydrateScoreHistory()`,
     `initializeAuth()`, `hydrateInterstitialCaps()`, plus a fifth effect
     that awaits `hydrateSettings()` again and initializes `blazeAudio`.
   - While `!fontsReady`, the component returns a **bare, empty
     `<View style={{ flex: 1, backgroundColor: colors.background }} />`**
     — `colors.background` is `#070707`, i.e. visually indistinguishable
     from pure black, with **zero text or content**.
   - Once `fontsReady` becomes true, `SplashScreen.hideAsync()` fires and
     the component renders `SafeAreaProvider` → `ErrorBoundary` →
     `NavigationContainer` → `AppNavigator` (initial route: `Home`).
4. `HomeScreen` mounts and renders its full UI unconditionally (nothing
   in its JSX is gated on an unresolved promise), then kicks off a
   `useEffect` that **sequentially `await`s** six hydration/init calls:
   `loadHighScore`, `hydrateSettings`, `hydrateScoreHistory`,
   `hydrateWallet`, `hydrateCosmetics`, `initializePurchases`, optionally
   `hydrateProgression`.
5. `usePreloadEquippedVisualTheme()` (also mounted from `HomeScreen`)
   synchronously resolves `useResolvedVisualTheme()` (pure, wrapped in
   try/catch inside `resolvePlayerVisualTheme`) and fire-and-forgets an
   asset preload.

## Every operation identified as capable of preventing the first screen from rendering

| # | Operation | Risk found | Status after this hotfix |
|---|---|---|---|
| 1 | **`ErrorBoundary` did not wrap the font-loading phase.** `ErrorBoundary` was only rendered *inside* the `fontsReady`-true branch. Any synchronous throw in `useFonts`, or in any of the four-plus unconditional root `useEffect`s (which run regardless of `fontsReady`), had **no boundary above it at all** — React unmounts the entire tree on an uncaught render/effect error with nothing above the root to catch it, producing a genuinely empty (black) native view with no recovery UI. This is the single most serious structural gap found. | **Fixed** — `App.tsx` now wraps the *entire* `AppContent` tree (fonts, watchdog, all startup effects, and the full app shell) in `ErrorBoundary`. |
| 2 | **The pre-`fontsReady` loading view rendered nothing but a solid `#070707` `View`.** Even in the fully-successful case, this is visually identical to a crash for up to 4 seconds; if anything ever stalled past that, it was genuinely indistinguishable from "completely black screen indefinitely" from a user's perspective. | **Fixed** — replaced with `StartupFallbackView`, a dependency-free view with a visible non-black background and readable "STARTING 21 BLAZE…" text. |
| 3 | **No independent, top-level startup watchdog** beyond the 4s font timeout. If a future gating condition were added (or if the font timeout itself were bypassed by a code path), there was no second safety net. | **Fixed** — an independent ~8s watchdog now exists, forcing render (with Classic visuals) regardless of *why* something is slow. |
| 4 | **Root startup effects had no individual error handling.** `initializeAuth()`, `hydrateSettings()`, `hydrateScoreHistory()`, `hydrateInterstitialCaps()`, and the audio-init chain were called via bare `void thing()` with no per-call guard; while each store already self-catches internally in most cases, there was no defense-in-depth against a future regression in any of them, and no diagnostic trail. | **Fixed** — every root startup step now runs through `runGuardedStartupStep`, individually try/caught, with sanitized diagnostic stages recorded. |
| 5 | **`HomeScreen`'s hydration chain used six sequential `await`s with no top-level try/catch.** `initializePurchases()` in particular had zero internal error handling — a rejection there (or in any of the other five calls, if one ever regressed) would produce an unhandled promise rejection and could stall `setHighScore` indefinitely (non-fatal to rendering today, since nothing in HomeScreen's JSX gates on this, but a real robustness gap and explicitly called out in the hotfix brief). | **Fixed** — rewritten to `Promise.allSettled`, so one hanging/rejecting task can never block or fail the others. |
| 6 | **`useResolvedVisualTheme` had no hard kill switch.** `EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM` previously only gated the *new* board/victory effects and the dev preview screen — per-slot cosmetic theme resolution (card face/back/arena/lane/profile frame) ran regardless of this flag's value, so there was no way to fully isolate "the visual system" as a variable via that flag alone. | **Fixed** — `shouldForceClassicVisuals()` now short-circuits `useResolvedVisualTheme` straight to `classicTheme` whenever the flag is off, before touching any equipped/owned cosmetic state, theme-registry lookup, or asset-failure bookkeeping. |
| 7 | **`loadVisualAsset`'s native asset download had no timeout.** A hung `Asset.fromModule(...).downloadAsync()` call would leave that one promise (and anything awaiting `preloadThemeAssets`) unresolved forever. Not proven to block rendering (nothing awaits preload today), but a genuine "no infinite hang" gap per the hotfix brief. | **Fixed** — wrapped in a 5s `withTimeout`; a hang now resolves to `'failed'` and falls back to classic. |
| 8 | **`isSupabaseConfigured()` / `requireConfiguredEnv()` could not be tested outside a full RN runtime**, making it impossible to verify in isolation that a missing Supabase environment fails open. (`initializeAuth()` itself already correctly checks `isSupabaseConfigured()` *before* touching the lazy `supabase` client proxy, so this was not found to be an active bug — but it was unverifiable, which the hotfix brief also flags as unacceptable.) | **Fixed** — extracted the pure check into `src/lib/supabaseConfig.ts`, now directly unit-tested. |
| 9 | Ads/UMP/RevenueCat initialization | **Audited, no bug found.** `hydrateAdConsent`/`requestAdConsentIfNeeded` are never called from `App.tsx` or `HomeScreen`'s mount path — both are only invoked lazily from `src/services/adService.ts` immediately before an actual ad request. `configureRevenueCat()` is gated by `isStorePurchasesEnabled()` (false in the `testflight` profile), so RevenueCat is never touched at all. Confirmed by a new structural test (`v1_2StartupHotfixSelfTest.ts` #8-9). |

## Root cause determination

Given the constraints of this environment, the root cause is best
characterized as a **structural startup-robustness gap, most likely
triggered by the Version 1.2C `eas.json` change that, for the first time,
let real Locker/rewards/visual-system code run inside an actual installed
TestFlight binary** — combined with the fact that **any resulting error
had no error boundary above it during the loading phase** (finding #1),
so instead of a recovery screen, the whole tree unmounted to a blank
native view. Findings #2-#7 are independent robustness gaps that either
compound the same failure mode or could independently cause the same
symptom in the future; all are fixed regardless of which one was the
precise trigger in the field.

No single "smoking gun" line of code could be captured without a device
crash log, which per the constraints of this task was not available. The
fix strategy therefore matches the hotfix brief's own framing: harden
every layer of the startup path to fail open, rather than chase one
unconfirmed line.

## Native entry architecture (hotfix branch)

```
index.ts
  import 'react-native-gesture-handler'
  registerRootComponent(App)
  recordStartupStage on global ErrorUtils (best-effort)

App.tsx  (minimal — no fonts, navigation, ads, or stores at module scope)
  recordStartupStage('native_entry')
  preventSplashAutoHideOnce()
  React.lazy(() => import('./AppShell'))
  Suspense fallback → StartupFallbackView ("21 BLAZE" / "STARTING GAME…")
  onFirstLayout → recordStartupStage('rescue_root_rendered') + hideSplashOnce()

AppShell.tsx  (heavy providers load only after lazy import resolves)
  ErrorBoundary → AppContent
  useFonts + 4s font timeout + 8s watchdog
  StartupFallbackView while fonts load (never null / blank View)
  SafeAreaProvider → NavigationContainer → AppNavigator
```

Classic `registerRootComponent` — **not** Expo Router. Single root path via `package.json` `"main": "index.ts"`.

## Expo Updates / OTA

- `expo-updates` is **not** a direct dependency on this hotfix branch.
- `app.json` has no `runtimeVersion` or `updates` URL.
- Installed TestFlight binaries from this branch embed JS only — no OTA override path unless a future build adds `expo-updates`.
- `testflight-rescue` EAS profile sets `updates.enabled = false` via `app.config.js` when `EAS_BUILD_PROFILE=testflight-rescue`.

## Splash-screen risk (previous release)

Previous `App.tsx` called `SplashScreen.preventAutoHideAsync()` at module scope and only hid the splash after fonts loaded, while showing a bare `#070707` View — visually identical to a black screen. If fonts or an uncaught error stalled startup, the native splash could remain visible over an empty dark view indefinitely. Hotfix: idempotent `hideSplashOnce()` from rescue `onLayout`, fonts-ready, navigation `onReady`, and watchdog paths.

## Fix summary

See `App.tsx`, `AppShell.tsx`, `src/components/ErrorBoundary.tsx`,
`src/startup/StartupFallbackView.tsx`, `src/startup/startupDiagnostics.ts`,
`src/startup/visualStartupOverride.ts`,
`src/startup/runOptionalStartupTasks.ts`,
`src/cosmetics/useLockerCosmetics.ts`, `src/services/visualAssetLoader.ts`,
`src/screens/HomeScreen.tsx`, and `src/lib/supabaseConfig.ts` for the
implementation; `docs/V1_2_STARTUP_HOTFIX_TESTFLIGHT_CHECKLIST.md` for the
device-verification plan.
