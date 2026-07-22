/**
 * Lightweight analytics sink. No third-party SDK in this beta.
 * Events must never include receipts, tokens, or payment details.
 */
type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

const recent: Array<{ name: string; at: number }> = [];

export function trackEvent(name: string, payload: AnalyticsPayload = {}): void {
  // Keep a tiny in-memory ring for tests / debugging without permanent console logs.
  recent.push({ name, at: Date.now() });
  if (recent.length > 100) {
    recent.shift();
  }
  void payload;
}

export function __getRecentAnalyticsForTests(): ReadonlyArray<{ name: string; at: number }> {
  return recent;
}

export function __clearAnalyticsForTests(): void {
  recent.length = 0;
}
