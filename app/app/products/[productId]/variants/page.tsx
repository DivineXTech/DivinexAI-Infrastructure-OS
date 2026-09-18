import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VariantMatrixGenerator } from "@/components/catalog/variant-matrix-generator";
import { getProduct, listProductVariants } from "@/lib/catalog/data-access";
import { requireCatalogEditAccess } from "@/lib/catalog/guard";

export default async function ProductVariantsPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const { membership } = await requireCatalogEditAccess();
  const product = await getProduct(membership.tenantId, productId);
  if (!product) notFound();

  const variants = await listProductVariants(membership.tenantId, productId);
  const skuPrefix = product.slug.slice(0, 6).toUpperCase() || "SKU";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{product.name} — variants</h1>
        <p className="text-sm text-ink-muted">
          Generate a size/color matrix — duplicate combinations are rejected automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate variants</CardTitle>
          <CardDescription>New combinations are added; existing ones are left untouched.</CardDescription>
        </CardHeader>
        <CardContent>
          <VariantMatrixGenerator productId={productId} skuPrefix={skuPrefix} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing variants ({variants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {variants.length === 0 ? (
            <p className="text-sm text-ink-subtle">No variants yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="p-2">SKU</th>
                    <th className="p-2">Size</th>
                    <th className="p-2">Color</th>
                    <th className="p-2">Retail price</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant) => (
                    <tr key={variant.id} className="border-b border-border/50">
                      <td className="p-2 font-mono text-xs">{variant.sku}</td>
                      <td className="p-2">{variant.sizeLabel ?? "—"}</td>
                      <td className="p-2">{variant.colorName ?? "—"}</td>
                      <td className="p-2">
                        {variant.retailPriceCents !== null ? `$${(variant.retailPriceCents / 100).toFixed(2)}` : "—"}
                      </td>
                      <td className="p-2">
                        <Badge variant={variant.isActive ? "success" : "outline"}>
                          {variant.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
