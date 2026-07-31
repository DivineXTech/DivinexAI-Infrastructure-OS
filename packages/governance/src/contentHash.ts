import { computeContentHash } from "@repo/platform-kernel";
import type { PolicyDocument } from "./policyDocument.js";
import type { RiskLevel } from "./policyDocument.js";

/** Thin wrap of `platform-kernel`'s `computeContentHash` — the single content-hash algorithm reused for every immutability guarantee in this codebase. */
export function computePolicyHash(document: PolicyDocument): string {
  return computeContentHash(document);
}

export function computeRiskClassificationHash(input: {
  action: string;
  riskLevel: RiskLevel;
  rationale: string;
}): string {
  return computeContentHash(input);
}

/** Hash of `(action, parameters, targetResource)` only — deliberately not the whole snapshot, since trace IDs/timestamps vary legitimately (§8). */
export function computeActionPayloadHash(input: {
  action: string;
  parameters: Record<string, unknown>;
  targetResource: string | null;
}): string {
  return computeContentHash(input);
}
