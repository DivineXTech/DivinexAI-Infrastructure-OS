import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DesignElement,
  DesignProjectState,
  GarmentView,
  Placement,
} from "@/lib/design-studio/project-schema";
import { createEmptyProjectState, parseProjectState } from "@/lib/design-studio/project-schema";
import type { Database } from "@/lib/supabase/types";

type DesignProjectUpdate = Database["public"]["Tables"]["design_projects"]["Update"];

/**
 * Every function takes an explicit tenantId resolved server-side by the
 * caller (lib/design-studio/guard.ts), never from client input, and every
 * query filters by it in addition to whatever RLS also enforces — see
 * supabase/migrations/20260719000000_catalog.sql's top-of-file comment.
 *
 * design_elements/design_placements are the *live* editable state;
 * design_project_versions.state is an immutable jsonb snapshot taken on
 * demand (createDesignProjectVersion) or restored (restoreVersion) — see
 * docs/DESIGN_STUDIO.md "Versioning vs. undo/redo" for why both exist.
 */

// ---------------------------------------------------------------------------
// design_projects
// ---------------------------------------------------------------------------
export type DesignProjectStatus =
  | "draft"
  | "needs_artwork"
  | "ready_for_review"
  | "changes_requested"
  | "approved"
  | "converted_to_product"
  | "archived";

export type DesignProjectRow = {
  id: string;
  tenantId: string;
  name: string;
  status: DesignProjectStatus;
  garmentTemplateId: string | null;
  garmentColorId: string | null;
  productionMethod: string | null;
  ownerProfileId: string | null;
  assignedDesignerId: string | null;
  internalNotes: string | null;
  customerNotes: string | null;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

const PROJECT_COLUMNS =
  "id, tenant_id, name, status, garment_template_id, garment_color_id, production_method, owner_profile_id, assigned_designer_id, internal_notes, customer_notes, current_version_id, created_at, updated_at";

function mapProject(row: {
  id: string;
  tenant_id: string;
  name: string;
  status: DesignProjectStatus;
  garment_template_id: string | null;
  garment_color_id: string | null;
  production_method: string | null;
  owner_profile_id: string | null;
  assigned_designer_id: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}): DesignProjectRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    status: row.status,
    garmentTemplateId: row.garment_template_id,
    garmentColorId: row.garment_color_id,
    productionMethod: row.production_method,
    ownerProfileId: row.owner_profile_id,
    assignedDesignerId: row.assigned_designer_id,
    internalNotes: row.internal_notes,
    customerNotes: row.customer_notes,
    currentVersionId: row.current_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listDesignProjects(tenantId: string): Promise<DesignProjectRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("design_projects")
    .select(PROJECT_COLUMNS)
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  return (data ?? []).map(mapProject);
}

export async function getDesignProject(tenantId: string, projectId: string): Promise<DesignProjectRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("design_projects")
    .select(PROJECT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", projectId)
    .maybeSingle();
  return data ? mapProject(data) : null;
}

