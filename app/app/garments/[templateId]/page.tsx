import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GarmentViewer } from "@/components/garment-preview/garment-viewer";
import { getGarmentTemplate } from "@/lib/catalog/data-access";
import { isRotationView } from "@/lib/catalog/garment-views";
import { requireCatalogReadAccess } from "@/lib/catalog/guard";

export default async function GarmentTemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const { membership } = await requireCatalogReadAccess();
  const template = await getGarmentTemplate(membership.tenantId, templateId);
  if (!template) notFound();

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="lg:w-96 lg:shrink-0">
        <GarmentViewer views={template.views.filter(isRotationView)} colors={template.colors} />
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-ink">{template.name}</h1>
          <Badge variant={template.tenantId ? "outline" : "accent"}>
            {template.tenantId ? "Custom template" : "Platform template"}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription className="capitalize">{template.category.replace(/_/g, " ")}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 text-sm text-ink-muted sm:grid-cols-2">
            {template.manufacturer ? <p>Manufacturer: {template.manufacturer}</p> : null}
            {template.fabricComposition ? <p>Fabric: {template.fabricComposition}</p> : null}
            {template.weight ? <p>Weight: {template.weight}</p> : null}
            {template.fit ? <p>Fit: {template.fit}</p> : null}
            {template.audience ? <p>Audience: {template.audience}</p> : null}
            {template.baseWholesaleCostCents !== null ? (
              <p>Base wholesale cost: ${(template.baseWholesaleCostCents / 100).toFixed(2)}</p>
            ) : null}
          </CardContent>
        </Card>

        {template.description ? (
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-muted">{template.description}</p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Sizes</CardTitle>
          </CardHeader>
          <CardContent>
            {template.sizes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {template.sizes.map((size) => (
                  <Badge key={size.id} variant="outline">
                    {size.sizeLabel}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-subtle">No sizes configured yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Print zones</CardTitle>
            <CardDescription>Applicable view, position, and safe-print boundary for each zone.</CardDescription>
          </CardHeader>
          <CardContent>
            {template.printZones.length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm text-ink-muted">
                {template.printZones.map((zone) => (
                  <li key={zone.id}>
                    <span className="font-medium text-ink capitalize">{zone.zoneKey.replace(/_/g, " ")}</span>{" "}
                    — {zone.viewKey} view
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-subtle">No print zones configured yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
