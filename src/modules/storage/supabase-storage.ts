import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StorageProvider } from "./provider";

/**
 * Supabase Storage-backed provider. Signed URLs are minted with the
 * service-role client and expire quickly — this is the only path by which
 * a `product-files` object is ever readable, matching the "no public URL
 * for paid files" requirement.
 */
export class SupabaseStorageProvider implements StorageProvider {
  async createSignedDownloadUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string> {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data) throw new Error(`Failed to create signed URL: ${error?.message ?? "unknown error"}`);
    return data.signedUrl;
  }

  async createSignedUploadUrl(bucket: string, path: string) {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) throw new Error(`Failed to create signed upload URL: ${error?.message ?? "unknown error"}`);
    return { signedUrl: data.signedUrl, token: data.token };
  }

  async removeObject(bucket: string, path: string): Promise<void> {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw new Error(`Failed to remove object: ${error.message}`);
  }
}
