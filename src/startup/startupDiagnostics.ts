import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Version 1.2.0 startup hotfix — sanitized startup-stage tracking.
 *
 * Persists ONLY the single latest stage name + a timestamp, overwriting
 * on every call — never an access token, user id, wallet value, Supabase
 * record, ad identifier, or any other secret/PII. This exists purely so
 * a player who hits the recovery screen (`src/components/ErrorBoundary.tsx`)
 * can see (and, if asked, report) "LAST STARTUP STEP: <stage>" without any
 * remote logging infrastructure — a local troubleshooting breadcrumb.
 *
 * Every write is fire-and-forget and swallows its own errors: recording a
 * diagnostic must never itself become a reason startup fails or blocks.
 */
export type StartupStage =
  | 'native_entry'
  | 'react_root_started'
  | 'storage_hydration_started'
  | 'storage_hydration_finished'
  | 'classic_theme_ready'
  | 'navigation_ready'
  | 'first_content_rendered'
  | 'optional_services_started'
  | 'optional_services_finished'
  | 'startup_watchdog_triggered'
  | 'startup_error_boundary_triggered';

const STORAGE_KEY = '@21blaze/startupDiagnostics';

/** In-memory mirror so a synchronous read (e.g. the recovery screen's
 * diagnostics line) never has to wait on AsyncStorage. Updated
 * synchronously by `recordStartupStage`, best-effort persisted after. */
let lastStageInMemory: { stage: StartupStage; atMs: number } | null = null;

export function recordStartupStage(stage: StartupStage): void {
  const entry = { stage, atMs: Date.now() };
  lastStageInMemory = entry;
  // Fire-and-forget — a persistence failure must never affect startup.
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entry)).catch(() => undefined);
}

/** Synchronous, in-memory-only read for the current process. */
export function getLastStartupStageSync(): { stage: StartupStage; atMs: number } | null {
  return lastStageInMemory;
}

/** Async read (survives a fresh process) for a future "diagnostics from
 * last session" surface — reachable only from the recovery screen. */
export async function getLastStartupStageAsync(): Promise<{ stage: StartupStage; atMs: number } | null> {
  if (lastStageInMemory) {
    return lastStageInMemory;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { stage?: unknown }).stage === 'string' &&
      typeof (parsed as { atMs?: unknown }).atMs === 'number'
    ) {
      return parsed as { stage: StartupStage; atMs: number };
    }
    return null;
  } catch {
    return null;
  }
}

export function __resetStartupDiagnosticsForTests(): void {
  lastStageInMemory = null;
}
