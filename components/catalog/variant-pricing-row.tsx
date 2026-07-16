"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { saveVariantCostComponentsAction, updateVariantPricingAction } from "@/app/app/products/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculatePricing, COST_COMPONENT_KEYS, type CostComponentKey } from "@/lib/catalog/pricing-engine";

const COMPONENT_LABELS: Record<CostComponentKey, string> = {
  blank_garment: "Blank garment",
  printing: "Printing",
  packaging: "Packaging",
  labor: "Labor",
  transaction_estimate: "Transaction estimate",
  fulfillment: "Fulfillment",
  other: "Other",
};

function dollarsToCents(value: string): number | null {
  if (value.trim() === "") return null;
  return Math.round(parseFloat(value) * 100);
}
function centsToDollarsString(cents: number | null | undefined): string {
  return cents !== null && cents !== undefined ? (cents / 100).toFixed(2) : "";
}

export function VariantPricingRow({
  productId,
  variantId,
  sku,
  label,
  initialCostComponents,
  initialRetailPriceCents,
  initialWholesalePriceCents,
}: {
  productId: string;
  variantId: string;
  sku: string;
  label: string;
  initialCostComponents: Partial<Record<CostComponentKey, number>>;
  initialRetailPriceCents: number | null;
  initialWholesalePriceCents: number | null;
}) {
  const router = useRouter();
  const [costs, setCosts] = useState<Record<CostComponentKey, string>>(() => {
    const initial = {} as Record<CostComponentKey, string>;
    for (const key of COST_COMPONENT_KEYS) {
      initial[key] = centsToDollarsString(initialCostComponents[key]);
    }
    return initial;
  });
  const [retailPrice, setRetailPrice] = useState(centsToDollarsString(initialRetailPriceCents));
  const [wholesalePrice, setWholesalePrice] = useState(centsToDollarsString(initialWholesalePriceCents));
  const [busy, setBusy] = useState(false);

  const pricing = useMemo(() => {
    const components: Partial<Record<CostComponentKey, number>> = {};
    for (const key of COST_COMPONENT_KEYS) {
      const cents = dollarsToCents(costs[key]);
      if (cents !== null) components[key] = cents;
    }
    return calculatePricing({
      costComponents: components,
      retailPriceCents: dollarsToCents(retailPrice),
      wholesalePriceCents: dollarsToCents(wholesalePrice),
    });
  }, [costs, retailPrice, wholesalePrice]);

  async function handleSave() {
    setBusy(true);
    const components: Partial<Record<CostComponentKey, number>> = {};
    for (const key of COST_COMPONENT_KEYS) {
      const cents = dollarsToCents(costs[key]);
      if (cents !== null) components[key] = cents;
    }
    await saveVariantCostComponentsAction(variantId, components);
    await updateVariantPricingAction(productId, variantId, {
      retailPriceCents: dollarsToCents(retailPrice),
      wholesalePriceCents: dollarsToCents(wholesalePrice),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-ink-subtle">{sku}</span>
        <span className="text-sm font-medium text-ink">{label}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {COST_COMPONENT_KEYS.map((key) => (
          <div key={key} className="flex flex-col gap-1">
            <Label htmlFor={`${variantId}-${key}`} className="text-xs">
              {COMPONENT_LABELS[key]}
            </Label>
            <Input
              id={`${variantId}-${key}`}
              type="number"
              step="0.01"
              value={costs[key]}
              onChange={(e) => setCosts((c) => ({ ...c, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${variantId}-retail`}>Retail price</Label>
          <Input id={`${variantId}-retail`} type="number" step="0.01" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${variantId}-wholesale`}>Wholesale price</Label>
          <Input
            id={`${variantId}-wholesale`}
            type="number"
            step="0.01"
            value={wholesalePrice}
            onChange={(e) => setWholesalePrice(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md bg-surface-muted p-3 text-xs text-ink-muted">
        <p>Total unit cost: ${(pricing.totalUnitCostCents / 100).toFixed(2)}</p>
        {pricing.grossMarginPercent !== null ? (
          <p>
            Retail gross profit: ${(pricing.grossProfitCents! / 100).toFixed(2)} ({pricing.grossMarginPercent}% margin)
          </p>
        ) : null}
        {pricing.wholesaleMarginPercent !== null ? (
          <p>
            Wholesale profit: ${(pricing.wholesaleProfitCents! / 100).toFixed(2)} ({pricing.wholesaleMarginPercent}% margin)
          </p>
        ) : null}
        <p className="mt-1 italic">This is planning guidance, not a guarantee of profitability.</p>
      </div>

      <Button type="button" size="sm" disabled={busy} onClick={handleSave} className="self-start">
        {busy ? "Saving…" : "Save pricing"}
      </Button>
    </div>
  );
}
