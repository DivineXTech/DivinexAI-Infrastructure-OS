import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listGarmentTemplates } from "@/lib/catalog/data-access";
import { requireCatalogReadAccess } from "@/lib/catalog/guard";

export default async function GarmentsPage() {
  const { membership } = await requireCatalogReadAccess();
  const templates = await listGarmentTemplates(membership.tenantId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Garment templates</h1>
        <p className="text-sm text-ink-muted">
          Platform-provided templates plus any custom templates your brand has created.
        </p>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-ink-muted">No garment templates available yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Link key={template.id} href={`/app/garments/${template.id}`}>
              <Card className="h-full transition-colors hover:border-accent">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <Badge variant={template.tenantId ? "outline" : "accent"}>
                      {template.tenantId ? "Custom" : "Platform"}
                    </Badge>
                  </div>
                  <CardDescription className="capitalize">{template.category.replace(/_/g, " ")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-ink-subtle">
                    {template.supportedProductionMethods.length > 0
                      ? template.supportedProductionMethods.join(", ").replace(/_/g, " ")
                      : "No production methods configured yet."}
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
