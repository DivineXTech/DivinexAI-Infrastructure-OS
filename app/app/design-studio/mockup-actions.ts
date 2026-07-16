"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/log";
import { createMockup, getDesignProject } from "@/lib/design-studio/data-access";
import { requireDesignStudioEditAccess } from "@/lib/design-studio/guard";
import { buildTenantObjectPath } from "@/lib/storage/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MockupViewUpload = {
  viewKey: "front" | "back" | "left" | "right" | "composite";
  /** A `data:image/png;base64,...` URL produced by the browser's Canvas
   * export — there is no server-side image renderer in this phase. */
  dataUrl: string;
};

function decodeDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/**
 * Uploads browser-generated mockup PNGs to Storage and records the
 * mockup + its views. Every mockup this produces is a digital preview —
 * never presented as a final production proof unless a human explicitly
 * marks the linked design approved (see docs/DESIGN_STUDIO.md "Mockup
 * limitations").
 */
export async function generateMockupAction(
  projectId: string,
  views: MockupViewUpload[],
  hasWatermark: boolean,
): Promise<{ ok: true; mockupId: string } | { ok: false; error: string }> {
  const { profile, membership } = await requireDesignStudioEditAccess();
  const project = await getDesignProject(membership.tenantId, projectId);
  if (!project) return { ok: false, error: "Design project not found." };

  const supabase = await createSupabaseServerClient();
  const uploadedViews: { viewKey: MockupViewUpload["viewKey"]; imagePath: string }[] = [];

  for (const view of views) {
    const bytes = decodeDataUrl(view.dataUrl);
    const path = buildTenantObjectPath(membership.tenantId, "mockups", `${projectId}-${view.viewKey}-${Date.now()}.png`);
    const { error } = await supabase.storage.from("design-uploads").upload(path, bytes, {
      contentType: "image/png",
      upsert: false,
    });
    if (error) return { ok: false, error: `Failed to upload ${view.viewKey} mockup: ${error.message}` };
    uploadedViews.push({ viewKey: view.viewKey, imagePath: path });
  }

  const mockupId = await createMockup(membership.tenantId, profile.id, {
    designProjectId: projectId,
    designProjectVersionId: project.currentVersionId,
    hasWatermark,
    views: uploadedViews,
  });

  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "mockup.generated",
    targetTable: "mockups",
    targetId: mockupId,
    metadata: { designProjectId: projectId, viewCount: uploadedViews.length },
  });

  revalidatePath("/app/mockups");
  revalidatePath(`/app/design-studio/${projectId}`);

  return { ok: true, mockupId };
}

export async function getMockupSignedUrlAction(
  storagePath: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { membership } = await requireDesignStudioEditAccess();
  if (!storagePath.startsWith(`${membership.tenantId}/`)) {
    return { ok: false, error: "Not found." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from("design-uploads").createSignedUrl(storagePath, 60 * 10);
  if (error || !data) return { ok: false, error: "Could not generate a preview link." };
  return { ok: true, url: data.signedUrl };
}
