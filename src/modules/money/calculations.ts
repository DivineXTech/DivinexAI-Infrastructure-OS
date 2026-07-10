/**
 * All monetary math for FlowraMarket Africa. Every amount is an integer
 * number of minor currency units (cents, kobo, etc.) — never a float.
 * These functions are the single source of truth for what a buyer pays and
 * what a creator earns; checkout/webhook code must never accept a price
 * computed anywhere else (especially not the browser).
 */

export interface FeeRule {
  percentageBps: number; // basis points, 100 = 1%
  fixedFeeMinor: number;
}

export interface Coupon {
  discountType: "percentage" | "fixed";
  discountValue: number; // percentage (0-100) or minor units
}

export interface PriceBreakdown {
  subtotalMinor: number;
  discountMinor: number;
  platformFeeMinor: number;
  taxMinor: number;
  totalMinor: number;
  creatorNetMinor: number;
}

export function computeDiscount(subtotalMinor: number, coupon: Coupon | null): number {
  if (!coupon) return 0;
  if (coupon.discountType === "percentage") {
    const discount = Math.floor((subtotalMinor * coupon.discountValue) / 100);
    return Math.min(discount, subtotalMinor);
  }
  return Math.min(coupon.discountValue, subtotalMinor);
}

export function computePlatformFee(amountMinor: number, rule: FeeRule): number {
  const percentageFee = Math.floor((amountMinor * rule.percentageBps) / 10000);
  return percentageFee + rule.fixedFeeMinor;
}

/**
 * Resolves the full server-side price breakdown for a checkout. `subtotalMinor`
 * must already be the server's own knowledge of the product price (or the
 * validated pay-what-you-want amount, clamped to its minimum) — never a
 * value read from the request body without validation.
 */
export function computePriceBreakdown(params: {
  subtotalMinor: number;
  coupon: Coupon | null;
  feeRule: FeeRule;
  taxMinor?: number;
}): PriceBreakdown {
  const { subtotalMinor, coupon, feeRule, taxMinor = 0 } = params;
  if (subtotalMinor < 0) throw new Error("subtotalMinor must be >= 0");

  const discountMinor = computeDiscount(subtotalMinor, coupon);
  const discountedSubtotal = subtotalMinor - discountMinor;
  const platformFeeMinor = computePlatformFee(discountedSubtotal, feeRule);
  const totalMinor = discountedSubtotal + taxMinor;
  const creatorNetMinor = Math.max(0, discountedSubtotal - platformFeeMinor);

  return {
    subtotalMinor,
    discountMinor,
    platformFeeMinor,
    taxMinor,
    totalMinor,
    creatorNetMinor,
  };
}

export function clampPayWhatYouWant(amountMinor: number, minimumMinor: number): number {
  return Math.max(amountMinor, minimumMinor);
}

export function computeAffiliateCommission(
  baseMinor: number,
  commission: { type: "percentage" | "fixed"; value: number },
): number {
  if (commission.type === "percentage") {
    return Math.floor((baseMinor * commission.value) / 100);
  }
  return Math.min(commission.value, baseMinor);
}
