import type { Pool } from "pg";
import { withAnonContext, withServiceRoleContext, withUserContext } from "@divinexai/db";
import { floorBpsOf } from "@divinexai/schemas";
import type {
  AiCapability,
  AiProvenanceRecord,
  Asset,
  AssetType,
  ContributorRole,
  CreatorProfile,
  LedgerEntry,
  Membership,
  Money,
  Order,
  Organization,
  Payout,
  Product,
  ProductType,
  Workspace,
} from "@divinexai/schemas";
import type { AiProviderGateway } from "@divinexai/ai-gateway";
import { validateAssetReadyForPublication } from "@divinexai/rights";
import { calculateFeeSplit, resolvePlatformFeeBps, type FeeScheduleSource } from "@divinexai/fees";
import {
  buildCompensatingEntries,
  buildPayoutLedgerEntries,
  buildSaleLedgerEntries,
  computeAccountBalance,
} from "@divinexai/ledger";
import type { FlowraPayClient } from "@divinexai/flowrapay-adapter";
import type { DomainEventEmitter } from "@divinexai/events";
import { handlify, randomUUID, slugify } from "./ids";
import type { PublicCreatorProfile } from "./mappers";
import {
  completeAiJob,
  getAsset,
  getCreatorProfile,
  getLedgerEntriesForAccount,
  getLedgerEntriesForOrder,
  getMembershipForFanAndProduct,
  getOrder,
  getOrderByIdempotencyKey,
  getOrganization,
  getProduct,
  getPublicCreatorProfileByHandle,
  listActiveProductsForCreator,
  listPublishedAssetsForCreator,
  insertAiJob,
  insertAsset,
  insertAuditLogEntry,
  insertConsentRecord,
  insertContributor,
  insertCreatorProfile,
  insertFanProfile,
  insertLedgerEntries,
  insertLicenseGrant,
  insertMembership,
  insertOrder,
  insertOrganization,
  insertOrganizationMember,
  insertPayoutRequest,
  insertProduct,
  insertRightsDeclaration,
  insertWorkspace,
  listConsentRecords,
  listContributors,
  listLicenseGrants,
  listRightsDeclarations,
  publishAssetRow,
  settlePayout,
  updateCreatorOnboarding,
  updateOrderStatus,
} from "./repo";

export interface SignUpCreatorInput {
  organizationName: string;
  displayName: string;
}

export interface SignUpCreatorResult {
  userId: string;
  organization: Organization;
  workspace: Workspace;
  creatorProfile: CreatorProfile;
}

/** Creator signup: provisions the creator's own tenant (organization + workspace), makes them OWNER, and creates their creator profile. */
export async function signUpCreator(
  pool: Pool,
  events: DomainEventEmitter,
  input: SignUpCreatorInput,
): Promise<SignUpCreatorResult> {
  const userId = randomUUID();
  const result = await withUserContext(pool, userId, async (client) => {
    const organization = await insertOrganization(client, {
      id: randomUUID(),
      name: input.organizationName,
      slug: slugify(input.organizationName),
      createdAt: new Date().toISOString(),
    });
    await insertOrganizationMember(client, { organizationId: organization.id, userId, role: "OWNER" });
    const workspace = await insertWorkspace(client, { organizationId: organization.id, name: "Main Workspace" });
    const creatorProfile = await insertCreatorProfile(client, {
      organizationId: organization.id,
      workspaceId: workspace.id,
      userId,
      displayName: input.displayName,
      handle: handlify(input.displayName),
    });
    return { organization, workspace, creatorProfile };
  });
  await events.emit({
    organizationId: result.organization.id,
    type: "creator.signed_up",
    payload: { creatorId: result.creatorProfile.id, userId },
  });
  return { userId, ...result };
}

export interface CompleteOnboardingInput {
  organizationId: string;
  userId: string;
  creatorId: string;
  email: string;
}

