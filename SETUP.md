# Setup Guide — DivinexAI BookOS Launch Engine

This is the first module of the DivinexAI BookOS Launch Engine: a reusable
pre-launch waitlist system, currently configured for **The Billionaire
Blueprint 2.0**. This guide covers local development, provisioning real
credentials, and deploying to Vercel.

## 1. Local development (zero external setup required)

```bash
npm install
npm run dev
```

Open http://localhost:3000. By design, every external integration has a
graceful fallback so the full signup → email → Chapter 12 flow works with
**no credentials configured**:

- **No Supabase credentials** → subscriber data is kept in an in-memory
  store for the life of the dev server (resets on restart). A console
  warning makes this explicit.
- **No Resend API key** → "sent" emails are printed to the server console
  instead of delivered, so you can copy the Chapter 12 / status / unsubscribe
  links straight out of the terminal.
- **No `APP_TOKEN_SECRET`** → falls back to an insecure development secret
  (do not use this in production — see below).

This means you can exercise the entire funnel — supporter actions, waitlist
submission, referral codes, Chapter 12 gating, status lookup, unsubscribe —
immediately after `npm install`.

## 2. Provisioning Supabase (production persistence)

1. Create a project at https://supabase.com.
2. In the SQL editor, run the migration at
   `supabase/migrations/0001_init.sql` (or link the project and run
   `supabase db push` with the Supabase CLI).
3. From Project Settings → API, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not currently used
     server-side, but kept for future client-side features)
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` — **server-only,
     never expose this to the browser**

**Security model:** the `subscribers` table has Row-Level Security enabled
with zero policies. This means the `anon`/`authenticated` roles can read or
write nothing — only the `service_role` key (used exclusively in API routes
and Server Components, never sent to the browser) can access subscriber
data. If you build an admin dashboard later, prefer a scoped SELECT policy
tied to an `is_admin` claim over relaxing this table broadly.

## 3. Provisioning Resend (transactional email)

1. Create an account at https://resend.com and verify a sending domain
   (e.g. `blueprint.divinexai.com`).
2. Create an API key → `RESEND_API_KEY`.
3. Set `RESEND_FROM_EMAIL` to an address on your verified domain, e.g.
   `"The Billionaire Blueprint <launch@blueprint.divinexai.com>"`.

## 4. Generating `APP_TOKEN_SECRET`

This signs the Chapter 12 / status / unsubscribe "magic links" (see
`src/lib/security/tokens.ts`). Generate a strong random value and set it
before deploying:

```bash
openssl rand -hex 32
```

If this is left unset in production, the app falls back to a well-known
insecure development secret and logs a warning — anyone could forge access
links. Treat this the same as a session secret.

## 5. Social destinations

Set the `NEXT_PUBLIC_SOCIAL_*` and `NEXT_PUBLIC_LAUNCH_POST_URL` /
`NEXT_PUBLIC_SHARE_URL` variables to the real Follow/Like/Share
destinations. These are read in one place — `src/config/site.ts` — so
there's nowhere else to update when a campaign changes.

## 6. Replacing the book cover

Drop a new image at `public/images/billionaire-blueprint-2-cover.png` (or
update the path in `src/config/site.ts` → `assets.coverImage`, e.g. to a
`.webp` file). Every component reads the cover from that one config value.

**Recommended:** convert to WebP for faster loads:

```bash
npx @squoosh/cli --webp '{"quality":85}' public/images/billionaire-blueprint-2-cover.png
```

Keep the natural aspect ratio; the `CoverArt` component (
`src/components/marketing/cover-art.tsx`) is a fixed 2:3 frame designed for
a standard book-cover proportion.

## 7. Deploying to Vercel

1. Import the repository into Vercel.
2. Add all variables from `.env.example` under Project Settings →
   Environment Variables (for Production, and Preview if you want preview
   deployments to send real email / use real Supabase — otherwise preview
   deployments will safely use the dev fallbacks).
3. Set `NEXT_PUBLIC_SITE_URL` to your production domain, e.g.
   `https://blueprint.divinexai.com`.
4. Point your domain's DNS at Vercel and add it under Project Settings →
   Domains.

## 8. Testing

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest unit tests
npm run test:e2e    # Playwright end-to-end smoke tests (builds + boots the app)
```

## 9. Known `npm audit` findings

A few transitive **devDependencies** (ESLint's YAML config parser, jsdom's
HTTP client used only by the test environment) carry moderate/high
advisories with no non-breaking fix available at time of writing. They are
not part of the production bundle and are not exposed to attacker-controlled
input in this project (they parse trusted local config / run only in
`npm test`). Re-run `npm audit` periodically and take the upgrade once a
compatible fixed version ships. The one **critical**, production-relevant
finding (a Next.js RCE advisory) is already patched — this repo pins
`next@^16.3.7`.

## 10. Extending this into the BookOS Launch Engine

This codebase is intentionally structured so a future title can reuse it:

- All book-specific copy and identity lives in `src/config/site.ts` and
  `src/content/chapter-12.ts` — nothing else hardcodes the title, author,
  or chapter content.
- The subscriber schema (`supabase/migrations/0001_init.sql`) and store
  abstraction (`src/lib/store/`) are campaign-agnostic; add a `campaign`
  column if/when you run multiple launches from one database.
- Email templates (`src/lib/email/templates/`) pull all copy from
  `src/config/site.ts`, so a new launch mostly means editing that one file
  and swapping the cover image.
