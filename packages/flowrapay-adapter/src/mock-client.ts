import { randomUUID } from "node:crypto";
import type {
  ChargeFanInput,
  ChargeFanResult,
  FlowraPayAccountStatus,
  FlowraPayClient,
  FlowraPayPayoutStatus,
  LinkPayoutAccountInput,
  LinkPayoutAccountResult,
  RequestPayoutInput,
  RequestPayoutResult,
} from "./types";

/**
 * In-memory stand-in for the real FlowraPay integration, used in local dev
 * and tests. Idempotent by idempotencyKey, same as the real client must be.
 */
export class MockFlowraPayClient implements FlowraPayClient {
  private accounts = new Map<string, FlowraPayAccountStatus>();
  private charges = new Map<string, ChargeFanResult>();
  private payoutsById = new Map<string, FlowraPayPayoutStatus>();
  private payoutsByIdempotencyKey = new Map<string, RequestPayoutResult>();

  async linkPayoutAccount(input: LinkPayoutAccountInput): Promise<LinkPayoutAccountResult> {
    const flowraPayAccountId = `fp_acct_${input.creatorId}`;
    this.accounts.set(flowraPayAccountId, "ACTIVE");
    return { flowraPayAccountId, status: "ACTIVE" };
  }

  async getAccountStatus(flowraPayAccountId: string): Promise<FlowraPayAccountStatus> {
    return this.accounts.get(flowraPayAccountId) ?? "PENDING";
  }

  async chargeFan(input: ChargeFanInput): Promise<ChargeFanResult> {
    const existing = this.charges.get(input.idempotencyKey);
    if (existing) return existing;
    const result: ChargeFanResult = { chargeId: `fp_charge_${randomUUID()}`, status: "SUCCEEDED" };
    this.charges.set(input.idempotencyKey, result);
    return result;
  }

  async requestPayout(input: RequestPayoutInput): Promise<RequestPayoutResult> {
    const existing = this.payoutsByIdempotencyKey.get(input.idempotencyKey);
    if (existing) return existing;
    const result: RequestPayoutResult = { flowraPayPayoutId: `fp_payout_${randomUUID()}`, status: "PAID" };
    this.payoutsByIdempotencyKey.set(input.idempotencyKey, result);
    this.payoutsById.set(result.flowraPayPayoutId, result.status);
    return result;
  }

  async getPayoutStatus(flowraPayPayoutId: string): Promise<FlowraPayPayoutStatus> {
    return this.payoutsById.get(flowraPayPayoutId) ?? "PROCESSING";
  }
}
