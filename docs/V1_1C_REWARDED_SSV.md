# Version 1.1C Rewarded-Ad Server-Side Verification (SSV)

## Status: implemented, unit-tested, **not live-verified**

`EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY` stays `false` in every EAS profile
(development, preview, testflight, production) until the live
verification pass described below is completed. Production Blaze Coins
are **never** granted from the client's local reward callback alone —
see "Security model" below.

## What was built

### 1. Pre-registration (`request_rewarded_ad` RPC + `request-rewarded-ad` Edge Function)

Before the client loads a rewarded ad, it calls `request-rewarded-ad`,
which:

- Authenticates the caller (standard Supabase JWT).
- Enforces the 3-per-UTC-day cap **before any ad impression happens** (so
  a capped-out player never wastes an ad watch that couldn't be paid).
- Inserts a `pending` row into `rewarded_ad_requests` with a 10-minute
  expiry and returns its `id`.

### 2. SSV-tagged ad request

The client passes that `id` as
`serverSideVerificationOptions.customData` (and the authenticated user id
as `serverSideVerificationOptions.userId`) when creating the rewarded ad
request (`adService.showRewardedAdForServerVerification`). AdMob echoes
both values back in its SSV postback.

### 3. Verification callback (`verify-rewarded-ad` Edge Function)

Google's ad servers call this endpoint directly (GET, no Authorization
header — Google does not have a Supabase session). It:

1. Parses the callback query parameters.
2. Rejects the callback if the timestamp is missing or older than 5
   minutes (replay protection).
3. Fetches Google's published verification keys
   (`https://www.gstatic.com/admob/reward/verifier-keys.json`, cached for
   an hour) and finds the one matching the callback's `key_id`.
4. Verifies the callback's ECDSA P-256/SHA-256 signature over the exact
   query-string prefix Google signed (everything before `&signature=`).
   Signatures are DER-encoded by Google; this step converts to the raw
   `r‖s` form the Web Crypto API requires.
5. Looks up the `rewarded_ad_requests` row by the `custom_data` id and
   confirms `user_id` matches (defense in depth beyond the signature
   check alone).
6. Calls `verify_and_grant_rewarded_ad`, the **only** function that ever
   credits the wallet for this reward — it re-checks the daily cap,
   applies the wallet delta idempotently (keyed by the request id, so a
   duplicate/replayed callback can never double-grant), and marks the
   request `verified`.

### 4. Client polling

The client never grants coins itself. After the ad's local
`EARNED_REWARD` event fires, `useRewardedCoinStore` shows
`REWARD VERIFYING…` and polls `rewarded_ad_requests` (RLS: a player may
only `SELECT` their own rows) every 2 seconds for up to 25 seconds. It
only shows `25 COINS ADDED` once that poll observes `status = 'verified'`
— i.e., once the server has already applied the grant.

## Security model

| Guarantee | How it's enforced |
|---|---|
| Client cannot forge a reward | `verify_and_grant_rewarded_ad` is only callable by `service_role`, from inside `verify-rewarded-ad`, which requires a valid Google signature first. |
| Client cannot inflate the amount | The credited amount always comes from the `rewarded_ad_requests.reward_amount` column (fixed at request time to 25), never from the amount Google echoes in the callback or anything the client sends. |
| Duplicate/replayed callback grants once | `verify_and_grant_rewarded_ad` is idempotent: a request already in `verified` status returns the existing grant without a second wallet mutation. The `transaction_id` column is also `UNIQUE`, and stale timestamps (>5 minutes old) are rejected outright. |
| Daily cap cannot be exceeded via a race | Enforced both at request time (`request_rewarded_ad`) and at grant time (`verify_and_grant_rewarded_ad`), inside a `FOR UPDATE`-locked row. |
| No PII/secrets in analytics or logs | Event payloads carry only ids, amounts, and enum-like status strings (see `docs/V1_1C_ADS_AUDIT.md`). |

## Why this cannot be live-verified in this environment

Testing the full pipeline against **real** Google traffic requires:

1. A live AdMob account with a real (or AdMob-provided test) rewarded ad
   unit.
2. Configuring that ad unit's **"Server-side verification callback URL"**
   in the AdMob console to point at the deployed
   `verify-rewarded-ad` Edge Function URL.
3. A physical device (or AdMob's test-ad SSV tooling) actually watching a
   rewarded ad, which triggers Google's servers to call that URL.

None of this is possible from this sandboxed development environment —
there is no AdMob console access, no deployed Supabase project for this
milestone, and no EAS build was produced (out of scope for this
milestone; the instructions explicitly say not to run an EAS build or
submit to TestFlight yet).

**What *is* verified:** the cryptographic core (`derToRawEcdsaSignature`,
`extractSignedContent`, `verifySsvSignature`) is exercised end-to-end in
`src/monetization/v1_1cAdsSelfTest.ts` against a real, locally-generated
EC P-256 keypair standing in for Google's — a genuine signature is
correctly accepted, a tampered payload (e.g. an inflated `reward_amount`)
is correctly rejected, and a signature from the wrong key is correctly
rejected. This proves the verification *algorithm* is implemented
correctly; it does not prove the *deployed, configured* endpoint has been
exercised by real Google traffic.

## Exact remaining blocker

> Deploy `verify-rewarded-ad` and `request-rewarded-ad` to a live
> Supabase project, apply migration `0010_v1_1c_rewarded_ad_ssv.sql`,
> configure the deployed `verify-rewarded-ad` URL as the SSV callback for
> a real (or AdMob test) rewarded ad unit in the AdMob console, then
> watch a rewarded ad on a physical device and confirm a `verified` row
> appears with the wallet correctly credited exactly once. Only after
> that pass should `EXPO_PUBLIC_ENABLE_REWARDED_CURRENCY` be set to
> `true` for any profile.

Until that pass, per the Version 1.1C instructions: rewarded-coin ads
stay disabled in production, test rewarded ads remain available for UI
testing (the ad itself still plays; the `WATCH AD — EARN 25 COINS`
button and its states are fully exercisable end-to-end except the final
`verified` transition, which legitimately never arrives without a real
Google callback), and zero production currency is ever granted.
