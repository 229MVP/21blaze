import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { ProfileRow } from '../lib/database.types';
import { safeReleaseLog } from '../monetization/safeLog';

const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

export type AuthStatus = 'connecting' | 'online' | 'local';

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  isInitializing: boolean;
  isAnonymous: boolean;
  authError: string | null;
  authStatus: AuthStatus;
  initializeAuth: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOutAndCreateNewGuest: () => Promise<void>;
  /** Clears a failed/local initializePromise and retries without blocking Solo Play. */
  retryOnlineAuth: () => Promise<void>;
};

let authSubscription: { unsubscribe: () => void } | null = null;
let initializePromise: Promise<void> | null = null;
/** After a settled local fallback, skip automatic re-init until explicit retry. */
let authSettledLocal = false;

function validateDisplayName(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim();
  if (value.length < 3 || value.length > 16) {
    return { ok: false, message: 'Name must be 3–16 characters.' };
  }
  if (!DISPLAY_NAME_PATTERN.test(value)) {
    return { ok: false, message: 'Use letters, numbers, and underscores only.' };
  }
  return { ok: true, value };
}

function authErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    if (/unauthorized/i.test(message)) {
      return 'Online sign-in unauthorized. Playing in local mode. Enable Anonymous Sign-Ins in Supabase Auth, and confirm the publishable key matches this project.';
    }
    if (message.length > 0) {
      return message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Authentication failed.';
}

function authErrorStatus(error: unknown): number {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : 0;
  }
  return 0;
}

async function loadProfile(userId: string): Promise<ProfileRow | null> {
  safeReleaseLog('profile_load_started', { stage: 'profiles_select' });
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    safeReleaseLog('profile_load_failed', {
      stage: 'profiles_select',
      status: authErrorStatus(error),
      name: error instanceof Error ? error.name : 'error',
    });
    throw error;
  }
  return data;
}

async function ensureAnonymousSession(): Promise<Session | null> {
  safeReleaseLog('auth_config_present', {
    configured: isSupabaseConfigured() ? 1 : 0,
  });

  const existing = await supabase.auth.getSession();
  if (existing.error) {
    safeReleaseLog('session_found', {
      ok: 0,
      stage: 'getSession',
      status: authErrorStatus(existing.error),
      name: existing.error.name,
    });
    throw existing.error;
  }

  if (existing.data.session) {
    safeReleaseLog('session_found', { ok: 1, stage: 'getSession' });
    return existing.data.session;
  }

  safeReleaseLog('anonymous_sign_in_started', { stage: 'signInAnonymously' });
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    safeReleaseLog('anonymous_sign_in_failed', {
      stage: 'signInAnonymously',
      status: authErrorStatus(error),
      name: error.name,
    });
    throw error;
  }
  safeReleaseLog('session_found', { ok: 1, stage: 'signInAnonymously' });
  return data.session;
}

async function loadProfileWithRetry(userId: string): Promise<ProfileRow | null> {
  // Profile trigger may lag briefly after anonymous sign-in.
  const delaysMs = [0, 250, 500];
  let lastError: unknown = null;
  for (const delay of delaysMs) {
    if (delay > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    }
    try {
      const profile = await loadProfile(userId);
      if (profile) {
        return profile;
      }
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
  return null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isInitializing: true,
  isAnonymous: false,
  authError: null,
  authStatus: 'connecting',

  initializeAuth: async () => {
    if (initializePromise) {
      await initializePromise;
      return;
    }
    if (authSettledLocal && get().authStatus === 'local' && !get().isInitializing) {
      return;
    }

    initializePromise = (async () => {
      if (!isSupabaseConfigured()) {
        safeReleaseLog('auth_config_present', { configured: 0 });
        authSettledLocal = true;
        set({
          isInitializing: false,
          authStatus: 'local',
          authError: 'Supabase is not configured.',
        });
        initializePromise = null;
        return;
      }

      set({ isInitializing: true, authStatus: 'connecting', authError: null });

      if (!authSubscription) {
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          const hasProfile = Boolean(get().profile);
          set({
            session,
            user: session?.user ?? null,
            isAnonymous: Boolean(session?.user?.is_anonymous),
            authStatus: session
              ? hasProfile
                ? 'online'
                : get().authStatus === 'online'
                  ? 'online'
                  : get().authStatus
              : get().authStatus === 'connecting'
                ? 'connecting'
                : 'local',
          });
          // Do not loop: only refresh when a session appears and profile is missing.
          if (session?.user && !get().profile && !get().isInitializing) {
            void get().refreshProfile();
          }
        });
        authSubscription = data.subscription;
      }

      try {
        const session = await Promise.race([
          ensureAnonymousSession(),
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 4000);
          }),
        ]);

        if (!session) {
          authSettledLocal = true;
          set({
            isInitializing: false,
            authStatus: 'local',
            authError: 'Could not connect. Playing in local mode.',
          });
          initializePromise = null;
          return;
        }

        let profile: ProfileRow | null = null;
        try {
          profile = await loadProfileWithRetry(session.user.id);
        } catch {
          profile = null;
        }

        authSettledLocal = !profile;
        set({
          session,
          user: session.user,
          profile,
          isAnonymous: Boolean(session.user.is_anonymous),
          isInitializing: false,
          // Without a profile row, verified matches cannot start yet.
          authStatus: profile ? 'online' : 'local',
          authError: profile
            ? null
            : 'Profile unavailable. Playing in local mode.',
        });
        if (!profile) {
          initializePromise = null;
        }
      } catch (error) {
        const message = authErrorMessage(error);
        safeReleaseLog('auth_initialization_failure', {
          stage: 'initializeAuth',
          status: authErrorStatus(error),
          name: error instanceof Error ? error.name : 'unknown',
          unauthorized:
            authErrorStatus(error) === 401 || /unauthorized/i.test(message)
              ? 1
              : 0,
        });
        authSettledLocal = true;
        set({
          isInitializing: false,
          authStatus: 'local',
          authError: message,
        });
        initializePromise = null;
      }
    })();

    await initializePromise;
  },

  refreshProfile: async () => {
    const userId = get().user?.id;
    if (!userId) {
      return;
    }
    try {
      const profile = await loadProfileWithRetry(userId);
      if (profile) {
        authSettledLocal = false;
        set({
          profile,
          authError: null,
          authStatus: 'online',
        });
      }
    } catch (error) {
      set({
        authError: authErrorMessage(error),
      });
    }
  },

  updateDisplayName: async (displayName) => {
    const validated = validateDisplayName(displayName);
    if (!validated.ok) {
      return validated;
    }

    const userId = get().user?.id;
    if (!userId) {
      return { ok: false, message: 'Session lost. Try again when online.' };
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: validated.value })
      .eq('id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return { ok: false, message: 'That name is already taken.' };
      }
      return { ok: false, message: error.message || 'Could not update name.' };
    }

    if (!data) {
      return { ok: false, message: 'Could not update name.' };
    }

    set({ profile: data, authError: null, authStatus: 'online' });
    return { ok: true };
  },

  signOutAndCreateNewGuest: async () => {
    await supabase.auth.signOut();
    initializePromise = null;
    authSettledLocal = false;
    set({
      session: null,
      user: null,
      profile: null,
      isAnonymous: false,
      authStatus: 'connecting',
      authError: null,
      isInitializing: true,
    });
    await get().initializeAuth();
  },

  retryOnlineAuth: async () => {
    authSettledLocal = false;
    initializePromise = null;
    await get().initializeAuth();
  },
}));
