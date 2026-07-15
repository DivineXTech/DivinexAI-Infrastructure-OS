-- KushPrintCo OS — Phase 3 onboarding schema.
--
-- One row per tenant for every preference table below (`tenant_id unique
-- not null references tenants(id)`), upserted as the wizard progresses —
-- this is what makes the Server Actions in
-- app/app/onboarding/wizard-actions.ts idempotent: re-submitting the same
-- step (refresh, double-click) is a plain upsert on the same row, not a
-- new one. `session_id` is kept alongside `tenant_id` on each table for
-- traceability back to the onboarding_sessions row that produced it, even
-- though `tenant_id` is what every RLS policy and query actually keys on.
--
-- RLS follows the role matrix in docs/ROLES_AND_PERMISSIONS.md /
-- docs/ONBOARDING.md: tenant_owner/tenant_admin have full read+write on
-- every table; designer additionally reads brand_profiles and
-- brand_product_preferences (read-only); production_manager additionally
-- reads production_preferences (read-only). Every other role has no
-- access. All membership checks route through has_tenant_role()/
-- is_tenant_member() (foundation migration) — the same helpers, not a
-- parallel implementation — and every query in the application layer
-- that reads these tables is scoped by an explicit tenant_id resolved
-- from the caller's own session (see lib/onboarding/session.ts), the
-- same pattern the 20260716010000/pre-Phase-3 fixes established. No
-- table here is queried by a "my X" contract that trusts RLS breadth
-- alone.

-- ---------------------------------------------------------------------------
-- onboarding_sessions: one per tenant. Tracks wizard status and the
-- cached "current step" (source of truth for step ordering/locking is
-- onboarding_step_progress; current_step is a denormalized convenience
-- field kept in sync by the same Server Action that marks a step done).
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  started_by uuid not null references public.profiles (id),
  current_step text not null default 'welcome',
  completion_percentage int not null default 0
    check (completion_percentage between 0 and 100),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'needs_review', 'completed', 'archived')),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.onboarding_sessions is 'One onboarding wizard session per tenant. Absence of a row means onboarding has not started.';
create index if not exists onboarding_sessions_tenant_id_idx on public.onboarding_sessions (tenant_id);

-- ---------------------------------------------------------------------------
-- onboarding_step_progress: per-step completion marker. Source of truth
-- for "current step" and step locking (see lib/onboarding/progress.ts).
-- ---------------------------------------------------------------------------
create table if not exists public.onboarding_step_progress (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.onboarding_sessions (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  step_key text not null check (step_key in (
    'welcome', 'brand', 'audience', 'products', 'production', 'budget',
    'startup_kit', 'storefront', 'fulfillment', 'review'
  )),
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, step_key)
);

create index if not exists onboarding_step_progress_tenant_id_idx on public.onboarding_step_progress (tenant_id);
create index if not exists onboarding_step_progress_session_id_idx on public.onboarding_step_progress (session_id);

-- ---------------------------------------------------------------------------
-- brand_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  session_id uuid references public.onboarding_sessions (id) on delete set null,
  brand_name text not null,
  tagline text,
  description text,
  logo_path text,
  primary_color text,
  secondary_color text,
  accent_color text,
  typography text,
  personality text check (personality in (
    'luxury', 'streetwear', 'athletic', 'professional', 'youth',
    'faith_based', 'lifestyle', 'workwear', 'custom'
  )),
  personality_other text,
  existing_website text,
  social_links jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_profiles_tenant_id_idx on public.brand_profiles (tenant_id);

-- ---------------------------------------------------------------------------
-- brand_audiences
-- ---------------------------------------------------------------------------
create table if not exists public.brand_audiences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  session_id uuid references public.onboarding_sessions (id) on delete set null,
  customer_types text[] not null default '{}',
  age_ranges text[] not null default '{}',
  geographic_focus text,
  market_type text check (market_type in ('b2c', 'b2b', 'both')),
  style_preferences text[] not null default '{}',
  purchase_motivation text,
  price_sensitivity text,
  primary_sales_channel text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_audiences_tenant_id_idx on public.brand_audiences (tenant_id);

-- ---------------------------------------------------------------------------
-- brand_product_preferences
-- ---------------------------------------------------------------------------
create table if not exists public.brand_product_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  session_id uuid references public.onboarding_sessions (id) on delete set null,
  categories text[] not null default '{}',
  launch_quantity int,
  initial_design_count int,
  size_range text,
  color_range text,
  customization_requirements text,
  sales_model text check (sales_model in ('retail', 'wholesale', 'both')),
  target_price_min_cents int,
  target_price_max_cents int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    target_price_min_cents is null or target_price_max_cents is null
    or target_price_min_cents <= target_price_max_cents
  )
);

