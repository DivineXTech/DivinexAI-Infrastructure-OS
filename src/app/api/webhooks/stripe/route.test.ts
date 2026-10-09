import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

const WEBHOOK_SECRET = "whsec_test_secret_for_offline_signature_verification";

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    isSupabaseConfigured: () => false,
    isStripeConfigured: () => true,
    env: { ...actual.env, stripeSecretKey: "sk_test_fake", stripeWebhookSecret: WEBHOOK_SECRET },
  };
});

function buildCheckoutSessionCompletedPayload(overrides: Partial<Stripe.Checkout.Session> = {}) {
  const session: Partial<Stripe.Checkout.Session> = {
    id: "cs_test_123",
    object: "checkout.session",
    customer_details: { email: "buyer@example.com" } as Stripe.Checkout.Session.CustomerDetails,
    customer_email: null,
    payment_intent: "pi_test_123",
    amount_total: 1997,
    currency: "usd",
    ...overrides,
  };

  return JSON.stringify({
    id: "evt_test_123",
    object: "event",
    type: "checkout.session.completed",
    data: { object: session },
  });
}

async function postWebhook(payload: string, signature: string) {
  const { POST } = await import("@/app/api/webhooks/stripe/route");
  const { NextRequest } = await import("next/server");
  const request = new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload,
  });
  return POST(request);
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a request with no stripe-signature header", async () => {
    const response = await postWebhook(buildCheckoutSessionCompletedPayload(), "");
    // An empty signature header is sent as absent by fetch/undici in practice,
    // but constructEvent will also reject a garbage one — either way, not 200.
    expect(response.status).not.toBe(200);
  });

  it("rejects a forged signature", async () => {
    const payload = buildCheckoutSessionCompletedPayload();
    const response = await postWebhook(payload, "t=1,v1=not-a-real-signature");
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/signature/i);
  });

  it("accepts a correctly-signed event and records a paid purchase", async () => {
    const payload = buildCheckoutSessionCompletedPayload();
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });

    const response = await postWebhook(payload, signature);
    expect(response.status).toBe(200);

    const { getPurchaseStore } = await import("@/lib/store/purchase-store");
    const purchase = await getPurchaseStore().findBySessionId("cs_test_123");
    expect(purchase).not.toBeNull();
    expect(purchase?.email).toBe("buyer@example.com");
    expect(purchase?.amountCents).toBe(1997);
    // Fulfillment (sendEmail + markFulfilled) runs synchronously in this
    // route before responding, unlike the reward engine's after()-deferred path.
    expect(purchase?.status).toBe("fulfilled");
  });

  it("is idempotent: redelivering the same event does not create a second purchase", async () => {
    const payload = buildCheckoutSessionCompletedPayload();
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const { NextRequest } = await import("next/server");

    const makeRequest = () =>
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": signature },
        body: payload,
      });

    const first = await POST(makeRequest());
    const second = await POST(makeRequest());
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const { getPurchaseStore } = await import("@/lib/store/purchase-store");
    const { purchases, total } = await getPurchaseStore().listAll({ limit: 10, offset: 0 });
    expect(total).toBe(1);
    expect(purchases).toHaveLength(1);
  });
});
