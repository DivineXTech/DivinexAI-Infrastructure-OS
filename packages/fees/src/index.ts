import type { CreatorPlanTier, Money } from "@divinexai/schemas";

/**
 * Config-driven commerce fee schedule. This is the ONLY place platform fee
 * rates may be defined — checkout/order logic must resolve rates through
 * `resolvePlatformFeeBps` rather than hard-coding a percentage.
 *
 * Values reflect the DMTV v1 launch plan and may be changed here (or
 * overridden per-organization via `resolvePlatformFeeBps`'s `overrideBps`
 * argument, sourced from an organization's contract) without touching any
 * checkout code path.
 */
export const DEFAULT_FEE_SCHEDULE_BPS: Record<CreatorPlanTier, number> = {
  FREE: 1_000, // 10%
  PRO: 800, // 8%
  BUSINESS: 600, // 6%
  STUDIO: 400, // 4%
  ENTERPRISE: 400, // configurable per-contract; this is only the fallback default
};

export interface FeeScheduleSource {
  /** Looks up an organization-specific fee override, if a contract sets one. */
  getOrganizationFeeOverrideBps(organizationId: string): number | null | Promise<number | null>;
}

export class StaticFeeScheduleSource implements FeeScheduleSource {
  constructor(private readonly overrides: Record<string, number> = {}) {}

  getOrganizationFeeOverrideBps(organizationId: string): number | null {
    return this.overrides[organizationId] ?? null;
  }
}

export async function resolvePlatformFeeBps(
  planTier: CreatorPlanTier,
  organizationId: string,
  source: FeeScheduleSource,
): Promise<number> {
  const override = await source.getOrganizationFeeOverrideBps(organizationId);
  if (override !== null && override !== undefined) {
    if (override < 0 || override > 10_000) {
      throw new Error(`Fee override out of range (0-10000 bps): ${override}`);
    }
    return override;
  }
  return DEFAULT_FEE_SCHEDULE_BPS[planTier];
}

export interface FeeSplitResult {
  grossAmount: Money;
  platformFeeAmount: Money;
  creatorNetAmount: Money;
  platformFeeBps: number;
}

/** Splits a gross sale amount into platform fee and creator net, in minor units, rounding the fee down (creator never loses a fractional unit to rounding). */
export function calculateFeeSplit(grossAmount: Money, platformFeeBps: number): FeeSplitResult {
  if (platformFeeBps < 0 || platformFeeBps > 10_000) {
    throw new Error(`platformFeeBps out of range (0-10000): ${platformFeeBps}`);
  }
  const platformFeeMinorUnits = Math.floor(
    (grossAmount.amountMinorUnits * platformFeeBps) / 10_000,
  );
  const creatorNetMinorUnits = grossAmount.amountMinorUnits - platformFeeMinorUnits;
  return {
    grossAmount,
    platformFeeAmount: { amountMinorUnits: platformFeeMinorUnits, currency: grossAmount.currency },
    creatorNetAmount: { amountMinorUnits: creatorNetMinorUnits, currency: grossAmount.currency },
    platformFeeBps,
  };
}
