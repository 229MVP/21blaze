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

async function loadProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}

async function ensureAnonymousSession(): Promise<Session | null> {
  const existing = await supabase.auth.getSession();
  if (existing.data.session) {
    return existing.data.session;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw error;
  }
  return data.session;
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

    initializePromise = (async () => {
      if (!isSupabaseConfigured()) {
        set({
          isInitializing: false,
          authStatus: 'local',
          authError: 'Supabase is not configured.',
        });
        // Allow a later retry once env/config becomes available.
        initializePromise = null;
        return;
      }

      set({ isInitializing: true, authStatus: 'connecting', authError: null });

      if (!authSubscription) {
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          set({
            session,
            user: session?.user ?? null,
            isAnonymous: Boolean(session?.user?.is_anonymous),
            authStatus: session ? 'online' : get().authStatus === 'connecting' ? 'connecting' : 'local',
          });
          if (session?.user) {
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
          set({
            isInitializing: false,
            authStatus: 'local',
            authError: 'Could not connect. Playing in local mode.',
          });
          // Clear so Retry Online can re-run initialization.
          initializePromise = null;
          return;
        }

        let profile: ProfileRow | null = null;
        try {
          profile = await loadProfile(session.user.id);
        } catch {
          profile = null;
        }

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
        safeReleaseLog('auth_initialization_failure', {
          message: error instanceof Error ? error.name : 'unknown',
        });
        set({
          isInitializing: false,
          authStatus: 'local',
          authError: error instanceof Error ? error.message : 'Authentication failed.',
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
      const profile = await loadProfile(userId);
      set({ profile, authError: null });
    } catch (error) {
      set({
        authError: error instanceof Error ? error.message : 'Could not load profile.',
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

    set({ profile: data, authError: null });
    return { ok: true };
  },

  signOutAndCreateNewGuest: async () => {
    await supabase.auth.signOut();
    initializePromise = null;
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
    initializePromise = null;
    await get().initializeAuth();
  },
}));
