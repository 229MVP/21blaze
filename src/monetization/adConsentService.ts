import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
    if (info.isConsentFormAvailable && info.status === ads.AdsConsentStatus.REQUIRED) {
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
    return consentState;
  } catch {
    // Safe fallback: treat as non-personalized / limited.
    consentState = 'unavailable';
    try {
      await AsyncStorage.setItem(STORAGE_KEY, consentState);
    } catch {
      // ignore
    }
    return consentState;
  }
}

export async function openPrivacyOptions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  try {
    const ads = await import('react-native-google-mobile-ads');
    if (ads.AdsConsent?.showForm) {
      await ads.AdsConsent.showForm();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function canRequestPersonalizedAds(): boolean {
  return consentState === 'obtained' || consentState === 'notRequired';
}

export function __resetAdConsentForTests(): void {
  consentState = 'unknown';
}
