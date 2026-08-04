import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import {
  extractSignedContent,
  fetchVerificationKeys,
  findVerificationKey,
  isSsvTimestampFresh,
  parseSsvQueryParams,
  SSV_MAX_CALLBACK_AGE_MS,
  verifySsvSignature,
} from '../_shared/adMobSsv.ts';
import { createServiceClient } from '../_shared/supabaseAdmin.ts';

/**
 * Version 1.1C — AdMob Server-Side Verification (SSV) callback.
 *
 * Google's ad servers call this endpoint directly (GET, no Authorization
 * header) after a rewarded ad completes. This is the ONLY code path that
 * may credit Blaze Coins for the flat "25 coins" rewarded-ad reward — the
 * client's local EARNED_REWARD callback alone is never trusted.
 *
 * NOT LIVE-TESTABLE IN THIS ENVIRONMENT: exercising this correctly
 * requires configuring this deployed URL as the "Server-side verification
 * callback URL" for the real rewarded ad unit in the AdMob console, which
 * needs a live AdMob account. The ECDSA signature verification itself is
 * unit tested against a locally generated keypair
 * (src/monetization/v1_1cAdsSelfTest.ts) using the identical algorithm in
 * ../_shared/adMobSsv.ts. See docs/V1_1C_REWARDED_SSV.md for the exact
 * remaining blocker and why EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY stays
 * `false` in every profile until that live configuration + a real-device
 * verification pass are completed.
 */
Deno.serve(async (request) => {
  try {
    if (request.method !== 'GET') {
      return new Response('Method not allowed.', { status: 405 });
    }

    const url = new URL(request.url);
    const rawQuery = url.search;
    const params = parseSsvQueryParams(rawQuery);

    if (
      !params.signatureBase64Url ||
      params.keyId == null ||
      !params.customData ||
      !params.transactionId
    ) {
      return new Response('Missing required SSV parameters.', { status: 400 });
    }

    const nowMs = Date.now();
    if (!isSsvTimestampFresh(params.timestampMs, nowMs, SSV_MAX_CALLBACK_AGE_MS)) {
      return new Response('Callback timestamp is stale or missing (replay protection).', {
        status: 400,
      });
    }

    const keys = await fetchVerificationKeys(nowMs);
    const key = findVerificationKey(keys, params.keyId);
    if (!key) {
      return new Response('Unknown verification key_id.', { status: 400 });
    }

    const content = extractSignedContent(rawQuery);
    const signatureValid = await verifySsvSignature({
      content,
      signatureBase64Url: params.signatureBase64Url,
      publicKeySpkiBase64: key.base64,
    });

    if (!signatureValid) {
      return new Response('Invalid SSV signature.', { status: 401 });
    }

    const admin = createServiceClient();

    // custom_data carries the opaque requestId issued by request_rewarded_ad().
    const requestId = params.customData;

    const { data: requestRow, error: lookupError } = await admin
      .from('rewarded_ad_requests')
      .select('id, user_id, status')
      .eq('id', requestId)
      .maybeSingle();

    if (lookupError || !requestRow) {
      return new Response('Unknown reward request id.', { status: 404 });
    }

    // Defense in depth: the SSV user_id (if present) must match the
    // request's owner — never trust custom_data alone to identify the user.
    if (params.userId && params.userId !== requestRow.user_id) {
      return new Response('user_id mismatch.', { status: 403 });
    }

    const { data, error } = await admin.rpc('verify_and_grant_rewarded_ad', {
      p_request_id: requestRow.id,
      p_transaction_id: params.transactionId,
      p_callback_metadata: {
        ad_network: params.adNetwork,
        ad_unit: params.adUnit,
        reward_item: params.rewardItem,
        echoed_reward_amount: params.rewardAmount,
        key_id: params.keyId,
      },
    });

    if (error) {
      return new Response(error.message || 'Unable to verify reward.', { status: 409 });
    }

    void data;
    return new Response('OK', { status: 200 });
  } catch (_error) {
    return new Response('Internal server error.', { status: 500 });
  }
});
