import { randomUUID } from "node:crypto";
import type { CreatePaymentIntentInput, PaymentIntentResult, PaymentProvider, WebhookVerificationResult } from "./provider";

/**
 * Local-development payment provider. No network calls, no real money.
 * Used whenever PAYMENT_MODE=mock (the default), so the full checkout →
 * order → entitlement → download flow works without any payment vendor
 * credentials. A buyer email starting with "declined@" simulates a
 * failed payment, useful for exercising the failure path in tests.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    const providerReference = `mock_pi_${randomUUID()}`;
    return {
      provider: this.name,
      providerReference,
      clientAction: {
        type: "confirm",
        payload: {
          orderId: input.orderId,
          amountMinor: input.amountMinor,
          currencyCode: input.currencyCode,
          willSucceed: !input.buyerEmail.startsWith("declined@"),
        },
      },
    };
  }

  async verifyWebhook(rawBody: string): Promise<WebhookVerificationResult> {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      isValid: true,
      eventId: String(payload.eventId ?? randomUUID()),
      eventType: String(payload.eventType ?? "payment.succeeded"),
      payload,
    };
  }

  async refund(providerReference: string, amountMinor: number) {
    return { providerRefundReference: `mock_re_${providerReference}_${amountMinor}` };
  }
}
