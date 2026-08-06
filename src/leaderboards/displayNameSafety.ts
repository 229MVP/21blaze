/** Version 1.3B — public display-name safety (client + shared tests). */

export const DISPLAY_NAME_MIN_LENGTH = 3;
export const DISPLAY_NAME_MAX_LENGTH = 20;

const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9_]+$/;

const RESERVED_TERMS = [
  'admin',
  'administrator',
  'moderator',
  'official',
  '21blazesupport',
  '21blaze support',
  'developer',
  'staff',
  'support',
  'blaze support',
];

function normalizeForReservedCheck(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s]+/g, '');
}

export function isReservedDisplayName(value: string): boolean {
  const normalized = normalizeForReservedCheck(value);
  return RESERVED_TERMS.some((term) => normalized.includes(term.replace(/\s+/g, '')));
}

export function validatePublicDisplayName(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const value = raw.trim();
  if (value.length < DISPLAY_NAME_MIN_LENGTH || value.length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `Name must be ${DISPLAY_NAME_MIN_LENGTH}–${DISPLAY_NAME_MAX_LENGTH} characters.`,
    };
  }
  if (/[\u0000-\u001F\u007F]/.test(value)) {
    return { ok: false, message: 'Name cannot include control characters.' };
  }
  if (!DISPLAY_NAME_PATTERN.test(value)) {
    return { ok: false, message: 'Use letters, numbers, and underscores only.' };
  }
  if (isReservedDisplayName(value)) {
    return { ok: false, message: 'This name is reserved. Choose a different display name.' };
  }
  return { ok: true, value };
}

export function formatPublicDisplayName(
  displayName: string | null | undefined,
  fallbackSuffix?: string,
): string {
  const trimmed = (displayName ?? '').trim();
  if (trimmed.length >= DISPLAY_NAME_MIN_LENGTH) {
    return trimmed.slice(0, DISPLAY_NAME_MAX_LENGTH);
  }
  const suffix = (fallbackSuffix ?? '0000').replace(/[^0-9A-Za-z]/g, '').slice(-4).padStart(4, '0');
  return `Blazer ${suffix}`;
}
