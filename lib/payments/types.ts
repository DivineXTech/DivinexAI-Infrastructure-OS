/**
 * Provider-neutral payments contract (section 22). All amounts are integer
 * minor units (cents) — never floats — per the platform's financial
 * calculation rule.
 */
export type MinorUnitAmount = number;

export type CheckoutSession = {
  id: string;
  tenantId: string;
  amount: MinorUnitAmount;
  currency: string;
  status: "pending" | "completed" | "expired" | "cancelled";
  createdAt: string;
};

export type Payment = {
  id: string;
  checkoutSessionId: string;
  amount: MinorUnitAmount;
  currency: string;
  status: "pending" | "succeeded" | "failed";
  providerReference: string | null;
};

export type Refund = {
  id: string;
  paymentId: string;
  amount: MinorUnitAmount;
  status: "pending" | "succeeded" | "failed";
};

export interface PaymentsProvider {
  readonly name: string;
  createCheckoutSession(input: {
    tenantId: string;
    amount: MinorUnitAmount;
    currency: string;
  }): Promise<CheckoutSession>;
  getPayment(paymentId: string): Promise<Payment | null>;
  refundPayment(paymentId: string, amount: MinorUnitAmount): Promise<Refund>;
}
