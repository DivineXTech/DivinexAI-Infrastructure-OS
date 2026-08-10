import "server-only";
import { hasSupabaseCredentials } from "@/src/env";
import { supabaseStorageProvider } from "@/src/providers/storage/supabase";
import { mockStorageProvider } from "@/src/providers/storage/mock";
import type { StorageProvider } from "@/src/providers/types";

export const storageProvider: StorageProvider = hasSupabaseCredentials()
  ? supabaseStorageProvider
  : mockStorageProvider;

/** Uploads a JSON payload marked as simulated media. Used by every mock
 *  provider so placeholder artifacts are self-describing and can never be
 *  mistaken for a real media file — see AGENTS/CLAUDE_CODE_MASTER_PROMPT.md
 *  non-negotiable: "never silently claim that simulated media is real." */
export async function uploadSimulatedPlaceholder(input: {
  path: string;
  payload: Record<string, unknown>;
}): Promise<{ url: string; path: string }> {
  const body = JSON.stringify(
    {
      simulated: true,
      generatedAt: new Date().toISOString(),
      ...input.payload,
    },
    null,
    2,
  );

  return storageProvider.upload({
    path: input.path.endsWith(".json") ? input.path : `${input.path}.simulated.json`,
    data: new TextEncoder().encode(body),
    contentType: "application/json",
  });
}
