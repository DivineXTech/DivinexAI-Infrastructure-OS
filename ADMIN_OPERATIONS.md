# Admin operations

## Getting admin access

No UI grants the first admin (see DEPLOYMENT.md). Either:

```sql
insert into public.user_roles (user_id, role)
values ('<auth.users.id>', 'super_admin')
on conflict do nothing;
```

or run `npm run seed` with `ADMIN_EMAIL_ALLOWLIST=you@example.com` set.

Any of `super_admin`, `marketplace_admin`, `moderator`, `support_agent`,
`finance_admin` grants access to `/admin` (`is_platform_admin()` treats
them equivalently in Phase 1 — finer-grained admin permissions are a
follow-up, not yet differentiated).

## Product moderation (`/admin/moderation`)

Every product a creator submits (`submitProductForReviewAction`) creates a
`product_submissions` row with `status = 'pending'` and sets the product to
`status = 'in_review'`. This page lists all pending submissions.

- **Approve** → product becomes `status = 'published'`, `published_at` set,
  now visible in marketplace search. Writes an `audit_logs` row
  (`product.approved`) with before/after state.
- **Reject** → requires a reason (min 3 characters); product becomes
  `status = 'rejected'` with `rejected_reason` set (shown to the creator).
  Writes `product.rejected` to the audit log.

## Seller verification (`/admin/creators`)

Lists every creator account with its current `seller_verifications.status`.
Only `pending` verifications show Approve/Reject actions — a creator moves
to `pending` by... nothing in Phase 1 actually transitions
`not_started → pending` yet (no "submit for verification" UI exists on the
creator side). In practice, use the seed script or a direct SQL update to
set a creator's verification to `pending` for testing this admin flow, or
extend `modules/creators` with the seller-facing submission action —
tracked as a Phase 2 gap.

## Orders (`/admin/orders`)

Read-only view of every order platform-wide, most recent 100. No
refund/dispute action exists in the UI yet — `refunds`/`disputes` tables
exist but have no mutation path (ROADMAP.md Phase 2).

## Audit log (`/admin/audit`)

Every material action writes here via `modules/audit/log.ts#writeAuditLog`,
using the service-role client so entries can never be tampered with by the
acting user's own session. Currently logged actions: `product.created`,
`product.submitted`, `product.approved`, `product.rejected`,
`creator.onboarded`, `creator.verified`,
`creator.verification_rejected`, `storefront.published`,
`storefront.updated`, `team.member_invited`, `order.fulfilled`,
`order.payment_failed`.

## Platform configuration

`platform_plans`, `platform_fee_rules`, `product_categories`,
`countries`, `currencies`, `feature_flags`, and `platform_settings` are all
real tables with no admin UI yet — manage them via SQL or the Supabase
table editor until Phase 2's `/admin/fees`, `/admin/plans`,
`/admin/categories`, `/admin/countries`, `/admin/providers` are built. The
public `/pricing` page and checkout fee calculation both read
`platform_plans`/`platform_fee_rules` live, so changes there take effect
immediately without a deploy.
