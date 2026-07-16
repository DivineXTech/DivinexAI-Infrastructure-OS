"use server";

import { writeAuditLog } from "@/lib/audit/log";
import { readImageInfo } from "@/lib/catalog/image-dimensions";
import { sanitizeSvgMarkup } from "@/lib/catalog/svg-sanitizer";
import {
  createDesignAsset,
  findDesignAssetByChecksum,
  markDesignAssetDeleted,
} from "@/lib/design-studio/data-access";
import { requireDesignStudioEditAccess } from "@/lib/design-studio/guard";
import { buildTenantObjectPath, sanitizeFilename } from "@/lib/storage/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"] as const;
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
const MAX_BYTES = 25 * 1024 * 1024;
const ARTWORK_BUCKET = "design-uploads";

function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type UploadArtworkResult =
  | { ok: true; assetId: string; reusedExisting: boolean }
  | { ok: false; error: string };

/**
 * Never trusts the browser-reported MIME type or file extension as the
 * final word — accepted bytes are re-checked structurally (SVG must
 * parse as a well-formed `<svg>` document; PNG/JPEG/WebP dimensions are
 * read from their actual binary headers, not assumed). SVGs are
 * sanitized server-side before a single byte reaches storage; a file that
 * fails sanitization is rejected outright, never stored "as-is with a
 * warning." See docs/ARTWORK_SECURITY.md.
 */
export async function uploadArtworkAction(
  formData: FormData,
  designProjectId: string | null = null,
): Promise<UploadArtworkResult> {
  const { profile, membership } = await requireDesignStudioEditAccess();

  const file = formData.get("artwork");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file was selected." };
  }
  if (!isAllowedMimeType(file.type)) {
    return { ok: false, error: "Unsupported file type. Use PNG, JPEG, WebP, or SVG." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "File must be smaller than 25 MB." };
  }

  const rawBytes = new Uint8Array(await file.arrayBuffer());
  let bytesToStore = rawBytes;
  const mimeType: AllowedMimeType = file.type;

  if (mimeType === "image/svg+xml") {
    const text = new TextDecoder().decode(rawBytes);
    const result = sanitizeSvgMarkup(text);
    if (!result.safe) {
      return { ok: false, error: "This SVG could not be safely processed and was rejected." };
    }
    bytesToStore = new TextEncoder().encode(result.sanitized);
  }

  const checksum = await sha256Hex(bytesToStore);
  const existing = await findDesignAssetByChecksum(membership.tenantId, checksum);
  if (existing) {
    return { ok: true, assetId: existing.id, reusedExisting: true };
  }

  const info = readImageInfo(bytesToStore, mimeType);
  const path = buildTenantObjectPath(
    membership.tenantId,
    "design-assets",
    `${Date.now()}-${sanitizeFilename(file.name)}`,
  );

  const supabase = await createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from(ARTWORK_BUCKET)
    .upload(path, bytesToStore, { contentType: mimeType, upsert: false });
  if (uploadError) {
    return { ok: false, error: "Upload failed. Please try again." };
  }

  const assetId = await createDesignAsset(membership.tenantId, profile.id, {
    designProjectId,
    storagePath: path,
    originalFilename: file.name,
    mimeType,
    fileSizeBytes: bytesToStore.length,
    widthPx: info?.widthPx ?? null,
    heightPx: info?.heightPx ?? null,
    estimatedDpi: null,
    hasTransparency: info?.hasTransparency ?? null,
    checksum,
  });

  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "design_asset.uploaded",
    targetTable: "design_assets",
    targetId: assetId,
    metadata: { mimeType, fileSizeBytes: bytesToStore.length },
  });

  return { ok: true, assetId, reusedExisting: false };
}

/** Uploads a new asset and marks the old one deleted — "replace" is just
 * upload-then-retire rather than an in-place overwrite, so the old
 * asset's row (and any element still pointing at it) never silently
 * changes underneath a design that hasn't been re-saved yet. */
export async function replaceArtworkAction(
  oldAssetId: string,
  formData: FormData,
  designProjectId: string | null = null,
): Promise<UploadArtworkResult> {
  const result = await uploadArtworkAction(formData, designProjectId);
  if (!result.ok) return result;
  const { membership } = await requireDesignStudioEditAccess();
  await markDesignAssetDeleted(membership.tenantId, oldAssetId);
  return result;
}

export async function removeArtworkAction(assetId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { profile, membership } = await requireDesignStudioEditAccess();
  await markDesignAssetDeleted(membership.tenantId, assetId);
  await writeAuditLog({
    tenantId: membership.tenantId,
    actorProfileId: profile.id,
    action: "design_asset.removed",
    targetTable: "design_assets",
    targetId: assetId,
  });
  return { ok: true };
}

/** design-uploads is a private bucket — every read goes through a
 * short-lived signed URL, never a public bucket URL. */
export async function getArtworkSignedUrlAction(
  storagePath: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { membership } = await requireDesignStudioEditAccess();
  if (!storagePath.startsWith(`${membership.tenantId}/`)) {
    return { ok: false, error: "Not found." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(ARTWORK_BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error || !data) return { ok: false, error: "Could not generate a preview link." };
  return { ok: true, url: data.signedUrl };
}
