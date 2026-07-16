"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { convertDesignToProductAction } from "@/app/app/design-studio/convert-actions";
import { Button } from "@/components/ui/button";

export function ConvertToProductButton({ designProjectId }: { designProjectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert() {
    setBusy(true);
    setError(null);
    const result = await convertDesignToProductAction(designProjectId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/app/products/${result.productId}`);
  }

  return (
    <div className="flex flex-col gap-1">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="button" size="sm" disabled={busy} onClick={handleConvert}>
        {busy ? "Converting…" : "Create product draft"}
      </Button>
    </div>
  );
}
