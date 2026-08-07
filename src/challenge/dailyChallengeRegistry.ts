/** Central Version 1.3 Daily Challenge rule/deck version registry. */

export const DAILY_CHALLENGE_RULES_VERSION = '1' as const;
export const DAILY_CHALLENGE_DECK_VERSION = '1' as const;
export const DAILY_CHALLENGE_SUBMISSION_VERSION = '1' as const;

export const DAILY_CHALLENGE_DURATION_SECONDS = 120;
export const DAILY_CHALLENGE_BUST_LIMIT = 3;
export const DAILY_CHALLENGE_SUBMISSION_GRACE_SECONDS = 30;

export const DAILY_CHALLENGE_SEED_PREFIX = '21blaze-daily-v1:';

export type DailyChallengeRulesVersion = typeof DAILY_CHALLENGE_RULES_VERSION;
export type DailyChallengeDeckVersion = typeof DAILY_CHALLENGE_DECK_VERSION;