export async function createDesignProject(
  tenantId: string,
  ownerProfileId: string,
  input: { name?: string; createdFrom?: "manual" | "onboarding" },
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("design_projects")
    .insert({
      tenant_id: tenantId,
      name: input.name ?? "Untitled design",
      owner_profile_id: ownerProfileId,
      created_from: input.createdFrom ?? "manual",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create design project: ${error?.message}`);
  return data.id;
}

export async function updateDesignProjectMeta(
  tenantId: string,
  projectId: string,
  input: {
    name?: string;
    garmentTemplateId?: string | null;
    garmentColorId?: string | null;
    productionMethod?: string | null;
    assignedDesignerId?: string | null;
    internalNotes?: string | null;
    customerNotes?: string | null;
  },
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const patch: DesignProjectUpdate = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.garmentTemplateId !== undefined) patch.garment_template_id = input.garmentTemplateId;
  if (input.garmentColorId !== undefined) patch.garment_color_id = input.garmentColorId;
  if (input.productionMethod !== undefined) patch.production_method = input.productionMethod;
  if (input.assignedDesignerId !== undefined) patch.assigned_designer_id = input.assignedDesignerId;
  if (input.internalNotes !== undefined) patch.internal_notes = input.internalNotes;
  if (input.customerNotes !== undefined) patch.customer_notes = input.customerNotes;

  const { error } = await supabase.from("design_projects").update(patch).eq("tenant_id", tenantId).eq("id", projectId);
  if (error) throw new Error(`Failed to update design project: ${error.message}`);
}

export async function updateDesignProjectStatus(
  tenantId: string,
  projectId: string,
  status: DesignProjectStatus,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("design_projects")
    .update({ status, archived_at: status === "archived" ? new Date().toISOString() : null })
    .eq("tenant_id", tenantId)
    .eq("id", projectId);
  if (error) throw new Error(`Failed to update design project status: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Live state (design_elements + design_placements) <-> DesignProjectState
// ---------------------------------------------------------------------------
export async function getDesignProjectState(tenantId: string, projectId: string): Promise<DesignProjectState> {
  const supabase = await createSupabaseServerClient();
  const [{ data: project }, { data: elements }] = await Promise.all([
    supabase
      .from("design_projects")
      .select("garment_template_id, garment_color_id")
      .eq("tenant_id", tenantId)
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("design_elements")
      .select(
        "id, element_type, z_index, locked, hidden, text_content, font_key, font_size, text_color, text_align, design_asset_id, design_placements(print_zone_id, garment_view, x, y, width, height, rotation)",
      )
      .eq("tenant_id", tenantId)
      .eq("design_project_id", projectId)
      .order("z_index"),
  ]);

  if (!project) return createEmptyProjectState();

  const mappedElements: DesignElement[] = (elements ?? []).flatMap((row) => {
    const placementRow = Array.isArray(row.design_placements) ? row.design_placements[0] : row.design_placements;
    if (!placementRow) return [];
    const placement: Placement = {
      printZoneId: placementRow.print_zone_id,
      garmentView: placementRow.garment_view as GarmentView,
      x: placementRow.x,
      y: placementRow.y,
      width: placementRow.width,
      height: placementRow.height,
      rotation: placementRow.rotation,
    };
    return [
      {
        id: row.id,
        elementType: row.element_type as "text" | "image",
        zIndex: row.z_index,
        locked: row.locked,
        hidden: row.hidden,
        textContent: row.text_content,
        fontKey: row.font_key,
        fontSize: row.font_size,
        textColor: row.text_color,
        textAlign: row.text_align as "left" | "center" | "right" | null,
        designAssetId: row.design_asset_id,
        placement,
      },
    ];
  });

  return {
    garmentTemplateId: project.garment_template_id,
    garmentColorId: project.garment_color_id,
    activeView: mappedElements[0]?.placement.garmentView ?? "front",
    elements: mappedElements,
  };
}

/**
 * Replaces every design_elements/design_placements row for this project
 * with the given normalized state — the live-state table pair is always
 * fully rewritten on save (delete + reinsert) rather than diffed, since
 * project sizes here are small (a handful of elements) and this keeps the
 * write path simple and impossible to leave half-updated.
 */
export async function saveDesignProjectState(
  tenantId: string,
  projectId: string,
  state: DesignProjectState,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  await supabase.from("design_projects").update({
    garment_template_id: state.garmentTemplateId,
    garment_color_id: state.garmentColorId,
  }).eq("tenant_id", tenantId).eq("id", projectId);

  await supabase.from("design_elements").delete().eq("tenant_id", tenantId).eq("design_project_id", projectId);

  for (const element of state.elements) {
    const { data: inserted, error } = await supabase
      .from("design_elements")
      .insert({
        tenant_id: tenantId,
        design_project_id: projectId,
        element_type: element.elementType,
        z_index: element.zIndex,
        locked: element.locked,
        hidden: element.hidden,
        text_content: element.textContent,
        font_key: element.fontKey,
        font_size: element.fontSize,
        text_color: element.textColor,
        text_align: element.textAlign,
        design_asset_id: element.designAssetId,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(`Failed to save design element: ${error?.message}`);

    const { error: placementError } = await supabase.from("design_placements").insert({
      design_element_id: inserted.id,
      tenant_id: tenantId,
      print_zone_id: element.placement.printZoneId,
      garment_view: element.placement.garmentView,
      x: element.placement.x,
      y: element.placement.y,
      width: element.placement.width,
      height: element.placement.height,
      rotation: element.placement.rotation,
    });
    if (placementError) throw new Error(`Failed to save design placement: ${placementError.message}`);
  }
}

// ---------------------------------------------------------------------------
// design_project_versions
// ---------------------------------------------------------------------------
export type DesignProjectVersionRow = {
  id: string;
  versionNumber: number;
  label: string | null;
  createdBy: string | null;
  createdAt: string;
};

export async function listDesignProjectVersions(
  tenantId: string,
  projectId: string,
): Promise<DesignProjectVersionRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("design_project_versions")
    .select("id, version_number, label, created_by, created_at")
    .eq("tenant_id", tenantId)
    .eq("design_project_id", projectId)
    .order("version_number", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id,
    versionNumber: row.version_number,
    label: row.label,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

/** Snapshots the *current live state* into a new immutable version row
 * and makes it the project's `current_version_id`. Idempotent in the
 * sense that calling it twice creates two distinct, individually
 * restorable versions — it is not meant to dedupe identical snapshots. */
export async function createDesignProjectVersion(
  tenantId: string,
  projectId: string,
  createdBy: string,
  label?: string,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const state = await getDesignProjectState(tenantId, projectId);

  const { data: latest } = await supabase
    .from("design_project_versions")
    .select("version_number")
    .eq("tenant_id", tenantId)
    .eq("design_project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersionNumber = (latest?.version_number ?? 0) + 1;

  const { data: version, error } = await supabase
    .from("design_project_versions")
    .insert({
      design_project_id: projectId,
      tenant_id: tenantId,
      version_number: nextVersionNumber,
      label: label ?? null,
      state,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error || !version) throw new Error(`Failed to create design project version: ${error?.message}`);

  await supabase
    .from("design_projects")
    .update({ current_version_id: version.id })
    .eq("tenant_id", tenantId)
    .eq("id", projectId);

  return version.id;
}

/** Restores a prior version by replacing the live state with its
 * snapshot, then recording that restoration as a brand-new version on
 * top (so "restore" is itself undoable via version history, never a
 * destructive rewrite of history). */
export async function restoreDesignProjectVersion(
  tenantId: string,
  projectId: string,
  versionId: string,
  actorId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: version } = await supabase
    .from("design_project_versions")
    .select("state")
    .eq("tenant_id", tenantId)
    .eq("design_project_id", projectId)
    .eq("id", versionId)
    .maybeSingle();
  if (!version) throw new Error("Version not found");

  const state = parseProjectState(version.state);
  await saveDesignProjectState(tenantId, projectId, state);
  await createDesignProjectVersion(tenantId, projectId, actorId, "Restored from prior version");
}

// ---------------------------------------------------------------------------
// design_assets
// ---------------------------------------------------------------------------
export type DesignAssetRow = {
  id: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  widthPx: number | null;
  heightPx: number | null;
  estimatedDpi: number | null;
  hasTransparency: boolean | null;
  status: "active" | "replaced" | "deleted";
};

export async function listDesignAssets(tenantId: string, projectId: string): Promise<DesignAssetRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("design_assets")
    .select("id, storage_path, original_filename, mime_type, file_size_bytes, width_px, height_px, estimated_dpi, has_transparency, status")
    .eq("tenant_id", tenantId)
    .eq("design_project_id", projectId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    widthPx: row.width_px,
    heightPx: row.height_px,
    estimatedDpi: row.estimated_dpi,
    hasTransparency: row.has_transparency,
    status: row.status,
  }));
}

export type CreateDesignAssetInput = {
  designProjectId: string | null;
  storagePath: string;
  originalFilename: string;
  mimeType: "image/png" | "image/jpeg" | "image/svg+xml" | "image/webp";
  fileSizeBytes: number;
  widthPx: number | null;
  heightPx: number | null;
  estimatedDpi: number | null;
  hasTransparency: boolean | null;
  checksum: string | null;
};

export async function createDesignAsset(
  tenantId: string,
  uploadedBy: string,
  input: CreateDesignAssetInput,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("design_assets")
    .insert({
      tenant_id: tenantId,
      design_project_id: input.designProjectId,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      mime_type: input.mimeType,
      file_size_bytes: input.fileSizeBytes,
      width_px: input.widthPx,
      height_px: input.heightPx,
      estimated_dpi: input.estimatedDpi,
      has_transparency: input.hasTransparency,
      checksum: input.checksum,
      uploaded_by: uploadedBy,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to record design asset: ${error?.message}`);
  return data.id;
}

export async function findDesignAssetByChecksum(
  tenantId: string,
  checksum: string,
): Promise<DesignAssetRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("design_assets")
    .select("id, storage_path, original_filename, mime_type, file_size_bytes, width_px, height_px, estimated_dpi, has_transparency, status")
    .eq("tenant_id", tenantId)
    .eq("checksum", checksum)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    storagePath: data.storage_path,
    originalFilename: data.original_filename,
    mimeType: data.mime_type,
    fileSizeBytes: data.file_size_bytes,
    widthPx: data.width_px,
    heightPx: data.height_px,
    estimatedDpi: data.estimated_dpi,
    hasTransparency: data.has_transparency,
    status: data.status,
  };
}

export async function markDesignAssetDeleted(tenantId: string, assetId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("design_assets")
    .update({ status: "deleted" })
    .eq("tenant_id", tenantId)
    .eq("id", assetId);
  if (error) throw new Error(`Failed to remove design asset: ${error.message}`);
}

// ---------------------------------------------------------------------------
// mockups
// ---------------------------------------------------------------------------
export type MockupRow = {
  id: string;
  designProjectId: string | null;
  status: "generated" | "downloaded";
  hasWatermark: boolean;
  createdAt: string;
  views: { viewKey: string; imagePath: string }[];
};

async function fetchMockupViews(
  tenantId: string,
  mockupIds: string[],
): Promise<Map<string, { viewKey: string; imagePath: string }[]>> {
  const supabase = await createSupabaseServerClient();
  const byMockupId = new Map<string, { viewKey: string; imagePath: string }[]>();
  if (mockupIds.length === 0) return byMockupId;

  const { data } = await supabase
    .from("mockup_views")
    .select("mockup_id, view_key, image_path")
    .eq("tenant_id", tenantId)
    .in("mockup_id", mockupIds);
  for (const row of data ?? []) {
    const existing = byMockupId.get(row.mockup_id) ?? [];
    existing.push({ viewKey: row.view_key, imagePath: row.image_path });
    byMockupId.set(row.mockup_id, existing);
  }
  return byMockupId;
}

export async function listMockups(tenantId: string): Promise<MockupRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("mockups")
    .select("id, design_project_id, status, has_watermark, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const viewsByMockupId = await fetchMockupViews(
    tenantId,
    rows.map((r) => r.id),
  );
  return rows.map((row) => ({
    id: row.id,
    designProjectId: row.design_project_id,
    status: row.status,
    hasWatermark: row.has_watermark,
    createdAt: row.created_at,
    views: viewsByMockupId.get(row.id) ?? [],
  }));
}

export async function getMockup(tenantId: string, mockupId: string): Promise<MockupRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("mockups")
    .select("id, design_project_id, status, has_watermark, created_at")
    .eq("tenant_id", tenantId)
    .eq("id", mockupId)
    .maybeSingle();
  if (!data) return null;
  const viewsByMockupId = await fetchMockupViews(tenantId, [data.id]);
  return {
    id: data.id,
    designProjectId: data.design_project_id,
    status: data.status,
    hasWatermark: data.has_watermark,
    createdAt: data.created_at,
    views: viewsByMockupId.get(data.id) ?? [],
  };
}

export async function createMockup(
  tenantId: string,
  generatedBy: string,
  input: {
    designProjectId: string;
    designProjectVersionId: string | null;
    hasWatermark: boolean;
    views: { viewKey: "front" | "back" | "left" | "right" | "composite"; imagePath: string }[];
  },
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data: mockup, error } = await supabase
    .from("mockups")
    .insert({
      tenant_id: tenantId,
      design_project_id: input.designProjectId,
      design_project_version_id: input.designProjectVersionId,
      has_watermark: input.hasWatermark,
      generated_by: generatedBy,
    })
    .select("id")
    .single();
  if (error || !mockup) throw new Error(`Failed to create mockup: ${error?.message}`);

  if (input.views.length > 0) {
    const { error: viewsError } = await supabase.from("mockup_views").insert(
      input.views.map((v) => ({
        mockup_id: mockup.id,
        tenant_id: tenantId,
        view_key: v.viewKey,
        image_path: v.imagePath,
      })),
    );
    if (viewsError) throw new Error(`Failed to save mockup views: ${viewsError.message}`);
  }

  return mockup.id;
}

// ---------------------------------------------------------------------------
// dashboard metrics
// ---------------------------------------------------------------------------
export type DesignDashboardMetrics = {
  designsAwaitingReview: number;
  approvedDesigns: number;
  mockupsGenerated: number;
};

export async function getDesignDashboardMetrics(tenantId: string): Promise<DesignDashboardMetrics> {
  const supabase = await createSupabaseServerClient();
  const [{ count: awaitingReview }, { count: approved }, { count: mockups }] = await Promise.all([
    supabase
      .from("design_projects")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "ready_for_review"),
    supabase
      .from("design_projects")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "approved"),
    supabase.from("mockups").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);
  return {
    designsAwaitingReview: awaitingReview ?? 0,
    approvedDesigns: approved ?? 0,
    mockupsGenerated: mockups ?? 0,
  };
}
