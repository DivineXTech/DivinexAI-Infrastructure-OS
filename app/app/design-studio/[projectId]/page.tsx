import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ConvertToProductButton } from "@/components/design-studio/convert-to-product-button";
import { DesignStudioEditor } from "@/components/design-studio/editor";
import { StatusPanel } from "@/components/design-studio/status-panel";
import { getGarmentTemplate } from "@/lib/catalog/data-access";
import { DESIGN_APPROVAL_ROLES } from "@/lib/design-studio/guard";
import { getDesignProject, getDesignProjectState } from "@/lib/design-studio/data-access";
import { requireDesignStudioEditAccess } from "@/lib/design-studio/guard";

export default async function DesignProjectEditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { membership } = await requireDesignStudioEditAccess();

  const project = await getDesignProject(membership.tenantId, projectId);
  if (!project) notFound();

  const [state, template] = await Promise.all([
    getDesignProjectState(membership.tenantId, projectId),
    project.garmentTemplateId ? getGarmentTemplate(membership.tenantId, project.garmentTemplateId) : null,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">{project.name}</h1>
        <div className="flex items-center gap-3">
          <StatusPanel
            projectId={projectId}
            status={project.status}
            canSubmit
            canApprove={DESIGN_APPROVAL_ROLES.includes(membership.roleKey)}
          />
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/design-studio/${projectId}/preview`}>Preview &amp; mockups</Link>
          </Button>
          {project.status === "approved" && DESIGN_APPROVAL_ROLES.includes(membership.roleKey) ? (
            <ConvertToProductButton designProjectId={projectId} />
          ) : null}
        </div>
      </div>
      <DesignStudioEditor projectId={projectId} initialState={state} initialTemplate={template} />
    </div>
  );
}
