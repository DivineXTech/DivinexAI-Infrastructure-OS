import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listProducts } from "@/lib/catalog/data-access";
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

export default async function ProductsPage() {
  const { membership } = await requireCatalogReadAccess();
  const products = await listProducts(membership.tenantId);
  const canCreate = TENANT_ADMIN_ROLES.includes(membership.roleKey);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Products</h1>
          <p className="text-sm text-ink-muted">Product catalog, variants, and pricing.</p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/app/products/new">New product</Link>
          </Button>
        ) : null}
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-ink-muted">No products yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Link key={product.id} href={`/app/products/${product.id}`}>
              <Card className="h-full transition-colors hover:border-accent">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <Badge variant={product.status === "active" ? "success" : "outline"}>
                      {STATUS_LABELS[product.status]}
                    </Badge>
                  </div>
                  <CardDescription>{product.category ?? "Uncategorized"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-ink-subtle">
                    {product.productionMethod ? product.productionMethod.replace(/_/g, " ") : "No production method set"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
