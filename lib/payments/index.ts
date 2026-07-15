import "server-only";

import { isMockPaymentsMode } from "@/lib/env";
import { MockPaymentsProvider } from "@/lib/payments/mock-provider";
import type { PaymentsProvider } from "@/lib/payments/types";

/**
 * Resolves the active payments provider. Only the mock provider is
 * implemented so far — real providers (Stripe first) plug in here behind
 * the same `PaymentsProvider` interface once credentials exist, gated by
 * `PAYMENTS_MODE=live`.
 */
export function getPaymentsProvider(): PaymentsProvider {
  if (isMockPaymentsMode) {
    return new MockPaymentsProvider();
  }
  throw new Error(
    "PAYMENTS_MODE=live has no provider implementation yet. Implement a live PaymentsProvider (e.g. Stripe) before enabling live mode.",
  );
}

export type { PaymentsProvider } from "@/lib/payments/types";
