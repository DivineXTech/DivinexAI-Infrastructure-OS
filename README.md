# DivinexAI BookOS Launch Engine

A premium, mobile-first pre-launch waitlist system, built as a reusable
module for launching books, courses, reports, and other digital products.
Currently configured for **The Billionaire Blueprint 2.0** (Extended
Edition) by Robert L. McCormick, published by Divinex Technology LLC.

Visitors complete three supporter actions (Follow, Like, Share), join the
waitlist, and receive early access to Chapter 12 — with referral tracking,
a secure subscriber status portal, and full legal/compliance pages.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
Supabase (Postgres + RLS) · Resend · Zod · React Hook Form · Vitest ·
Playwright · Vercel Analytics

## Quick start

```bash
npm install
npm run dev
```

No external credentials are required to run the full funnel locally —
Supabase and Resend both have graceful dev fallbacks. See
**[SETUP.md](./SETUP.md)** for provisioning real credentials, deploying to
Vercel, replacing the cover image, and extending this to future launches.

## Routes

| Route                  | Purpose                                             |
| ----------------------- | ---------------------------------------------------- |
| `/`                    | Primary landing page and conversion funnel          |
| `/join`                | Focused waitlist enrollment page                    |
| `/thank-you`           | Post-submission confirmation + referral tools       |
| `/chapter-12`          | Secure, token-gated early-access chapter            |
| `/referral/[code]`     | Referral attribution redirect                       |
| `/status`              | Subscriber status / referral count portal           |
| `/privacy`             | Privacy Policy                                      |
| `/terms`               | Terms of Use                                        |
| `/early-access-terms`  | Chapter 12 early-access offer terms                 |
| `/unsubscribe`         | Email unsubscribe workflow                          |

## Scripts

```bash
npm run dev         # start the dev server
npm run build       # production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest unit tests
npm run test:e2e    # Playwright end-to-end smoke tests
```

## Project structure

```
src/config/site.ts        # single source of truth: book copy, social links, assets
src/content/chapter-12.ts # gated early-access chapter content
src/lib/                  # env, security (tokens/rate-limit), store, email, validation
src/components/           # UI primitives + marketing components
src/app/                  # routes (see table above) + API routes
supabase/migrations/      # Postgres schema + RLS
```
