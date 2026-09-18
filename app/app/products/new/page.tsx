import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewProductForm } from "@/components/catalog/new-product-form";
import { listGarmentTemplates } from "@/lib/catalog/data-access";
import { requireCatalogEditAccess } from "@/lib/catalog/guard";

export default async function NewProductPage() {
  const { membership } = await requireCatalogEditAccess();
  const templates = await listGarmentTemplates(membership.tenantId);

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>New product draft</CardTitle>
          <CardDescription>Add variants and pricing after creating the draft.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewProductForm templates={templates} />
        </CardContent>
      </Card>
    </div>
  );
}
