import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DesignPreview } from "@/components/design-studio/design-preview";
import { MockupGenerateButton } from "@/components/design-studio/mockup-generate-button";
import { getGarmentTemplate } from "@/lib/catalog/data-access";
import { isRotationView } from "@/lib/catalog/garment-views";
import { getDesignProject, getDesignProjectState } from "@/lib/design-studio/data-access";
import { requireDesignReadAccess } from "@/lib/design-studio/guard";

export default async function DesignProjectPreviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { membership } = await requireDesignReadAccess();

  const project = await getDesignProject(membership.tenantId, projectId);
  if (!project) notFound();

  const [state, template] = await Promise.all([
    getDesignProjectState(membership.tenantId, projectId),
    project.garmentTemplateId ? getGarmentTemplate(membership.tenantId, project.garmentTemplateId) : null,
  ]);

  const colorHex = template?.colors.find((c) => c.id === project.garmentColorId)?.hexValue ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{project.name} — preview</h1>
        <p className="text-sm text-ink-muted">
          An interactive digital preview across every garment view — not a production proof.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All views</CardTitle>
          <CardDescription>Switch views to check placement before submitting for review.</CardDescription>
        </CardHeader>
        <CardContent>
          <DesignPreview views={template?.views.filter(isRotationView) ?? []} colorHex={colorHex} elements={state.elements} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generate mockup</CardTitle>
          <CardDescription>
            Creates a digital preview image for each view with elements — a browser-rendered preview, not a
            production proof.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MockupGenerateButton
            projectId={projectId}
            views={(template?.views.filter(isRotationView) ?? []).map((v) => ({
              viewKey: v.viewKey,
              svgMarkup: v.svgMarkup,
            }))}
            colorHex={colorHex}
            elements={state.elements}
            tenantName={membership.tenantName}
          />
        </CardContent>
      </Card>
    </div>
  );
}
