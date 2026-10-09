import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, isSupabaseConfigured: () => false };
});

describe("reward-store (in-memory fallback)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("creates a grant only once for the same (subscriber, milestone)", async () => {
    const { getRewardStore } = await import("@/lib/store/reward-store");
    const store = getRewardStore();

    const first = await store.createGrantIfNotExists({
      subscriberId: "sub-1",
      milestoneId: "milestone-1",
      qualifiedCountAtGrant: 1,
      status: "fulfilled",
      fraudFlag: false,
      fraudReason: null,
    });
    const second = await store.createGrantIfNotExists({
      subscriberId: "sub-1",
      milestoneId: "milestone-1",
      qualifiedCountAtGrant: 5, // even with a different count, no new grant
      status: "fulfilled",
      fraudFlag: false,
      fraudReason: null,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.grant.id).toBe(first.grant.id);
    expect(second.grant.qualifiedCountAtGrant).toBe(1); // unchanged
  });

  it("transitions pending_review -> approved -> fulfilled", async () => {
    const { getRewardStore } = await import("@/lib/store/reward-store");
    const store = getRewardStore();

    const { grant } = await store.createGrantIfNotExists({
      subscriberId: "sub-2",
      milestoneId: "milestone-3",
      qualifiedCountAtGrant: 3,
      status: "pending_review",
      fraudFlag: false,
      fraudReason: null,
    });

    const approved = await store.updateGrantStatus(grant.id, {
      status: "approved",
      approvedBy: "founder@example.com",
    });
    expect(approved?.transitioned).toBe(true);
    expect(approved?.grant.status).toBe("approved");
    expect(approved?.grant.approvedBy).toBe("founder@example.com");

    const fulfilled = await store.updateGrantStatus(grant.id, { status: "fulfilled" });
    expect(fulfilled?.transitioned).toBe(true);
    expect(fulfilled?.grant.status).toBe("fulfilled");
    expect(fulfilled?.grant.fulfilledAt).not.toBeNull();
  });

  it("is idempotent once fulfilled — re-fulfilling is a no-op, not a re-transition", async () => {
    const { getRewardStore } = await import("@/lib/store/reward-store");
    const store = getRewardStore();

    const { grant } = await store.createGrantIfNotExists({
      subscriberId: "sub-3",
      milestoneId: "milestone-1",
      qualifiedCountAtGrant: 1,
      status: "fulfilled",
      fraudFlag: false,
      fraudReason: null,
    });

    const originalFulfilledAt = grant.fulfilledAt;
    const result = await store.updateGrantStatus(grant.id, { status: "fulfilled" });

    expect(result?.transitioned).toBe(false);
    expect(result?.grant.fulfilledAt).toBe(originalFulfilledAt);
  });

  it("can deny a grant with a reason", async () => {
    const { getRewardStore } = await import("@/lib/store/reward-store");
    const store = getRewardStore();

    const { grant } = await store.createGrantIfNotExists({
      subscriberId: "sub-4",
      milestoneId: "milestone-10",
      qualifiedCountAtGrant: 10,
      status: "pending_review",
      fraudFlag: true,
      fraudReason: "suspicious velocity",
    });

    const denied = await store.updateGrantStatus(grant.id, {
      status: "denied",
      deniedReason: "Confirmed fraudulent referrals",
    });

    expect(denied?.grant.status).toBe("denied");
    expect(denied?.grant.deniedReason).toBe("Confirmed fraudulent referrals");
  });

  it("returns null for an unknown grant id", async () => {
    const { getRewardStore } = await import("@/lib/store/reward-store");
    const store = getRewardStore();
    const result = await store.updateGrantStatus("not-a-real-id", { status: "approved" });
    expect(result).toBeNull();
  });
});
