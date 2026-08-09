/**
 * Central XP source registry — authoritative amounts are server-side;
 * this mirror drives UI labels and client self-tests.
 */

export type XpSourceKey =
  | 'SOLO_COMPLETION'
  | 'DAILY_CHALLENGE_COMPLETION'
  | 'DAILY_MISSION'
  | 'DAILY_STREAK_MILESTONE';

export type XpSourceDefinition = {
  key: XpSourceKey;
  sourceType: string;
  defaultAmount: number;
  description: string;
};

export const XP_SOURCES: ReadonlyArray<XpSourceDefinition> = [
  {
    key: 'SOLO_COMPLETION',
    sourceType: 'solo_match',
    defaultAmount: 25,
    description: 'Valid Solo game completion',
  },
  {
    key: 'DAILY_CHALLENGE_COMPLETION',
    sourceType: 'daily_challenge_completion',
    defaultAmount: 75,
    description: 'Official ranked Daily Blaze completion',
  },
  {
    key: 'DAILY_MISSION',
    sourceType: 'daily_mission',
    defaultAmount: 0,
    description: 'Mission completion claim — amount from server mission definition',
  },
  {
    key: 'DAILY_STREAK_MILESTONE',
    sourceType: 'daily_streak_milestone',
    defaultAmount: 15,
    description: 'Daily Blaze streak milestone bonus',
  },
] as const;

export function xpAmountForSource(key: XpSourceKey): number {
  const found = XP_SOURCES.find((entry) => entry.key === key);
  return found?.defaultAmount ?? 0;
}
