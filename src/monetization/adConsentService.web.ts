import type { AdConsentState } from './types';

let consentState: AdConsentState = 'unavailable';

export function getAdConsentState(): AdConsentState {
  return consentState;
}

export async function hydrateAdConsent(): Promise<AdConsentState> {
  consentState = 'unavailable';
  return consentState;
}

export async function requestAdConsentIfNeeded(): Promise<AdConsentState> {
  consentState = 'unavailable';
  return consentState;
}

export function canRequestPersonalizedAds(): boolean {
  return false;
}

export async function openPrivacyOptions(): Promise<boolean> {
  return false;
}
