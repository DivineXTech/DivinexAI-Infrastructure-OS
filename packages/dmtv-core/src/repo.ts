import type { PoolClient } from "pg";
import type {
  AiCapability,
  AiProvenanceRecord,
  Asset,
  AssetType,
  ConsentRecord,
  Contributor,
  ContributorRole,
  CreatorProfile,
  FanProfile,
  LedgerAccountType,
  LedgerEntry,
  LicenseGrant,
  Membership,
  Money,
  Order,
  Organization,
  Payout,
  Product,
  ProductType,
  RightsDeclaration,
  RightsType,
  Territory,
  Workspace,
} from "@divinexai/schemas";
import type { NewLedgerEntry } from "@divinexai/ledger";
import {
  mapAsset,
  mapConsentRecord,
  mapContributor,
  mapCreatorProfile,
  mapFanProfile,
  mapLedgerEntry,
  mapLicenseGrant,
  mapMembership,
  mapOrder,
  mapOrganization,
  mapPayout,
  mapProduct,
  mapPublicCreatorProfile,
  mapRightsDeclaration,
  mapWorkspace,
  type PublicCreatorProfile,
} from "./mappers";
import type {
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

/**
 * Inserts the organization WITHOUT `returning`. A brand-new organization has
 * no organization_members row yet, so app.current_org_ids() is still empty
 * for the inserting user -- Postgres would reject the implicit SELECT-policy
 * check that RETURNING performs on newly-inserted rows (even though the
 * WITH CHECK for the insert itself passes). The id is generated client-side
 * so callers don't need it back from the row.
 */
export async function insertOrganization(
  client: PoolClient,
  input: { id: string; name: string; slug: string; createdAt: string },
): Promise<Organization> {
  await client.query(`insert into organizations (id, name, slug, created_at) values ($1, $2, $3, $4)`, [
    input.id,
    input.name,
    input.slug,
    input.createdAt,
  ]);
  return { id: input.id, name: input.name, slug: input.slug, planTier: "FREE", createdAt: input.createdAt };
}

export async function getOrganization(client: PoolClient, organizationId: string): Promise<Organization> {
  const { rows } = await client.query<OrganizationRow>(`select * from organizations where id = $1`, [
    organizationId,
  ]);
  return mapOrganization(rows[0]!);
}

export async function insertOrganizationMember(
  client: PoolClient,
  input: { organizationId: string; userId: string; role: "OWNER" | "ADMIN" | "CONTRIBUTOR" | "VIEWER" },
): Promise<void> {
  await client.query(
    `insert into organization_members (organization_id, user_id, role) values ($1, $2, $3)`,
    [input.organizationId, input.userId, input.role],
  );
}

export async function insertWorkspace(
  client: PoolClient,
  input: { organizationId: string; name: string },
): Promise<Workspace> {
  const { rows } = await client.query<WorkspaceRow>(
    `insert into workspaces (organization_id, name) values ($1, $2)
     returning id, organization_id, name, created_at`,
    [input.organizationId, input.name],
  );
  return mapWorkspace(rows[0]!);
}

export async function insertCreatorProfile(
  client: PoolClient,
  input: { organizationId: string; workspaceId: string; userId: string; displayName: string; handle: string },
): Promise<CreatorProfile> {
  const { rows } = await client.query<CreatorProfileRow>(
    `insert into creator_profiles (organization_id, workspace_id, user_id, display_name, handle)
     values ($1, $2, $3, $4, $5)
     returning id, organization_id, workspace_id, user_id, display_name, handle, onboarding_step, flowra_pay_account_id, created_at`,
    [input.organizationId, input.workspaceId, input.userId, input.displayName, input.handle],
  );
  return mapCreatorProfile(rows[0]!);
}

export async function updateCreatorOnboarding(
  client: PoolClient,
  input: { creatorId: string; onboardingStep: CreatorProfile["onboardingStep"]; flowraPayAccountId?: string },
): Promise<CreatorProfile> {
  const { rows } = await client.query<CreatorProfileRow>(
    `update creator_profiles
     set onboarding_step = $2, flowra_pay_account_id = coalesce($3, flowra_pay_account_id)
     where id = $1
     returning id, organization_id, workspace_id, user_id, display_name, handle, onboarding_step, flowra_pay_account_id, created_at`,
    [input.creatorId, input.onboardingStep, input.flowraPayAccountId ?? null],
  );
  return mapCreatorProfile(rows[0]!);
}

export async function getCreatorProfile(client: PoolClient, creatorId: string): Promise<CreatorProfile> {
  const { rows } = await client.query<CreatorProfileRow>(
    `select id, organization_id, workspace_id, user_id, display_name, handle, onboarding_step, flowra_pay_account_id, created_at
     from creator_profiles where id = $1`,
    [creatorId],
  );
  return mapCreatorProfile(rows[0]!);
}

export async function getPublicCreatorProfileByHandle(
  client: PoolClient,
  handle: string,
): Promise<PublicCreatorProfile | null> {
  const { rows } = await client.query<PublicCreatorProfileRow>(
    `select * from public_creator_profiles where handle = $1`,
    [handle],
  );
  return rows[0] ? mapPublicCreatorProfile(rows[0]) : null;
}

export async function listActiveProductsForCreator(client: PoolClient, creatorId: string): Promise<Product[]> {
  const { rows } = await client.query<ProductRow>(
    `select * from products where creator_id = $1 and active = true order by created_at desc`,
    [creatorId],
  );
  return rows.map(mapProduct);
}

export async function listPublishedAssetsForCreator(client: PoolClient, creatorId: string): Promise<Asset[]> {
  const { rows } = await client.query<AssetRow>(
    `select * from assets where creator_id = $1 and status = 'PUBLISHED' order by created_at desc`,
    [creatorId],
  );
  return rows.map(mapAsset);
}

export async function insertFanProfile(
  client: PoolClient,
  input: { userId: string; displayName: string },
): Promise<FanProfile> {
  const { rows } = await client.query<FanProfileRow>(
    `insert into fan_profiles (user_id, display_name) values ($1, $2)
     returning id, user_id, display_name, created_at`,
    [input.userId, input.displayName],
  );
  return mapFanProfile(rows[0]!);
}

export async function insertAsset(
  client: PoolClient,
  input: {
    organizationId: string;
    workspaceId: string;
    creatorId: string;
    type: AssetType;
    title: string;
    source: Asset["source"];
    durationSeconds?: number | null;
    storagePath?: string | null;
    provenance: AiProvenanceRecord[];
    territories?: Territory[];
  },
): Promise<Asset> {
  const { rows } = await client.query<AssetRow>(
    `insert into assets (organization_id, workspace_id, creator_id, type, title, source, duration_seconds, storage_path, provenance, territories)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     returning *`,
    [
      input.organizationId,
      input.workspaceId,
      input.creatorId,
      input.type,
      input.title,
      input.source,
      input.durationSeconds ?? null,
      input.storagePath ?? null,
      JSON.stringify(input.provenance),
      input.territories ?? ["WORLDWIDE"],
    ],
  );
  return mapAsset(rows[0]!);
}

export async function getAsset(client: PoolClient, assetId: string): Promise<Asset> {
  const { rows } = await client.query<AssetRow>(`select * from assets where id = $1`, [assetId]);
  return mapAsset(rows[0]!);
}

export async function updateAssetStoragePath(
  client: PoolClient,
  input: { assetId: string; storagePath: string },
): Promise<void> {
  await client.query(`update assets set storage_path = $2 where id = $1`, [input.assetId, input.storagePath]);
}

export async function publishAssetRow(
  client: PoolClient,
  input: { assetId: string; commercialUseAuthorized: boolean },
): Promise<Asset> {
  const { rows } = await client.query<AssetRow>(
    `update assets set status = 'PUBLISHED', published_at = now(), commercial_use_authorized = $2
     where id = $1 returning *`,
    [input.assetId, input.commercialUseAuthorized],
  );
  return mapAsset(rows[0]!);
}

export async function insertContributor(
  client: PoolClient,
  input: {
    assetId: string;
    organizationId: string;
    userId?: string | null;
    displayName: string;
    role: ContributorRole;
    revenueSplitBps: number;
  },
): Promise<Contributor> {
  const { rows } = await client.query<ContributorRow>(
    `insert into contributors (asset_id, organization_id, user_id, display_name, role, revenue_split_bps)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [input.assetId, input.organizationId, input.userId ?? null, input.displayName, input.role, input.revenueSplitBps],
  );
  return mapContributor(rows[0]!);
}

export async function listContributors(client: PoolClient, assetId: string): Promise<Contributor[]> {
  const { rows } = await client.query<ContributorRow>(`select * from contributors where asset_id = $1`, [assetId]);
  return rows.map(mapContributor);
}

export async function insertRightsDeclaration(
  client: PoolClient,
  input: { assetId: string; organizationId: string; rightsType: RightsType; ownerUserId: string; ownershipPct: number },
): Promise<RightsDeclaration> {
  const { rows } = await client.query<RightsDeclarationRow>(
    `insert into rights_declarations (asset_id, organization_id, rights_type, owner_user_id, ownership_pct)
     values ($1, $2, $3, $4, $5) returning *`,
    [input.assetId, input.organizationId, input.rightsType, input.ownerUserId, input.ownershipPct],
  );
  return mapRightsDeclaration(rows[0]!);
}

export async function listRightsDeclarations(client: PoolClient, assetId: string): Promise<RightsDeclaration[]> {
  const { rows } = await client.query<RightsDeclarationRow>(`select * from rights_declarations where asset_id = $1`, [
    assetId,
  ]);
  return rows.map(mapRightsDeclaration);
}

export async function insertLicenseGrant(
  client: PoolClient,
  input: {
    assetId: string;
    organizationId: string;
    licenseType: LicenseGrant["licenseType"];
    licenseeName: string;
    territories?: Territory[];
    commercialUse: boolean;
    startsAt: string;
    endsAt?: string | null;
  },
): Promise<LicenseGrant> {
  const { rows } = await client.query<LicenseGrantRow>(
    `insert into license_grants (asset_id, organization_id, license_type, licensee_name, territories, commercial_use, starts_at, ends_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
    [
      input.assetId,
      input.organizationId,
      input.licenseType,
      input.licenseeName,
      input.territories ?? ["WORLDWIDE"],
      input.commercialUse,
      input.startsAt,
      input.endsAt ?? null,
    ],
  );
  return mapLicenseGrant(rows[0]!);
}

export async function listLicenseGrants(client: PoolClient, assetId: string): Promise<LicenseGrant[]> {
  const { rows } = await client.query<LicenseGrantRow>(`select * from license_grants where asset_id = $1`, [assetId]);
  return rows.map(mapLicenseGrant);
}

export async function insertConsentRecord(
  client: PoolClient,
  input: {
    organizationId: string;
    subjectType: ConsentRecord["subjectType"];
    subjectUserId: string;
    grantedByUserId: string;
    scope: ConsentRecord["scope"];
    assetIdScope?: string[];
  },
): Promise<ConsentRecord> {
  const { rows } = await client.query<ConsentRecordRow>(
    `insert into consent_records (organization_id, subject_type, subject_user_id, granted_by_user_id, scope, asset_id_scope)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [
      input.organizationId,
      input.subjectType,
      input.subjectUserId,
      input.grantedByUserId,
      input.scope,
      input.assetIdScope ?? [],
    ],
  );
  return mapConsentRecord(rows[0]!);
}

export async function listConsentRecords(client: PoolClient, organizationId: string): Promise<ConsentRecord[]> {
  const { rows } = await client.query<ConsentRecordRow>(`select * from consent_records where organization_id = $1`, [
    organizationId,
  ]);
  return rows.map(mapConsentRecord);
}

export async function insertProduct(
  client: PoolClient,
  input: {
    organizationId: string;
    workspaceId: string;
    creatorId: string;
    assetId?: string | null;
    type: ProductType;
    name: string;
    price: Money;
  },
): Promise<Product> {
  const { rows } = await client.query<ProductRow>(
    `insert into products (organization_id, workspace_id, creator_id, asset_id, type, name, price_amount_minor_units, price_currency)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
    [
      input.organizationId,
      input.workspaceId,
      input.creatorId,
      input.assetId ?? null,
      input.type,
      input.name,
      input.price.amountMinorUnits,
      input.price.currency,
    ],
  );
  return mapProduct(rows[0]!);
}

export async function getProduct(client: PoolClient, productId: string): Promise<Product> {
  const { rows } = await client.query<ProductRow>(`select * from products where id = $1`, [productId]);
  return mapProduct(rows[0]!);
}

export async function insertOrder(
  client: PoolClient,
  input: {
    organizationId: string;
    workspaceId: string;
    productId: string;
    creatorId: string;
    fanId: string;
    fanDisplayName: string;
    status: Order["status"];
    grossAmount: Money;
    flowraPayChargeId?: string | null;
    idempotencyKey: string;
  },
): Promise<Order> {
  const { rows } = await client.query<OrderRow>(
    `insert into orders (organization_id, workspace_id, product_id, creator_id, fan_id, fan_display_name, status, gross_amount_minor_units, gross_currency, flowra_pay_charge_id, idempotency_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
    [
      input.organizationId,
      input.workspaceId,
      input.productId,
      input.creatorId,
      input.fanId,
      input.fanDisplayName,
      input.status,
      input.grossAmount.amountMinorUnits,
      input.grossAmount.currency,
      input.flowraPayChargeId ?? null,
      input.idempotencyKey,
    ],
  );
  return mapOrder(rows[0]!);
}

export async function insertMembership(
  client: PoolClient,
  input: { organizationId: string; productId: string; fanId: string; fanDisplayName: string },
): Promise<Membership> {
  const { rows } = await client.query<MembershipRow>(
    `insert into memberships (organization_id, product_id, fan_id, fan_display_name, status)
     values ($1, $2, $3, $4, 'ACTIVE') returning *`,
    [input.organizationId, input.productId, input.fanId, input.fanDisplayName],
  );
  return mapMembership(rows[0]!);
}

/** Idempotency lookup: a prior order with this key means this exact purchase attempt already ran to completion. */
export async function getOrderByIdempotencyKey(
  client: PoolClient,
  organizationId: string,
  idempotencyKey: string,
): Promise<Order | null> {
  const { rows } = await client.query<OrderRow>(
    `select * from orders where organization_id = $1 and idempotency_key = $2`,
    [organizationId, idempotencyKey],
  );
  return rows[0] ? mapOrder(rows[0]) : null;
}

export async function getOrder(client: PoolClient, orderId: string): Promise<Order> {
  const { rows } = await client.query<OrderRow>(`select * from orders where id = $1`, [orderId]);
  return mapOrder(rows[0]!);
}

export async function updateOrderStatus(
  client: PoolClient,
  input: { orderId: string; status: Order["status"] },
): Promise<Order> {
  const { rows } = await client.query<OrderRow>(`update orders set status = $2 where id = $1 returning *`, [
    input.orderId,
    input.status,
  ]);
  return mapOrder(rows[0]!);
}

export async function getMembershipForFanAndProduct(
  client: PoolClient,
  input: { productId: string; fanId: string },
): Promise<Membership | null> {
  const { rows } = await client.query<MembershipRow>(
    `select * from memberships where product_id = $1 and fan_id = $2 order by started_at desc limit 1`,
    [input.productId, input.fanId],
  );
  return rows[0] ? mapMembership(rows[0]) : null;
}

export async function insertLedgerEntries(client: PoolClient, entries: NewLedgerEntry[]): Promise<LedgerEntry[]> {
  const inserted: LedgerEntry[] = [];
  for (const entry of entries) {
    const { rows } = await client.query<LedgerEntryRow>(
      `insert into ledger_entries (organization_id, transaction_id, order_id, account_type, account_ref_id, entry_type, direction, amount_minor_units, currency, reversal_of_entry_id, idempotency_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
      [
        entry.organizationId,
        entry.transactionId,
        entry.orderId,
        entry.accountType,
        entry.accountRefId,
        entry.entryType,
        entry.direction,
        entry.amount.amountMinorUnits,
        entry.amount.currency,
        entry.reversalOfEntryId,
        entry.idempotencyKey,
      ],
    );
    inserted.push(mapLedgerEntry(rows[0]!));
  }
  return inserted;
}

export async function getLedgerEntriesForAccount(
  client: PoolClient,
  input: { organizationId: string; accountType: LedgerAccountType; accountRefId: string },
): Promise<LedgerEntry[]> {
  const { rows } = await client.query<LedgerEntryRow>(
    `select * from ledger_entries where organization_id = $1 and account_type = $2 and account_ref_id = $3`,
    [input.organizationId, input.accountType, input.accountRefId],
  );
  return rows.map(mapLedgerEntry);
}

export async function getLedgerEntriesForOrder(client: PoolClient, orderId: string): Promise<LedgerEntry[]> {
  const { rows } = await client.query<LedgerEntryRow>(
    `select * from ledger_entries where order_id = $1 order by created_at asc`,
    [orderId],
  );
  return rows.map(mapLedgerEntry);
}

export async function insertPayoutRequest(
  client: PoolClient,
  input: { organizationId: string; creatorId: string; amount: Money; idempotencyKey: string },
): Promise<Payout> {
  const { rows } = await client.query<PayoutRow>(
    `insert into payouts (organization_id, creator_id, amount_minor_units, currency, status, idempotency_key)
     values ($1, $2, $3, $4, 'REQUESTED', $5) returning *`,
    [input.organizationId, input.creatorId, input.amount.amountMinorUnits, input.amount.currency, input.idempotencyKey],
  );
  return mapPayout(rows[0]!);
}

export async function settlePayout(
  client: PoolClient,
  input: { payoutId: string; status: Payout["status"]; flowraPayPayoutId: string },
): Promise<Payout> {
  const { rows } = await client.query<PayoutRow>(
    `update payouts set status = $2, flowra_pay_payout_id = $3, settled_at = now() where id = $1 returning *`,
    [input.payoutId, input.status, input.flowraPayPayoutId],
  );
  return mapPayout(rows[0]!);
}

export async function insertAuditLogEntry(
  client: PoolClient,
  input: {
    organizationId: string;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `insert into audit_log (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.organizationId,
      input.actorUserId ?? null,
      input.action,
      input.entityType,
      input.entityId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export interface AiCreditGrantInput {
  organizationId: string;
  delta: number;
  reason: "GRANT" | "CONSUMPTION" | "REFUND";
  aiJobId?: string | null;
}

export async function insertAiCreditLedgerEntry(client: PoolClient, input: AiCreditGrantInput): Promise<void> {
  await client.query(
    `insert into ai_credit_ledger (organization_id, ai_job_id, delta, reason) values ($1, $2, $3, $4)`,
    [input.organizationId, input.aiJobId ?? null, input.delta, input.reason],
  );
}

export async function getAiCreditBalance(client: PoolClient, organizationId: string): Promise<number> {
  const { rows } = await client.query<{ balance: string | null }>(
    `select sum(delta) as balance from ai_credit_ledger where organization_id = $1`,
    [organizationId],
  );
  return Number(rows[0]?.balance ?? 0);
}

export interface AiJobInsertInput {
  organizationId: string;
  workspaceId: string;
  creatorId: string;
  capability: AiCapability;
  providerId: string;
  inputPrompt?: string | null;
  sourceAssetIds?: string[];
  voiceSubjectUserId?: string | null;
  likenessSubjectUserId?: string | null;
  creditCost: number;
}

export async function insertAiJob(client: PoolClient, input: AiJobInsertInput): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into ai_jobs (organization_id, workspace_id, creator_id, capability, provider_id, status, input_prompt, source_asset_ids, voice_subject_user_id, likeness_subject_user_id, credit_cost)
     values ($1, $2, $3, $4, $5, 'RUNNING', $6, $7, $8, $9, $10) returning id`,
    [
      input.organizationId,
      input.workspaceId,
      input.creatorId,
      input.capability,
      input.providerId,
      input.inputPrompt ?? null,
      input.sourceAssetIds ?? [],
      input.voiceSubjectUserId ?? null,
      input.likenessSubjectUserId ?? null,
      input.creditCost,
    ],
  );
  return rows[0]!.id;
}

export async function completeAiJob(
  client: PoolClient,
  input: {
    jobId: string;
    status: "SUCCEEDED" | "FAILED" | "REJECTED_CONSENT";
    providerCostMinorUnits?: number | null;
    outputAssetId?: string | null;
  },
): Promise<void> {
  await client.query(
    `update ai_jobs set status = $2, provider_cost_minor_units = $3, output_asset_id = $4, completed_at = now() where id = $1`,
    [input.jobId, input.status, input.providerCostMinorUnits ?? null, input.outputAssetId ?? null],
  );
}
