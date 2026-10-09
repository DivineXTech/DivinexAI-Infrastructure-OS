export type PurchaseStatus = "pending" | "paid" | "fulfilled" | "refunded";

export interface Purchase {
  id: string;
  subscriberId: string | null;
  email: string;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  amountCents: number;
  currency: string;
  status: PurchaseStatus;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecordPurchaseInput {
  subscriberId: string | null;
  email: string;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  amountCents: number;
  currency: string;
  status: PurchaseStatus;
}
