import "server-only";
import { randomUUID } from "node:crypto";

import type {
  CheckoutSession,
  Payment,
  PaymentsProvider,
  Refund,
} from "@/lib/payments/types";

/**
 * Default payments provider until a real one (Stripe, FlowraPay, PayPal,
 * Flutterwave, Paystack, mobile money) is configured. Simulates an
 * instantly-succeeding checkout with no external calls — never represents
 * this as a completed real-money transaction in UI copy.
 */
export class MockPaymentsProvider implements PaymentsProvider {
  readonly name = "mock";
  private payments = new Map<string, Payment>();

  async createCheckoutSession(input: {
    tenantId: string;
    amount: number;
    currency: string;
  }): Promise<CheckoutSession> {
    const id = randomUUID();
    const payment: Payment = {
      id: randomUUID(),
      checkoutSessionId: id,
      amount: input.amount,
      currency: input.currency,
      status: "succeeded",
      providerReference: `mock_${id}`,
    };
    this.payments.set(payment.id, payment);

    return {
      id,
      tenantId: input.tenantId,
      amount: input.amount,
      currency: input.currency,
      status: "completed",
      createdAt: new Date().toISOString(),
    };
  }

  async getPayment(paymentId: string): Promise<Payment | null> {
    return this.payments.get(paymentId) ?? null;
  }

  async refundPayment(paymentId: string, amount: number): Promise<Refund> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Unknown mock payment: ${paymentId}`);
    }
    return { id: randomUUID(), paymentId, amount, status: "succeeded" };
  }
}
