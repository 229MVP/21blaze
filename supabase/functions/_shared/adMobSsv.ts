/**
 * Version 1.1C — Google AdMob SSV signature verification, Deno copy.
 *
 * Mirrors `src/monetization/adMobSsvVerification.ts` exactly (same Web
 * Crypto API is available in both Deno and the client-side unit test
 * environment) so the verification logic that is unit-tested with a
 * self-generated keypair is provably the same logic deployed here. Keep
 * both files in sync if this algorithm ever changes.
 */

export type SsvVerificationKey = {
  keyId: number;
  base64: string;
};

const P256_COMPONENT_LENGTH = 32;

export function extractSignedContent(rawQueryString: string): string {
  const query = rawQueryString.startsWith('?') ? rawQueryString.slice(1) : rawQueryString;
  const signatureIndex = query.indexOf('&signature=');
  if (signatureIndex === -1) {
    const altIndex = query.indexOf('signature=');
    return altIndex <= 0 ? '' : query.slice(0, altIndex - 1);
  }
  return query.slice(0, signatureIndex);
}

export function parseSsvQueryParams(rawQueryString: string) {
  const query = rawQueryString.startsWith('?') ? rawQueryString.slice(1) : rawQueryString;
  const params = new URLSearchParams(query);
  const numberOrNull = (value: string | null): number | null => {
    if (value == null || value.trim() === '') return null;
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
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function stripLeadingZeros(bytes: Uint8Array): Uint8Array {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
  return bytes.slice(start);
}

function padLeft(bytes: Uint8Array, length: number): Uint8Array {
  if (bytes.length >= length) return bytes.slice(bytes.length - length);
  const out = new Uint8Array(length);
  out.set(bytes, length - bytes.length);
  return out;
}

export function derToRawEcdsaSignature(
  der: Uint8Array,
  componentLength = P256_COMPONENT_LENGTH,
): Uint8Array {
  let offset = 0;
  if (der[offset] !== 0x30) throw new Error('Invalid DER signature: expected SEQUENCE');
  offset += 1;

  const first = der[offset];
  offset += 1;
  if (first & 0x80) {
    offset += first & 0x7f;
  }

  if (der[offset] !== 0x02) throw new Error('Invalid DER signature: expected INTEGER for r');
  offset += 1;
  const rLen = der[offset];
  offset += 1;
  const r = der.slice(offset, offset + rLen);
  offset += rLen;

  if (der[offset] !== 0x02) throw new Error('Invalid DER signature: expected INTEGER for s');
  offset += 1;
  const sLen = der[offset];
  offset += 1;
  const s = der.slice(offset, offset + sLen);

  const raw = new Uint8Array(componentLength * 2);
  raw.set(padLeft(stripLeadingZeros(r), componentLength), 0);
  raw.set(padLeft(stripLeadingZeros(s), componentLength), componentLength);
  return raw;
}

export async function verifySsvSignature(input: {
  content: string;
  signatureBase64Url: string;
  publicKeySpkiBase64: string;
}): Promise<boolean> {
  try {
    const spkiBytes = base64ToUint8Array(input.publicKeySpkiBase64);
    const publicKey = await crypto.subtle.importKey(
      'spki',
      spkiBytes,
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
      rawSignature,
      contentBytes,
    );
  } catch {
    return false;
  }
}

export function isSsvTimestampFresh(
  timestampMs: number | null,
  nowMs: number,
  maxAgeMs: number,
): boolean {
  if (timestampMs == null || !Number.isFinite(timestampMs)) return false;
  const age = nowMs - timestampMs;
  return age >= 0 && age <= maxAgeMs;
}

export function findVerificationKey(
  keys: readonly SsvVerificationKey[],
  keyId: number | null,
): SsvVerificationKey | null {
  if (keyId == null) return null;
  return keys.find((key) => key.keyId === keyId) ?? null;
}

export const SSV_MAX_CALLBACK_AGE_MS = 5 * 60 * 1000;
export const SSV_VERIFIER_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';

let cachedKeys: { keys: SsvVerificationKey[]; fetchedAtMs: number } | null = null;
const KEYS_CACHE_TTL_MS = 60 * 60 * 1000; // Google rotates keys infrequently.

export async function fetchVerificationKeys(nowMs: number): Promise<SsvVerificationKey[]> {
  if (cachedKeys && nowMs - cachedKeys.fetchedAtMs < KEYS_CACHE_TTL_MS) {
    return cachedKeys.keys;
  }
  const response = await fetch(SSV_VERIFIER_KEYS_URL);
  if (!response.ok) {
    throw new Error(`Unable to fetch AdMob SSV verification keys (${response.status})`);
  }
  const data = (await response.json()) as { keys?: SsvVerificationKey[] };
  const keys = Array.isArray(data.keys) ? data.keys : [];
  cachedKeys = { keys, fetchedAtMs: nowMs };
  return keys;
}
