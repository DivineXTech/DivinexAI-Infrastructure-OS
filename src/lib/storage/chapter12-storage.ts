import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Private Supabase Storage delivery for the Chapter 12 PDF.
 *
 * The bucket is expected to be PRIVATE (no public policy) — access is only
 * ever granted through short-lived signed URLs minted here, never a public
 * object URL. See SETUP.md for bucket setup.
 *
 * Until a real PDF is uploaded (or Supabase isn't configured at all, e.g.
 * local dev), `getChapter12PdfUrl()` returns `{ available: false }` and
 * callers fall back to the inline text chapter in `src/content/chapter-12.ts`
 * — the chapter is never unreadable, just not yet in its final PDF form.
 */

const BUCKET = process.env.CHAPTER12_STORAGE_BUCKET || "chapter12-private";
const OBJECT_PATH = process.env.CHAPTER12_STORAGE_PATH || "chapter-12.pdf";
const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes — short-lived by design

export interface Chapter12PdfResult {
  /** True only when a real signed URL to an uploaded PDF was generated. */
  available: boolean;
  /** True when this result came from the dev mock (Supabase not configured). */
  mocked: boolean;
  url?: string;
}

export async function getChapter12PdfUrl(): Promise<Chapter12PdfResult> {
  if (!isSupabaseConfigured()) {
    return { available: false, mocked: true };
  }

  const client = getSupabaseAdmin()!;
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(OBJECT_PATH, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    // Most likely cause: the bucket/object don't exist yet because the
    // founder hasn't uploaded the approved PDF. Not a hard error — the
    // page falls back to the text chapter.
    return { available: false, mocked: false };
  }

  return { available: true, mocked: false, url: data.signedUrl };
}
