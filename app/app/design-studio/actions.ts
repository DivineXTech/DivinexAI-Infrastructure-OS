"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/log";
import { getGarmentTemplate, listGarmentTemplates, type GarmentTemplateDetail, type GarmentTemplateSummary } from "@/lib/catalog/data-access";
import {
  createDesignProject,
  createDesignProjectVersion,
  getDesignProject,
  getDesignProjectState,
  restoreDesignProjectVersion,
  saveDesignProjectState,
  updateDesignProjectMeta,
  updateDesignProjectStatus,
} from "@/lib/design-studio/data-access";
import {
  DESIGN_APPROVAL_ROLES,
  requireDesignApprovalAccess,
  requireDesignStudioEditAccess,
} from "@/lib/design-studio/guard";
import { designProjectStateSchema } from "@/lib/design-studio/project-schema";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createDesignProjectAction(
  name?: string,
): Promise<ActionResult<{ projectId: string }>> {
  const { profile, membership } = await requireDesignStudioEditAccess();
  const projectId = await createDesignProject(membership.tenantId, profile.id, { name });
  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "design_project.created",
    targetTable: "design_projects",
    targetId: projectId,
  });
  revalidatePath("/app/design-studio");
  return { ok: true, data: { projectId } };
}

export async function duplicateDesignProjectAction(projectId: string): Promise<ActionResult<{ projectId: string }>> {
  const { profile, membership } = await requireDesignStudioEditAccess();
  const source = await getDesignProject(membership.tenantId, projectId);
  if (!source) return { ok: false, error: "Design project not found." };

  const newProjectId = await createDesignProject(membership.tenantId, profile.id, {
    name: `${source.name} (copy)`,
  });
  await updateDesignProjectMeta(membership.tenantId, newProjectId, {
    garmentTemplateId: source.garmentTemplateId,
    garmentColorId: source.garmentColorId,
    productionMethod: source.productionMethod,
  });
  const state = await getDesignProjectState(membership.tenantId, projectId);
  await saveDesignProjectState(membership.tenantId, newProjectId, state);

  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "design_project.created",
    targetTable: "design_projects",
    targetId: newProjectId,
    metadata: { duplicatedFrom: projectId },
  });
  revalidatePath("/app/design-studio");
  return { ok: true, data: { projectId: newProjectId } };
}

export async function renameDesignProjectAction(projectId: string, name: string): Promise<ActionResult> {
  const { membership } = await requireDesignStudioEditAccess();
  await updateDesignProjectMeta(membership.tenantId, projectId, { name });
  revalidatePath(`/app/design-studio/${projectId}`);
  return { ok: true, data: undefined };
}

export async function updateDesignMetaAction(
  projectId: string,
  input: {
    garmentTemplateId?: string | null;
    garmentColorId?: string | null;
    productionMethod?: string | null;
  },
): Promise<ActionResult> {
  const { membership } = await requireDesignStudioEditAccess();
  await updateDesignProjectMeta(membership.tenantId, projectId, input);
  revalidatePath(`/app/design-studio/${projectId}`);
  return { ok: true, data: undefined };
}

/**
 * Saves the live editor state (design_elements/design_placements) without
 * creating a version snapshot — used for both the explicit "Save draft"
 * button and debounced autosave. Rejects anything that doesn't validate
 * against designProjectStateSchema rather than persisting partial/
 * malformed state.
 */
export async function saveDesignStateAction(projectId: string, state: unknown): Promise<ActionResult> {
  const { membership } = await requireDesignStudioEditAccess();
  const parsed = designProjectStateSchema.safeParse(state);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid design state." };
  }
  await saveDesignProjectState(membership.tenantId, projectId, parsed.data);

  const project = await getDesignProject(membership.tenantId, projectId);
  if (project?.status === "draft" && parsed.data.elements.length === 0) {
    await updateDesignProjectStatus(membership.tenantId, projectId, "needs_artwork");
  }

  return { ok: true, data: undefined };
}

export async function createDesignVersionAction(
  projectId: string,
  label?: string,
): Promise<ActionResult<{ versionId: string }>> {
  const { profile, membership } = await requireDesignStudioEditAccess();
  const versionId = await createDesignProjectVersion(membership.tenantId, projectId, profile.id, label);
  revalidatePath(`/app/design-studio/${projectId}`);
  return { ok: true, data: { versionId } };
}

export async function restoreDesignVersionAction(projectId: string, versionId: string): Promise<ActionResult> {
  const { profile, membership } = await requireDesignStudioEditAccess();
  await restoreDesignProjectVersion(membership.tenantId, projectId, versionId, profile.id);
  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "design_project.version_restored",
    targetTable: "design_project_versions",
    targetId: versionId,
    metadata: { designProjectId: projectId },
  });
  revalidatePath(`/app/design-studio/${projectId}`);
  return { ok: true, data: undefined };
}

export async function submitDesignForReviewAction(projectId: string): Promise<ActionResult> {
  const { profile, membership } = await requireDesignStudioEditAccess();
  await updateDesignProjectStatus(membership.tenantId, projectId, "ready_for_review");
  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "design_project.submitted",
    targetTable: "design_projects",
    targetId: projectId,
  });
  revalidatePath(`/app/design-studio/${projectId}`);
  return { ok: true, data: undefined };
}

/** Only tenant_owner/tenant_admin — designers can submit but never
 * self-approve (section 9/15). */
export async function approveDesignAction(projectId: string): Promise<ActionResult> {
  const { profile, membership } = await requireDesignApprovalAccess();
  await updateDesignProjectStatus(membership.tenantId, projectId, "approved");
  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "design_project.approved",
    targetTable: "design_projects",
    targetId: projectId,
  });
  revalidatePath(`/app/design-studio/${projectId}`);
  return { ok: true, data: undefined };
}

export async function requestDesignChangesAction(projectId: string, notes?: string): Promise<ActionResult> {
  const { profile, membership } = await requireDesignApprovalAccess();
  await updateDesignProjectStatus(membership.tenantId, projectId, "changes_requested");
  if (notes) {
    await updateDesignProjectMeta(membership.tenantId, projectId, { internalNotes: notes });
  }
  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "design_project.changes_requested",
    targetTable: "design_projects",
    targetId: projectId,
  });
  revalidatePath(`/app/design-studio/${projectId}`);
  return { ok: true, data: undefined };
}

export async function listGarmentTemplatesForEditorAction(): Promise<GarmentTemplateSummary[]> {
  const { membership } = await requireDesignStudioEditAccess();
  return listGarmentTemplates(membership.tenantId);
}

export async function getGarmentTemplateForEditorAction(templateId: string): Promise<GarmentTemplateDetail | null> {
  const { membership } = await requireDesignStudioEditAccess();
  return getGarmentTemplate(membership.tenantId, templateId);
}

export { DESIGN_APPROVAL_ROLES };
