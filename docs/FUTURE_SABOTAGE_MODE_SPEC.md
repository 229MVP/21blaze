# Future Feature Specification — Sabotage Battle Mode

**Status:** Approved for a future release. **Not implemented** in Version 1.2.0.
**Do not** add sabotage effects, UI, or server logic until this mode is explicitly
scheduled and resourced.

---

## 1. Overview

**Sabotage Battle** is a separate competitive mode from Solo Play, Ranked, Live
Duel, and Daily Challenge. Two players engage in the standard 21 Blaze lane
rules while each may deploy **sabotage effects** against the opponent and
**defensive effects** for themselves.

Design goals:

- Skill-based competition with tactical disruption, not raw stat inflation
- **No pay-to-win numerical advantages** — premium content is visual only
- **Server-authoritative** effect activation, resolution, and economy
- Clear counters, cooldowns, and stacking limits to prevent spam and exploits

---

## 2. Mode structure

| Element | Specification |
|---------|----------------|
| Mode identity | Distinct queue / match type (`sabotage_battle`) |
| Match rules | Same core deck, lanes, 21, five-card clear, bust, and timer baselines as Ranked unless mode-specific tuning is approved in a later doc |
| Slots | **3 sabotage slots** (offensive) + **1 defense slot** |
| Energy | **Sabotage Energy** meter — spend to activate slotted effects; regen rules defined server-side |
| Ranked values | Uses **standardized Ranked** rating / MMR hooks where applicable (shared ladder policy doc) |
| Cosmetics | Earnable effect visuals + **premium visual skins only** (no gameplay stat bundles) |
| Economy | Selected effects unlockable with **Blaze Coins**; server confirms ownership before slot equip |

---

## 3. Sabotage Energy

- Meter visible to both players (current value + regen state as designed)
- Activation costs defined per effect tier on the server
- Regen: time-based and/or event-based (e.g. after opponent bust) — exact curves in balance doc when implemented
- Client displays server state; **never** deducts energy locally for authoritative matches
- Offline / practice variants may use local simulation with clear labeling

---

## 4. Initial approved effect set (v1 of Sabotage Battle)

These eight effects are approved for the **first sabotage release**. Implement
only when mode ships; **do not** add to Solo or Ranked without mode gate.

| Effect | Category | Summary |
|--------|----------|---------|
| **Time Burn** | Time pressure | Reduces opponent usable time or accelerates their timer segment |
| **Blind Draw** | Visibility | Hides or delays opponent active card reveal |
| **Frozen Lane** | Lane disruption | Locks one opponent lane from receiving cards for a window |
| **Lane Fog** | Visibility | Obscures one or more opponent lane totals/cards |
| **Multiplier Jam** | Score / multiplier | Suppresses or caps opponent multiplier growth temporarily |
| **Blaze Shield** | Defensive | Blocks or dampens the next incoming sabotage |
| **Cleanse** | Defensive | Removes active negative effects from self |
| **Mirror Flame** | Counter | Reflects or partially returns a sabotage effect |

Each effect must define: duration, energy cost, cooldown, stacking rule, counter
interactions, client VFX/audio, and Reduced Motion fallback.

---

## 5. Approved future expansion catalog (not v1)

Documented for roadmap alignment. **Not** in initial implementation scope.

### Visibility effects
- Deep fog (multi-lane obscurity)
- Card back swap (cosmetic misread window)
- Timer shimmer (distraction-only VFX)

### Time-pressure effects
- Sudden countdown pulse
- Turn skip compression

### Lane disruption
- Lane shuffle (cosmetic reorder without rule break)
- Forced lane (must play to indicated lane next card)

### Score and multiplier disruption
- Score leak (display-only panic, no real score change without server rule)
- Multiplier reset (server-timed reset to floor)

### Decision-pressure effects
- Double-or-hold prompt (timed decision UI)
- Fake bust warning (UI-only unless server confirms real bust state)

### Defensive effects
- Extended Blaze Shield tiers
- Energy surge (regen boost, not flat energy grant without cap)

### Rare high-tier effects
- One-per-match ultimates with long cooldowns and broadcast VFX
- Spectator-visible “Blaze Storm” moments (cosmetic spectacle + single rule mutation)

