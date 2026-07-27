# The Flavor Station (native)

Native mobile app (iOS + Android, React Native + Expo) for The Flavor
Station, a soul food restaurant in Baytown, TX. This is the first
production build of DivinexAI's white-label RestaurantOS native template;
patterns here are meant to be extracted for future restaurant clients.

Shares its backend (Supabase/Lovable Cloud) with the existing web app —
see `flavorful-foodie-forge` for the web client, schema, RLS policies, and
Edge Functions this app calls into.

## Getting started

```bash
cp .env.example .env.development   # then fill in the values
npm install
npm run web       # fastest loop for UI iteration
npm run ios       # requires macOS + Xcode
npm run android   # requires Android Studio
```

## Environment variables

Three env files, loaded automatically by Expo CLI based on the run mode:
`.env.development`, `.env.staging`, `.env.production`. Only `.env.example`
is committed — copy it and fill in real values locally; never commit the
others (see `.gitignore`). `EXPO_PUBLIC_`-prefixed vars are inlined into
the client bundle at build time — same convention as the web app's
`VITE_` prefix, so never put a secret behind it.

Currently `.env.development` and `.env.production` point at the same
single Supabase project the web app uses (one restaurant, one backend).
`.env.staging` is a placeholder until a separate staging project exists.

## Scripts

- `npm run web` / `ios` / `android` — start the dev server for that platform
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint (flat config via `eslint-config-expo`)
- `npm test` — Jest (`jest-expo` preset)

## Structure

```
src/
  app/            expo-router routes (file-based)
  components/     shared UI (ThemedText/ThemedView + design-token consumers)
  constants/      theme.ts — ported Flavor Station design tokens
  hooks/          use-color-scheme, use-theme
  lib/            supabase.ts — Supabase client (SecureStore on native,
                  localStorage fallback on web/SSR)
```

## Status

Scaffold milestone only: project setup, design tokens ported from the web
app, Supabase client wired to the real backend (read-only smoke test).
Menu browsing, cart/checkout, auth, and push notifications are separate
milestones — see the project's Phase 2 plan.
