import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Private Supabase Storage delivery for the full ebook (post-purchase
 * fulfillment). Same pattern as chapter12-storage.ts — see that file for
 * the full rationale.
 */

const BUCKET = process.env.EBOOK_STORAGE_BUCKET || "ebook-private";
const OBJECT_PATH = process.env.EBOOK_STORAGE_PATH || "the-billionaire-blueprint-2.0.pdf";
const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes

export interface EbookDownloadResult {
  available: boolean;
  mocked: boolean;
  url?: string;
}

export async function getEbookDownloadUrl(): Promise<EbookDownloadResult> {
  if (!isSupabaseConfigured()) {
    return { available: false, mocked: true };
  }

  const client = getSupabaseAdmin()!;
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(OBJECT_PATH, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return { available: false, mocked: false };
  }

  return { available: true, mocked: false, url: data.signedUrl };
}
