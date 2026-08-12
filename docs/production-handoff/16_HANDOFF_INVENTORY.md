# Handoff Inventory

## Existing design and prototype package

- `src/` — runnable twelve-theme prototype.
- `public/assets/themes/` — twelve approved source directions.
- `handoff/exports/` — 1×, 2×, and 3× PNG exports.
- `handoff/theme-manifest.json` — normalized theme and lane geometry.
- `handoff/design-tokens.json` — existing visual/gameplay tokens.
- `handoff/figma-handoff.md` — Figma assembly guidance.
- `handoff/five-card-contract.md` — five-card lane rules.
- `design-qa.md` — original prototype QA record.

## New production documents

- `00_START_HERE.md`
- `01_CORE_GAME_RULES.md`
- `02_PVP_POWERS.md`
- `03_CARD_AND_POWER_EFFECTS.md`
- `04_SCREEN_AND_NAVIGATION_MAP.md`
- `05_BACKEND_REALTIME_AND_SECURITY.md`
- `06_PROGRESSION_ECONOMY_AND_MONETIZATION.md`
- `07_ANALYTICS_AND_LIVE_OPS.md`
- `08_ACCESSIBILITY_LOCALIZATION_AND_SETTINGS.md`
- `09_QA_TEST_PLAN.md`
- `10_RELEASE_AND_OPERATIONS.md`
- `11_IMPLEMENTATION_BACKLOG.md`
- `12_ASSET_PRODUCTION_MANIFEST.md`
- `13_ACCEPTANCE_CRITERIA.md`
- `14_DECISIONS_AND_OPEN_CONFIG.md`
- `15_IMPLEMENTATION_CHAT_PROMPT.md`
- `16_HANDOFF_INVENTORY.md`

## Machine-readable contracts

- `contracts/game-contracts.ts`
- `contracts/powers.json`
- `contracts/analytics-events.json`
- `contracts/supabase-schema.sql`

## Not included because they require live implementation or external authority

- Production Supabase credentials and store keys.
- Applied database migrations against the live project.
- Final power/effect raster atlases and licensed music/SFX recordings.
- Apple/Google purchase products and store-console configuration.
- Privacy policy/terms reviewed by counsel.
- Production analytics/crash vendor credentials.
- Store submission and signed production builds.

The package specifies those remaining execution items so the implementation chat can build them in the correct order.
