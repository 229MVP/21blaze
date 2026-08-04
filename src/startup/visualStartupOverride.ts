import { isV1_2VisualSystemEnabled } from '../config/featureFlags';

/**
 * Version 1.2.0 startup hotfix — an in-session-only "force Classic
 * visuals" override, set exclusively by the root recovery screen's
 * "START WITH CLASSIC THEME" action (`src/components/ErrorBoundary.tsx`).
 *
 * Deliberately in-memory only (never written to local device storage or
 * any server table): it exists to let a player recover from a crash within
 * the current app session without waiting for a new TestFlight build,
 * and resets naturally the next time the app is freshly launched. The
 * durable, cross-restart kill switch for an actual release is the
 * `EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM` env flag (see
 * `src/config/featureFlags.ts`), not this module.
 *
 * Setting this flag never touches cosmetic ownership, wallet, XP, high
 * scores, or authentication — `useResolvedVisualTheme` (`src/cosmetics/
 * useLockerCosmetics.ts`) is the only reader, and it only changes what
 * is RENDERED, never what is owned/equipped server-side.
 */
let classicOverrideActive = false;

export function activateClassicVisualsOverride(): void {
  classicOverrideActive = true;
}

export function isClassicVisualsOverrideActive(): boolean {
  return classicOverrideActive;
}

export function __resetClassicVisualsOverrideForTests(): void {
  classicOverrideActive = false;
}

/**
 * Single pure decision point, checked first (and unconditionally) by
 * `useResolvedVisualTheme` — true whenever visual-theme resolution must
 * skip straight to Classic: either the TestFlight isolation flag
 * (`EXPO_PUBLIC_ENABLE_V1_2_VISUAL_SYSTEM=false`) is off, or the
 * in-session recovery override above is active. Extracted as a small,
 * RN-independent function so this exact release-hotfix decision is
 * directly unit-testable (see `src/startup/v1_2StartupHotfixSelfTest.ts`).
 */
export function shouldForceClassicVisuals(): boolean {
  return !isV1_2VisualSystemEnabled() || isClassicVisualsOverrideActive();
}
