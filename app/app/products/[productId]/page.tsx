import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductStatusActions } from "@/components/catalog/product-status-actions";
import { getProduct, listProductVariants } from "@/lib/catalog/data-access";
import { requireCatalogReadAccess } from "@/lib/catalog/guard";
import { TENANT_ADMIN_ROLES } from "@/lib/auth/roles";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready_for_review: "Ready for review",
  approved: "Approved",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const { membership } = await requireCatalogReadAccess();
  const product = await getProduct(membership.tenantId, productId);
  if (!product) notFound();

  const variants = await listProductVariants(membership.tenantId, productId);
  const canEdit = TENANT_ADMIN_ROLES.includes(membership.roleKey);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{product.name}</h1>
          <p className="text-sm text-ink-muted">{product.category ?? "Uncategorized"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={product.status === "active" ? "success" : "outline"}>{STATUS_LABELS[product.status]}</Badge>
          {canEdit ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/products/${productId}/edit`}>Edit</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/products/${productId}/variants`}>Variants</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/products/${productId}/pricing`}>Pricing</Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {canEdit ? <ProductStatusActions productId={productId} status={product.status} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>{product.shortDescription ?? "No short description yet."}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-ink-muted">
          <p>Production method: {product.productionMethod?.replace(/_/g, " ") ?? "Not set"}</p>
          <p>Variants: {variants.length}</p>
          <p>
            Priced variants: {variants.filter((v) => v.retailPriceCents !== null).length} / {variants.length}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
