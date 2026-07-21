export function createMatchId(now: number = Date.now()): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `match-${now}-${random}`;
}
