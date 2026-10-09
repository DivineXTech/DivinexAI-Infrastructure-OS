import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.doUnmock("@/lib/env");
  vi.doUnmock("@/lib/supabase/admin");
});

describe("chapter12-storage", () => {
  it("returns a mocked unavailable result when Supabase isn't configured", async () => {
    vi.doMock("@/lib/env", () => ({ isSupabaseConfigured: () => false }));
    const { getChapter12PdfUrl } = await import("@/lib/storage/chapter12-storage");
    const result = await getChapter12PdfUrl();
    expect(result).toEqual({ available: false, mocked: true });
  });

  it("returns a signed URL when a real PDF exists in storage", async () => {
    vi.doMock("@/lib/env", () => ({ isSupabaseConfigured: () => true }));
    vi.doMock("@/lib/supabase/admin", () => ({
      getSupabaseAdmin: () => ({
        storage: {
          from: () => ({
            createSignedUrl: async () => ({
              data: { signedUrl: "https://example.supabase.co/signed/chapter-12.pdf?token=abc" },
              error: null,
            }),
          }),
        },
      }),
    }));
    const { getChapter12PdfUrl } = await import("@/lib/storage/chapter12-storage");
    const result = await getChapter12PdfUrl();
    expect(result.available).toBe(true);
    expect(result.mocked).toBe(false);
    expect(result.url).toContain("signed/chapter-12.pdf");
  });

  it("falls back to unavailable (not an error) when the PDF hasn't been uploaded yet", async () => {
    vi.doMock("@/lib/env", () => ({ isSupabaseConfigured: () => true }));
    vi.doMock("@/lib/supabase/admin", () => ({
      getSupabaseAdmin: () => ({
        storage: {
          from: () => ({
            createSignedUrl: async () => ({
              data: null,
              error: { message: "Object not found" },
            }),
          }),
        },
      }),
    }));
    const { getChapter12PdfUrl } = await import("@/lib/storage/chapter12-storage");
    const result = await getChapter12PdfUrl();
    expect(result.available).toBe(false);
    expect(result.mocked).toBe(false);
  });
});
