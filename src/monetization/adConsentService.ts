import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { trackEvent } from './analytics';
import type { AdConsentState } from './types';

const STORAGE_KEY = '21blaze.adConsent.v1';

let consentState: AdConsentState = 'unknown';

export function getAdConsentState(): AdConsentState {
  return consentState;
}

export async function hydrateAdConsent(): Promise<AdConsentState> {
  if (Platform.OS === 'web') {
    consentState = 'unavailable';
    return consentState;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (
      raw === 'obtained' ||
      raw === 'notRequired' ||
      raw === 'required' ||
      raw === 'unavailable' ||
      raw === 'error'
    ) {
      consentState = raw;
      return consentState;
    }
  } catch {
    consentState = 'error';
    return consentState;
  }
  consentState = 'unknown';
  return consentState;
}

/**
 * Request or refresh consent before personalized ads.
 * Falls back safely when the UMP / consent SDK path is unavailable.
 */
export async function requestAdConsentIfNeeded(): Promise<AdConsentState> {
  if (Platform.OS === 'web') {
    consentState = 'unavailable';
    return consentState;
  }

  try {
    // react-native-google-mobile-ads exposes AdsConsent on native builds.
    const ads = await import('react-native-google-mobile-ads');
    if (!ads.AdsConsent) {
      consentState = 'notRequired';
      await AsyncStorage.setItem(STORAGE_KEY, consentState);
      return consentState;
    }

    const info = await ads.AdsConsent.requestInfoUpdate();
    // Only ever presents the form when the SDK itself reports it is still
    // REQUIRED — an already-obtained or not-required decision never
    // re-shows the form.
    if (info.isConsentFormAvailable && info.status === ads.AdsConsentStatus.REQUIRED) {
      trackEvent('ump_form_presented');
      const result = await ads.AdsConsent.showForm();
      consentState =
        result.status === ads.AdsConsentStatus.OBTAINED ? 'obtained' : 'required';
    } else if (info.status === ads.AdsConsentStatus.OBTAINED) {
      consentState = 'obtained';
    } else if (info.status === ads.AdsConsentStatus.NOT_REQUIRED) {
      consentState = 'notRequired';
    } else {
      consentState = 'required';
    }
    await AsyncStorage.setItem(STORAGE_KEY, consentState);
    trackEvent('ump_status_updated', { status: consentState });
    return consentState;
  } catch {
    // Safe fallback: treat as non-personalized / limited. Consent loading
    // failures never crash or block Solo Play.
    consentState = 'unavailable';
    try {
      await AsyncStorage.setItem(STORAGE_KEY, consentState);
    } catch {
      // ignore
    }
    trackEvent('ump_status_updated', { status: consentState });
    return consentState;
  }
}

/**
 * Exposed via Settings → Privacy Options. Uses the SDK's dedicated privacy
 * options form when available, falling back to the general consent form
 * for older SDK versions — never a fabricated/local-only consent change.
 */
export async function openPrivacyOptions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    const ads = await import('react-native-google-mobile-ads');
    trackEvent('privacy_options_opened');
    const adsConsentAny = ads.AdsConsent as unknown as {
      showPrivacyOptionsForm?: () => Promise<unknown>;
      showForm?: () => Promise<unknown>;
    };
    if (adsConsentAny?.showPrivacyOptionsForm) {
      await adsConsentAny.showPrivacyOptionsForm();
      return true;
    }
    if (adsConsentAny?.showForm) {
      await adsConsentAny.showForm();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Whether Settings should expose the "Privacy Options" entry at all — per
 * UMP guidance, only when the SDK reports the privacy options form is
 * actually required for this user/region.
 */
export async function isPrivacyOptionsRequired(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    const ads = await import('react-native-google-mobile-ads');
    const adsConsentAny = ads.AdsConsent as unknown as {
      getPrivacyOptionsRequirementStatus?: () => Promise<string>;
    };
    if (!adsConsentAny?.getPrivacyOptionsRequirementStatus) {
      // Older SDK without the dedicated status API — fall back to
      // "required whenever we know a consent decision exists to revisit".
      return consentState === 'obtained' || consentState === 'required';
    }
    const status = await adsConsentAny.getPrivacyOptionsRequirementStatus();
    return status === 'REQUIRED';
  } catch {
    return false;
  }
}

/**
 * Whether the app may request *personalized* ads. This app never
 * requests Apple's App Tracking Transparency (ATT) permission — per
 * Apple's guidelines, personalized/IDFA-based ad targeting on iOS still
 * requires ATT authorization even when GDPR/UMP consent was obtained, so
 * iOS always requests non-personalized ads here. Android does not require
 * ATT, so it follows the UMP (GDPR) consent state directly. See
 * docs/V1_1C_ADS_AUDIT.md for the full ATT determination.
 */
export function canRequestPersonalizedAds(): boolean {
  const gdprAllows = consentState === 'obtained' || consentState === 'notRequired';
  if (!gdprAllows) {
    return false;
  }
  return Platform.OS !== 'ios';
}

export function __resetAdConsentForTests(): void {
  consentState = 'unknown';
}

/**
 * Development-only consent reset for manual UMP testing. Never available
 * in release/production builds — callers must additionally gate this
 * behind `__DEV__` (see SettingsScreen).
 */
export async function resetAdConsentForDevelopment(): Promise<void> {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return;
  }
  try {
    const ads = await import('react-native-google-mobile-ads');
    if (ads.AdsConsent?.reset) {
      await ads.AdsConsent.reset();
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — best effort dev tool
  }
  consentState = 'unknown';
}
