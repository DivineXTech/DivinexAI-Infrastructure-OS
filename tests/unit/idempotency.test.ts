import { describe, expect, it } from "vitest";
import { deriveIdempotencyKey } from "@/src/lib/idempotency";
import { toIdempotencyKey } from "@/src/types/contract";

describe("deriveIdempotencyKey", () => {
  it("is deterministic for the same inputs", () => {
    const a = deriveIdempotencyKey({ tenantId: "t1", graphId: "g1", naturalKey: "n1" });
    const b = deriveIdempotencyKey({ tenantId: "t1", graphId: "g1", naturalKey: "n1" });
    expect(a).toBe(b);
  });

  it("differs when any input differs", () => {
    const base = deriveIdempotencyKey({ tenantId: "t1", graphId: "g1", naturalKey: "n1" });
    expect(deriveIdempotencyKey({ tenantId: "t2", graphId: "g1", naturalKey: "n1" })).not.toBe(base);
    expect(deriveIdempotencyKey({ tenantId: "t1", graphId: "g2", naturalKey: "n1" })).not.toBe(base);
    expect(deriveIdempotencyKey({ tenantId: "t1", graphId: "g1", naturalKey: "n2" })).not.toBe(base);
  });

  it("produces a key long enough to satisfy toIdempotencyKey", () => {
    const key = deriveIdempotencyKey({ tenantId: "t1", graphId: "g1", naturalKey: "n1" });
    expect(() => toIdempotencyKey(key)).not.toThrow();
  });
});

describe("toIdempotencyKey", () => {
  it("rejects empty or too-short values", () => {
    expect(() => toIdempotencyKey("")).toThrow();
    expect(() => toIdempotencyKey("short")).toThrow();
  });

  it("accepts a sufficiently long value", () => {
    expect(() => toIdempotencyKey("a".repeat(8))).not.toThrow();
  });
});
