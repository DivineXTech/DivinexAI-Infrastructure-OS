import { describe, expect, test } from "bun:test";
import { MockFlowraPayClient } from "./mock-client";

describe("MockFlowraPayClient", () => {
  test("charging with the same idempotency key returns the same charge", async () => {
    const client = new MockFlowraPayClient();
    const input = {
      organizationId: "org1",
      fanId: "fan1",
      amount: { amountMinorUnits: 1000, currency: "USD" },
      idempotencyKey: "order1:charge",
      description: "test purchase",
    };
    const first = await client.chargeFan(input);
    const second = await client.chargeFan(input);
    expect(second).toEqual(first);
  });

  test("linking a payout account activates it", async () => {
    const client = new MockFlowraPayClient();
    const { flowraPayAccountId, status } = await client.linkPayoutAccount({
      organizationId: "org1",
      creatorId: "creator1",
      email: "creator@example.com",
    });
    expect(status).toBe("ACTIVE");
    expect(await client.getAccountStatus(flowraPayAccountId)).toBe("ACTIVE");
  });

  test("requesting a payout returns a paid status in the mock", async () => {
    const client = new MockFlowraPayClient();
    const { flowraPayPayoutId, status } = await client.requestPayout({
      organizationId: "org1",
      flowraPayAccountId: "fp_acct_creator1",
      amount: { amountMinorUnits: 5000, currency: "USD" },
      idempotencyKey: "payout1",
    });
    expect(status).toBe("PAID");
    expect(await client.getPayoutStatus(flowraPayPayoutId)).toBe("PAID");
  });
});
