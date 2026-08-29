import { afterAll, describe, expect, test } from "bun:test";
import { Pool } from "pg";
import { MockAgentFlowClient } from "@divinexai/agentflow-adapter";
import { MockFlowraPayClient } from "@divinexai/flowrapay-adapter";
import { AiProviderGateway, MockAiProvider, UnauthorizedCloneError } from "@divinexai/ai-gateway";
import { StaticFeeScheduleSource } from "@divinexai/fees";
import { DomainEventEmitter } from "@divinexai/events";
import {
  DbConsentSource,
  DbCreditMeter,
  createAssetFromGeneration,
  createProduct,
  declareRights,
  generateAiContent,
  getCreatorBalance,
  getOrderLedgerEntries,
  grantAiCredits,
  publishAsset,
  purchaseProduct,
  recordVoiceConsent,
  refundOrder,
  registerFan,
  requestPayout,
  signUpCreator,
  completeOnboarding,
} from "../src/index";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDb = databaseUrl ? describe : describe.skip;

if (!databaseUrl) {
  console.warn("Skipping DMTV lifecycle integration test: DATABASE_URL is not set.");
}

describeIfDb("DMTV v1 primary end-to-end acceptance lifecycle", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const agentFlow = new MockAgentFlowClient();
  const flowraPay = new MockFlowraPayClient();
  const events = new DomainEventEmitter(agentFlow);
  const feeScheduleSource = new StaticFeeScheduleSource();
  const gateway = new AiProviderGateway({
    providers: [new MockAiProvider()],
    consentSource: new DbConsentSource(pool),
    creditMeter: new DbCreditMeter(pool),
  });

  afterAll(async () => {
    await pool.end();
  });

  /** Shared setup for the idempotency/refund tests: a creator with one published, purchasable track. */
  async function setUpPublishedTrackWithProduct(priceMinorUnits: number, label: string) {
    const signUp = await signUpCreator(pool, events, {
      organizationName: `${label} Co ${Date.now()}`,
      displayName: label,
    });
    await grantAiCredits(pool, signUp.organization.id, 100);
    const musicGeneration = await generateAiContent(pool, gateway, events, {
      organizationId: signUp.organization.id,
      workspaceId: signUp.workspace.id,
      creatorId: signUp.creatorProfile.id,
      actingUserId: signUp.userId,
      capability: "TEXT_TO_MUSIC",
      prompt: "test track",
    });
    const asset = await createAssetFromGeneration(pool, {
      organizationId: signUp.organization.id,
      workspaceId: signUp.workspace.id,
      creatorId: signUp.creatorProfile.id,
      actingUserId: signUp.userId,
      title: `${label} Track`,
      assetType: "MUSIC_TRACK",
      musicGeneration,
    });
    await declareRights(pool, {
      organizationId: signUp.organization.id,
      assetId: asset.id,
      actingUserId: signUp.userId,
      contributors: [{ userId: signUp.userId, displayName: label, role: "PRIMARY_ARTIST", revenueSplitBps: 10_000 }],
      rightsDeclarations: [
        { rightsType: "MASTER", ownerUserId: signUp.userId, ownershipPct: 100 },
        { rightsType: "PUBLISHING", ownerUserId: signUp.userId, ownershipPct: 100 },
      ],
    });
    await publishAsset(pool, events, {
      organizationId: signUp.organization.id,
      assetId: asset.id,
      actingUserId: signUp.userId,
      commercialUseAuthorized: true,
    });
    const fan = await registerFan(pool, events, signUp.organization.id, `${label} Fan`);
    const product = await createProduct(pool, {
      organizationId: signUp.organization.id,
      workspaceId: signUp.workspace.id,
      creatorId: signUp.creatorProfile.id,
      actingUserId: signUp.userId,
      assetId: asset.id,
      type: "DIGITAL_DOWNLOAD",
      name: `${label} Track (Digital Download)`,
      price: { amountMinorUnits: priceMinorUnits, currency: "USD" },
    });
    return { signUp, asset, fan, product };
  }

  test(
    "creator signup -> onboarding -> AI generation -> rights -> publish -> fan -> purchase -> fee -> split -> ledger -> balance -> payout",
    async () => {
      // 1. Creator signup
      const signUp = await signUpCreator(pool, events, {
        organizationName: `Nova Sound Studio ${Date.now()}`,
        displayName: "Nova Rey",
      });
      expect(signUp.creatorProfile.onboardingStep).toBe("ACCOUNT_CREATED");

      // 2. Creator onboarding (links FlowraPay payout account)
      const onboarded = await completeOnboarding(pool, flowraPay, events, {
        organizationId: signUp.organization.id,
        userId: signUp.userId,
        creatorId: signUp.creatorProfile.id,
        email: "nova@example.com",
      });
      expect(onboarded.onboardingStep).toBe("COMPLETED");
      expect(onboarded.flowraPayAccountId).toBeTruthy();

      await grantAiCredits(pool, signUp.organization.id, 1_000);

      // 3. AI music generation
      const musicGeneration = await generateAiContent(pool, gateway, events, {
        organizationId: signUp.organization.id,
        workspaceId: signUp.workspace.id,
        creatorId: signUp.creatorProfile.id,
        actingUserId: signUp.userId,
        capability: "TEXT_TO_MUSIC",
        prompt: "an upbeat synthwave anthem about new beginnings",
      });
      expect(musicGeneration.outputStoragePath).toMatch(/^mock:\/\//);

      // 4. Artwork generation
      const artworkGeneration = await generateAiContent(pool, gateway, events, {
        organizationId: signUp.organization.id,
        workspaceId: signUp.workspace.id,
        creatorId: signUp.creatorProfile.id,
        actingUserId: signUp.userId,
        capability: "TEXT_TO_IMAGE",
        prompt: "album cover, neon skyline, synthwave aesthetic",
      });

      // 5. Asset creation
      const asset = await createAssetFromGeneration(pool, {
        organizationId: signUp.organization.id,
        workspaceId: signUp.workspace.id,
        creatorId: signUp.creatorProfile.id,
        actingUserId: signUp.userId,
        title: "New Beginnings",
        assetType: "MUSIC_TRACK",
        musicGeneration,
        artworkGeneration,
      });
      expect(asset.status).toBe("DRAFT");
      expect(asset.provenance).toHaveLength(2);

      // 6. Rights declaration (contributors + ownership, summing to 100%)
      await declareRights(pool, {
        organizationId: signUp.organization.id,
        assetId: asset.id,
        actingUserId: signUp.userId,
        contributors: [
          {
            userId: signUp.userId,
            displayName: "Nova Rey",
            role: "PRIMARY_ARTIST",
            revenueSplitBps: 10_000,
          },
        ],
        rightsDeclarations: [
          { rightsType: "MASTER", ownerUserId: signUp.userId, ownershipPct: 100 },
          { rightsType: "PUBLISHING", ownerUserId: signUp.userId, ownershipPct: 100 },
        ],
      });

      // 7. Publication (rights gate must pass)
      const published = await publishAsset(pool, events, {
        organizationId: signUp.organization.id,
        assetId: asset.id,
        actingUserId: signUp.userId,
        commercialUseAuthorized: true,
      });
      expect(published.status).toBe("PUBLISHED");
      expect(published.publishedAt).toBeTruthy();

      // 8. Fan registration
      const fan = await registerFan(pool, events, signUp.organization.id, "Fan Ninety-One");
      expect(fan.fanUserId).toBeTruthy();

      const product = await createProduct(pool, {
        organizationId: signUp.organization.id,
        workspaceId: signUp.workspace.id,
        creatorId: signUp.creatorProfile.id,
        actingUserId: signUp.userId,
        assetId: asset.id,
        type: "DIGITAL_DOWNLOAD",
        name: "New Beginnings (Digital Download)",
        price: { amountMinorUnits: 1_000, currency: "USD" },
      });

      // 9-12. Product purchase -> platform fee calculation -> creator revenue split -> ledger entry
      const purchase = await purchaseProduct(
        pool,
        { flowraPay, feeScheduleSource, events },
        {
          organizationId: signUp.organization.id,
          workspaceId: signUp.workspace.id,
          productId: product.id,
          fanId: fan.fanUserId,
          fanDisplayName: fan.displayName,
          idempotencyKey: `purchase:${asset.id}:${fan.fanUserId}`,
        },
      );
      expect(purchase.order.status).toBe("COMPLETED");
      expect(purchase.platformFeeBps).toBe(1_000); // FREE tier default: 10%
      const platformFeeEntry = purchase.ledgerEntries.find((e) => e.entryType === "PLATFORM_FEE")!;
      const creatorNetEntry = purchase.ledgerEntries.find((e) => e.entryType === "CREATOR_NET")!;
      expect(platformFeeEntry.amount.amountMinorUnits).toBe(100);
      expect(creatorNetEntry.amount.amountMinorUnits).toBe(900);

      // 13. Creator balance
      const balance = await getCreatorBalance(pool, signUp.organization.id, signUp.creatorProfile.id);
      expect(balance.amountMinorUnits).toBe(900);

      // 14. Payout request
      const payoutResult = await requestPayout(
        pool,
        { flowraPay, events },
        {
          organizationId: signUp.organization.id,
          creatorId: signUp.creatorProfile.id,
          actingUserId: signUp.userId,
          amount: balance,
        },
      );
      expect(payoutResult.payout.status).toBe("PAID");
      expect(payoutResult.payout.flowraPayPayoutId).toBeTruthy();

      const balanceAfterPayout = await getCreatorBalance(pool, signUp.organization.id, signUp.creatorProfile.id);
      expect(balanceAfterPayout.amountMinorUnits).toBe(0);

      // Every domain event along the way reached AgentFlow Pro.
      const emittedTypes = agentFlow.publishedEvents
        .filter((e) => e.organizationId === signUp.organization.id)
        .map((e) => e.type);
      expect(emittedTypes).toEqual(
        expect.arrayContaining([
          "creator.signed_up",
          "creator.onboarding_completed",
          "ai_job.completed",
          "asset.published",
          "order.completed",
          "ledger.entries_recorded",
          "payout.requested",
          "payout.settled",
        ]),
      );
    },
    20_000,
  );

  test("publication is blocked when contributor splits don't sum to 100%", async () => {
    const signUp = await signUpCreator(pool, events, {
      organizationName: `Incomplete Splits Co ${Date.now()}`,
      displayName: "Half Share",
    });
    await grantAiCredits(pool, signUp.organization.id, 100);
    const generation = await generateAiContent(pool, gateway, events, {
      organizationId: signUp.organization.id,
      workspaceId: signUp.workspace.id,
      creatorId: signUp.creatorProfile.id,
      actingUserId: signUp.userId,
      capability: "TEXT_TO_MUSIC",
      prompt: "test track",
    });
    const asset = await createAssetFromGeneration(pool, {
      organizationId: signUp.organization.id,
      workspaceId: signUp.workspace.id,
      creatorId: signUp.creatorProfile.id,
      actingUserId: signUp.userId,
      title: "Unfinished Business",
      assetType: "MUSIC_TRACK",
      musicGeneration: generation,
    });
    await declareRights(pool, {
      organizationId: signUp.organization.id,
      assetId: asset.id,
      actingUserId: signUp.userId,
      contributors: [
        { userId: signUp.userId, displayName: "Half Share", role: "PRIMARY_ARTIST", revenueSplitBps: 5_000 },
      ],
      rightsDeclarations: [
        { rightsType: "MASTER", ownerUserId: signUp.userId, ownershipPct: 100 },
        { rightsType: "PUBLISHING", ownerUserId: signUp.userId, ownershipPct: 100 },
      ],
    });

    await expect(
      publishAsset(pool, events, {
        organizationId: signUp.organization.id,
        assetId: asset.id,
        actingUserId: signUp.userId,
        commercialUseAuthorized: true,
      }),
    ).rejects.toThrow(/10000 bps/);
  });

  test("unauthorized voice cloning is rejected by the AI gateway", async () => {
    const signUp = await signUpCreator(pool, events, {
      organizationName: `No Consent Co ${Date.now()}`,
      displayName: "No Consent",
    });
    await grantAiCredits(pool, signUp.organization.id, 100);
    const unrelatedSinger = crypto.randomUUID();

    await expect(
      generateAiContent(pool, gateway, events, {
        organizationId: signUp.organization.id,
        workspaceId: signUp.workspace.id,
        creatorId: signUp.creatorProfile.id,
        actingUserId: signUp.userId,
        capability: "VOICE",
        prompt: "clone this voice",
        voiceSubjectUserId: unrelatedSinger,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedCloneError);
  });

  test("voice cloning succeeds once the subject has granted consent", async () => {
    const signUp = await signUpCreator(pool, events, {
      organizationName: `Consented Co ${Date.now()}`,
      displayName: "Consented Creator",
    });
    await grantAiCredits(pool, signUp.organization.id, 100);
    const singer = crypto.randomUUID();
    await recordVoiceConsent(pool, {
      organizationId: signUp.organization.id,
      subjectUserId: singer,
      grantedByUserId: signUp.userId,
    });

    const result = await generateAiContent(pool, gateway, events, {
      organizationId: signUp.organization.id,
      workspaceId: signUp.workspace.id,
      creatorId: signUp.creatorProfile.id,
      actingUserId: signUp.userId,
      capability: "VOICE",
      prompt: "sing this melody",
      voiceSubjectUserId: singer,
    });
    expect(result.outputStoragePath).toMatch(/^mock:\/\//);
  });

  test("purchaseProduct is idempotent: replaying the same idempotency key never duplicates revenue or ledger entries", async () => {
    const { signUp, fan, product } = await setUpPublishedTrackWithProduct(499, "Idempotent Artist");
    const idempotencyKey = `purchase:${product.id}:${fan.fanUserId}:once`;
    const purchaseInput = {
      organizationId: signUp.organization.id,
      workspaceId: signUp.workspace.id,
      productId: product.id,
      fanId: fan.fanUserId,
      fanDisplayName: fan.displayName,
      idempotencyKey,
    };

    const first = await purchaseProduct(pool, { flowraPay, feeScheduleSource, events }, purchaseInput);
    // Same provider event / retried request, processed a second time.
    const second = await purchaseProduct(pool, { flowraPay, feeScheduleSource, events }, purchaseInput);
    const third = await purchaseProduct(pool, { flowraPay, feeScheduleSource, events }, purchaseInput);

    expect(second.order.id).toBe(first.order.id);
    expect(third.order.id).toBe(first.order.id);
    expect(second.ledgerEntries.map((e) => e.id).sort()).toEqual(first.ledgerEntries.map((e) => e.id).sort());
    expect(third.ledgerEntries.map((e) => e.id).sort()).toEqual(first.ledgerEntries.map((e) => e.id).sort());

    // Only one sale's worth of ledger entries exist for this order, however many times it was "processed".
    const allEntriesForOrder = await getOrderLedgerEntries(pool, first.order.id);
    expect(allEntriesForOrder).toHaveLength(first.ledgerEntries.length);

    // Only one sale's worth of revenue landed on the creator's balance -- not two, not three.
    const balance = await getCreatorBalance(pool, signUp.organization.id, signUp.creatorProfile.id);
    expect(balance.amountMinorUnits).toBe(450); // $4.99 gross @ FREE tier 10% -> $4.50 net, once.
  });

  test("refundOrder reverses a completed purchase via compensating entries, never mutates the originals, restores the creator's balance, and is itself idempotent", async () => {
    const { signUp, fan, product } = await setUpPublishedTrackWithProduct(1_000, "Refund Artist");
    const purchase = await purchaseProduct(
      pool,
      { flowraPay, feeScheduleSource, events },
      {
        organizationId: signUp.organization.id,
        workspaceId: signUp.workspace.id,
        productId: product.id,
        fanId: fan.fanUserId,
        fanDisplayName: fan.displayName,
        idempotencyKey: `purchase:${product.id}:${fan.fanUserId}`,
      },
    );

    const balanceBeforeRefund = await getCreatorBalance(pool, signUp.organization.id, signUp.creatorProfile.id);
    expect(balanceBeforeRefund.amountMinorUnits).toBe(900); // $10.00 gross @ 10% -> $9.00 net

    const refund = await refundOrder(pool, events, {
      organizationId: signUp.organization.id,
      orderId: purchase.order.id,
    });
    expect(refund.order.status).toBe("REFUNDED");
    expect(refund.compensatingEntries.every((e) => e.entryType === "COMPENSATING")).toBe(true);
    expect(refund.compensatingEntries).toHaveLength(purchase.ledgerEntries.length);

    // The original sale entries are byte-for-byte untouched: still there, unmodified, alongside the new reversal entries.
    const allEntriesAfterRefund = await getOrderLedgerEntries(pool, purchase.order.id);
    const originalsAfterRefund = allEntriesAfterRefund.filter((e) => e.entryType !== "COMPENSATING");
    expect(originalsAfterRefund).toEqual(purchase.ledgerEntries);

    // The reversal exactly cancels the original: creator balance is back to zero.
    const balanceAfterRefund = await getCreatorBalance(pool, signUp.organization.id, signUp.creatorProfile.id);
    expect(balanceAfterRefund.amountMinorUnits).toBe(0);

    // Refunding an already-refunded order is idempotent: no new compensating entries, no further balance change.
    const secondRefund = await refundOrder(pool, events, {
      organizationId: signUp.organization.id,
      orderId: purchase.order.id,
    });
    expect(secondRefund.order.status).toBe("REFUNDED");
    expect(secondRefund.compensatingEntries.map((e) => e.id).sort()).toEqual(
      refund.compensatingEntries.map((e) => e.id).sort(),
    );
    const balanceAfterSecondRefund = await getCreatorBalance(pool, signUp.organization.id, signUp.creatorProfile.id);
    expect(balanceAfterSecondRefund.amountMinorUnits).toBe(0);
  });
});
