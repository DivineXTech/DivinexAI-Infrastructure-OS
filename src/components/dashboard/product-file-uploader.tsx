"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { requestProductUploadUrlAction, attachProductFileAction } from "@/modules/products/actions";

export function ProductFileUploader({ productId }: { productId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    startTransition(async () => {
      try {
        const { token, path, bucket } = await requestProductUploadUrlAction({
          productId,
          fileName: file.name,
          kind: "file",
        });

        const supabase = createSupabaseBrowserClient();
        const { error: uploadError } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file);
        if (uploadError) throw uploadError;

        await attachProductFileAction({
          productId,
          storagePath: path,
          fileName: file.name,
          sizeBytes: file.size,
          contentType: file.type || undefined,
        });

        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        event.target.value = "";
      }
    });
  };

  return (
    <div>
      <label className="block">
        <span className="sr-only">Upload product file</span>
        <input
          type="file"
          onChange={handleChange}
          disabled={isPending}
          className="block w-full rounded-md border border-dashed border-border p-4 text-sm text-ink-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-strong"
        />
      </label>
      {isPending ? <p className="mt-2 text-xs text-ink-muted">Uploading…</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-ink-muted">Files are private — only buyers with a purchase can download them.</p>
    </div>
  );
}
