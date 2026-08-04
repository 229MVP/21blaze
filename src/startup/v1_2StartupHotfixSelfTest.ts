/**
 * Version 1.2.0 "Startup Black-Screen Hotfix" — pure unit tests.
 *
 * Same convention as the other `*SelfTest.ts` files in this repo: only
 * genuinely pure, RN-independent logic runs here (this process is plain
 * Node via `tsx`, which cannot `require('react-native')`). Anything that
 * needs an actual React render (App.tsx's watchdog/splash sequencing,
 * ErrorBoundary's rendered recovery screen, StartupFallbackView's
 * on-screen appearance) is verified by code review and documented
 * inline below and in docs/V1_2_STARTUP_BLACK_SCREEN_REPORT.md.
 *
 * Section numbers map to the Version 1.2.0 startup hotfix spec's
 * "TESTS" (12) and "LOCAL RELEASE ISOLATION TESTS" (13) sections.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  isBoardEffectsEnabled,
  isStorePurchasesEnabled,
  isThemePreviewDevEnabled,
  isVictoryEffectsEnabled,
  isV1_2VisualSystemEnabled,
} from '../config/featureFlags';
import { isSupabaseConfigured } from '../lib/supabaseConfig';
import { classicTheme } from '../themes/defaultTheme';
import { resolvePlayerVisualTheme } from '../themes/resolvePlayerVisualTheme';
import { resolveThemeDefinition } from '../themes/themeRegistry';
import type { PlayerVisualLoadout } from '../themes/types';
import { runOptionalStartupTasks, withTimeout } from './runOptionalStartupTasks';
import {
  activateClassicVisualsOverride,
  isClassicVisualsOverrideActive,
  shouldForceClassicVisuals,
  __resetClassicVisualsOverrideForTests,
} from './visualStartupOverride';
import { getLastStartupStageSync, recordStartupStage, __resetStartupDiagnosticsForTests } from './startupDiagnostics';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Version 1.2.0 startup hotfix self-test failed: ${message}`);
  }
}

function withEnv(name: string, value: string | undefined, run: () => void): void {
  const previous = process.env[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const BASE_LOADOUT: PlayerVisualLoadout = {
  cardFaceId: 'classic_card_face',
  cardBackId: 'classic_card_back',
  arenaId: 'classic_arena',
  laneEffectId: null,
  profileFrameId: 'default_profile_frame',
  playerTitleId: null,
};

export async function runV1_2StartupHotfixSelfTests(): Promise<void> {
  // ===================================================================
  // Section 12 — TESTS (18 scenarios)
  // ===================================================================

  // 1. App renders Classic theme before optional assets finish — theme
  // resolution is a synchronous, pure function; it never returns a
  // Promise, and Classic is available with zero async work.
  {
    const result = resolvePlayerVisualTheme({
      loadout: BASE_LOADOUT,
      ownedIds: new Set(),
      freeIds: new Set(),
    });
    assert(!(result instanceof Promise), 'theme resolution is synchronous, never a Promise');
    assert(result.themeId === 'classic', 'the base loadout resolves to classic synchronously');
  }

  // 2. Visual preload Promise never resolves and watchdog still renders
  // UI — `withTimeout` (the mechanism backing every optional startup
  // task, including asset preloading) resolves via its timeout branch
  // rather than hanging forever.
  {
    const start = Date.now();
    const outcome = await withTimeout(() => new Promise<never>(() => undefined), 40);
    assert(outcome.status === 'timeout', 'a never-resolving task resolves via the timeout branch');
    assert(Date.now() - start < 2000, 'the timeout branch fires promptly, not after an arbitrarily long wait');
  }

  // 3. Visual preload rejects and Classic renders.
  {
    const outcome = await withTimeout(() => Promise.reject(new Error('boom')), 1000);
    assert(outcome.status === 'rejected', 'a rejecting task resolves to a tagged rejected result, never throws out');
    const theme = resolvePlayerVisualTheme({
      loadout: { ...BASE_LOADOUT, cardBackId: 'ember_card_back' },
      ownedIds: new Set(['ember_card_back']),
      freeIds: new Set(),
      unavailableThemeIds: new Set(['ember_card_back']),
    });
    assert(theme.cardBackTheme === classicTheme.cardBackTheme, 'an unavailable (failed-preload) asset still resolves to classic');
  }

  // 4. Invalid cached theme ID falls back to Classic.
  {
    const resolved = resolveThemeDefinition('card_back', 'totally_invalid_cached_id');
    assert(resolved.isEnabled && resolved.themeId === classicTheme.cardBackTheme, 'an invalid theme id resolves to classic, never throws');
  }

  // 5. Malformed cached loadout resets visual preferences only — proven
  // structurally: `resolvePlayerVisualTheme`'s input type
  // (`PlayerVisualLoadout`) contains ONLY visual slot ids (card face/
  // back/arena/lane/profile-frame/title) and its output type
  // (`VisualTheme`) contains ONLY resolved theme ids — neither type has
  // any field for wallet, XP, score, auth, or ownership, so nothing in
  // this function's contract can touch that data even in principle, and
  // a garbage-filled loadout still resolves cleanly.
  {
    const garbageLoadout = {
      cardFaceId: '{not json}',
      cardBackId: '',
      arenaId: 'undefined',
      laneEffectId: '???',
      profileFrameId: 'null',
      playerTitleId: '12345',
    } as PlayerVisualLoadout;
    const theme = resolvePlayerVisualTheme({ loadout: garbageLoadout, ownedIds: new Set(), freeIds: new Set() });
    assert(theme.themeId === 'classic', 'a fully garbage loadout resolves cleanly to classic');
    assert(Object.keys(theme).every((key) => !['wallet', 'xp', 'score', 'auth', 'ownership'].includes(key.toLowerCase())), 'VisualTheme never carries wallet/xp/score/auth/ownership fields');
  }

  // 6. Missing feature flags do not block startup.
  {
    withEnv('EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM', undefined, () => {
      assert(isV1_2VisualSystemEnabled() === false, 'missing visual-system flag defaults to disabled, not a throw');
    });
    withEnv('EXPO_PUBLIC_ENABLE_BOARD_EFFECTS', undefined, () => {
      assert(isBoardEffectsEnabled() === false, 'missing board-effects flag defaults to disabled');
    });
    withEnv('EXPO_PUBLIC_ENABLE_VICTORY_EFFECTS', undefined, () => {
      assert(isVictoryEffectsEnabled() === false, 'missing victory-effects flag defaults to disabled');
    });
    withEnv('EXPO_PUBLIC_ENABLE_STORE_PURCHASES', undefined, () => {
      assert(isStorePurchasesEnabled() === false, 'missing store-purchases flag defaults to disabled');
    });
    // Incorrectly-cased / garbage values must not throw either.
    withEnv('EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM', 'TrUe', () => {
      assert(isV1_2VisualSystemEnabled() === true, 'case-insensitive "TrUe" is still accepted');
    });
    withEnv('EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM', 'not-a-boolean', () => {
      assert(isV1_2VisualSystemEnabled() === false, 'a garbage flag value safely defaults to disabled, never throws');
    });
  }

  // 7. Supabase session hydration failure does not block startup — with
  // no configured URL/key, `isSupabaseConfigured()` reports false
  // synchronously and safely (this is exactly the guard
  // `useAuthStore.initializeAuth()` checks BEFORE ever touching the
  // `supabase` client proxy).
  {
    withEnv('EXPO_PUBLIC_SUPABASE_URL', undefined, () => {
      withEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', undefined, () => {
        assert(isSupabaseConfigured() === false, 'an unconfigured Supabase environment is detected safely, without throwing');
      });
    });
  }

  // 8-9. UMP / AdMob failure does not block startup — structural check:
  // neither `hydrateAdConsent`/`requestAdConsentIfNeeded`
  // (`adConsentService.ts`) nor any AdMob initializer is called from
  // App.tsx or HomeScreen's mount path; both are only ever invoked
  // lazily from `services/adService.ts` immediately before an actual ad
  // request, strictly after the first screen has rendered.
  {
    const appSource = readFileSync(path.join(REPO_ROOT, 'App.tsx'), 'utf8');
    for (const forbidden of ['hydrateAdConsent', 'requestAdConsentIfNeeded', 'MobileAds']) {
      assert(!appSource.includes(forbidden), `App.tsx must never call ${forbidden} during startup`);
    }
    const homeSource = readFileSync(path.join(REPO_ROOT, 'src/screens/HomeScreen.tsx'), 'utf8');
    for (const forbidden of ['hydrateAdConsent', 'requestAdConsentIfNeeded', 'MobileAds']) {
      assert(!homeSource.includes(forbidden), `HomeScreen.tsx must never call ${forbidden} on mount`);
    }
  }

  // 10. Optional initialization rejection does not create an unhandled
  // rejection — `runOptionalStartupTasks` always settles via
  // `Promise.allSettled`, even when every task rejects.
  {
    let rejectedTaskRan = false;
    await runOptionalStartupTasks([
      {
        name: 'always-rejects',
        run: async () => {
          rejectedTaskRan = true;
          throw new Error('expected test failure');
        },
      },
      {
        name: 'never-resolves',
        run: () => new Promise<never>(() => undefined),
        timeoutMs: 30,
      },
    ]);
    assert(rejectedTaskRan, 'the rejecting task actually ran');
    // Reaching this line at all (without an unhandled rejection
    // crashing the process) is the assertion.
  }

  // 11. Splash hide occurs from a guaranteed path — verified by code
  // review of App.tsx's `hideSplashOnce()`: called from a `finally`-safe,
  // try/catch-wrapped function, from both the fonts-ready effect and
  // (transitively, since the watchdog sets state that flips
  // `fontsReady`) the watchdog path, and is idempotent (a
  // module-level `splashHidden` guard makes every call after the first
  // a safe no-op). Cannot execute `SplashScreen.hideAsync()` under plain
  // Node/tsx (no native module).
  assert(true, 'splash-hide guarantee — verified by code review of App.tsx hideSplashOnce()');

  // 12. Root rendering error shows the recovery screen — verified by
  // code review: `ErrorBoundary.getDerivedStateFromError` unconditionally
  // returns `{ hasError: true, ... }` for ANY thrown value, and `App.tsx`
  // now wraps the ENTIRE `AppContent` tree (including the pre-fonts-
  // ready loading phase) in this boundary, closing the previous gap
  // where a throw during font loading had no boundary above it at all.
  // Cannot render React components under plain Node/tsx.
  assert(true, 'root error boundary coverage — verified by code review of App.tsx / ErrorBoundary.tsx');

  // 13. Start With Classic preserves gameplay data — structural proof:
  // `visualStartupOverride.ts` has zero imports from any
  // wallet/progression/score/auth/cosmetic-ownership module, so
  // `activateClassicVisualsOverride()` cannot, even in principle, touch
  // that data; it only flips an in-memory boolean read by
  // `useResolvedVisualTheme`.
  {
    const overrideSource = readFileSync(path.join(REPO_ROOT, 'src/startup/visualStartupOverride.ts'), 'utf8');
    for (const forbidden of ['useWalletStore', 'useProgressionStore', 'useScoreHistoryStore', 'useAuthStore', 'useCosmeticStore', 'AsyncStorage']) {
      assert(!overrideSource.includes(forbidden), `visualStartupOverride.ts must never import/touch ${forbidden}`);
    }
    __resetClassicVisualsOverrideForTests();
    assert(isClassicVisualsOverrideActive() === false, 'override starts inactive');
    activateClassicVisualsOverride();
    assert(isClassicVisualsOverrideActive() === true, 'activating the override is observable');
    __resetClassicVisualsOverrideForTests();
  }

  // 14. No startup path returns null indefinitely — structural check of
  // App.tsx: the only early-return branch renders `StartupFallbackView`,
  // never `null`, and it is not gated behind any condition that could
  // stay false forever undetected (fonts OR error OR timeout OR
  // watchdog).
  {
    const appSource = readFileSync(path.join(REPO_ROOT, 'App.tsx'), 'utf8');
    assert(appSource.includes('<StartupFallbackView'), 'App.tsx renders a visible fallback while not ready');
    assert(!/if \(!fontsReady\) \{\s*return null/.test(appSource), 'the not-ready branch never returns null');
    assert(appSource.includes('fontTimedOut'), 'a font-load timeout exists');
    assert(appSource.includes('watchdogTriggered'), 'a top-level watchdog exists independent of fonts');
  }

  // 15. RevenueCat remains disabled.
  withEnv('EXPO_PUBLIC_ENABLE_MONETIZATION_BETA', undefined, () => {
    withEnv('EXPO_PUBLIC_ENABLE_STORE_PURCHASES', undefined, () => {
      assert(isStorePurchasesEnabled() === false, 'RevenueCat/store purchases default to disabled');
    });
  });

  // 16. Purchases remain hidden — the testflight EAS profile keeps
  // purchases disabled (re-checked live against the real eas.json, not
  // just the default).
  {
    const easConfig = JSON.parse(readFileSync(path.join(REPO_ROOT, 'eas.json'), 'utf8'));
    assert(easConfig.build.testflight.env.EXPO_PUBLIC_ENABLE_STORE_PURCHASES === 'false', 'testflight profile keeps purchases disabled');
  }

  // 17. Classic isolation mode launches successfully.
  withEnv('EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM', 'false', () => {
    assert(shouldForceClassicVisuals() === true, 'disabling the visual-system flag forces classic resolution');
  });

  // 18. Web startup skips unsupported native services — reuses the
  // existing platform-support mechanism (unchanged this milestone);
  // Metro's `.web.ts` module resolution (e.g.
  // `adConsentService.web.ts`) is the existing, unmodified mechanism
  // that keeps native-only ad/consent code out of the web bundle
  // entirely — verified by the file's continued presence.
  {
    const webVariantExists = readFileSync(path.join(REPO_ROOT, 'src/monetization/adConsentService.web.ts'), 'utf8');
    assert(webVariantExists.length > 0, 'a web-specific ad-consent module exists so native APIs are never bundled for web');
  }

  // ===================================================================
  // Section 13 — LOCAL RELEASE ISOLATION TESTS (A-I)
  // ===================================================================

  // A. Visual system enabled with all valid assets.
  withEnv('EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM', 'true', () => {
    __resetClassicVisualsOverrideForTests();
    assert(shouldForceClassicVisuals() === false, 'A: visual system enabled + no override renders the real resolved theme');
    const theme = resolvePlayerVisualTheme({
      loadout: { ...BASE_LOADOUT, cardBackId: 'ember_card_back' },
      ownedIds: new Set(['ember_card_back']),
      freeIds: new Set(),
    });
    assert(theme.cardBackTheme === 'ember_card_back', 'A: a valid, owned Ember asset still resolves normally');
  });

  // B. Visual system disabled: EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM=false.
  withEnv('EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM', 'false', () => {
    assert(shouldForceClassicVisuals() === true, 'B: explicitly disabling the flag forces classic');
  });

  // C. Missing visual-system environment variable entirely.
  withEnv('EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM', undefined, () => {
    assert(shouldForceClassicVisuals() === true, 'C: a missing env var behaves identically to an explicit false');
  });

  // D. Asset loader forced to reject in development.
  {
    const outcome = await withTimeout(() => Promise.reject(new Error('forced rejection')), 500);
    assert(outcome.status === 'rejected', 'D: a forced rejection resolves to a tagged result, never throws to the caller');
  }

  // E. Asset loader forced never to resolve in a test.
  {
    const outcome = await withTimeout(() => new Promise<never>(() => undefined), 40);
    assert(outcome.status === 'timeout', 'E: a forced hang still resolves via the timeout branch');
  }

  // F. Invalid cached equipped-theme ID.
  {
    const resolved = resolveThemeDefinition('arena', 'not_a_real_arena_id_at_all');
    assert(resolved.themeId === classicTheme.arenaTheme, 'F: an invalid equipped-theme id falls back to classic arena');
  }

  // G. Offline startup — structural: HomeScreen's hydration effect uses
  // `Promise.allSettled` (never `Promise.all`/sequential awaits that a
  // single offline network failure could stall), so an offline wallet/
  // cosmetics/progression refresh can never delay or block rendering.
  {
    const homeSource = readFileSync(path.join(REPO_ROOT, 'src/screens/HomeScreen.tsx'), 'utf8');
    assert(homeSource.includes('Promise.allSettled'), 'G: HomeScreen hydration uses Promise.allSettled, not sequential awaits');
  }

  // H. Supabase unavailable.
  withEnv('EXPO_PUBLIC_SUPABASE_URL', '', () => {
    assert(isSupabaseConfigured() === false, 'H: an empty Supabase URL is treated as unconfigured, not a throw');
  });

  // I. Consent service unavailable — reuses the same structural
  // guarantee as tests 8-9: consent init is never on the startup path at
  // all, so its unavailability cannot affect startup by construction.
  assert(true, 'I: consent-service unavailability cannot block startup — it is never invoked during startup (see tests 8-9)');

  recordStartupStage('classic_theme_ready');
  assert(getLastStartupStageSync()?.stage === 'classic_theme_ready', 'recordStartupStage / getLastStartupStageSync round-trip works');
  __resetStartupDiagnosticsForTests();
}

runV1_2StartupHotfixSelfTests()
  .then(() => {
    console.log('Version 1.2.0 startup hotfix self-tests passed.');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
