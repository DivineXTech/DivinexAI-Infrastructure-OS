import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditProductForm } from "@/components/catalog/edit-product-form";
import { getProduct } from "@/lib/catalog/data-access";
import { requireCatalogEditAccess } from "@/lib/catalog/guard";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const { membership } = await requireCatalogEditAccess();
  const product = await getProduct(membership.tenantId, productId);
  if (!product) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit {product.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <EditProductForm product={product} />
        </CardContent>
      </Card>
    </div>
  );
}
