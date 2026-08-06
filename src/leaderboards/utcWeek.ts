/** UTC weeks begin Monday 00:00 UTC. */

export function getUtcWeekStartDate(nowMs = Date.now()): string {
  const date = new Date(nowMs);
  const day = date.getUTCDay();
  const diffFromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - diffFromMonday,
  ));
  return monday.toISOString().slice(0, 10);
}

export function getUtcWeekEndDate(weekStartDate: string): string {
  const start = new Date(`${weekStartDate}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  return end.toISOString().slice(0, 10);
}

export function isDateInUtcWeek(challengeDate: string, weekStartDate: string): boolean {
  const startMs = Date.parse(`${weekStartDate}T00:00:00.000Z`);
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000;
  const dateMs = Date.parse(`${challengeDate}T00:00:00.000Z`);
  return dateMs >= startMs && dateMs < endMs;
}
