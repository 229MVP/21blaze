/**
 * Client UX flags only. Server authorization remains the final authority.
 * Never treat these as a security boundary.
 */
export function isRankedBetaEnabled(): boolean {
  const value = process.env.EXPO_PUBLIC_ENABLE_RANKED_BETA;
  if (value === undefined || value === null || value === '') {
    return true;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}
