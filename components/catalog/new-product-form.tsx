"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createProductAction } from "@/app/app/products/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GarmentTemplateSummary } from "@/lib/catalog/data-access";

const PRODUCTION_METHODS = [
  "heat_transfer_vinyl",
  "dtf",
  "sublimation",
  "screen_printing",
  "embroidery",
  "outsourced",
  "hybrid",
] as const;

export function NewProductForm({ templates }: { templates: GarmentTemplateSummary[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [garmentTemplateId, setGarmentTemplateId] = useState("");
  const [productionMethod, setProductionMethod] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Product name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await createProductAction({
      name,
      category: category || undefined,
      garmentTemplateId: garmentTemplateId || null,
      productionMethod: productionMethod || null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/app/products/${result.data.productId}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-name">Product name</Label>
        <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-category">Category</Label>
        <Input id="product-category" value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-template">Garment template</Label>
        <select
          id="product-template"
          value={garmentTemplateId}
          onChange={(e) => setGarmentTemplateId(e.target.value)}
          className="h-10 rounded-md border border-border-strong bg-surface px-2 text-sm text-ink"
        >
          <option value="">None</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-method">Production method</Label>
        <select
          id="product-method"
          value={productionMethod}
          onChange={(e) => setProductionMethod(e.target.value)}
          className="h-10 rounded-md border border-border-strong bg-surface px-2 text-sm text-ink"
        >
          <option value="">Not set</option>
          {PRODUCTION_METHODS.map((m) => (
            <option key={m} value={m}>
              {m.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="button" disabled={busy} onClick={handleCreate} className="self-start">
        {busy ? "Creating…" : "Create product draft"}
      </Button>
    </div>
  );
}
