# Threat model

Scope: Phase 1 (mock payments only, no live money movement). Each entry:
threat → mitigation in this codebase → residual risk / follow-up phase.

## Unauthorized file access

**Threat:** a buyer or anonymous visitor reads a paid product's file without
purchasing it, by guessing a storage path or manipulating a route parameter.

**Mitigation:** `product-files` storage bucket has no public/authenticated
read policy at all (verified empirically — see DATABASE.md). The only read
path is `getSignedDownloadUrl()`, which checks `entitlements.buyer_id =
<caller>` before minting a 5-minute signed URL. `product_files` table
metadata (including `storage_path`) also has no client SELECT policy.

**Residual risk:** a leaked signed URL is valid for 5 minutes for anyone
with the link — acceptable for Phase 1; watermarking/IP-binding is future
work.

## Account takeover

**Threat:** credential stuffing, session fixation.

**Mitigation:** Supabase Auth handles password hashing and session tokens;
`proxy.ts` refreshes sessions via `@supabase/ssr`'s cookie handling, which
rotates tokens.

**Residual risk:** no rate limiting, MFA, or account-lockout is implemented
in this application layer — relying on Supabase Auth's platform defaults.
Flagged in SECURITY.md as not yet built.

## Fake/fraudulent creator accounts

**Threat:** a bad actor creates a storefront to publish scam products.

**Mitigation:** every product requires admin approval (`product_submissions`,
`app/admin/moderation/page.tsx`) before it appears in marketplace search —
`status = 'published'` is only reachable via `approveProductAction`, which
requires `is_platform_admin()`. Seller verification status exists on every
creator account.

**Residual risk:** verification is manual/admin-driven only; no automated
sanctions-screening or document-verification integration yet (Phase 2+,
COMPLIANCE_NOTES.md).

## Payment fraud

**Threat:** a buyer pays with a stolen card, or a fraudulent chargeback.

**Mitigation:** not applicable to Phase 1 — no real payment provider is
connected, no card data is ever collected or stored by this application.

**Residual risk:** deferred entirely to Phase 2, at which point this
threat is owned jointly by the chosen provider's fraud tooling and this
app's `disputes`/`refunds` tables.

## Webhook replay

**Threat:** an attacker replays a captured payment webhook to fraudulently
mark an order paid.

**Mitigation:** schema is ready — `payment_events` has a unique constraint
on `(provider, provider_event_id)`, and `PaymentProvider.verifyWebhook()` is
part of the interface every real provider adapter must implement.

**Residual risk:** no real provider is wired up yet, so this is untested in
practice; must be exercised with real webhook fixtures before Phase 2 ships.

## Coupon abuse

**Threat:** a buyer redeems a single-use or capped coupon repeatedly.

**Mitigation:** `startCheckout` checks `redemption_count >=
max_redemptions` before allowing use; `coupon_redemptions` has a unique
constraint on `(coupon_id, order_id)`.

**Residual risk:** no per-buyer redemption limit (only a global cap) — a
buyer could use the same coupon on multiple accounts. Acceptable for Phase 1
given no live payments are at stake.

## Affiliate fraud

**Threat:** self-referral, click fraud.

**Mitigation:** not applicable yet — affiliate tables exist as schema-only
stubs (DATABASE.md) with admin-only RLS; no affiliate feature is live.

## Review manipulation

**Threat:** fake reviews, review bombing.

**Mitigation:** not applicable yet — `reviews` requires a matching
`order_items` row (`unique(order_item_id)`) in the schema, enforcing
verified-purchase-only once the feature ships in Phase 3.

## Payout redirection

**Threat:** an attacker changes a creator's payout destination to divert
funds.

**Mitigation:** not applicable — no payout destinations or payout execution
exist in Phase 1.

## Privilege escalation

**Threat:** a buyer or creator grants themselves `super_admin` or a higher
creator-team role than they should have.

**Mitigation:** `user_roles` has no client-facing INSERT/UPDATE policy
except `public.is_platform_admin()`-gated inserts; `creator_members` writes
require `is_creator_member(creator_id, ['owner','administrator'])`. Both
verified against direct cross-tenant write attempts during RLS testing
(DATABASE.md).

**Residual risk:** the team-invite flow (`modules/team/actions.ts`)
auto-accepts an invite immediately rather than requiring the invitee to
confirm — a deliberate Phase 1 simplification (documented in
`inviteTeamMemberAction`), not a security gap, since only existing
`owner`/`administrator` members can invite.

## Data exposure

**Threat:** a creator dashboard query leaks another creator's orders,
customers, or ledger data.

**Mitigation:** every creator-scoped table's RLS policy resolves through
`is_creator_member()`, tested directly (a second creator's `UPDATE` against
the first creator's product affected 0 rows).

## Cross-store access

**Threat:** a creator team member with a restricted role (e.g.
`finance_viewer`) performs an action reserved for `owner`/`administrator`.

**Mitigation:** RLS policies parameterize the allowed `creator_member_role`
array per operation (see `products_update_managers`,
`storefronts_update_managers`, etc. in `0004`–`0007` migrations); UI-level
checks in `modules/creators/service.ts` (`canManageProducts`,
`canManageStorefront`, `canManageTeam`, `canViewFinance`) mirror but do not
replace them.
