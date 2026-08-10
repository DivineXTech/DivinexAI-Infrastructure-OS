import { describe, expect, it } from "vitest";
import { signWebhookPayload, verifyWebhookSignature } from "@/src/lib/webhook-signature";

describe("webhook signature", () => {
  const secret = "top-secret-webhook-key";
  const payload = JSON.stringify({ jobId: "job-1", status: "completed" });

  it("verifies a correctly signed payload", () => {
    const signature = signWebhookPayload(payload, secret);
    expect(
      verifyWebhookSignature({ payload, signatureHeader: signature, secret }),
    ).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const signature = signWebhookPayload(payload, secret);
    const tampered = JSON.stringify({ jobId: "job-1", status: "failed" });
    expect(
      verifyWebhookSignature({ payload: tampered, signatureHeader: signature, secret }),
    ).toBe(false);
  });

  it("rejects a signature produced with the wrong secret", () => {
    const signature = signWebhookPayload(payload, "wrong-secret");
    expect(
      verifyWebhookSignature({ payload, signatureHeader: signature, secret }),
    ).toBe(false);
  });

  it("rejects when the signature header is missing", () => {
    expect(
      verifyWebhookSignature({ payload, signatureHeader: null, secret }),
    ).toBe(false);
  });

  it("rejects when the secret is empty", () => {
    const signature = signWebhookPayload(payload, secret);
    expect(
      verifyWebhookSignature({ payload, signatureHeader: signature, secret: "" }),
    ).toBe(false);
  });

  it("rejects a malformed (non-hex) signature header without throwing", () => {
    expect(() =>
      verifyWebhookSignature({ payload, signatureHeader: "not-hex-!!", secret }),
    ).not.toThrow();
    expect(
      verifyWebhookSignature({ payload, signatureHeader: "not-hex-!!", secret }),
    ).toBe(false);
  });
});
