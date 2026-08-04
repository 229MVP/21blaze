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
function readEnv(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'): string {
  const value = process.env[name];
  return value?.trim() ?? '';
}

export function isSupabaseConfigured(): boolean {
  return (
    readEnv('EXPO_PUBLIC_SUPABASE_URL').length > 0 &&
    readEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY').length > 0
  );
}

export function getSupabaseConfiguredEnv(): { url: string; publishableKey: string } {
  return {
    url: readEnv('EXPO_PUBLIC_SUPABASE_URL'),
    publishableKey: readEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  };
}
