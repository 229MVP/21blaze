# Account Deletion Plan — 21 Blaze RC 0.9.0

Apple and Google require a way for users to request deletion of their account and associated data.  
**Status at audit:** Not implemented in-app. Auth supports anonymous guest sessions and local mode; no dedicated delete-account API or UI flow yet.

---

## Goals

1. User can initiate deletion from the app (Settings) **or** a web form linked from the store listing.
2. Deletion removes or anonymizes personal data in Supabase within a published timeframe (recommend ≤ 30 days; aim for immediate soft-delete + hard purge job).
3. Store purchases remain governed by Apple/Google; entitlements revoke server-side; receipts stay with stores.
4. Local-only mode users can clear local data without a cloud account.

---

## Data to delete or anonymize

| Store | Action on delete |
|-------|------------------|
| Auth user (`auth.users`) | Delete user (cascades where FK ON DELETE CASCADE) |
| `profiles` | Delete or anonymize display name |
| Online / live / ranked match history | Delete rows owned by user **or** anonymize `user_id`/display name for leaderboard integrity policy (choose one; document in privacy policy) |
| `player_wallets`, `wallet_transactions` | Delete |
| `player_entitlements`, cosmetics, equipped | Delete |
| `purchase_events`, `ad_reward_claims` | Delete or retain minimal fraud log **without** PII if legally required — decide with counsel |
| Progression (XP, dailies, missions) | Delete |
| RevenueCat | Delete/alias subscriber via RC API or support process |
| AdMob | No first-party store; rely on device ad settings |
| Local AsyncStorage | Clear on-device on confirmation |

**RLS note:** Clients cannot directly wipe wallet/XP tables; deletion must use **service role** edge function or admin job.

---

## Proposed implementation (RC hardening — permitted under freeze as compliance)

### A. In-app flow

1. Settings → Account → **Delete account**
2. Explain consequences (scores, cosmetics, coins, ranked progress)
3. Require typed confirmation (`DELETE`)
4. Call edge function `delete-account` (to be added) with user JWT
5. Sign out; clear local storage; show confirmation

### B. Edge function `delete-account` (new)

1. `requireAuthedUser`
2. Verify `user.id` matches
3. Service-role transaction: delete child tables then `auth.admin.deleteUser`
4. Idempotent if user already gone
5. Audit log row (optional, without display name)

### C. Web fallback (store requirement)

- Hosted page: email + account identifier instructions, or magic link authenticated delete
- SLA statement matching privacy policy

---

## Purchase / subscription caveats

| Case | Behavior |
|------|----------|
| Active Pro subscription | User must cancel in App Store / Play; deletion does not refund |
| Non-consumable IAP | Still owned in store account; reinstall + new guest will not auto-restore until restore with same store account |
| Founders coin grant | Removed with wallet; re-purchase rules follow store |

---

## Local-mode users

If `authStatus === 'local'` (no Supabase session):

1. Offer **Clear local data** (scores, settings, local caches)
2. Do not claim cloud deletion

---

## Timeline (suggested)

| Milestone | Target |
|-----------|--------|
| Spec + privacy policy wording | Before store submit |
| `delete-account` function + migration FKs review | Before RC gate |
| Settings UI + QA | Before RC gate |
| Web request form live | Before App Store submit |

---

## Testing checklist

- [ ] Delete removes profile and wallet for test user
- [ ] JWT for user A cannot delete user B
- [ ] Post-delete sign-in creates fresh anonymous user
- [ ] Leaderboard policy matches privacy wording
- [ ] RevenueCat subscriber cleaned or documented exception

---

## Explicit non-claims

- Account deletion is **not** available in the audited build.
- No remote deletion job has been deployed.
