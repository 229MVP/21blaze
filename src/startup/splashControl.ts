import * as SplashScreen from 'expo-splash-screen';

let splashPreventCalled = false;
let splashHidden = false;

/**
 * Call once at module load (App entry). Safe if native splash already hidden.
 */
export function preventSplashAutoHideOnce(): void {
  if (splashPreventCalled) {
    return;
  }
  splashPreventCalled = true;
  SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

/**
 * Idempotent splash hide — safe from fonts-ready, watchdog, onLayout, or error paths.
 */
export function hideSplashOnce(): void {
  if (splashHidden) {
    return;
  }
  splashHidden = true;
  try {
    SplashScreen.hideAsync().catch(() => undefined);
  } catch {
    // Never let splash-hide failure block startup.
  }
}

export function __resetSplashControlForTests(): void {
  splashPreventCalled = false;
  splashHidden = false;
}
