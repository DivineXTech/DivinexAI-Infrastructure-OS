/**
 * Deterministic, explainable cost/margin/pricing engine. Pure — no I/O —
 * so it's unit-testable and safe to call on every pricing-page render
 * without worrying about staleness. All monetary values are integer minor
 * units (cents); nothing here ever touches a float dollar amount. See
 * docs/PRICING_ENGINE.md.
 *
 * Suggested prices are planning guidance derived from stated costs and a
 * chosen rule — never a guarantee of profitability. Every caller that
 * surfaces `suggestedPriceCents` to a user should pair it with that
 * disclosure (see docs/PRICING_ENGINE.md "What this is not").
 */

export type CostComponentKey =
  | "blank_garment"
  | "printing"
  | "packaging"
  | "labor"
  | "transaction_estimate"
  | "fulfillment"
  | "other";

export const COST_COMPONENT_KEYS: CostComponentKey[] = [
  "blank_garment",
  "printing",
  "packaging",
  "labor",
  "transaction_estimate",
  "fulfillment",
  "other",
];

export type CostComponents = Partial<Record<CostComponentKey, number>>;

export type PricingRule =
  | { type: "fixed_markup"; markupCents: number }
  | { type: "target_margin"; targetMarginPercent: number }
  | { type: "tiered_quantity_markup"; quantity: number; tiers: { minQuantity: number; markupMultiplier: number }[] }
  | { type: "manual"; manualPriceCents: number };

export type PricingCalculationInput = {
  costComponents: CostComponents;
  retailPriceCents: number | null;
  wholesalePriceCents: number | null;
  rule?: PricingRule;
  /** Optional fixed overhead used only for the break-even placeholder. */
  fixedOverheadCents?: number;
};

export type PricingCalculationResult = {
  totalUnitCostCents: number;
  suggestedPriceCents: number | null;
  grossProfitCents: number | null;
  grossMarginPercent: number | null;
  wholesaleProfitCents: number | null;
  wholesaleMarginPercent: number | null;
  breakEvenQuantity: number | null;
  explanation: string[];
};

/** Sums whatever cost components are present; missing components count as 0. */
export function calculateTotalUnitCost(components: CostComponents): number {
  return COST_COMPONENT_KEYS.reduce((sum, key) => sum + (components[key] ?? 0), 0);
}

/**
 * Profit and margin at a given price against a given cost. Margin is
 * profit / price (not profit / cost) — the conventional "gross margin"
 * definition. Returns 0 margin (never divides by zero, never NaN/Infinity)
 * when price is 0 or negative.
 */
export function calculateProfitAndMargin(
  priceCents: number,
  costCents: number,
): { profitCents: number; marginPercent: number } {
  const profitCents = priceCents - costCents;
  const marginPercent = priceCents > 0 ? Math.round((profitCents / priceCents) * 10000) / 100 : 0;
  return { profitCents, marginPercent };
}

/**
 * Deterministic suggested price for a given rule and unit cost. `manual`
 * always returns exactly the manually-entered price (the rule exists so
 * callers have one uniform code path, not because "manual" needs
 * computing). Tiered markup applies the multiplier for the highest tier
 * the quantity qualifies for, falling back to the first tier if the
 * quantity is below every threshold.
 */
export function suggestPriceCents(rule: PricingRule, totalUnitCostCents: number): number {
  switch (rule.type) {
    case "fixed_markup":
      return totalUnitCostCents + rule.markupCents;
    case "target_margin": {
      const clampedMargin = Math.min(Math.max(rule.targetMarginPercent, 0), 99.99);
      return Math.round(totalUnitCostCents / (1 - clampedMargin / 100));
    }
    case "tiered_quantity_markup": {
      const sortedTiers = [...rule.tiers].sort((a, b) => a.minQuantity - b.minQuantity);
      let multiplier = sortedTiers[0]?.markupMultiplier ?? 1;
      for (const tier of sortedTiers) {
        if (rule.quantity >= tier.minQuantity) multiplier = tier.markupMultiplier;
      }
      return Math.round(totalUnitCostCents * multiplier);
    }
    case "manual":
      return rule.manualPriceCents;
  }
}

export function calculatePricing(input: PricingCalculationInput): PricingCalculationResult {
  const totalUnitCostCents = calculateTotalUnitCost(input.costComponents);
  const explanation: string[] = [
    `Total unit cost of ${totalUnitCostCents} cents is the sum of every entered cost component.`,
  ];

  const suggestedPriceCents = input.rule ? suggestPriceCents(input.rule, totalUnitCostCents) : null;
  if (input.rule) {
    explanation.push(`Suggested price derived from the "${input.rule.type}" pricing rule.`);
  }

  const retail =
    input.retailPriceCents !== null
      ? calculateProfitAndMargin(input.retailPriceCents, totalUnitCostCents)
      : null;
  const wholesale =
    input.wholesalePriceCents !== null
      ? calculateProfitAndMargin(input.wholesalePriceCents, totalUnitCostCents)
      : null;

  let breakEvenQuantity: number | null = null;
  if (input.fixedOverheadCents && retail && retail.profitCents > 0) {
    breakEvenQuantity = Math.ceil(input.fixedOverheadCents / retail.profitCents);
    explanation.push(
      `Break-even quantity assumes ${input.fixedOverheadCents} cents of fixed overhead recovered entirely from retail-price profit per unit.`,
    );
  }

  explanation.push("This is planning guidance, not a guarantee of profitability.");

  return {
    totalUnitCostCents,
    suggestedPriceCents,
    grossProfitCents: retail?.profitCents ?? null,
    grossMarginPercent: retail?.marginPercent ?? null,
    wholesaleProfitCents: wholesale?.profitCents ?? null,
    wholesaleMarginPercent: wholesale?.marginPercent ?? null,
    breakEvenQuantity,
    explanation,
  };
}
