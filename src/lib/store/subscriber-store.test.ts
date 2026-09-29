import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, isSupabaseConfigured: () => false };
});

describe("subscriber-store (in-memory fallback)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("creates a new subscriber with a referral code on first submission", async () => {
    const { getSubscriberStore } = await import("@/lib/store/subscriber-store");
    const store = getSubscriberStore();

    const { subscriber, isNew } = await store.upsertByEmail({
      firstName: "Grace",
      lastName: null,
      email: "grace@example.com",
      phone: null,
      country: null,
      marketingConsent: true,
      termsAccepted: true,
      referredBy: null,
      socialFollowConfirmed: true,
      socialLikeConfirmed: true,
      socialShareConfirmed: true,
      source: "landing",
    });

    expect(isNew).toBe(true);
    expect(subscriber.referralCode).toHaveLength(8);
    expect(subscriber.email).toBe("grace@example.com");
  });

  it("updates rather than duplicates on a repeat submission with the same email", async () => {
    const { getSubscriberStore } = await import("@/lib/store/subscriber-store");
    const store = getSubscriberStore();

    const first = await store.upsertByEmail({
      firstName: "Grace",
      lastName: null,
      email: "grace@example.com",
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

    const second = await store.upsertByEmail({
      firstName: "Grace M.",
      lastName: "Hopper",
      email: "grace@example.com",
      phone: null,
      country: null,
      marketingConsent: true,
      termsAccepted: true,
      referredBy: null,
      socialFollowConfirmed: true,
      socialLikeConfirmed: true,
      socialShareConfirmed: true,
      source: "landing",
    });

    expect(second.isNew).toBe(false);
    expect(second.subscriber.id).toBe(first.subscriber.id);
    expect(second.subscriber.referralCode).toBe(first.subscriber.referralCode);
    expect(second.subscriber.firstName).toBe("Grace M.");
    expect(second.subscriber.marketingConsent).toBe(true);
  });

  it("counts referrals attributed to a referral code", async () => {
    const { getSubscriberStore } = await import("@/lib/store/subscriber-store");
    const store = getSubscriberStore();

    const referrer = await store.upsertByEmail({
      firstName: "Referrer",
      lastName: null,
      email: "referrer@example.com",
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

    await store.upsertByEmail({
      firstName: "Friend One",
      lastName: null,
      email: "friend1@example.com",
      phone: null,
      country: null,
      marketingConsent: false,
      termsAccepted: true,
      referredBy: referrer.subscriber.referralCode,
      socialFollowConfirmed: true,
      socialLikeConfirmed: true,
      socialShareConfirmed: true,
      source: "referral",
    });

    await store.upsertByEmail({
      firstName: "Friend Two",
      lastName: null,
      email: "friend2@example.com",
      phone: null,
      country: null,
      marketingConsent: false,
      termsAccepted: true,
      referredBy: referrer.subscriber.referralCode,
      socialFollowConfirmed: true,
      socialLikeConfirmed: true,
      socialShareConfirmed: true,
      source: "referral",
    });

    const count = await store.countReferrals(referrer.subscriber.referralCode);
    expect(count).toBe(2);
  });

  it("marks a subscriber unsubscribed by email", async () => {
    const { getSubscriberStore } = await import("@/lib/store/subscriber-store");
    const store = getSubscriberStore();

    await store.upsertByEmail({
      firstName: "Alan",
      lastName: null,
      email: "alan@example.com",
      phone: null,
      country: null,
      marketingConsent: true,
      termsAccepted: true,
      referredBy: null,
      socialFollowConfirmed: true,
      socialLikeConfirmed: true,
      socialShareConfirmed: true,
      source: "landing",
    });

    const result = await store.markUnsubscribedByEmail("alan@example.com");
    expect(result).toBe(true);

    const subscriber = await store.findByEmail("alan@example.com");
    expect(subscriber?.unsubscribed).toBe(true);
  });
});