All expansion effects require separate balance review and anti-cheat sign-off.

---

## 6. Server authority

- Match state, energy, cooldowns, effect application, and cleanse resolution live on the server
- Client sends **intent** (`activate_sabotage`, `slot_index`, `target_lane`, `effect_event_id` proposal)
- Server validates: turn phase, energy, cooldown, immunity, stacking, target legality
- Server emits **effect events** with canonical payloads; clients render only confirmed events
- No client-only sabotage that alters score, timer, or lane totals in authoritative matches

---

## 7. Effect cooldowns

- Per-effect cooldown tracked server-side per player per match
- Global sabotage activation throttle optional (e.g. max one offensive sabotage per N seconds)
- Cooldown UI synced from server snapshots; local countdown is display-only
- Reconnect restores cooldown state from server, not local cache

---

## 8. Effect stacking limits

- Explicit max stacks per effect type (typically 1 active instance; some defensives may stack visually but not numerically)
- Mutually exclusive groups (e.g. two visibility haze effects collapse to strongest)
- Server rejects activation that would exceed stack cap
- Cleanse removes stacks according to priority table (debuffs before buffs, etc.)

---

## 9. Counter and cleanse system

- **Blaze Shield** consumes on block; priority over raw damage-style debuffs
- **Mirror Flame** triggers on defined offensive categories only
- **Cleanse** removes debuffs per tag list; does not refund energy spent by opponent
- Counter chain depth capped (prevent infinite reflect loops)
- Effect interaction matrix maintained in server module + regression tests

---

## 10. Effect event IDs and idempotency

- Every applied effect receives a server-generated **`effect_event_id`** (UUID or deterministic match-scoped id)
- Client handlers key VFX/audio off `effect_event_id`; duplicate delivery must not double-apply
- Activation RPCs accept optional client **`request_id`**; server returns same result for retries
- Event log per match for replay, dispute resolution, and analytics

---

## 11. Anti-cheat requirements

- Rate-limit activation RPCs per player
- Reject activations during invalid phases (countdown, pause, results, disconnect grace)
- Validate equipped effect ids against owned catalog server-side
- Log anomalous patterns (impossible energy, zero cooldown bursts, target spoofing)
- No trust of client timer or lane totals for sabotage outcomes
- Spectator / replay stream uses same event log as clients

---

## 12. Economy and monetization boundaries

| Allowed | Forbidden |
|---------|-----------|
| Blaze Coin unlock for earnable sabotage cosmetics / slot themes | Dollar bundles that increase energy regen, reduce cooldowns, or add hidden stats |
| Premium **visual skins** for effects (particles, colors, sounds) | Pay-to-win “+10% sabotage damage” |
| Battle pass **cosmetic** tracks (future) | Gacha numeric power |

Purchases remain disabled in 1.2.0; sabotage economy ships only when store policy allows and server wallet authority is live.

---

## 13. Client UX (future)

- Pre-match loadout: 3 sabotage + 1 defense picker
- In-match energy bar + cooldown chips on slots
- Opponent effect telegraph (accessibility: not color-only; Reduced Motion safe)
- Clear “blocked / cleansed / reflected” feedback
- No sabotage UI in Solo Play navigation until mode flag enabled

---

## 14. Dependencies before implementation

- [ ] Ranked / async infrastructure stable
- [ ] Server effect engine + event log schema
- [ ] Anti-cheat monitoring for activation RPCs
- [ ] Balance spreadsheet for initial eight effects
- [ ] Feature flag `EXPO_PUBLIC_ENABLE_SABOTAGE_BATTLE` (default false)
- [ ] QA matrix for effect interaction matrix
- [ ] Legal review for competitive disruption mechanics in target regions

---

## 15. Explicit non-goals for 1.2.0

- No sabotage slots in Solo Play
- No sabotage energy in existing modes
- No new currencies for sabotage-only wallets
- No RevenueCat products for sabotage power
- No Daily Challenge / Live Duel integration until separately approved

---

**Document version:** 1.0 (spec only)  
**Target app version when implemented:** TBD (post-1.2.0)
