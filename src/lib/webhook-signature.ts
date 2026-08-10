import { createHmac, timingSafeEqual } from "node:crypto";

/** Computes the HMAC-SHA256 hex signature Atlas expects on the
 *  `X-Atlas-Signature` header of an inbound provider webhook. */
export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Timing-safe verification of an inbound webhook signature. Returns false
 *  (never throws) for any malformed input so callers can respond 401
 *  uniformly. */
export function verifyWebhookSignature(input: {
  payload: string;
  signatureHeader: string | null;
  secret: string;
}): boolean {
  if (!input.signatureHeader || !input.secret) {
    return false;
  }

  const expected = signWebhookPayload(input.payload, input.secret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(input.signatureHeader, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
