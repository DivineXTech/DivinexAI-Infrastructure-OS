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

**Verifying RLS is actually enforced** — after running the migration, confirm
the `anon` key gets zero rows while `service_role` gets real data:

```bash
# Should return {"code":"PGRST116", ...} or an empty array — never subscriber rows.
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/subscribers?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"

# Should return actual rows (service_role bypasses RLS by design).
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/subscribers?select=*" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

You can also run `select * from pg_policies where tablename = 'subscribers';`
in the SQL editor — it should return **zero rows**, confirming no policy
accidentally opens the table up.

**Chapter 12 content storage:** the early-access chapter is currently plain
text checked into source at `src/content/chapter-12.ts`, rendered only after
the page verifies a signed access token server-side — an unauthenticated
request never receives the chapter content in its response, so this already
satisfies "private" without a storage layer. If the final asset becomes a
formatted file (PDF/EPUB) instead of text, the stack's Supabase Storage
integration is still available but not yet wired up: create a **private**
bucket (`chapter-12`, public access off), upload the file, and in
`src/app/chapter-12/page.tsx` replace the inline content render with
`await getSupabaseAdmin().storage.from("chapter-12").createSignedUrl(path, 300)`
after the existing token check, then redirect/embed that short-lived signed
URL. No other route or component needs to change.

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

## 5. Production fail-fast guards

The dev fallbacks described in §1 are intentionally **disabled** the moment
the app detects it's running in a real production deployment, so launch
traffic can never silently land in an in-memory store or go un-emailed:

- `getSubscriberStore()` throws if Supabase isn't configured.
- `sendEmail()` throws if Resend isn't configured.
- Signing a token throws if `APP_TOKEN_SECRET` isn't set.

Each throws a descriptive error (visible in Vercel's function logs) instead
of degrading quietly, and the affected API route returns `500`.

**This only activates when `VERCEL_ENV=production`** (set automatically by
Vercel for the Production environment — not Preview, not local `next build`
/ `next start`, not this repo's own CI). Deliberately not keyed off
`NODE_ENV`, since `next build`/`next start` always set
`NODE_ENV=production` even for local smoke testing — keying off that would
have broken local prod-mode testing and this repo's own Playwright suite.
If you self-host outside Vercel, set `VERCEL_ENV=production` explicitly in
that environment to get the same protection. See `src/lib/env.ts` →
`isRunningInProduction()`.

**Practical implication:** the first real deployment to the Production
environment in Vercel will hard-fail on every waitlist submission until
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
and `APP_TOKEN_SECRET` are all set there — by design, so no real visitor can
ever sign up into a store that silently discards their data.

## 6. Social destinations

Set the `NEXT_PUBLIC_SOCIAL_*` and `NEXT_PUBLIC_LAUNCH_POST_URL` /
`NEXT_PUBLIC_SHARE_URL` variables to the real Follow/Like/Share
destinations. These are read in one place — `src/config/site.ts` — so
there's nowhere else to update when a campaign changes.

## 7. Replacing the book cover

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

## 8. Deploying to Vercel (blueprint.divinexai.com)

1. Import the repository into Vercel, selecting the `claude/billionaire-blueprint-launch-lzoju4`
   branch (or `main` once the PR is merged) as the Production branch.
2. Under Project Settings → Environment Variables, add every variable from
   `.env.example` to the **Production** environment (see §5 — Production
   will hard-fail signups until these are set). Add them to Preview too only
   if you want preview deployments to send real email / use real Supabase;
   otherwise previews safely use the dev fallbacks.
3. Set `NEXT_PUBLIC_SITE_URL=https://blueprint.divinexai.com`.
4. Under Project Settings → Domains, add `blueprint.divinexai.com`. Vercel
   will show the exact DNS record to create — typically either:
   - a **CNAME** record: `blueprint` → `cname.vercel-dns.com`, or
   - an **A** record: `blueprint` → `76.76.21.21`
   (Vercel's UI gives the authoritative current value — use what it shows,
   not this list, if they differ.) Create the record at whoever hosts DNS
   for `divinexai.com`.
