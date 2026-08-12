# Card, Power, Audio, and Haptic Effects

Effects communicate verified state; they must never delay server resolution. Gameplay state updates first, then the client renders the matching effect from the accepted event.

## Card effects

| Trigger | Visual | Duration | Audio | Haptic |
|---|---|---:|---|---|
| Card reveal | Card flips from back with rim light | 240ms | soft flick | light |
| Legal lane hover | Lane outline brightens; slot expands 4% | while targeting | none | selection once |
| Card placement | Curved travel path into chosen slot, small impact spark | 280ms | card snap | light |
| Score increment | Number rolls to verified value | 220ms | ascending tick | none |
| Streak tier | Flame meter ignites one tier; multiplier punches in | 360ms | flame rise | medium |
| Exact 21 | Lane flash, radial flame ring, “21” lock-in | 650ms | signature blaze hit | success |
| Five-card 21 | Five cards cascade-highlight, gold crown burst | 900ms | blaze hit + chime | success then medium |
| Bust | Red fracture sweep, smoke, score changes to BUST | 520ms | low crack | warning |
| Bust recovery | Smoke reverses, green/gold edge relights | 500ms | restore swell | success |
| Lane full | Fifth slot seals; capacity pips illuminate | 320ms | metal seal | medium |
| Auto-Route | Timer flashes amber; dashed path moves card | 300ms | warning click | warning |
| Match victory | Four lanes collapse into central Blaze emblem | 1,200ms | victory sting | success |
| Match defeat | Embers cool; score remains readable | 900ms | low resolve | none |

## Power effects

| Power | Activation | Target effect | Resolve/expiry |
|---|---|---|---|
| Ember Shield | Golden ember wraps player badge | Translucent hex/flame barrier | Barrier cracks on block or dissolves on expiry |
| Frost Lock | Cyan charge at power icon | Ice grows around lane perimeter; timer badge | Ice shatters on cleanse/expiry |
| Swap Spark | Orange electric tether between chosen lanes | Newest cards exchange along crossing arcs | Twin sparks confirm recalculated totals |
| Scorch Mark | Red ember projectile crosses center | +3 heat badge and rising heat distortion | Smoke dissipates; score rolls back if needed |
| Wild Shift | Card enters orange prism | Value carousel stops on server-approved value | Prism collapses into card face |
| Redirect | Purple arrow splits toward opponent lanes | Forced lane receives pulsing arrow and countdown | Arrow snaps into placement or dissolves |
| Cleanse | White-gold wave starts at player emblem | Status badges lift from affected area | Status-specific debris fades |
| Double Blaze | Multiplier flame forms behind current card | Armed badge remains for up to 10s | Gold double-ring burst on exact 21 or ember fade on expiry |

## Performance budgets

- Maintain 60 FPS on target mid-range devices; gracefully fall to 30 FPS without changing timers.
- Maximum four full-screen particle emitters at once.
- Maximum 80 live particles on low quality, 160 medium, 280 high.
- Texture atlases: 2048 × 2048 preferred, 4096 maximum.
- One-shot effect audio should be mono AAC/OGG, normally under 200 KB each.
- Reuse pooled particles and animation objects; do not allocate per frame.
- If events arrive while another effect plays, queue cosmetic animation for at most 350 ms, then fast-forward to verified state.

## Accessibility variants

- Reduced Motion replaces travel, shake, zoom, fracture, and particle bursts with 120–180 ms fades and outlines.
- Screen Flash Off removes full-screen luminance changes and uses localized rings.
- Haptics Off disables all vibration.
- Every status uses icon + text/timer, not color alone.
- Critical events announce concise screen-reader messages after server acceptance.

## Asset delivery list

Create these production assets after placeholder integration is proven:

- Card back, card face frame, four suit icons, wild-value overlay.
- Five empty/filled capacity pips.
- Eight power icons plus nine state treatments each.
- Shield barrier, ice edge, spark trail, heat distortion mask, redirect arrow, cleanse wave, double-blaze ring.
- Flame streak tiers 0–4, exact-21 ring, five-card crown, bust fracture/smoke, victory emblem.
- Status badges: shielded, frozen, scorched, redirected, double-blaze armed.
- Quality variants: low/static, medium, high.
- Audio: UI tap, card reveal/place, score tick, streak tiers, 21, five-card 21, bust, recovery, each power activate/hit/block/expire, countdown, victory, defeat.
