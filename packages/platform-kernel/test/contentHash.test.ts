import { describe, expect, it } from "vitest";
import { computeContentHash } from "../src/contentHash.js";

describe("computeContentHash", () => {
  it("produces identical hashes for objects with the same content but different key order at the top level", () => {
    const a = { name: "sara", role: "director", version: "1.0.0" };
    const b = { version: "1.0.0", name: "sara", role: "director" };
    expect(computeContentHash(a)).toBe(computeContentHash(b));
  });

  it("produces identical hashes for objects with the same content but different key order at nested depths", () => {
    const a = {
      metadata: { memoryPolicy: { scope: "tenant" }, approvalPolicy: { required: true } },
    };
    const b = {
      metadata: { approvalPolicy: { required: true }, memoryPolicy: { scope: "tenant" } },
    };
    expect(computeContentHash(a)).toBe(computeContentHash(b));
  });

  it("preserves array order as meaningful (does not sort array elements)", () => {
    const a = { responsibilities: ["first", "second"] };
    const b = { responsibilities: ["second", "first"] };
    expect(computeContentHash(a)).not.toBe(computeContentHash(b));
  });

  it("detects a change in a nested property even when top-level keys are identical", () => {
    const a = { metadata: { executionPolicy: { timeoutMs: 1000 } } };
    const b = { metadata: { executionPolicy: { timeoutMs: 2000 } } };
    expect(computeContentHash(a)).not.toBe(computeContentHash(b));
  });

  it("is deterministic across repeated calls", () => {
    const value = { a: 1, b: [1, 2, 3], c: { d: "e" } };
    expect(computeContentHash(value)).toBe(computeContentHash(value));
  });
});
