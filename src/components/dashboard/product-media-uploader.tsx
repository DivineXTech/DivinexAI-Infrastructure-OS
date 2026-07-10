"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { requestProductUploadUrlAction, attachProductMediaAction } from "@/modules/products/actions";

export function ProductMediaUploader({ productId }: { productId: string }) {
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
          kind: "media",
        });

        const supabase = createSupabaseBrowserClient();
        const { error: uploadError } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);

        await attachProductMediaAction({
          productId,
          storagePath: path,
          publicUrl: publicUrlData.publicUrl,
          mediaType: "cover",
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
        <span className="sr-only">Upload cover image</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
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
    </div>
  );
}
