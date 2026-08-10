import "server-only";
import { getEnv } from "@/src/env";
import { createSupabaseServiceClient } from "@/src/lib/supabase/server";
import type { HealthCheckResult, StorageProvider } from "@/src/providers/types";

/** Real Supabase Storage-backed provider. Only selected when all three
 *  Supabase env vars are present — see src/providers/storage/index.ts. */
export const supabaseStorageProvider: StorageProvider = {
  name: "supabase-storage",
  simulated: false,

  async upload({ path, data, contentType }) {
    const env = getEnv();
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .upload(path, data, { contentType, upsert: true });

    if (error) {
      throw new Error(`Supabase Storage upload failed for "${path}": ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(path);

    return { url: publicUrlData.publicUrl, path };
  },

  async download(path) {
    const env = getEnv();
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .download(path);

    if (error || !data) {
      throw new Error(
        `Supabase Storage download failed for "${path}": ${error?.message ?? "no data"}`,
      );
    }

    return new Uint8Array(await data.arrayBuffer());
  },

  async checkHealth(): Promise<HealthCheckResult> {
    try {
      const env = getEnv();
      const supabase = createSupabaseServiceClient();
      const { error } = await supabase.storage.getBucket(env.SUPABASE_STORAGE_BUCKET);
      if (error) {
        return { healthy: false, detail: error.message };
      }
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        detail: error instanceof Error ? error.message : "Unknown storage error",
      };
    }
  },
};
