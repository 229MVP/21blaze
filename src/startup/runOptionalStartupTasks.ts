/**
 * Version 1.2.0 startup hotfix — helpers for running NON-blocking,
 * optional startup work (visual asset preloading, wallet/progression
 * refresh, ad/consent init, analytics, etc.) safely: every task gets a
 * finite timeout, individual error handling, and a safe fallback, and
 * independent tasks are run with `Promise.allSettled` so one hanging or
 * rejecting task can never fail (or delay) the others.
 *
 * Nothing here is awaited by any rendering code path — these exist to
 * make already-fire-and-forget optional work more robust, not to
 * introduce a new blocking dependency.
 */

export type OptionalTaskResult<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'timeout' }
  | { status: 'rejected'; reason: unknown };

/**
 * Races `task()` against `timeoutMs`. Never throws — a timeout or
 * rejection both resolve to a tagged result object instead. No retry
 * loop of any kind: a timed-out task is abandoned (its promise may still
 * settle later and will simply be ignored), never retried automatically.
 */
export async function withTimeout<T>(
  task: () => Promise<T>,
  timeoutMs: number,
): Promise<OptionalTaskResult<T>> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = await Promise.race([
      task().then((value): OptionalTaskResult<T> => ({ status: 'fulfilled', value })),
      new Promise<OptionalTaskResult<T>>((resolve) => {
        timeoutHandle = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs);
      }),
    ]);
    return result;
  } catch (reason) {
    return { status: 'rejected', reason };
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export type NamedOptionalTask = {
  name: string;
  run: () => Promise<unknown>;
  timeoutMs?: number;
};

const DEFAULT_OPTIONAL_TASK_TIMEOUT_MS = 6000;

/**
 * Runs every independent optional startup task in parallel via
 * `Promise.allSettled` (never `Promise.all`, which would let one
 * rejection abort the whole bootstrap), each individually bounded by
 * `withTimeout`. Errors are swallowed here (each task is responsible for
 * its own safe fallback); this function only exists to guarantee the
 * *bootstrap process itself* never fails or hangs because one optional
 * subsystem did.
 */
export async function runOptionalStartupTasks(tasks: readonly NamedOptionalTask[]): Promise<void> {
  await Promise.allSettled(
    tasks.map((task) => withTimeout(task.run, task.timeoutMs ?? DEFAULT_OPTIONAL_TASK_TIMEOUT_MS)),
  );
}
