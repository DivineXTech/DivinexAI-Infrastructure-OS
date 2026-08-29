import { floorBpsOf, type CreatorPlanTier, type Money } from "@divinexai/schemas";

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

/**
 * ROUNDING POLICY (see also docs/dmtv-financial-architecture.md): every
 * deduction taken out of a gross amount -- the platform fee here, and any
 * future processing fee / tax / partner allocation via
 * `calculateWaterfallSplit` below -- is floored (truncated toward zero)
 * using exact integer math via `floorBpsOf`, never rounded to the nearest
 * cent. The residual (creator net) is always computed as `gross - sum(all
 * deductions)`, never as an independently-rounded percentage of its own.
 *
 * Two consequences, both deliberate:
 *   1. The platform can never collect more than its exact advertised rate
 *      on any single transaction (floor rounds the fee DOWN, so
 *      `platformFeeAmount <= grossAmount * platformFeeBps / 10000`
 *      always holds) -- the rounding "dust" always favors the creator.
 *   2. `grossAmount === platformFeeAmount + creatorNetAmount` holds
 *      exactly for every input, by construction, not by coincidence: the
 *      residual is derived by subtraction, so there is nothing left to
 *      round.
 *
 * This means $4.99 at a 10% fee yields a $0.49 platform fee and a $4.50
 * creator net (floor(49.9) = 49), not the $0.50 / $4.49 a naive
 * round-half-up implementation would produce. That is intentional.
 */
export function calculateFeeSplit(grossAmount: Money, platformFeeBps: number): FeeSplitResult {
  if (platformFeeBps < 0 || platformFeeBps > 10_000) {
    throw new Error(`platformFeeBps out of range (0-10000): ${platformFeeBps}`);
  }
  const platformFeeMinorUnits = floorBpsOf(grossAmount.amountMinorUnits, platformFeeBps);
  const creatorNetMinorUnits = grossAmount.amountMinorUnits - platformFeeMinorUnits;
  return {
    grossAmount,
    platformFeeAmount: { amountMinorUnits: platformFeeMinorUnits, currency: grossAmount.currency },
    creatorNetAmount: { amountMinorUnits: creatorNetMinorUnits, currency: grossAmount.currency },
    platformFeeBps,
  };
}

export interface Allocation {
  /** e.g. "platform_fee", "processing_fee", "tax", "partner:acme-label" */
  name: string;
  bps: number;
}

export interface AllocationAmount {
  name: string;
  amount: Money;
}

export interface WaterfallSplitResult {
  grossAmount: Money;
  allocations: AllocationAmount[];
  /** What's left after every allocation is deducted -- e.g. creator net. Never independently rounded. */
  residualAmount: Money;
}

/**
 * Generalization of `calculateFeeSplit` to an arbitrary ordered list of
 * bps-rate deductions (platform fee, processing fee, tax, partner/affiliate
 * cuts, ...). Each is floored independently via `floorBpsOf`; the residual
 * is always `gross - sum(allocations)`, so the invariant `gross ===
 * sum(allocations) + residual` holds exactly regardless of how many
 * allocations are present or what their rates are.
 *
 * DMTV v1 only has one allocation (platform_fee) wired into the live
 * purchase flow; this exists so Phase 2 (processing fees, taxes,
 * partner/affiliate splits) can add allocations to the list without ever
 * having to re-derive the invariant.
 */
export function calculateWaterfallSplit(gross: Money, allocations: Allocation[]): WaterfallSplitResult {
  let totalBps = 0;
  for (const allocation of allocations) {
    if (allocation.bps < 0 || allocation.bps > 10_000) {
      throw new Error(`Allocation "${allocation.name}" bps out of range (0-10000): ${allocation.bps}`);
    }
    totalBps += allocation.bps;
  }
  if (totalBps > 10_000) {
    throw new Error(`Allocations sum to ${totalBps} bps, which exceeds 10000 (100%).`);
  }

  const allocationAmounts: AllocationAmount[] = allocations.map((allocation) => ({
    name: allocation.name,
    amount: {
      amountMinorUnits: floorBpsOf(gross.amountMinorUnits, allocation.bps),
      currency: gross.currency,
    },
  }));
  const allocatedTotal = allocationAmounts.reduce((sum, a) => sum + a.amount.amountMinorUnits, 0);

  return {
    grossAmount: gross,
    allocations: allocationAmounts,
    residualAmount: { amountMinorUnits: gross.amountMinorUnits - allocatedTotal, currency: gross.currency },
  };
}
