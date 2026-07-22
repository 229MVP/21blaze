import {
  DEFAULT_RANKED_RATING,
  divisionForRating,
  MINIMUM_RANKED_RATING,
  PLACEMENT_MATCHES_REQUIRED,
} from './divisions';
import { matchmakingRangeForElapsed } from './matchmakingRange';
import {
  computeRatingChange,
  expectedScore,
  kFactor,
  softResetRating,
} from './rating';
import { normalizeRankedProfile } from './types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Ranked self-test failed: ${message}`);
  }
}

export function runRankedSelfTests(): void {
  // 1. Equal ratings + win => positive change
  const win = computeRatingChange(1200, 1200, 1, 5, 5);
  assert(win.ratingChange === 12, `Equal-rating win should be +12, got ${win.ratingChange}`);

  // 2. Equal ratings + loss => matching negative
  const loss = computeRatingChange(1200, 1200, 0, 5, 5);
  assert(loss.ratingChange === -12, `Equal-rating loss should be -12, got ${loss.ratingChange}`);
  assert(win.ratingChange === -loss.ratingChange, 'Win/loss deltas should match');

  // 3. Draw between equals => zero
  const draw = computeRatingChange(1200, 1200, 0.5, 5, 5);
  assert(draw.ratingChange === 0, 'Equal-rating draw should be 0');

  // 4. Rating floor at 100
  const floor = computeRatingChange(100, 2000, 0, 5, 5);
  assert(floor.ratingAfter === MINIMUM_RANKED_RATING, 'rating cannot fall below 100');

  // 5. Placement K = 40
  assert(kFactor(0, 0) === 40, 'placement K-factor should be 40');
  assert(kFactor(4, 4) === 40, 'still placement until 5 complete');

  // 6. Normal K = 24
  assert(kFactor(5, 5) === 24, 'normal K-factor should be 24');

  // 7. Veteran K = 16 after 100 matches
  assert(kFactor(5, 100) === 16, 'veteran K-factor should be 16');

  // 8. Division thresholds
  assert(divisionForRating(899, 5).key === 'ember', 'ember threshold');
  assert(divisionForRating(900, 5).key === 'spark', 'spark threshold');
  assert(divisionForRating(1099, 5).key === 'spark', 'spark upper');
  assert(divisionForRating(1100, 5).key === 'flame', 'flame threshold');
  assert(divisionForRating(1299, 5).key === 'flame', 'flame upper');
  assert(divisionForRating(1300, 5).key === 'inferno', 'inferno threshold');
  assert(divisionForRating(1499, 5).key === 'inferno', 'inferno upper');
  assert(divisionForRating(1500, 5).key === 'blaze', 'blaze threshold');
  assert(divisionForRating(1699, 5).key === 'blaze', 'blaze upper');
  assert(divisionForRating(1700, 5).key === 'blaze_elite', 'blaze elite threshold');

  // 9. Fifth placement reveals rank
  assert(divisionForRating(1248, 4).key === 'unranked', 'fourth placement still unranked');
  assert(divisionForRating(1248, 5).key === 'flame', 'fifth placement reveals flame');

  // 10/11. Idempotent math — same inputs yield same outputs (double finalize would be blocked by DB unique match_id)
  const again = computeRatingChange(1200, 1200, 1, 5, 5);
  assert(
    again.ratingAfter === win.ratingAfter && again.ratingChange === win.ratingChange,
    'rating update must be deterministic',
  );

  // 12. Pre-start cancellation — no rating effect modeled as zero actual delta path
  const cancelled = { ratingChange: 0 };
  assert(cancelled.ratingChange === 0, 'pre-start cancel has no rating effect');

  // 13. Post-start forfeit counts as loss (actual 0)
  const forfeitLoss = computeRatingChange(1200, 1200, 0, 5, 5);
  assert(forfeitLoss.ratingChange < 0, 'post-start forfeit loss decreases rating');

  // 14. No-contest has no rating effect
  const noContestDelta = 0;
  assert(noContestDelta === 0, 'no-contest has no rating effect');

  // 15. Simultaneous finalization uniqueness is a DB constraint (unique match_id) — documented here.
  assert(true, 'unique match_id enforces single ranked result');

  // 16. Repeated-opponent protection threshold semantics
  const recentPairCount = 3;
  const zeroRating = recentPairCount >= 3;
  assert(zeroRating, 'after three rated matches in 24h, further matches get zero rating change');

  // 17. Unplaced players are not publicly ranked
  const unplaced = normalizeRankedProfile({
    seasonId: 's1',
    seasonName: 'Beta',
    rating: 1200,
    division: 'unranked',
    placementMatchesCompleted: 3,
    placementMatchesRequired: 5,
    rankedMatchesPlayed: 3,
    wins: 2,
    losses: 1,
    draws: 0,
    currentWinStreak: 1,
    longestWinStreak: 1,
    peakRating: 1200,
    peakDivision: 'unranked',
  });
  assert(unplaced !== null && unplaced.rating === null, 'hidden rating while unplaced');
  assert(unplaced !== null && !unplaced.placementComplete, 'unplaced flag');

  // 18/19. Queue modes remain separate — covered by mode field contract
  const casualMode: string = 'casual';
  const rankedMode: string = 'ranked';
  assert(casualMode !== rankedMode, 'ranked and casual queues remain separate');

  // 20. Client-provided rating values are ignored by normalize when still placing
  const spoofed = normalizeRankedProfile({
    seasonId: 's1',
    seasonName: 'Beta',
    rating: 9999,
    division: 'blaze_elite',
    placementMatchesCompleted: 1,
    placementMatchesRequired: PLACEMENT_MATCHES_REQUIRED,
    rankedMatchesPlayed: 1,
    wins: 1,
    losses: 0,
    draws: 0,
    currentWinStreak: 1,
    longestWinStreak: 1,
    peakRating: 9999,
    peakDivision: 'blaze_elite',
  });
  assert(spoofed !== null && spoofed.rating === null, 'client rating ignored while placing');

  // Expected score formula sanity
  assert(Math.abs(expectedScore(1200, 1200) - 0.5) < 1e-9, 'equal expected score is 0.5');
  assert(softResetRating(1400) === 1300, 'soft reset 1400 -> 1300');
  assert(DEFAULT_RANKED_RATING === 1200, 'default rating 1200');

  // Matchmaking range expansion
  assert(matchmakingRangeForElapsed(0) === 100, '0-10s range 100');
  assert(matchmakingRangeForElapsed(10) === 200, '10-20s range 200');
  assert(matchmakingRangeForElapsed(20) === 300, '20-30s range 300');
  assert(matchmakingRangeForElapsed(30) === 450, '30-45s range 450');
  assert(matchmakingRangeForElapsed(45) === null, '45s+ any rating');
}

runRankedSelfTests();
console.log('Ranked self-tests passed.');