5. Wait for Vercel to confirm the domain and auto-issue a TLS certificate.
6. `VERCEL_ENV` is set automatically by Vercel per environment — no action
   needed for the fail-fast guards in §5 to work correctly.

## 9. Continuous integration

`.github/workflows/billionaire-blueprint-ci.yml` runs on every push/PR that
touches app code: lint → typecheck → unit tests → build, then a second job
installs Chromium and runs the Playwright e2e suite. Both must be green
before merging. It builds/runs with placeholder credentials (no
`VERCEL_ENV`), so it exercises the dev-fallback path intentionally — it does
not (and cannot, without real credentials) verify the production path
end-to-end; that's a deploy-time check, not a CI-time one.

## 10. Local verification commands

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest unit tests
npm run test:e2e    # Playwright end-to-end smoke tests (builds + boots the app)
```

## 11. Known `npm audit` findings

This repo pins `next@^16.4.0`, which patches every production-relevant
Next.js advisory found to date, including:

- A critical unauthenticated RCE (windows-hosted servers; AVIF Image
  Optimization) — fixed in 16.3.7.
- A batch disclosed after that: SSRF in Image Optimization, SSG/ISR cache
  poisoning (self-hosted), Draft Mode content leak via `use cache`,
  metadata-image-route `dynamicParams` info disclosure, and a dev-only MCP
  endpoint info disclosure — all fixed in 16.3.8, which 16.4.0 includes.

Re-run `npm audit` before every deploy — Next.js advisories have landed
roughly every two weeks during this project; treat a pinned version as
provisional, not settled. `npm install next@latest eslint-config-next@latest`
is the normal remediation once `npm run build && npm test && npm run
test:e2e` stay green after the bump (as verified for 16.4.0).

The remaining findings are all transitive **devDependencies with no
non-breaking fix available** — ESLint's YAML/glob internals (`js-yaml`,
`brace-expansion`, `braces`), a `nanoid` copy bundled inside PostCSS, a
`source-map-js` build-tool transitive, and `undici` (jsdom's HTTP client,
test-environment only). None ship in the production bundle or run against
attacker-controlled input in this project (they parse trusted local config
or run only under `npm test`/`npm run lint`). `npm audit fix --force` would
downgrade `eslint-config-next` to the 14.x line to "fix" these — a real
regression, not a fix — so that's deliberately not applied. Re-check
periodically for a non-breaking upstream fix.

## 12. Extending this into the BookOS Launch Engine

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

## 13. Founder checklist — what's needed before go-live

Everything below is external to this codebase and cannot be provisioned by
an AI agent. Nothing in the app will silently proceed without it (§5).

**Accounts / credentials**
- [ ] Supabase project created; `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Resend account; sending domain added and verified; `RESEND_API_KEY`
- [ ] `APP_TOKEN_SECRET` generated (`openssl rand -hex 32`) and stored as a
      secret, not committed anywhere
- [ ] Vercel project connected to this GitHub repo

**DNS (at whoever hosts `divinexai.com`)**
- [ ] `blueprint.divinexai.com` → CNAME/A record per Vercel's Domains panel
      (§8)
- [ ] For Resend domain verification: the SPF/DKIM/DMARC TXT (and
      sometimes MX) records Resend's dashboard provides for the domain you
      send from (e.g. `blueprint.divinexai.com` or a subdomain of it)

**Assets**
- [ ] Final book cover image (replaces `public/images/billionaire-blueprint-2-cover.png`
      — see §7; no code change required)
- [ ] Final Follow/Like/Share destination URLs (Instagram, TikTok, YouTube,
      Facebook, LinkedIn, the launch post, the share URL) for the
      `NEXT_PUBLIC_SOCIAL_*` variables (§6)
- [ ] Final Chapter 12 text/file, if different from the current placeholder
      chapter in `src/content/chapter-12.ts`
- [ ] Support email address for `NEXT_PUBLIC_SUPPORT_EMAIL`
- [ ] Decision + details on referral reward fulfillment (not yet built —
      see the production-readiness report for what exists vs. doesn't)

**Sign-off**
- [ ] PR #3 reviewed and approved by the founder
- [ ] A real end-to-end test performed against the Production environment
      (real signup → real email received → real Chapter 12 link works)
      before announcing the launch publicly
