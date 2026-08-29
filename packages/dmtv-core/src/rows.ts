// Snake_case row shapes as returned by `pg`, one per table. Kept separate
// from the camelCase domain types in @divinexai/schemas; the repo.ts
// mappers are the only place a row crosses that boundary.

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  plan_tier: string;
  created_at: Date;
}

export interface WorkspaceRow {
  id: string;
  organization_id: string;
  name: string;
  created_at: Date;
}

export interface CreatorProfileRow {
  id: string;
  organization_id: string;
  workspace_id: string;
  user_id: string;
  display_name: string;
  handle: string;
  onboarding_step: string;
  flowra_pay_account_id: string | null;
  created_at: Date;
}

export interface PublicCreatorProfileRow {
  id: string;
  organization_id: string;
  workspace_id: string;
  display_name: string;
  handle: string;
  created_at: Date;
}

export interface FanProfileRow {
  id: string;
  user_id: string;
  display_name: string;
  created_at: Date;
}

export interface AssetRow {
  id: string;
  organization_id: string;
  workspace_id: string;
  creator_id: string;
  type: string;
  title: string;
  status: string;
  source: string;
  storage_path: string | null;
  duration_seconds: string | null;
  provenance: unknown;
  territories: string[];
  commercial_use_authorized: boolean;
  published_at: Date | null;
  created_at: Date;
}

export interface ContributorRow {
  id: string;
  asset_id: string;
  organization_id: string;
  user_id: string | null;
  display_name: string;
  role: string;
  revenue_split_bps: number;
  created_at: Date;
}

export interface RightsDeclarationRow {
  id: string;
  asset_id: string;
  organization_id: string;
  rights_type: string;
  owner_user_id: string;
  ownership_pct: string;
  created_at: Date;
}

export interface LicenseGrantRow {
  id: string;
  asset_id: string;
  organization_id: string;
  license_type: string;
  licensee_name: string;
  territories: string[];
  commercial_use: boolean;
  starts_at: Date;
  ends_at: Date | null;
  created_at: Date;
}

export interface ConsentRecordRow {
  id: string;
  organization_id: string;
  subject_type: string;
  subject_user_id: string;
  granted_by_user_id: string;
  scope: string;
  asset_id_scope: string[];
  revoked_at: Date | null;
  created_at: Date;
}

export interface ProductRow {
  id: string;
  organization_id: string;
  workspace_id: string;
  creator_id: string;
  asset_id: string | null;
  type: string;
  name: string;
  price_amount_minor_units: string;
  price_currency: string;
  active: boolean;
  created_at: Date;
}

export interface OrderRow {
  id: string;
  organization_id: string;
  workspace_id: string;
  product_id: string;
  creator_id: string;
  fan_id: string;
  fan_display_name: string;
  status: string;
  gross_amount_minor_units: string;
  gross_currency: string;
  flowra_pay_charge_id: string | null;
  idempotency_key: string;
  created_at: Date;
}

export interface MembershipRow {
  id: string;
  organization_id: string;
  product_id: string;
  fan_id: string;
  fan_display_name: string;
  status: string;
  started_at: Date;
  renews_at: Date | null;
  canceled_at: Date | null;
}

export interface LedgerEntryRow {
  id: string;
  organization_id: string;
  transaction_id: string;
  order_id: string | null;
  account_type: string;
  account_ref_id: string;
  entry_type: string;
  direction: string;
  amount_minor_units: string;
  currency: string;
  reversal_of_entry_id: string | null;
  idempotency_key: string;
  created_at: Date;
}

export interface PayoutRow {
  id: string;
  organization_id: string;
  creator_id: string;
  amount_minor_units: string;
  currency: string;
  status: string;
  flowra_pay_payout_id: string | null;
  idempotency_key: string;
  requested_at: Date;
  settled_at: Date | null;
}

export interface AiJobRow {
  id: string;
  organization_id: string;
  workspace_id: string;
  creator_id: string;
  capability: string;
  provider_id: string;
  status: string;
  input_prompt: string | null;
  source_asset_ids: string[];
  voice_subject_user_id: string | null;
  likeness_subject_user_id: string | null;
  credit_cost: string;
  provider_cost_minor_units: string | null;
  output_asset_id: string | null;
  created_at: Date;
  completed_at: Date | null;
}
