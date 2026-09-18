# Pricing and Margin Engine (Phase 4)

`lib/catalog/pricing-engine.ts` — pure, deterministic, no I/O. All
monetary values are **integer minor units (cents)** throughout; nothing in
this engine or its callers ever holds a float dollar amount. The UI
(`components/catalog/variant-pricing-row.tsx`) converts to/from a dollar
string only at the input-field boundary, immediately before/after calling
this engine.

## Cost components

Seven fixed keys (`COST_COMPONENT_KEYS`): `blank_garment`, `printing`,
`packaging`, `labor`, `transaction_estimate`, `fulfillment`, `other` —
matching `product_cost_components.component_key`'s check constraint
exactly. `calculateTotalUnitCost` sums whichever are present; missing
components count as 0 cents, never `NaN`.

## Margin

`calculateProfitAndMargin(priceCents, costCents)` returns `profitCents`
(`price - cost`) and `marginPercent` (`profit / price`, the conventional
"gross margin" definition — margin relative to price, not to cost).
Returns exactly `0` margin for a zero or negative price rather than
dividing by zero — the function is total, never throws, never returns
`Infinity`/`NaN`.

## Pricing rules

`suggestPriceCents(rule, totalUnitCostCents)` — one function, four rule
shapes, always deterministic (same rule + same cost → same price, every
time):

| Rule | Behavior |
|---|---|
| `fixed_markup` | `cost + markupCents` |
| `target_margin` | Solves for the price where `(price - cost) / price` equals the target (clamped 0–99.99% to avoid dividing by zero at 100%). |
| `tiered_quantity_markup` | Applies the highest-quantity tier's multiplier the given quantity qualifies for; falls back to the lowest tier if the quantity is below every threshold. |
| `manual` | Returns exactly the manually-entered price — included as a rule variant so every caller has one uniform code path, not because "manual" needs computing. |

## `calculatePricing`

The full picture for one variant: total unit cost, an optional suggested
price (if a rule is supplied), retail profit/margin, wholesale
profit/margin, and an optional break-even quantity (only computed when
both a fixed-overhead figure and a positive retail profit-per-unit are
given — otherwise `null`, never a nonsensical value). `explanation` is a
plain-English list of what was computed and why, always ending with:
**"This is planning guidance, not a guarantee of profitability."** Every
UI surface that shows a suggested price or margin keeps that line
attached — it's not optional decoration.

## Price history

`updateVariantPricingAction` (`app/app/products/actions.ts`) never
overwrites a price silently: every call also inserts a
`product_price_history` row (`retail_price_cents`, `wholesale_price_cents`,
`compare_at_price_cents`, `changed_by`, `reason`). The current price lives
on `product_variants`; the full history of how it got there lives
separately and is never mutated.