/** Links the creator's FlowraPay payout account and marks onboarding complete. */
export async function completeOnboarding(
  pool: Pool,
  flowraPay: FlowraPayClient,
  events: DomainEventEmitter,
  input: CompleteOnboardingInput,
): Promise<CreatorProfile> {
  const { flowraPayAccountId } = await flowraPay.linkPayoutAccount({
    organizationId: input.organizationId,
    creatorId: input.creatorId,
    email: input.email,
  });
  const creatorProfile = await withUserContext(pool, input.userId, (client) =>
    updateCreatorOnboarding(client, {
      creatorId: input.creatorId,
      onboardingStep: "COMPLETED",
      flowraPayAccountId,
    }),
  );
  await events.emit({
    organizationId: input.organizationId,
    type: "creator.onboarding_completed",
    payload: { creatorId: input.creatorId },
  });
  return creatorProfile;
}

export interface GenerateAiContentInput {
  organizationId: string;
  workspaceId: string;
  creatorId: string;
  actingUserId: string;
  capability: AiCapability;
  prompt: string;
  voiceSubjectUserId?: string;
}

export interface GenerateAiContentResult {
  provenance: AiProvenanceRecord;
  outputStoragePath: string;
  durationSeconds?: number;
}

/** Runs one AI generation (music, artwork, script, ...) through the gateway and records the job. */
export async function generateAiContent(
  pool: Pool,
  gateway: AiProviderGateway,
  events: DomainEventEmitter,
  input: GenerateAiContentInput,
): Promise<GenerateAiContentResult> {
  const jobId = await withServiceRoleContext(pool, (client) =>
    insertAiJob(client, {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      creatorId: input.creatorId,
      capability: input.capability,
      providerId: "pending",
      inputPrompt: input.prompt,
      voiceSubjectUserId: input.voiceSubjectUserId ?? null,
      creditCost: 0,
    }),
  );

  try {
    const outcome = await gateway.generate({
      organizationId: input.organizationId,
      capability: input.capability,
      prompt: input.prompt,
      voiceSubjectUserId: input.voiceSubjectUserId,
    });
    await withServiceRoleContext(pool, (client) =>
      completeAiJob(client, {
        jobId,
        status: "SUCCEEDED",
        providerCostMinorUnits: outcome.result.providerCostMinorUnits,
      }),
    );
    await events.emit({
      organizationId: input.organizationId,
      type: "ai_job.completed",
      payload: { jobId, capability: input.capability },
    });
    return {
      provenance: {
        aiJobId: jobId,
        capability: input.capability,
        providerId: outcome.result.providerId,
        providerModel: outcome.result.providerModel,
        prompt: input.prompt,
        sourceAssetIds: [],
        voiceSubjectUserId: input.voiceSubjectUserId ?? null,
        likenessSubjectUserId: null,
      },
      outputStoragePath: outcome.result.outputStoragePath,
      durationSeconds: outcome.result.durationSeconds,
    };
  } catch (error) {
    const status = (error as Error).name === "UnauthorizedCloneError" ? "REJECTED_CONSENT" : "FAILED";
    await withServiceRoleContext(pool, (client) => completeAiJob(client, { jobId, status }));
    throw error;
  }
}

export interface CreateAssetFromGenerationInput {
  organizationId: string;
  workspaceId: string;
  creatorId: string;
  actingUserId: string;
  title: string;
  assetType: AssetType;
  musicGeneration: GenerateAiContentResult;
  artworkGeneration?: GenerateAiContentResult;
}

/** Creates the DRAFT asset record from one or more completed AI generations. */
export async function createAssetFromGeneration(
  pool: Pool,
  input: CreateAssetFromGenerationInput,
): Promise<Asset> {
  const provenance = [input.musicGeneration.provenance];
  if (input.artworkGeneration) provenance.push(input.artworkGeneration.provenance);

  return withUserContext(pool, input.actingUserId, (client) =>
    insertAsset(client, {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      creatorId: input.creatorId,
      type: input.assetType,
      title: input.title,
      source: "AI_GENERATED",
      storagePath: input.musicGeneration.outputStoragePath,
      durationSeconds: input.musicGeneration.durationSeconds ?? null,
      provenance,
    }),
  );
}

