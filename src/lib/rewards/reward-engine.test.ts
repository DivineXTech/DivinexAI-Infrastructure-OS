import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, isSupabaseConfigured: () => false };
});

async function createReferrer(email: string) {
  const { getSubscriberStore } = await import("@/lib/store/subscriber-store");
  const store = getSubscriberStore();
  const { subscriber } = await store.upsertByEmail({
    firstName: "Referrer",
    lastName: null,
    email,
    phone: null,
    country: null,
    marketingConsent: false,
    termsAccepted: true,
    referredBy: null,
    socialFollowConfirmed: true,
    socialLikeConfirmed: true,
    socialShareConfirmed: true,
    source: "landing",
  });
  return subscriber;
}

async function createReferredSignup(email: string, referredBy: string) {
  const { getSubscriberStore } = await import("@/lib/store/subscriber-store");
  const store = getSubscriberStore();
  return store.upsertByEmail({
    firstName: "Friend",
    lastName: null,
    email,
    phone: null,
    country: null,
    marketingConsent: false,
    termsAccepted: true,
    referredBy,
    socialFollowConfirmed: true,
    socialLikeConfirmed: true,
    socialShareConfirmed: true,
    source: "referral",
  });
}

describe("reward-engine", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("grants the 1-referral milestone and auto-fulfills it (no asset required)", async () => {
    const referrer = await createReferrer("referrer1@example.com");
    await createReferredSignup("friend1@example.com", referrer.referralCode);

    const { evaluateRewardsForReferrer } = await import("@/lib/rewards/reward-engine");
    const result = await evaluateRewardsForReferrer(referrer.referralCode);

    expect(result.newGrants).toHaveLength(1);
    expect(result.newGrants[0].milestoneId).toBe("milestone-1");
    expect(result.newGrants[0].status).toBe("fulfilled");
  });

  it("grants the 3-referral milestone as pending_review (requires an asset/approval)", async () => {
    const referrer = await createReferrer("referrer3@example.com");
    for (let i = 0; i < 3; i++) {
      await createReferredSignup(`friend3-${i}@example.com`, referrer.referralCode);
    }

    const { evaluateRewardsForReferrer } = await import("@/lib/rewards/reward-engine");
    const result = await evaluateRewardsForReferrer(referrer.referralCode);

    const milestone3 = result.newGrants.find((g) => g.milestoneId === "milestone-3");
    expect(milestone3).toBeDefined();
    expect(milestone3?.status).toBe("pending_review");
    // Never auto-issues an unavailable/unapproved reward.
    expect(milestone3?.fulfilledAt).toBeNull();
  });

  it("does not re-grant an already-granted milestone (idempotent)", async () => {
    const referrer = await createReferrer("referrer-idempotent@example.com");
    await createReferredSignup("friend-idempotent@example.com", referrer.referralCode);

    const { evaluateRewardsForReferrer } = await import("@/lib/rewards/reward-engine");
    const first = await evaluateRewardsForReferrer(referrer.referralCode);
    const second = await evaluateRewardsForReferrer(referrer.referralCode);

    expect(first.newGrants).toHaveLength(1);
    expect(second.newGrants).toHaveLength(0); // already granted, nothing new

    const { getRewardStore } = await import("@/lib/store/reward-store");
    const grants = await getRewardStore().listGrantsForSubscriber(referrer.id);
    expect(grants).toHaveLength(1);
  });

  it("flags velocity-fraud and withholds auto-fulfillment even for the 1-referral milestone", async () => {
    const referrer = await createReferrer("referrer-fraud@example.com");
    // 3 referrals in rapid succession (well within the 10-minute window).
    for (let i = 0; i < 3; i++) {
      await createReferredSignup(`friend-fraud-${i}@example.com`, referrer.referralCode);
    }

    const { evaluateRewardsForReferrer } = await import("@/lib/rewards/reward-engine");
    const result = await evaluateRewardsForReferrer(referrer.referralCode);

    const milestone1 = result.newGrants.find((g) => g.milestoneId === "milestone-1");
    expect(milestone1?.fraudFlag).toBe(true);
    // Even the normally-auto-fulfillable milestone is held for review.
    expect(milestone1?.status).toBe("pending_review");
  });

  it("does nothing for an unknown referral code", async () => {
    const { evaluateRewardsForReferrer } = await import("@/lib/rewards/reward-engine");
    const result = await evaluateRewardsForReferrer("NOTAREALCODE");
    expect(result.newGrants).toHaveLength(0);
  });

  it("excludes unsubscribed referred subscribers from qualification", async () => {
    const referrer = await createReferrer("referrer-unsub@example.com");
    const { subscriber: referred } = await createReferredSignup(
      "friend-unsub@example.com",
      referrer.referralCode,
    );

    const { getSubscriberStore } = await import("@/lib/store/subscriber-store");
    await getSubscriberStore().markUnsubscribedByEmail(referred.email);

    const { evaluateRewardsForReferrer } = await import("@/lib/rewards/reward-engine");
    const result = await evaluateRewardsForReferrer(referrer.referralCode);
    expect(result.newGrants).toHaveLength(0);
  });
});
