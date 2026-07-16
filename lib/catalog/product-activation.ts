/**
 * Pure gating check for section 11's "Product activation must be blocked
 * when required fields or variants are missing." No I/O — the caller
 * (app/app/products/actions.ts) fetches the product and its variants and
 * passes plain data in.
 */
export type ProductActivationInput = {
  name: string;
  productionMethod: string | null;
  variants: { retailPriceCents: number | null }[];
};

export type ProductActivationResult = {
  canActivate: boolean;
  missingRequirements: string[];
};

export function checkProductActivation(input: ProductActivationInput): ProductActivationResult {
  const missing: string[] = [];

  if (!input.name.trim()) missing.push("Product name is required.");
  if (!input.productionMethod) missing.push("A production method must be selected.");
  if (input.variants.length === 0) missing.push("At least one variant is required.");
  if (input.variants.length > 0 && input.variants.every((v) => v.retailPriceCents === null)) {
    missing.push("At least one variant must have a retail price set.");
  }

  return { canActivate: missing.length === 0, missingRequirements: missing };
}
