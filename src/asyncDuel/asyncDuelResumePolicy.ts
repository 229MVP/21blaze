/**
 * Async Duel resume policy (v1.4 Phase 1).
 *
 * Server is authoritative. Client recovery must never create a second attempt.
 *
 * Challenger start:
 * - create_async_duel creates duel + challenger attempt transactionally.
 * - Network timeout after success: client should call get_async_duel_details /
 *   history and resume the existing started attempt — do not create again.
 * - Active competitive attempts ARE resumable in Phase 1 (same account only).
 *
 * Opponent start:
 * - start_async_duel_opponent_attempt is concurrency-safe.
 * - Double tap / parallel / retry returns the same attempt with alreadyStarted.
 * - Seed is returned only from this RPC (or challenger create), never inbox.
 *
 * Completion:
 * - complete_async_duel_attempt is idempotent when attempt already completed.
 * - Settled duels return the same get_async_duel_result payload on retry.
 *
 * Auth:
 * - Expired session: re-authenticate; attempt ownership still bound to user_id.
 * - Account switch: clear local caches; never resume another user's attempt.
 *
 * Expiration:
 * - Server time only. Expired duels cannot start or settle as completed.
 */

export const ASYNC_DUEL_RESUME_POLICY = {
  attemptsResumable: true,
  seedDisclosure: 'only_on_own_attempt_start',
  completionIdempotent: true,
  accountBound: true,
} as const;
