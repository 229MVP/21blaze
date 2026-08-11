/**
 * Version 1.2.0 startup hotfix — pure, React-Native-free Supabase
 * configuration check, extracted out of `src/lib/supabase.ts` (which
 * imports `react-native-url-polyfill`/`AsyncStorage`/`Platform` and so
 * cannot be imported under a plain Node/tsx test process — the same
 * class of problem solved for ad-unit resolution in
 * `src/monetization/adUnitResolution.ts`).
 *
 * `useAuthStore.initializeAuth()` checks this BEFORE ever touching the
 * lazy `supabase` client proxy, so an unconfigured environment never
 * throws — it safely falls back to `authStatus: 'local'`.
 */
import { readPublicEnv } from '../config/publicEnv';

export function isSupabaseConfigured(): boolean {
  return (
    readPublicEnv('EXPO_PUBLIC_SUPABASE_URL').length > 0 &&
    readPublicEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY').length > 0
  );
}

export function getSupabaseConfiguredEnv(): { url: string; publishableKey: string } {
  return {
    url: readPublicEnv('EXPO_PUBLIC_SUPABASE_URL'),
    publishableKey: readPublicEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  };
}
