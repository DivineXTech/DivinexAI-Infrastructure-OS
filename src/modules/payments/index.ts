import { MockPaymentProvider } from "./mock-provider";
import type { PaymentProvider } from "./provider";

/**
 * Stripe/Paystack/Flutterwave adapters land here in Phase 2 (see ROADMAP.md).
 * Provider selection is driven by PAYMENT_MODE + creator country, never
 * hard-coded — the mock provider is the only one wired up in Phase 1.
 */
export function getPaymentProvider(): PaymentProvider {
  return new MockPaymentProvider();
}

export type { PaymentProvider } from "./provider";