export interface DeclareRightsInput {
  organizationId: string;
  assetId: string;
  actingUserId: string;
  contributors: Array<{ userId?: string | null; displayName: string; role: ContributorRole; revenueSplitBps: number }>;
  rightsDeclarations: Array<{ rightsType: "MASTER" | "PUBLISHING"; ownerUserId: string; ownershipPct: number }>;
}

/** Declares ownership, contributors, and revenue splits for an asset -- required before publication. */
export async function declareRights(pool: Pool, input: DeclareRightsInput): Promise<void> {
  await withUserContext(pool, input.actingUserId, async (client) => {
    for (const contributor of input.contributors) {
      await insertContributor(client, { assetId: input.assetId, organizationId: input.organizationId, ...contributor });
    }
    for (const declaration of input.rightsDeclarations) {
      await insertRightsDeclaration(client, {
        assetId: input.assetId,
        organizationId: input.organizationId,
        ...declaration,
      });
    }
  });
  await withServiceRoleContext(pool, (client) =>
    insertAuditLogEntry(client, {
      organizationId: input.organizationId,
      actorUserId: input.actingUserId,
      action: "rights.declared",
      entityType: "asset",
      entityId: input.assetId,
    }),
  );
}

export interface PublishAssetInput {
  organizationId: string;
  assetId: string;
  actingUserId: string;
  commercialUseAuthorized: boolean;
}

/** The single gate: validates ownership/splits/consent/licenses, then publishes. Throws with the specific errors if not ready. */
export async function publishAsset(
  pool: Pool,
  events: DomainEventEmitter,
  input: PublishAssetInput,
): Promise<Asset> {
  const published = await withUserContext(pool, input.actingUserId, async (client) => {
    const asset = await getAsset(client, input.assetId);
    // A single pg Client cannot run overlapping queries, so these run sequentially rather than via Promise.all.
    const contributors = await listContributors(client, input.assetId);
    const rightsDeclarations = await listRightsDeclarations(client, input.assetId);
    const licenses = await listLicenseGrants(client, input.assetId);
    const consentRecords = await listConsentRecords(client, input.organizationId);
    const check = validateAssetReadyForPublication({
      asset: { ...asset, commercialUseAuthorized: input.commercialUseAuthorized },
      contributors,
      rightsDeclarations,
      consentRecords,
      licenses,
    });
    if (!check.valid) {
      throw new Error(`Asset ${input.assetId} is not ready for publication: ${check.errors.join("; ")}`);
    }
    return publishAssetRow(client, { assetId: input.assetId, commercialUseAuthorized: input.commercialUseAuthorized });
  });
  await withServiceRoleContext(pool, (client) =>
    insertAuditLogEntry(client, {
      organizationId: input.organizationId,
      actorUserId: input.actingUserId,
      action: "asset.published",
      entityType: "asset",
      entityId: input.assetId,
    }),
  );
  await events.emit({
    organizationId: input.organizationId,
    type: "asset.published",
    payload: { assetId: input.assetId },
  });
  return published;
}

export interface RegisterFanResult {
  fanUserId: string;
  displayName: string;
}

/** Registers a new fan identity (platform-wide, not tenant-owned). */
export async function registerFan(
  pool: Pool,
  events: DomainEventEmitter,
  organizationIdForEvent: string,
  displayName: string,
): Promise<RegisterFanResult> {
  const fanUserId = randomUUID();
  await withUserContext(pool, fanUserId, (client) => insertFanProfile(client, { userId: fanUserId, displayName }));
  await events.emit({
    organizationId: organizationIdForEvent,
    type: "fan.registered",
    payload: { fanUserId },
  });
  return { fanUserId, displayName };
}

export interface CreateProductInput {
  organizationId: string;
  workspaceId: string;
  creatorId: string;
  actingUserId: string;
  assetId?: string | null;
  type: ProductType;
  name: string;
  price: Money;
}

export async function createProduct(pool: Pool, input: CreateProductInput): Promise<Product> {
  return withUserContext(pool, input.actingUserId, (client) =>
    insertProduct(client, {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      creatorId: input.creatorId,
      assetId: input.assetId,
      type: input.type,
      name: input.name,
      price: input.price,
    }),
  );
}

