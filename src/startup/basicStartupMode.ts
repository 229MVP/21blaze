import { activateClassicVisualsOverride } from './visualStartupOverride';

/**
 * In-session "Basic Mode" — Classic visuals, no ads/consent/notifications for
 * this launch. Does not erase wallet, XP, scores, auth, or cosmetic ownership.
 */
let basicModeActive = false;

export function activateBasicStartupMode(): void {
  basicModeActive = true;
  activateClassicVisualsOverride();
}

export function isBasicStartupModeActive(): boolean {
  return basicModeActive;
}

export function __resetBasicStartupModeForTests(): void {
  basicModeActive = false;
}
