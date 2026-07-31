import { z } from "zod";

/**
 * Lifecycle for a `risk_classification_versions` row — mirrors
 * `policyVersionLifecycle.ts` exactly (Decision 1: risk classifications get
 * the same immutable-once-published versioning discipline as everything
 * else a policy decision depends on).
 */
export const RiskClassificationVersionStatusSchema = z.enum([
  "draft",
  "validated",
  "published",
  "deprecated",
  "retired",
]);
export type RiskClassificationVersionStatus = z.infer<
  typeof RiskClassificationVersionStatusSchema
>;

const ALLOWED_TRANSITIONS: Record<
  RiskClassificationVersionStatus,
  readonly RiskClassificationVersionStatus[]
> = {
  draft: ["validated"],
  validated: ["draft", "published"],
  published: ["deprecated"],
  deprecated: ["retired"],
  retired: [],
};

export function isValidRiskClassificationVersionTransition(
  from: RiskClassificationVersionStatus,
  to: RiskClassificationVersionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidRiskClassificationVersionTransitionError extends Error {
  constructor(
    public readonly from: RiskClassificationVersionStatus,
    public readonly to: RiskClassificationVersionStatus,
  ) {
    super(
      `Invalid risk classification version status transition: ${from} -> ${to}`,
    );
    this.name = "InvalidRiskClassificationVersionTransitionError";
  }
}

export function assertValidRiskClassificationVersionTransition(
  from: RiskClassificationVersionStatus,
  to: RiskClassificationVersionStatus,
): void {
  if (!isValidRiskClassificationVersionTransition(from, to)) {
    throw new InvalidRiskClassificationVersionTransitionError(from, to);
  }
}
