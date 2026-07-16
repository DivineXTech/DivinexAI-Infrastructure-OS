"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { generateVariantsAction } from "@/app/app/products/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function VariantMatrixGenerator({ productId, skuPrefix }: { productId: string; skuPrefix: string }) {
  const router = useRouter();
  const [sizes, setSizes] = useState("");
  const [colors, setColors] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await generateVariantsAction(
      productId,
      { sizes: parseList(sizes), colors: parseList(colors) },
      skuPrefix.toUpperCase(),
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(`Created ${result.data.createdCount} new variant(s).`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="matrix-sizes">Sizes (comma-separated)</Label>
          <Input id="matrix-sizes" placeholder="S, M, L, XL" value={sizes} onChange={(e) => setSizes(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="matrix-colors">Colors (comma-separated)</Label>
          <Input id="matrix-colors" placeholder="Black, White" value={colors} onChange={(e) => setColors(e.target.value)} />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}
      <Button type="button" disabled={busy} onClick={handleGenerate} className="self-start">
        {busy ? "Generating…" : "Generate variants"}
      </Button>
    </div>
  );
}
