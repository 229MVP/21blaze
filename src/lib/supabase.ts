import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { Database } from './database.types';
import { getSupabaseConfiguredEnv, isSupabaseConfigured } from './supabaseConfig';

export { isSupabaseConfigured };

function requireConfiguredEnv(): {
  url: string;
  publishableKey: string;
} {
  const { url, publishableKey } = getSupabaseConfiguredEnv();

  if (!url || !publishableKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Add them to .env.local for local development.',
    );
  }

  return { url, publishableKey };
}

let client: SupabaseClient<Database> | null = null;

function getSupabaseClient(): SupabaseClient<Database> {
  if (client) {
    return client;
  }

  const { url, publishableKey } = requireConfiguredEnv();

  client = createClient<Database>(url, publishableKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });

  return client;
}

/** Shared Supabase client. Lazily created so local-only play works without blocking import. */
export const supabase: SupabaseClient<Database> = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_target, property, receiver) {
      const real = getSupabaseClient();
      const value = Reflect.get(real, property, receiver);
      return typeof value === 'function' ? value.bind(real) : value;
    },
  },
);
