import { createHash } from "node:crypto";
import { toIdempotencyKey, type IdempotencyKey } from "@/src/types/contract";

/**
 * Derives a stable idempotency key from a tenant, graph, and a
 * caller-supplied natural key (e.g. a schedule tick timestamp, or an
 * upstream webhook's event id). Redelivering the same natural key always
 * yields the same idempotency key, so the workflow engine can detect and
 * skip duplicate runs/steps instead of re-executing them.
 */
export function deriveIdempotencyKey(input: {
  tenantId: string;
  graphId: string;
  naturalKey: string;
}): IdempotencyKey {
  const hash = createHash("sha256")
    .update(`${input.tenantId}:${input.graphId}:${input.naturalKey}`)
    .digest("hex");
  return toIdempotencyKey(hash);
}
