import type {
  AiJob,
  Asset,
  AssetType,
  ConsentRecord,
  Contributor,
  CreatorProfile,
  FanProfile,
  LedgerEntry,
  LicenseGrant,
  Membership,
  Order,
  Organization,
  Payout,
  Product,
  RightsDeclaration,
  Workspace,
} from "@divinexai/schemas";
import type {
  AiJobRow,
  AssetRow,
  ConsentRecordRow,
  ContributorRow,
  CreatorProfileRow,
  FanProfileRow,
  LedgerEntryRow,
  LicenseGrantRow,
  MembershipRow,
  OrderRow,
  OrganizationRow,
  PayoutRow,
  ProductRow,
  PublicCreatorProfileRow,
  RightsDeclarationRow,
  WorkspaceRow,
} from "./rows";

/** The public-safe slice of a creator's identity, as exposed by the public_creator_profiles view. */
export interface PublicCreatorProfile {
  id: string;
  organizationId: string;
  workspaceId: string;
  displayName: string;
  handle: string;
  createdAt: string;
}

export function mapPublicCreatorProfile(row: PublicCreatorProfileRow): PublicCreatorProfile {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    displayName: row.display_name,
    handle: row.handle,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    planTier: row.plan_tier as Organization["planTier"],
    createdAt: row.created_at.toISOString(),
  };
}

export function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapCreatorProfile(row: CreatorProfileRow): CreatorProfile {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    displayName: row.display_name,
    handle: row.handle,
    onboardingStep: row.onboarding_step as CreatorProfile["onboardingStep"],
    flowraPayAccountId: row.flowra_pay_account_id,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapFanProfile(row: FanProfileRow): FanProfile {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    creatorId: row.creator_id,
    type: row.type as AssetType,
    title: row.title,
    status: row.status as Asset["status"],
    source: row.source as Asset["source"],
    storagePath: row.storage_path,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    provenance: (row.provenance as Asset["provenance"]) ?? [],
    territories: row.territories as Asset["territories"],
    commercialUseAuthorized: row.commercial_use_authorized,
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapContributor(row: ContributorRow): Contributor {
  return {
    id: row.id,
    assetId: row.asset_id,
    organizationId: row.organization_id,
    userId: row.user_id,
    displayName: row.display_name,
    role: row.role as Contributor["role"],
    revenueSplitBps: row.revenue_split_bps,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapRightsDeclaration(row: RightsDeclarationRow): RightsDeclaration {
  return {
    id: row.id,
    assetId: row.asset_id,
    organizationId: row.organization_id,
    rightsType: row.rights_type as RightsDeclaration["rightsType"],
    ownerUserId: row.owner_user_id,
    ownershipPct: Number(row.ownership_pct),
    createdAt: row.created_at.toISOString(),
  };
}

export function mapLicenseGrant(row: LicenseGrantRow): LicenseGrant {
  return {
    id: row.id,
    assetId: row.asset_id,
    organizationId: row.organization_id,
    licenseType: row.license_type as LicenseGrant["licenseType"],
    licenseeName: row.licensee_name,
    territories: row.territories as LicenseGrant["territories"],
    commercialUse: row.commercial_use,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapConsentRecord(row: ConsentRecordRow): ConsentRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    subjectType: row.subject_type as ConsentRecord["subjectType"],
    subjectUserId: row.subject_user_id,
    grantedByUserId: row.granted_by_user_id,
    scope: row.scope as ConsentRecord["scope"],
    assetIdScope: row.asset_id_scope,
    revokedAt: row.revoked_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    creatorId: row.creator_id,
    assetId: row.asset_id,
    type: row.type as Product["type"],
    name: row.name,
    price: { amountMinorUnits: Number(row.price_amount_minor_units), currency: row.price_currency },
    active: row.active,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    productId: row.product_id,
    creatorId: row.creator_id,
    fanId: row.fan_id,
    status: row.status as Order["status"],
    grossAmount: { amountMinorUnits: Number(row.gross_amount_minor_units), currency: row.gross_currency },
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapMembership(row: MembershipRow): Membership {
  return {
    id: row.id,
    organizationId: row.organization_id,
    productId: row.product_id,
    fanId: row.fan_id,
    status: row.status as Membership["status"],
    startedAt: row.started_at.toISOString(),
    renewsAt: row.renews_at?.toISOString() ?? null,
    canceledAt: row.canceled_at?.toISOString() ?? null,
  };
}

export function mapLedgerEntry(row: LedgerEntryRow): LedgerEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    transactionId: row.transaction_id,
    orderId: row.order_id,
    accountType: row.account_type as LedgerEntry["accountType"],
    accountRefId: row.account_ref_id,
    entryType: row.entry_type as LedgerEntry["entryType"],
    direction: row.direction as LedgerEntry["direction"],
    amount: { amountMinorUnits: Number(row.amount_minor_units), currency: row.currency },
    reversalOfEntryId: row.reversal_of_entry_id,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at.toISOString(),
  };
}

export function mapPayout(row: PayoutRow): Payout {
  return {
    id: row.id,
    organizationId: row.organization_id,
    creatorId: row.creator_id,
    amount: { amountMinorUnits: Number(row.amount_minor_units), currency: row.currency },
    status: row.status as Payout["status"],
    flowraPayPayoutId: row.flowra_pay_payout_id,
    idempotencyKey: row.idempotency_key,
    requestedAt: row.requested_at.toISOString(),
    settledAt: row.settled_at?.toISOString() ?? null,
  };
}

export function mapAiJob(row: AiJobRow): AiJob {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    creatorId: row.creator_id,
    capability: row.capability as AiJob["capability"],
    providerId: row.provider_id,
    status: row.status as AiJob["status"],
    inputPrompt: row.input_prompt,
    sourceAssetIds: row.source_asset_ids,
    voiceSubjectUserId: row.voice_subject_user_id,
    likenessSubjectUserId: row.likeness_subject_user_id,
    creditCost: Number(row.credit_cost),
    providerCostMinorUnits: row.provider_cost_minor_units === null ? null : Number(row.provider_cost_minor_units),
    outputAssetId: row.output_asset_id,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}
