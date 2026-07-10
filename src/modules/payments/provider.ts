/**
 * Every payment integration (Stripe, Paystack, Flutterwave, mock) implements
 * this interface. Checkout/webhook code depends only on this contract, so
 * adding a real provider later never touches checkout business logic.
 */
export interface CreatePaymentIntentInput {
  orderId: string;
  amountMinor: number;
  currencyCode: string;
  buyerEmail: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  provider: string;
  providerReference: string;
  clientAction: { type: "redirect"; url: string } | { type: "confirm"; payload: Record<string, unknown> };
}

export interface WebhookVerificationResult {
  isValid: boolean;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: "mock" | "stripe" | "paystack" | "flutterwave";
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>;
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookVerificationResult>;
  refund(providerReference: string, amountMinor: number): Promise<{ providerRefundReference: string }>;
}
