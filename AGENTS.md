# AGENTS.md

## Cursor Cloud specific instructions

This repo is **21 Blaze**, a single Expo / React Native (SDK ~57, TypeScript) mobile card game. Package manager is **npm** (`package-lock.json`). Dependencies are installed automatically by the startup update script (`npm install`), so you normally don't need to reinstall.

### Services / how to run

- **The app (only hard requirement for core gameplay):** run the Expo dev server. For a headless cloud VM, run it as a web app so it renders in a browser: `npx expo start --web --port 8081`, then open `http://localhost:8081`. Metro takes ~10-30s to bundle on first load (blank dark screen until then). Standard run scripts are in `package.json` (`npm start`, `web`, `ios`, `android`).
- **Solo Play is fully local/offline** and needs no backend, no `.env`, and no auth. It is never gated by feature flags. This is the fastest end-to-end smoke test: Home → `SOLO PLAY` → place cards into lanes.
- **Online/multiplayer/monetization/progression** features are feature-flagged **OFF** by default (see `.env.example` / `src/config/featureFlags.ts`). Without Supabase env vars the auth store settles into `authStatus: 'local'` after a ~4s timeout and the app keeps working in "local mode" — this is expected, not a failure.
- **Backend** is a hosted Supabase project (Postgres + Deno Edge Functions under `supabase/`). There is **no local Docker / docker-compose**; edge functions deploy via the Supabase CLI. Testing any online feature end-to-end requires a configured hosted Supabase project (see `docs/SUPABASE_DEPLOYMENT_CHECKLIST.md` and `docs/ENVIRONMENT_VARIABLES.md`).

### Non-obvious gotchas

- **Node version:** `.nvmrc` pins Node 20, but the VM's default `node` (v22, at `/exec-daemon/node`) takes PATH precedence over nvm and works fine for install/build/test. `nvm use 20` will NOT change the resolved `node` because `/exec-daemon` is earlier in `PATH`; don't fight it.
- **Web bundling works** even though the app depends on native-only modules (`react-native-google-mobile-ads`, `react-native-purchases`). Those are isolated behind platform files (e.g. `*.native.ts`), so the web bundle compiles. AdMob falls back to Google TEST ad unit IDs when env vars are empty; ads/IAP only truly function in a native EAS build, not on web/Expo Go.
- **`.env`** is optional and gitignored; copy from `.env.example` if you want to point at a Supabase project. It is not needed for Solo Play.

### Lint / typecheck / test

- **Typecheck (there is no ESLint config):** `npx tsc --noEmit`. `tsconfig.json` excludes `supabase/functions` (Deno runtime, typed separately).
- **Automated tests** are `tsx` self-test scripts (no Jest): `npm run test:game`, `npm run test:ranked`, `npm run test:monetization`, `npm run test:progression`. They use assertions and **pass = exit code 0**; `test:game` prints nothing on success (silent), the others print a "passed" line.
