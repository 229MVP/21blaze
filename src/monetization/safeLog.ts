/**
 * Safe release logging — never log secrets, receipts, tokens, or full payloads.
 */

const SENSITIVE_KEY =
  /(token|secret|password|receipt|authorization|apikey|api_key|service_role|webhook)/i;

export function safeReleaseLog(
  event: string,
  detail?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    // Production/preview: keep only a tiny in-memory trail via analytics.
    return;
  }
  if (!detail) {
    console.warn(`[21Blaze] ${event}`);
    return;
  }
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (SENSITIVE_KEY.test(key)) {
      sanitized[key] = '[redacted]';
      continue;
    }
    if (typeof value === 'string' && value.length > 120) {
      sanitized[key] = `${value.slice(0, 120)}…`;
      continue;
    }
    sanitized[key] = value ?? null;
  }
  console.warn(`[21Blaze] ${event}`, sanitized);
}
