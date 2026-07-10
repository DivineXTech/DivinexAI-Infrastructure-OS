import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SupabaseStorageProvider } from "@/modules/storage/supabase-storage";

const PRODUCT_FILES_BUCKET = "product-files";
const SIGNED_URL_TTL_SECONDS = 60 * 5;

export class FileAccessError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "FileAccessError";
  }
}

/**
 * The only path by which a buyer ever gets a URL for a protected product
 * file. Verifies an active, non-expired, non-exhausted entitlement before
 * minting a short-lived signed URL, and logs the download event. A buyer
 * can never reach a file by guessing/changing a storage path — this
 * function is the sole gate.
 */
export async function getSignedDownloadUrl(params: {
  buyerId: string;
  entitlementId: string;
  productFileId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<string> {
  const supabase = createSupabaseAdminClient();

  const { data: entitlement } = await supabase
    .from("entitlements")
    .select("*")
    .eq("id", params.entitlementId)
    .eq("buyer_id", params.buyerId)
    .maybeSingle();

  if (!entitlement) throw new FileAccessError("No access to this file.", "not_entitled");
  if (entitlement.status !== "active") throw new FileAccessError("This access grant is no longer active.", "entitlement_inactive");
  if (entitlement.expires_at && new Date(entitlement.expires_at) < new Date()) {
    throw new FileAccessError("This access grant has expired.", "entitlement_expired");
  }
  if (entitlement.download_limit !== null && entitlement.downloads_used >= entitlement.download_limit) {
    throw new FileAccessError("Download limit reached for this purchase.", "download_limit_reached");
  }

  const { data: file } = await supabase
    .from("product_files")
    .select("*")
    .eq("id", params.productFileId)
    .eq("product_id", entitlement.product_id)
    .maybeSingle();

  if (!file) throw new FileAccessError("File not found for this product.", "file_not_found");

  const storage = new SupabaseStorageProvider();
  const signedUrl = await storage.createSignedDownloadUrl(PRODUCT_FILES_BUCKET, file.storage_path, SIGNED_URL_TTL_SECONDS);

  await supabase.from("download_events").insert({
    entitlement_id: entitlement.id,
    product_file_id: file.id,
    buyer_id: params.buyerId,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  });

  await supabase.from("entitlements").update({ downloads_used: entitlement.downloads_used + 1 }).eq("id", entitlement.id);

  return signedUrl;
}

export function buildProductFileStoragePath(creatorId: string, productId: string, fileId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${creatorId}/${productId}/${fileId}-${safeName}`;
}