export interface PurchaseProductInput {
  organizationId: string;
  workspaceId: string;
  productId: string;
  fanId: string;
  fanDisplayName: string;
  idempotencyKey: string;
}

export interface PurchaseProductResult {
  order: Order;
  ledgerEntries: LedgerEntry[];
  membership: Membership | null;
  platformFeeBps: number;
}

/**
 * The commerce path: charges the fan via FlowraPay, computes the
 * config-driven platform fee, and records a balanced ledger transaction --
 * all as one service-role-mediated operation, since orders/ledger rows have
 * no authenticated write policy at all.
 *
 * Idempotent on `input.idempotencyKey`: if an order with this key already
 * exists (e.g. a retried request, or the same provider event delivered
 * twice), the fan is never re-charged and no new order or ledger rows are
 * written -- the original result is simply replayed.
 */
export async function purchaseProduct(
  pool: Pool,
  deps: { flowraPay: FlowraPayClient; feeScheduleSource: FeeScheduleSource; events: DomainEventEmitter },
  input: PurchaseProductInput,
): Promise<PurchaseProductResult> {
  const { product, organization, creatorUserId, contributors, existingOrder } = await withServiceRoleContext(
    pool,
    async (client) => {
      const product = await getProduct(client, input.productId);
      const organization = await getOrganization(client, input.organizationId);
      const creatorProfile = await getCreatorProfile(client, product.creatorId);
      const contributors = product.assetId ? await listContributors(client, product.assetId) : [];
      const existingOrder = await getOrderByIdempotencyKey(client, input.organizationId, input.idempotencyKey);
      return { product, organization, creatorUserId: creatorProfile.userId, contributors, existingOrder };
    },
  );

  const platformFeeBps = await resolvePlatformFeeBps(organization.planTier, organization.id, deps.feeScheduleSource);

  if (existingOrder) {
    const [ledgerEntries, membership] = await withServiceRoleContext(pool, async (client) => [
      await getLedgerEntriesForOrder(client, existingOrder.id),
      product.type === "MEMBERSHIP"
        ? await getMembershipForFanAndProduct(client, { productId: product.id, fanId: input.fanId })
        : null,
    ]);
    return { order: existingOrder, ledgerEntries, membership, platformFeeBps };
  }

  const feeSplit = calculateFeeSplit(product.price, platformFeeBps);

  const charge = await deps.flowraPay.chargeFan({
    organizationId: input.organizationId,
    fanId: input.fanId,
    amount: feeSplit.grossAmount,
    idempotencyKey: input.idempotencyKey,
    description: `Purchase of ${product.name}`,
  });

  const transactionId = randomUUID();
  const contributorShares = contributors
    .filter((c) => c.userId && c.userId !== creatorUserId)
    .map((c) => ({
      accountRefId: c.userId!,
      amountMinorUnits: floorBpsOf(feeSplit.creatorNetAmount.amountMinorUnits, c.revenueSplitBps),
    }));

  const { order, ledgerEntries, membership } = await withServiceRoleContext(pool, async (client) => {
    const order = await insertOrder(client, {
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      productId: input.productId,
      creatorId: product.creatorId,
      fanId: input.fanId,
      fanDisplayName: input.fanDisplayName,
      status: charge.status === "SUCCEEDED" ? "COMPLETED" : "FAILED",
      grossAmount: feeSplit.grossAmount,
      flowraPayChargeId: charge.chargeId,
      idempotencyKey: input.idempotencyKey,
    });

    if (charge.status !== "SUCCEEDED") {
      return { order, ledgerEntries: [] as LedgerEntry[], membership: null as Membership | null };
    }

    const newEntries = buildSaleLedgerEntries({
      organizationId: input.organizationId,
      transactionId,
      orderId: order.id,
      fanId: input.fanId,
      creatorId: product.creatorId,
      feeSplit,
      contributorShares,
      idempotencyKey: input.idempotencyKey,
    });
    const ledgerEntries = await insertLedgerEntries(client, newEntries);

    const membership =
      product.type === "MEMBERSHIP"
        ? await insertMembership(client, {
            organizationId: input.organizationId,
            productId: product.id,
            fanId: input.fanId,
            fanDisplayName: input.fanDisplayName,
          })
        : null;

    return { order, ledgerEntries, membership };
  });

  await deps.events.emit({
    organizationId: input.organizationId,
    type: "order.completed",
    payload: { orderId: order.id, status: order.status },
  });
  if (ledgerEntries.length > 0) {
    await deps.events.emit({
      organizationId: input.organizationId,
      type: "ledger.entries_recorded",
      payload: { transactionId, orderId: order.id },
    });
  }

  return { order, ledgerEntries, membership, platformFeeBps };
}

