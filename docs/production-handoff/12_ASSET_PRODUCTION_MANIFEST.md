# Remaining Asset Production Manifest

The twelve full-screen visual directions are already supplied. The assets below remain for production polish. Build them only after their placeholder states are functioning.

## Power asset families

For each of the eight powers, deliver:

- 1024 × 1024 master transparent PNG.
- 256, 128, 96, 64, and 48 px transparent PNG exports.
- Editable SVG only when the artwork is truly vector-safe.
- States: locked, ready, selected, targeting, insufficient energy, cooldown, blocked, activated, disabled.
- Monochrome accessibility mask.
- Low/static, medium, and high-quality effect treatment.

## Card assets

- One neutral card-face master and twelve theme-compatible frame treatments.
- Four suit glyphs and optional four-color variants.
- Card back per theme or a smaller curated launch set.
- Wild Shift value overlay and disabled/locked overlay.
- Empty slot, legal slot, selected slot, full slot, and bust slot.

## Gameplay effects

- Card reveal/placement trail.
- Score tick glow.
- Streak flames 1–4.
- Exact-21 ring.
- Five-card crown/burst.
- Bust fracture, smoke, and recovery.
- Shield, freeze, spark, scorch, wild, redirect, cleanse, and double-blaze effects.
- Victory, defeat, draw, rank-up, mission complete, reward claim.

## UI and meta assets

- Mode icons: tutorial, practice, casual, ranked, private, daily.
- Ranked tier badges: Ember, Flame, Inferno, Blaze, Legendary Blaze.
- Currency: Blaze Coin, Blaze Gem, Ranked Mark, XP.
- Mission, achievement, inbox, friend, report, network, reconnect, settings, accessibility, shop, restore-purchase icons.
- Profile frames, banners, placeholder avatars, emotes, and quick-chat bubbles.

## Audio

- Menu loop and gameplay loop with intensity layers.
- UI navigation/tap/back/error/success.
- Full card and power cue list from `03_CARD_AND_POWER_EFFECTS.md`.
- Countdown, sudden death, victory, defeat, rank change, reward, and purchase cues.
- Optional announcer callouts with subtitle keys.

## Naming

`category_item_variant_state_scale.ext`

Examples:

- `power_frost-lock_default_ready_128.png`
- `power_frost-lock_neon-cyan_cooldown_96.png`
- `effect_exact-21_molten_high.atlas`
- `audio_power_shield_block_v01.ogg`

Every asset entry should include source file, export files, intended slot size, pivot/anchor, safe padding, animation duration, loop behavior, quality tier, and licensing/provenance.