create index if not exists brand_product_preferences_tenant_id_idx on public.brand_product_preferences (tenant_id);

-- ---------------------------------------------------------------------------
-- production_preferences
-- ---------------------------------------------------------------------------
create table if not exists public.production_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  session_id uuid references public.onboarding_sessions (id) on delete set null,
  preferred_method text check (preferred_method in (
    'heat_transfer_vinyl', 'dtf', 'sublimation', 'screen_printing',
    'embroidery', 'outsourced', 'hybrid'
  )),
  experience_level text check (experience_level in ('new', 'some_experience', 'experienced')),
  workspace text,
  expected_monthly_volume int,
  equipment_owned boolean not null default false,
  existing_equipment text,
  outsourcing_preference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists production_preferences_tenant_id_idx on public.production_preferences (tenant_id);

-- ---------------------------------------------------------------------------
-- budget_profiles. Allocation sum (where present) may never exceed the
-- precise total (where the founder chose to give one) — enforced here,
-- not just in Zod, since this is the one place a monetary invariant
-- actually matters at the data layer.
-- ---------------------------------------------------------------------------
create table if not exists public.budget_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  session_id uuid references public.onboarding_sessions (id) on delete set null,
  budget_band text not null check (budget_band in (
    'under_500', '500_1500', '1500_5000', '5000_15000', '15000_plus', 'custom_undecided'
  )),
  precise_total_cents int,
  allocation_equipment_cents int,
  allocation_blank_apparel_cents int,
  allocation_branding_cents int,
  allocation_storefront_cents int,
  allocation_marketing_cents int,
  allocation_packaging_cents int,
  allocation_training_cents int,
  allocation_working_capital_cents int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    precise_total_cents is null
    or (
      coalesce(allocation_equipment_cents, 0) + coalesce(allocation_blank_apparel_cents, 0)
      + coalesce(allocation_branding_cents, 0) + coalesce(allocation_storefront_cents, 0)
      + coalesce(allocation_marketing_cents, 0) + coalesce(allocation_packaging_cents, 0)
      + coalesce(allocation_training_cents, 0) + coalesce(allocation_working_capital_cents, 0)
    ) <= precise_total_cents
  )
);

create index if not exists budget_profiles_tenant_id_idx on public.budget_profiles (tenant_id);

-- ---------------------------------------------------------------------------
-- startup_kit_recommendations
-- ---------------------------------------------------------------------------
create table if not exists public.startup_kit_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  session_id uuid references public.onboarding_sessions (id) on delete set null,
  recommended_kit_slug text not null,
  secondary_kit_slug text,
  score numeric not null,
  explanation text not null,
  required_categories text[] not null default '{}',
  optional_categories text[] not null default '{}',
  owned_items text[] not null default '{}',
  estimated_range_min_cents int,
  estimated_range_max_cents int,
  risks text[] not null default '{}',
  next_steps text[] not null default '{}',
  rule_version text not null,
  user_selected_kit_slug text,
  overridden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists startup_kit_recommendations_tenant_id_idx on public.startup_kit_recommendations (tenant_id);

-- ---------------------------------------------------------------------------
-- storefront_preferences
-- ---------------------------------------------------------------------------
create table if not exists public.storefront_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  session_id uuid references public.onboarding_sessions (id) on delete set null,
  storefront_name text,
  theme_direction text,
  hero_messaging text,
  featured_categories text[] not null default '{}',
  domain_status text check (domain_status in ('none', 'have_domain', 'need_domain')),
  existing_domain text,
  social_links jsonb not null default '{}'::jsonb,
  contact_channel text,
  announcement_bar_text text,
  fulfillment_offer text check (fulfillment_offer in ('pickup', 'shipping', 'both')),
  planned_payment_methods jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists storefront_preferences_tenant_id_idx on public.storefront_preferences (tenant_id);

-- ---------------------------------------------------------------------------
-- fulfillment_preferences
-- ---------------------------------------------------------------------------
create table if not exists public.fulfillment_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  session_id uuid references public.onboarding_sessions (id) on delete set null,
  fulfillment_model text check (fulfillment_model in (
    'self_fulfillment', 'local_pickup', 'third_party', 'supplier_direct', 'hybrid'
  )),
  production_lead_time_days int,
  pickup_location_placeholder text,
  shipping_regions text[] not null default '{}',
  return_policy_status text check (return_policy_status in ('defined', 'in_progress', 'not_started')),
  packaging_preference text,
  tracking_required boolean not null default false,
  qc_responsibility text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fulfillment_preferences_tenant_id_idx on public.fulfillment_preferences (tenant_id);

