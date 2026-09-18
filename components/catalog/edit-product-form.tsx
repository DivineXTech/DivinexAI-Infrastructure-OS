"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateProductAction } from "@/app/app/products/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProductRow } from "@/lib/catalog/data-access";

export function EditProductForm({ product }: { product: ProductRow }) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [shortDescription, setShortDescription] = useState(product.shortDescription ?? "");
  const [fullDescription, setFullDescription] = useState(product.fullDescription ?? "");
  const [seoTitle, setSeoTitle] = useState(product.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(product.seoDescription ?? "");
  const [tags, setTags] = useState(product.tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setBusy(true);
    setSaved(false);
    await updateProductAction(product.id, {
      name,
      shortDescription,
      fullDescription,
      seoTitle,
      seoDescription,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setBusy(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-name">Product name</Label>
        <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-short">Short description</Label>
        <Textarea id="edit-short" rows={2} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-full">Full description</Label>
        <Textarea id="edit-full" rows={4} value={fullDescription} onChange={(e) => setFullDescription(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-seo-title">SEO title</Label>
        <Input id="edit-seo-title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-seo-description">SEO description</Label>
        <Textarea id="edit-seo-description" rows={2} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
        <Input id="edit-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      {saved ? <p className="text-sm text-success">Saved.</p> : null}
      <Button type="button" disabled={busy} onClick={handleSave} className="self-start">
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
