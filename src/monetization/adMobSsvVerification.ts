/**
 * Version 1.1C — Google AdMob Server-Side Verification (SSV) signature
 * checking, implemented against Google's documented callback format:
 * https://developers.google.com/admob/android/rewarded-video-ssv
 *
 * This module is intentionally dependency-free (only the standard Web
 * Crypto API, available as `globalThis.crypto.subtle` in Deno, modern
 * Node, and the Supabase Edge Function runtime) so the exact same logic
 * can be:
 *  - unit tested with `tsx` against a locally-generated EC keypair
 *    (see `src/monetization/v1_1cAdsSelfTest.ts`), and
 *  - deployed unmodified inside `supabase/functions/verify-rewarded-ad/`.
 *
 * Google signs the callback query string (every parameter up to, but not
 * including, `signature=`) with ECDSA P-256/SHA-256. The signature is
 * DER-encoded; Web Crypto's `ECDSA` verify only accepts the raw
 * `r || s` (32 bytes each for P-256) form, so this module converts
 * DER -> raw before calling `crypto.subtle.verify`.
 */

export type SsvQueryParams = {
  adNetwork: string | null;
  adUnit: string | null;
  rewardAmount: number | null;
  rewardItem: string | null;
  timestampMs: number | null;
  transactionId: string | null;
  /** Echoed back from `serverSideVerificationOptions.userId` at ad-request time. */
  userId: string | null;
  /** Echoed back from `serverSideVerificationOptions.customData` at ad-request time. */
  customData: string | null;
  keyId: number | null;
  signatureBase64Url: string | null;
};

export type SsvVerificationKey = {
  keyId: number;
  /** Base64-encoded DER SubjectPublicKeyInfo (P-256), as published by Google. */
  base64: string;
};

const P256_COMPONENT_LENGTH = 32;

/**
 * Extracts the exact substring of the query string that Google signed:
 * every parameter that appears before `signature=`, in original order,
 * exactly as received (not re-encoded). Google explicitly signs a prefix
 * of the raw query string, so this must operate on the raw string, not a
 * re-serialized `URLSearchParams`.
 */
export function extractSignedContent(rawQueryString: string): string {
  const query = rawQueryString.startsWith('?') ? rawQueryString.slice(1) : rawQueryString;
  const signatureIndex = query.indexOf('&signature=');
  if (signatureIndex === -1) {
    // signature may be the very first param in a malformed/test URL — treat
    // whatever precedes "signature=" (possibly nothing) as the content.
    const altIndex = query.indexOf('signature=');
    return altIndex <= 0 ? '' : query.slice(0, altIndex - 1);
  }
  return query.slice(0, signatureIndex);
}

export function parseSsvQueryParams(rawQueryString: string): SsvQueryParams {
  const query = rawQueryString.startsWith('?') ? rawQueryString.slice(1) : rawQueryString;
  const params = new URLSearchParams(query);
  const numberOrNull = (value: string | null): number | null => {
    if (value == null || value.trim() === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    adNetwork: params.get('ad_network'),
    adUnit: params.get('ad_unit'),
    rewardAmount: numberOrNull(params.get('reward_amount')),
    rewardItem: params.get('reward_item'),
    timestampMs: numberOrNull(params.get('timestamp')),
    transactionId: params.get('transaction_id'),
    userId: params.get('user_id'),
    customData: params.get('custom_data'),
    keyId: numberOrNull(params.get('key_id')),
    signatureBase64Url: params.get('signature'),
  };
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stripLeadingZeros(bytes: Uint8Array): Uint8Array {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) {
    start += 1;
  }
  return bytes.slice(start);
}

function padLeft(bytes: Uint8Array, length: number): Uint8Array {
  if (bytes.length >= length) {
    return bytes.slice(bytes.length - length);
  }
  const out = new Uint8Array(length);
  out.set(bytes, length - bytes.length);
  return out;
}

/**
 * Converts a DER-encoded ECDSA signature (SEQUENCE of two INTEGERs, r and
 * s) into the raw `r || s` form Web Crypto requires for verification.
 * Throws on malformed input rather than silently accepting garbage.
 */
export function derToRawEcdsaSignature(
  der: Uint8Array,
  componentLength = P256_COMPONENT_LENGTH,
): Uint8Array {
  let offset = 0;
  if (der[offset] !== 0x30) {
    throw new Error('Invalid DER signature: expected SEQUENCE');
  }
  offset += 1;

  const first = der[offset];
  offset += 1;
  if (first & 0x80) {
    const lengthBytes = first & 0x7f;
    offset += lengthBytes;
  }

  if (der[offset] !== 0x02) {
    throw new Error('Invalid DER signature: expected INTEGER for r');
  }
  offset += 1;
  const rLen = der[offset];
  offset += 1;
  const r = der.slice(offset, offset + rLen);
  offset += rLen;

  if (der[offset] !== 0x02) {
    throw new Error('Invalid DER signature: expected INTEGER for s');
  }
  offset += 1;
  const sLen = der[offset];
  offset += 1;
  const s = der.slice(offset, offset + sLen);

  const raw = new Uint8Array(componentLength * 2);
  raw.set(padLeft(stripLeadingZeros(r), componentLength), 0);
  raw.set(padLeft(stripLeadingZeros(s), componentLength), componentLength);
  return raw;
}

/**
 * Verifies an AdMob SSV signature against one candidate public key.
 * `content` must be exactly what `extractSignedContent` returned for the
 * same callback — never a re-serialized/re-ordered query string.
 */
export async function verifySsvSignature(input: {
  content: string;
  signatureBase64Url: string;
  publicKeySpkiBase64: string;
}): Promise<boolean> {
  try {
    const spkiBytes = base64ToUint8Array(input.publicKeySpkiBase64);
    const publicKey = await crypto.subtle.importKey(
      'spki',
      spkiBytes as BufferSource,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );

    const derSignature = base64UrlToUint8Array(input.signatureBase64Url);
    const rawSignature = derToRawEcdsaSignature(derSignature);
    const contentBytes = new TextEncoder().encode(input.content);

    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      rawSignature as BufferSource,
      contentBytes as BufferSource,
    );
  } catch {
    return false;
  }
}

/**
 * Replay protection: rejects a callback whose `timestamp` is not within
 * `maxAgeMs` of `nowMs`. Pure — callers supply `nowMs` explicitly so this
 * never depends on the device/server clock internally.
 */
export function isSsvTimestampFresh(
  timestampMs: number | null,
  nowMs: number,
  maxAgeMs: number,
): boolean {
  if (timestampMs == null || !Number.isFinite(timestampMs)) {
    return false;
  }
  const age = nowMs - timestampMs;
  return age >= 0 && age <= maxAgeMs;
}

export function findVerificationKey(
  keys: readonly SsvVerificationKey[],
  keyId: number | null,
): SsvVerificationKey | null {
  if (keyId == null) {
    return null;
  }
  return keys.find((key) => key.keyId === keyId) ?? null;
}

export const SSV_MAX_CALLBACK_AGE_MS = 5 * 60 * 1000;
