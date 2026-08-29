import type { Money } from "@divinexai/schemas";

export type FlowraPayChargeStatus = "SUCCEEDED" | "FAILED" | "PENDING";
export type FlowraPayPayoutStatus = "PROCESSING" | "PAID" | "FAILED";
export type FlowraPayAccountStatus = "PENDING" | "ACTIVE" | "RESTRICTED";

export interface ChargeFanInput {
  organizationId: string;
  fanId: string;
  amount: Money;
  idempotencyKey: string;
  description: string;
}

export interface ChargeFanResult {
  chargeId: string;
  status: FlowraPayChargeStatus;
}

export interface RequestPayoutInput {
  organizationId: string;
  flowraPayAccountId: string;
  amount: Money;
  idempotencyKey: string;
}

export interface RequestPayoutResult {
  flowraPayPayoutId: string;
  status: FlowraPayPayoutStatus;
}

export interface LinkPayoutAccountInput {
  organizationId: string;
  creatorId: string;
  email: string;
}

export interface LinkPayoutAccountResult {
  flowraPayAccountId: string;
  status: FlowraPayAccountStatus;
}

/**
 * The full surface DMTV needs from FlowraPay. This interface is the seam:
 * DMTV code depends only on FlowraPayClient, never on FlowraPay's internal
 * ledger, gateway, or SDK types directly, so FlowraPay's own payment
 * infrastructure is never duplicated here — only invoked through this
 * adapter.
 */
export interface FlowraPayClient {
  linkPayoutAccount(input: LinkPayoutAccountInput): Promise<LinkPayoutAccountResult>;
  getAccountStatus(flowraPayAccountId: string): Promise<FlowraPayAccountStatus>;
  chargeFan(input: ChargeFanInput): Promise<ChargeFanResult>;
  requestPayout(input: RequestPayoutInput): Promise<RequestPayoutResult>;
  getPayoutStatus(flowraPayPayoutId: string): Promise<FlowraPayPayoutStatus>;
}
