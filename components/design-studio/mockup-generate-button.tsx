"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { generateMockupAction, type MockupViewUpload } from "@/app/app/design-studio/mockup-actions";
import { Button } from "@/components/ui/button";
import { composeMockupSvg } from "@/lib/design-studio/mockup-compose";
import type { GarmentView } from "@/lib/design-studio/project-schema";
import type { DesignElement } from "@/lib/design-studio/project-schema";

const CANVAS_SIZE = 800;

async function rasterizeSvg(svgString: string): Promise<string> {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to render mockup image"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas rendering is not available in this browser.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Browser-generated mockups: composes an SVG per view (garment + text
 * elements — image elements render as a placeholder outline, not the
 * actual artwork pixels, since embedding private cross-origin storage
 * images risks tainting the canvas export; see docs/DESIGN_STUDIO.md
 * "Mockup limitations") and rasterizes it client-side via Canvas. There
 * is no server-side image renderer in this phase — this is the honest
 * browser export flow section 10 allows for that case.
 */
export function MockupGenerateButton({
  projectId,
  views,
  colorHex,
  elements,
  tenantName,
}: {
  projectId: string;
  views: { viewKey: GarmentView; svgMarkup: string | null }[];
  colorHex: string | null;
  elements: DesignElement[];
  tenantName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watermark, setWatermark] = useState(true);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      const uploads: MockupViewUpload[] = [];
      for (const view of views) {
        const viewElements = elements.filter((el) => el.placement.garmentView === view.viewKey && !el.hidden);
        if (viewElements.length === 0) continue;
        const svg = composeMockupSvg({
          view: view.viewKey,
          garmentSvgMarkup: view.svgMarkup,
          colorHex,
          elements,
          watermarkText: watermark ? `${tenantName} — digital preview` : null,
        });
        const dataUrl = await rasterizeSvg(svg);
        uploads.push({ viewKey: view.viewKey, dataUrl });
      }
      if (uploads.length === 0) {
        setError("Add at least one element to a view before generating a mockup.");
        setBusy(false);
        return;
      }
      const result = await generateMockupAction(projectId, uploads, watermark);
      setBusy(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/app/mockups/${result.mockupId}`);
    } catch {
      setBusy(false);
      setError("Could not generate a mockup in this browser. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm text-ink-muted">
        <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} className="size-4" />
        Add a watermark
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="button" disabled={busy} onClick={handleGenerate} className="self-start">
        {busy ? "Generating…" : "Generate mockup"}
      </Button>
    </div>
  );
}