export interface RefundOrderInput {
  organizationId: string;
  orderId: string;
}

export interface RefundOrderResult {
  order: Order;
  compensatingEntries: LedgerEntry[];
}

/**
 * Refunds a COMPLETED order: reverses its original ledger entries with
 * compensating entries and moves the order to REFUNDED. The original sale
 * entries are never mutated or deleted -- this is the only way a
 * completed financial record is ever corrected (see @divinexai/ledger's
 * buildCompensatingEntries). Idempotent: refunding an already-REFUNDED
 * order replays the existing compensating entries instead of reversing a
 * second time.
 */
export async function refundOrder(
  pool: Pool,
  events: DomainEventEmitter,
  input: RefundOrderInput,
): Promise<RefundOrderResult> {
  const { order, originalEntries } = await withServiceRoleContext(pool, async (client) => {
    const order = await getOrder(client, input.orderId);
    const originalEntries = await getLedgerEntriesForOrder(client, input.orderId);
    return { order, originalEntries };
  });

  if (order.status === "REFUNDED") {
    return {
      order,
      compensatingEntries: originalEntries.filter((e) => e.entryType === "COMPENSATING"),
    };
  }
  if (order.status !== "COMPLETED") {
    throw new Error(`Order ${input.orderId} cannot be refunded from status ${order.status}.`);
  }

  const transactionId = randomUUID();
  const idempotencyKey = `refund:${input.orderId}`;
  const reversalEntries = buildCompensatingEntries(originalEntries, transactionId, idempotencyKey);

  const { updatedOrder, compensatingEntries } = await withServiceRoleContext(pool, async (client) => {
    const compensatingEntries = await insertLedgerEntries(client, reversalEntries);
    const updatedOrder = await updateOrderStatus(client, { orderId: input.orderId, status: "REFUNDED" });
    return { updatedOrder, compensatingEntries };
  });

  await events.emit({
    organizationId: input.organizationId,
    type: "order.refunded",
    payload: { orderId: input.orderId },
  });

  return { order: updatedOrder, compensatingEntries };
}

export async function getCreatorBalance(pool: Pool, organizationId: string, creatorId: string): Promise<Money> {
  const entries = await withServiceRoleContext(pool, (client) =>
    getLedgerEntriesForAccount(client, { organizationId, accountType: "CREATOR_BALANCE", accountRefId: creatorId }),
  );
  return computeAccountBalance(entries);
}

/** Full ledger trail for one order -- e.g. for a receipt or audit view. Includes any compensating (refund) entries. */
export async function getOrderLedgerEntries(pool: Pool, orderId: string): Promise<LedgerEntry[]> {
  return withServiceRoleContext(pool, (client) => getLedgerEntriesForOrder(client, orderId));
}

export interface RequestPayoutInput {
  organizationId: string;
  creatorId: string;
  actingUserId: string;
  amount: Money;
}

export interface RequestPayoutResult {
  payout: Payout;
  ledgerEntries: LedgerEntry[];
}