-- ---------------------------------------------------------------------------
-- launch_readiness_assessments
-- ---------------------------------------------------------------------------
create table if not exists public.launch_readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  session_id uuid references public.onboarding_sessions (id) on delete set null,
  total_score int not null check (total_score between 0 and 100),
  category_scores jsonb not null default '{}'::jsonb,
  strengths text[] not null default '{}',
  gaps text[] not null default '{}',
  priority_actions text[] not null default '{}',
  blocking_issues text[] not null default '{}',
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists launch_readiness_assessments_tenant_id_idx on public.launch_readiness_assessments (tenant_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance (reuses public.set_updated_at() from the
-- foundation migration)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'onboarding_sessions', 'onboarding_step_progress', 'brand_profiles',
    'brand_audiences', 'brand_product_preferences', 'production_preferences',
    'budget_profiles', 'startup_kit_recommendations', 'storefront_preferences',
    'fulfillment_preferences', 'launch_readiness_assessments'
  ]
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I; create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security: default-deny on every table above.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'onboarding_sessions', 'onboarding_step_progress', 'brand_profiles',
    'brand_audiences', 'brand_product_preferences', 'production_preferences',
    'budget_profiles', 'startup_kit_recommendations', 'storefront_preferences',
    'fulfillment_preferences', 'launch_readiness_assessments'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end;
$$;

-- onboarding_sessions / onboarding_step_progress: owner/admin full access
-- (plus platform super admin, consistent with every other tenant table).
drop policy if exists onboarding_sessions_owner_admin on public.onboarding_sessions;
create policy onboarding_sessions_owner_admin on public.onboarding_sessions
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  );

drop policy if exists onboarding_step_progress_owner_admin on public.onboarding_step_progress;
create policy onboarding_step_progress_owner_admin on public.onboarding_step_progress
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  );

-- brand_profiles: owner/admin full access; designer read-only.
drop policy if exists brand_profiles_owner_admin on public.brand_profiles;
create policy brand_profiles_owner_admin on public.brand_profiles
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  );

drop policy if exists brand_profiles_designer_read on public.brand_profiles;
create policy brand_profiles_designer_read on public.brand_profiles
  for select using (public.has_tenant_role(tenant_id, array['designer']));

-- brand_audiences: owner/admin only (spec does not list broader read).
drop policy if exists brand_audiences_owner_admin on public.brand_audiences;
create policy brand_audiences_owner_admin on public.brand_audiences
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  );

-- brand_product_preferences: owner/admin full access; designer read-only.
drop policy if exists brand_product_preferences_owner_admin on public.brand_product_preferences;
create policy brand_product_preferences_owner_admin on public.brand_product_preferences
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  );

drop policy if exists brand_product_preferences_designer_read on public.brand_product_preferences;
create policy brand_product_preferences_designer_read on public.brand_product_preferences
  for select using (public.has_tenant_role(tenant_id, array['designer']));

-- production_preferences: owner/admin full access; production_manager read-only.
drop policy if exists production_preferences_owner_admin on public.production_preferences;
create policy production_preferences_owner_admin on public.production_preferences
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  );

drop policy if exists production_preferences_production_manager_read on public.production_preferences;
create policy production_preferences_production_manager_read on public.production_preferences
  for select using (public.has_tenant_role(tenant_id, array['production_manager']));

-- budget_profiles: owner/admin only — no broader read (financial detail).
drop policy if exists budget_profiles_owner_admin on public.budget_profiles;
create policy budget_profiles_owner_admin on public.budget_profiles
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  );

-- startup_kit_recommendations: owner/admin only.
drop policy if exists startup_kit_recommendations_owner_admin on public.startup_kit_recommendations;
create policy startup_kit_recommendations_owner_admin on public.startup_kit_recommendations
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  );

-- storefront_preferences: owner/admin only.
drop policy if exists storefront_preferences_owner_admin on public.storefront_preferences;
create policy storefront_preferences_owner_admin on public.storefront_preferences
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  );

-- fulfillment_preferences: owner/admin full access; production_manager read-only
-- (fulfillment and production are closely related operational concerns).
drop policy if exists fulfillment_preferences_owner_admin on public.fulfillment_preferences;
create policy fulfillment_preferences_owner_admin on public.fulfillment_preferences
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  );

drop policy if exists fulfillment_preferences_production_manager_read on public.fulfillment_preferences;
create policy fulfillment_preferences_production_manager_read on public.fulfillment_preferences
  for select using (public.has_tenant_role(tenant_id, array['production_manager']));

-- launch_readiness_assessments: owner/admin only.
drop policy if exists launch_readiness_assessments_owner_admin on public.launch_readiness_assessments;
create policy launch_readiness_assessments_owner_admin on public.launch_readiness_assessments
  for all using (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  ) with check (
    public.has_tenant_role(tenant_id, array['tenant_owner', 'tenant_admin'])
    or public.is_platform_super_admin()
  );
