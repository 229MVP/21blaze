/**
 * Pure Blaze Coin reward math — keep in sync with SQL calculate_solo_match_coins.
 */
export function calculateSoloMatchCoins(
  score: number,
  isFirstOfDay: boolean,
): number {
  if (score < 0) {
    return 0;
  }

  let coins = 25;
  if (score >= 1000) {
    coins += 10;
  }
  if (score >= 2000) {
    coins += 15;
  }
  if (score >= 3000) {
    coins += 25;
  }
  if (isFirstOfDay) {
    coins += 50;
  }
  return coins;
}

export function calculateCasualLiveDuelCoins(result: 'win' | 'loss' | 'draw'): number {
  let coins = 15;
  if (result === 'win') {
    coins += 20;
  } else if (result === 'draw') {
    coins += 10;
  }
  return coins;
}

export function calculateRankedCoins(result: 'win' | 'loss' | 'draw'): number {
  let coins = 20;
  if (result === 'win') {
    coins += 30;
  } else if (result === 'draw') {
    coins += 15;
  }
  return coins;
}
