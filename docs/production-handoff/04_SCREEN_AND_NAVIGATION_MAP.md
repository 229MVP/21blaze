# Complete Screen and Navigation Map

The twelve existing gameplay directions are skins of one Gameplay screen, not twelve unrelated routes.

## Launch screen inventory

| Area | Screens | Required launch behavior |
|---|---|---|
| Entry | Splash, Age/Terms gate, Sign in, Create account, Guest warning | Restore session; protect purchases and ranked play |
| Onboarding | Welcome, Rules tutorial, Lane tutorial, Power tutorial, First practice result | Skippable after first completion; replayable in Help |
| Home | Home hub, Daily Blaze card, Events card, Inbox preview | Continue progression and surface primary play action |
| Play | Mode select, Power loadout, Matchmaking, Private room/create/join | Validate loadout before queue |
| Match | Gameplay, Pause/options, Reconnecting, Opponent disconnected, Result, Rematch | Preserve match state across network interruption |
| Ranked | Rank overview, Leaderboard, Season rewards, Match history, Match detail | Show verified result and rating explanation |
| Collection | Powers, Power detail/training, Themes, Card backs, Effects, Emotes | Equip cosmetic and competitive loadouts separately |
| Progression | Player profile, Level rewards, Missions, Achievements, Daily reward | Server-granted rewards only |
| Shop | Featured, Themes, Effects, Bundles, Purchase confirmation, Restore purchases | Cosmetic-only competitive economy |
| Social | Friends, Requests, Invite, Private duel, Inbox | Block/report controls required |
| Settings | Account, Audio, Haptics, Graphics, Accessibility, Notifications, Privacy, Support, Legal | Cloud-save settings where appropriate |

## Primary navigation

Bottom navigation after onboarding:

1. **Home**
2. **Play**
3. **Collection**
4. **Ranked**
5. **Profile**

The central Play item may receive the strongest visual emphasis but must remain an ordinary accessible tab target.

## Core route flow

`Splash → Session Restore → Home → Mode Select → Loadout → Matchmaking → Gameplay → Result → Home/Rematch`

Private duel:

`Home/Play → Private Room → Create or Join → Lobby → Loadout Ready Check → Gameplay → Result → Rematch/Lobby`

Daily challenge:

`Home → Daily Blaze Details → Ranked Attempt Confirmation → Gameplay → Daily Result → Daily Leaderboard`

## Deep-link routes

- `/play`
- `/play/private/:inviteCode`
- `/ranked/leaderboard`
- `/match/:matchId/result`
- `/collection/power/:powerId`
- `/shop/item/:catalogItemId`
- `/inbox/:messageId`

Unauthenticated deep links preserve their intended destination through authentication. Expired or unauthorized match links show a safe result-unavailable state.

## Gameplay overlays

Gameplay must support these overlays without leaving the match route: power targeting, status detail, pause/options, network quality, reconnect countdown, opponent disconnect, tutorial callout, reduced-motion notice, and match-end transition.

## Missing screen design priority

1. Mode Select, Loadout, Matchmaking, Gameplay PvP HUD, Result.
2. Home, Collection/Powers, Ranked overview, Leaderboard.
3. Onboarding, missions, profile, settings, shop.
4. Social, inbox, achievements, event variants.

All screens should inherit the chosen 21 Blaze direction while keeping typography, spacing, accessibility, and navigation anatomy consistent.
