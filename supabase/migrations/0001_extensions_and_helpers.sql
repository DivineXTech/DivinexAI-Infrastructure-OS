-- FlowraMarket Africa — 0001: extensions, enums, and shared helper functions
-- Assumes deployment onto a Supabase project, which already provides the
-- `auth` schema (auth.uid(), auth.users) and `storage` schema. Local
-- validation of these migrations uses scripts/local-dev-auth-shim.sql to
-- emulate `auth.uid()` — that shim is never applied to a real project.

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists app;

-- Generic updated_at trigger -------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Enum types ------------------------------------------------------------------
create type app.platform_role as enum (
  'buyer',
  'creator',
  'affiliate',
  'moderator',
  'support_agent',
  'finance_admin',
  'marketplace_admin',
  'super_admin'
);

create type app.creator_member_role as enum (
  'owner',
  'administrator',
  'product_manager',
  'marketing_manager',
  'support_agent',
  'analyst',
  'finance_viewer'
);

create type app.verification_status as enum (
  'not_started',
  'pending',
  'approved',
  'restricted',
  'rejected'
);

create type app.product_type as enum (
  'downloadable_file',
  'external_resource',
  'course',
  'membership',
  'subscription',
  'service',
  'license_key',
  'software_product',
  'api_access',
  'ai_agent',
  'automation_workflow',
  'business_os_template',
  'event_ticket',
  'bundle',
  'pay_what_you_want',
  'free_lead_magnet',
  'preorder'
);

create type app.product_status as enum (
  'draft',
  'in_review',
  'published',
  'rejected',
  'unlisted',
  'archived',
  'suspended'
);

create type app.submission_status as enum (
  'pending',
  'approved',
  'rejected',
  'changes_requested'
);

create type app.order_status as enum (
  'pending',
  'processing',
  'paid',
  'fulfilled',
  'partially_refunded',
  'refunded',
  'failed',
  'disputed',
  'cancelled'
);

create type app.payment_provider as enum (
  'mock',
  'stripe',
  'paystack',
  'flutterwave'
);

create type app.payment_status as enum (
  'requires_payment',
  'processing',
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded'
);

create type app.moderation_status as enum (
  'pending',
  'approved',
  'rejected',
  'flagged',
  'removed'
);

comment on schema app is 'FlowraMarket Africa application schema: enums, shared helper functions, and cross-cutting utilities used by public tables.';
