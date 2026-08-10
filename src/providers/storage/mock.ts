import "server-only";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HealthCheckResult, StorageProvider } from "@/src/providers/types";

/**
 * Local-disk mock storage used only when Supabase credentials are missing.
 * Writes under the OS temp directory — fine for local dev / demoing the
 * pipeline end-to-end, NOT durable and NOT suitable for a real deployment.
 * Never used when NEXT_PUBLIC_SUPABASE_URL + ANON_KEY + SERVICE_ROLE_KEY are
 * all set (see src/providers/storage/index.ts).
 */
const ROOT = join(tmpdir(), "atlas-video-factory-mock-storage");

export const mockStorageProvider: StorageProvider = {
  name: "mock-storage",
  simulated: true,

  async upload({ path, data, contentType }) {
    const fullPath = join(ROOT, path);
    await fs.mkdir(join(fullPath, ".."), { recursive: true });
    await fs.writeFile(fullPath, data);
    return {
      url: `file://${fullPath}#${contentType}`,
      path,
    };
  },

  async download(path) {
    const fullPath = join(ROOT, path);
    const buffer = await fs.readFile(fullPath);
    return new Uint8Array(buffer);
  },

  async checkHealth(): Promise<HealthCheckResult> {
    return {
      healthy: false,
      detail: "Supabase Storage is not configured — using local-disk mock storage",
    };
  },
};
