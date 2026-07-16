import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VariantPricingRow } from "@/components/catalog/variant-pricing-row";
import { getProduct, getVariantCostComponents, listProductVariants } from "@/lib/catalog/data-access";
import { requireCatalogEditAccess } from "@/lib/catalog/guard";

export default async function ProductPricingPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const { membership } = await requireCatalogEditAccess();
  const product = await getProduct(membership.tenantId, productId);
  if (!product) notFound();

  const variants = await listProductVariants(membership.tenantId, productId);
  const costComponentsByVariant = await Promise.all(
    variants.map((v) => getVariantCostComponents(membership.tenantId, v.id)),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{product.name} — pricing</h1>
        <p className="text-sm text-ink-muted">
          Enter cost components per variant to see gross margin — every price change is recorded in price history.
        </p>
      </div>

      {variants.length === 0 ? (
        <p className="text-sm text-ink-muted">Generate variants first before setting pricing.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Variants</CardTitle>
            <CardDescription>Deterministic margin calculation, integer cents throughout.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {variants.map((variant, index) => (
              <VariantPricingRow
                key={variant.id}
                productId={productId}
                variantId={variant.id}
                sku={variant.sku}
                label={[variant.sizeLabel, variant.colorName].filter(Boolean).join(" / ") || "Default"}
                initialCostComponents={costComponentsByVariant[index]}
                initialRetailPriceCents={variant.retailPriceCents}
                initialWholesalePriceCents={variant.wholesalePriceCents}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
