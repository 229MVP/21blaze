# Screenshot Plan — 21 Blaze RC 0.9.0

Plan for store screenshots and preview frames. Capture from **release-configured** builds once EAS projectId and production AdMob/IAP configs are fixed.  
Do not use debug banners or Google test-ad labels in final store art.

---

## Devices / sizes (minimum)

| Platform | Sizes |
|----------|-------|
| iPhone | 6.7" and 6.5" (plus 5.5" if still required) |
| iPad (if tablet supported) | 12.9" — `supportsTablet: true` in app.json |
| Android Phone | Feature graphic 1024×500 + phone screenshots |
| Android Tablet | Optional if listing includes tablets |

Orientation: **Portrait** only.

---

## Shot list (order = store carousel order)

| # | Shot | Screen / state | Must show | Avoid |
|---|------|----------------|-----------|-------|
| 1 | Hero gameplay | Solo `GameScreen` mid-run, strong score/streak | Brand/logo presence, readable HUD | Tiny UI, debug FPS |
| 2 | Tension / bust risk | Lane near bust decision | Clarity of choices | Cluttered overlays |
| 3 | Results | `ResultsScreen` with solid score | Score celebration | Fake “+$$$$$” gambling language |
| 4 | Home hub | `HomeScreen` | Modes entry, brand | Dashboard clutter |
| 5 | Live Duel | Lobby or in-match (two-device when available) | Multiplayer fantasy | Empty/error states |
| 6 | Ranked | `RankedHome` or division badge | Competitive climb | Implying pay-to-win |
| 7 | Cosmetics | Inferno cards **or** Neon arena equipped | Cosmetic-only beauty | “Odds boost” claims |
| 8 | Store | `BlazeStoreScreen` | Remove ads / packs / Pro present | Test product IDs, $0.00 placeholders if broken |
| 9 | Progression | Daily reward **or** missions **or** XP bar | Retention loop | Unverified coin claim callouts |

Optional extras: How to Play, Leaderboard, Settings privacy entry.

---

## Caption drafts (short)

1. Push the blaze. Don’t bust.  
2. One card from glory — or flames.  
3. Post a score worth chasing.  
4. Jump into Solo, Live, or Ranked.  
5. Challenge a friend in Live Duel.  
6. Climb divisions in Ranked.  
7. Dress the board. Never buy the deal.  
8. Optional Store — ads off, cosmetics on.  
9. Come back for dailies and XP.

---

## Production constraints

- **No** Google “Test Ad” watermarks
- **No** Expo / dev-client banners
- Prefer online mode with real display name; if backend unverified, use staged local screens honestly for marketing comps and re-shoot after deploy
- Founders creative should match **post-remap** contents (ad_free + inferno + neon) — today’s code grants volcano not neon; don’t screenshot neon-as-Founders until remap ships
- Do not show Casual/Ranked **unverified** coin grant toasts as if server-backed

---

## Capture checklist

- [ ] Release build (real EAS projectId) — currently **blocked**
- [ ] Production AdMob IDs or ads disabled for clean shots
- [ ] Reduced motion OFF for hero shot; one accessibility reduced-motion alt optional
- [ ] Same account cosmetics across shots 7–8
- [ ] Export lossless PNG; no heavy compression artifacts

---

## Explicit non-claims

Screenshot plan readiness ≠ multiplayer or purchase certification.