/** Creator requests a payout of their available balance; settles it through FlowraPay and records the ledger movement. */
export async function requestPayout(
  pool: Pool,
  deps: { flowraPay: FlowraPayClient; events: DomainEventEmitter },
  input: RequestPayoutInput,
): Promise<RequestPayoutResult> {
  const idempotencyKey = `payout:${input.creatorId}:${randomUUID()}`;
  const payout = await withUserContext(pool, input.actingUserId, (client) =>
    insertPayoutRequest(client, {
      organizationId: input.organizationId,
      creatorId: input.creatorId,
      amount: input.amount,
      idempotencyKey,
    }),
  );
  await deps.events.emit({
    organizationId: input.organizationId,
    type: "payout.requested",
    payload: { payoutId: payout.id },
  });

  const { creatorProfile } = await withServiceRoleContext(pool, async (client) => ({
    creatorProfile: await getCreatorProfile(client, input.creatorId),
  }));
  if (!creatorProfile.flowraPayAccountId) {
    throw new Error(`Creator ${input.creatorId} has not linked a FlowraPay payout account.`);
  }

  const payoutResult = await deps.flowraPay.requestPayout({
    organizationId: input.organizationId,
    flowraPayAccountId: creatorProfile.flowraPayAccountId,
    amount: input.amount,
    idempotencyKey,
  });

  const transactionId = randomUUID();
  const { settled, ledgerEntries } = await withServiceRoleContext(pool, async (client) => {
    const settled = await settlePayout(client, {
      payoutId: payout.id,
      status: payoutResult.status === "PAID" ? "PAID" : "PROCESSING",
      flowraPayPayoutId: payoutResult.flowraPayPayoutId,
    });
    const entries = buildPayoutLedgerEntries({
      organizationId: input.organizationId,
      transactionId,
      creatorId: input.creatorId,
      amount: input.amount,
      idempotencyKey,
    });
    const ledgerEntries = await insertLedgerEntries(client, entries);
    return { settled, ledgerEntries };
  });

  await deps.events.emit({
    organizationId: input.organizationId,
    type: "payout.settled",
    payload: { payoutId: payout.id, status: settled.status },
  });

  return { payout: settled, ledgerEntries };
}

export async function recordVoiceConsent(
  pool: Pool,
  input: { organizationId: string; subjectUserId: string; grantedByUserId: string },
): Promise<void> {
  await withUserContext(pool, input.grantedByUserId, (client) =>
    insertConsentRecord(client, {
      organizationId: input.organizationId,
      subjectType: "VOICE",
      subjectUserId: input.subjectUserId,
      grantedByUserId: input.grantedByUserId,
      scope: "ORGANIZATION_ONLY",
    }),
  );
}

export async function getAssetById(pool: Pool, actingUserId: string, assetId: string): Promise<Asset> {
  return withUserContext(pool, actingUserId, (client) => getAsset(client, assetId));
}

export interface CreatorStorefront {
  creator: PublicCreatorProfile;
  publishedAssets: Asset[];
  products: Product[];
}

/** Public storefront: what an anonymous fan can browse for a creator, purely via the public-read RLS policies. */
export async function getCreatorStorefront(pool: Pool, handle: string): Promise<CreatorStorefront | null> {
  return withAnonContext(pool, async (client) => {
    const creator = await getPublicCreatorProfileByHandle(client, handle);
    if (!creator) return null;
    const [publishedAssets, products] = [
      await listPublishedAssetsForCreator(client, creator.id),
      await listActiveProductsForCreator(client, creator.id),
    ];
    return { creator, publishedAssets, products };
  });
}

export async function addLicenseGrant(
  pool: Pool,
  input: {
    organizationId: string;
    assetId: string;
    actingUserId: string;
    licenseType: "SYNC" | "COVER" | "SAMPLE" | "DISTRIBUTION" | "CUSTOM";
    licenseeName: string;
    commercialUse: boolean;
  },
): Promise<void> {
  await withUserContext(pool, input.actingUserId, (client) =>
    insertLicenseGrant(client, {
      assetId: input.assetId,
      organizationId: input.organizationId,
      licenseType: input.licenseType,
      licenseeName: input.licenseeName,
      commercialUse: input.commercialUse,
      startsAt: new Date().toISOString(),
    }),
  );
}
