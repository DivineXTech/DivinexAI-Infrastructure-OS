# Roadmap

## Phase 1 — Foundation (this repository, complete)

- [x] Repository audit, architecture plan, design system
- [x] Database schema (11 migrations) with RLS on every table, validated
      against a local Postgres instance with simulated cross-tenant access
      attempts
- [x] Authentication (Supabase Auth, email/password), roles and permissions
      (platform roles + per-creator team roles, enforced server-side and
      in RLS)
- [x] Seller onboarding (resumable multi-step flow)
- [x] Storefront (`/@username`) and product CRUD, including protected file
      upload and cover image upload via signed URLs
- [x] Secure file storage: entitlement-gated signed download URLs, no
      public path to a paid file
- [x] Public marketplace shell: homepage, discover, search, categories,
      product pages, creator directory, deterministic ranking (newest-first)
- [x] Mock checkout → orders → entitlements → customer library →
      protected download, fully wired
- [x] Discount codes (creator-created, server-validated, ledger-recorded)
- [x] Creator dashboard: overview (real stored metrics), products, orders,
      customers, storefront settings, earnings/ledger, team management
- [x] Admin console: overview, product moderation (approve/reject with
      audit trail), seller verification, orders, audit log viewer
- [x] Seed script (5 demo African creators/products across NG/KE/GH/ZA),
      unit tests, e2e tests

## Phase 2 — Commerce (next)

- [ ] Stripe adapter (implements `PaymentProvider`)
- [ ] Paystack adapter (Nigeria, Ghana)
- [ ] Flutterwave adapter (pan-African)
- [ ] Real webhook processing: signature verification, idempotent
      processing against `payment_events`
- [ ] Refund processing UI (schema and admin data model exist;
      `refunds` table has no mutation path yet)
- [ ] Payout tracking and scheduling
- [ ] Platform subscriptions (Starter/Creator Pro/Studio/Enterprise billing
      — `platform_plans` and `platform_subscriptions` schema exists,
      pricing page reads it, but no billing/upgrade flow exists)
- [ ] Country/product-type/plan-specific fee rule resolution (currently
      only the single default `platform_fee_rules` row is used)

## Phase 3 — Creator growth

- [ ] Subscribers + creator email tools (`subscribers`,
      `subscriber_consents` schema exists)
- [ ] Affiliates (`affiliate_*` schema exists)
- [ ] Reviews (`reviews`, `review_votes` schema exists, verified-purchase
      constraint already enforced at the schema level)
- [ ] AI Creator Studio (`ai_generations`, `ai_credit_ledger` schema
      exists; no `AIProvider` interface or mock implementation built yet —
      unlike payments/storage, this wasn't scaffolded to avoid unused
      dead code)
- [ ] Courses (lesson delivery + progress tracking — `courses`,
      `course_sections`, `course_lessons`, `course_lesson_progress` schema
      exists)
- [ ] Memberships/subscriptions (`membership_plans`, `subscriptions` schema
      exists)
- [ ] Advanced analytics: store visits, product views, conversion rate
      (requires wiring `analytics_events` inserts into the marketplace
      browsing pages — the table and dashboard "Coming soon" placeholder
      already exist)

## Phase 4 — Africa scale

- [ ] Additional countries beyond the 15 seeded in `0011` (architecture
      already supports any ISO country code)
- [ ] Mobile money providers (M-Pesa, MTN, Airtel Money)
- [ ] Multilingual interface (French, Portuguese, Arabic, Swahili —
      `preferred_language` already captured at onboarding, no i18n
      framework wired up yet)
- [ ] WhatsApp integration
- [ ] Local partner onboarding, university/incubator marketplaces,
      white-label enterprise marketplace, AI-agent installation marketplace

## Known Phase 1 simplifications (not bugs, documented tradeoffs)

- Team member invites (`modules/team/actions.ts`) auto-accept immediately
  rather than requiring the invitee to confirm — only existing
  `owner`/`administrator` members can invite, so this doesn't weaken the
  permission model, just skips an acceptance step.
- Coupon redemption caps are global, not per-buyer.
- The catalog search is deterministic keyword + filter matching, not
  ranked/AI-powered — `modules/catalog/service.ts` is the intended plug-in
  point for a future recommendation engine.
- Marketplace and dashboard pages fetch with `force-dynamic` for
  correctness (always-fresh inventory/orders) rather than optimizing for
  cache hit rate — worth revisiting with ISR once traffic patterns exist.
