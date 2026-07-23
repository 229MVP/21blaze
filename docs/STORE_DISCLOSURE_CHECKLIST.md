# Store Disclosure Checklist — 21 Blaze RC 0.9.0

Use while completing App Store Connect and Google Play Console questionnaires.  
Items marked **Blocked** cannot be honestly answered as production-ready until P1s close.

---

## App identity

| Item | Value / status |
|------|----------------|
| App name | 21 Blaze |
| Bundle / application ID | `com.twentyoneblaze.app` |
| Version for RC | Target **0.9.0** (repo currently still `1.0.0`) |
| EAS project | **Blocked** — placeholder `projectId` |
| Platforms | iOS, Android (web export exists; not primary store binary) |

---

## Privacy nutrition / data safety

| Disclosure topic | Likely answer | Evidence / gap |
|------------------|---------------|----------------|
| Account info | Yes — user ID, display name | Anonymous auth + profiles |
| Gameplay / progress | Yes | Scores, ranked, progression |
| Purchases | Yes | RevenueCat + store |
| Advertising data | Yes | AdMob (currently **test IDs** in config — fix before production) |
| Approximate location | Usually No (confirm AdMob SDK defaults) | Verify SDK settings |
| Contacts / photos / mic | No (confirm no extra permissions) | Audit Info.plist / AndroidManifest before submit |
| Data linked to identity | Yes for online features | See [PRIVACY_DATA_MAP.md](./PRIVACY_DATA_MAP.md) |
| Data used for tracking | Disclose if ATT/AdMob personalized ads | Device verification pending |
| Privacy policy URL | Required | Must be live before submit |
| Account deletion URL / in-app path | Required (Apple) | **Plan only** — not implemented |

---

## Ads disclosures

- [ ] Production AdMob app IDs (not Google sample `3940256099942544`)
- [ ] SKAdNetwork items reviewed for iOS
- [ ] UMP / consent where required (EEA/UK)
- [ ] ATT prompt copy (iOS) reviewed
- [ ] Settings “privacy options” opens valid flow on device

**Audit:** Test AdMob IDs in `app.json` → **P1**.

---

## In-app purchases / subscriptions

| Item | Status |
|------|--------|
| Remove ads / cosmetics / Founders | Present in client; SKU remapping in progress |
| Pro monthly / yearly / lifetime | Present — feature freeze: do not expand |
| Subscription disclosure (terms, auto-renew) | Draft in store listing — legal copy TBD |
| Restore purchases | Must pass sandbox matrix — **Not run** |
| RevenueCat products match binary | **Mismatch P1** until remap |

---

## Multiplayer / UGC

| Item | Notes |
|------|-------|
| User-generated content | Display names — moderation/reporting policy TBD |
| Real-time multiplayer | Live/Quick/Ranked — **two-device untested** |
| Chat | None claimed — confirm no chat before answering “no” |

---

## Age rating questionnaires (pointers)

See [CONTENT_RATING_NOTES.md](./CONTENT_RATING_NOTES.md).

Expect declarations around: simulated gambling **No** (card game skill/score, not casino cash-out); violence **None/low**; unrestricted web **No**.

---

## Permissions checklist (verify in release binary)

| Permission | Expected |
|------------|----------|
| Internet / network | Yes |
| Advertising ID (Android) | Likely Yes if ads |
| ATT (iOS) | Likely if personalized ads |
| Push notifications | Only if implemented — do not declare unused |
| Location | Should be No unless SDK pulls it |

---

## Export / encryption

| Item | Notes |
|------|-------|
| Standard HTTPS | Yes (Supabase, stores, ads) |
| Export compliance | Typical HTTPS exemption path — confirm with counsel |

---

## Honest blockers before submit

1. Real EAS projectId + successful store builds  
2. Production AdMob IDs  
3. RevenueCat SKU remap + sandbox Pass  
4. Supabase remote deploy verified  
5. Privacy policy + account deletion path live  
6. Version string `0.9.0` (or final store version policy)

---

## Explicit non-claims

- No claim that store questionnaires are already filed.
- No claim of sandbox purchase or two-device multiplayer success.
