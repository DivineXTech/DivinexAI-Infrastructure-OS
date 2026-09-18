"use client";

import { useState } from "react";

import { Layered2dAdapter } from "@/components/garment-preview/layered-2d-adapter";
import type { GarmentView, GarmentViewAsset } from "@/components/garment-preview/adapter";
import { fontCssFamily } from "@/lib/design-studio/fonts";
import type { DesignElement } from "@/lib/design-studio/project-schema";
import { cn } from "@/lib/utils";

const VIEW_ORDER: GarmentView[] = ["front", "back", "left", "right"];

/** Read-only rendering of a saved design state — used on the review/
 * preview page. No drag, no editing; just the same coordinate overlay
 * DesignCanvas uses, minus interaction. */
export function DesignPreview({
  views,
  colorHex,
  elements,
}: {
  views: GarmentViewAsset[];
  colorHex: string | null;
  elements: DesignElement[];
}) {
  const [activeView, setActiveView] = useState<GarmentView>("front");
  const currentView = views.find((v) => v.viewKey === activeView) ?? null;
  const currentElements = elements.filter((el) => el.placement.garmentView === activeView && !el.hidden);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-lg border border-border bg-surface-muted">
        <div className="absolute inset-0">
          <Layered2dAdapter view={currentView} colorHex={colorHex} />
        </div>
        {currentElements.map((element) => (
          <div
            key={element.id}
            className="absolute flex items-center justify-center overflow-hidden text-xs"
            style={{
              left: `${element.placement.x}%`,
              top: `${element.placement.y}%`,
              width: `${element.placement.width}%`,
              height: `${element.placement.height}%`,
              transform: `rotate(${element.placement.rotation}deg)`,
              color: element.textColor ?? undefined,
              fontFamily: fontCssFamily(element.fontKey),
              fontSize: element.fontSize ? `${element.fontSize}px` : undefined,
              textAlign: element.textAlign ?? undefined,
            }}
          >
            {element.elementType === "text" ? element.textContent : "Image"}
          </div>
        ))}
      </div>
      <div role="radiogroup" aria-label="Garment view" className="flex gap-2">
        {VIEW_ORDER.map((view) => (
          <button
            key={view}
            type="button"
            role="radio"
            aria-checked={view === activeView}
            onClick={() => setActiveView(view)}
            className={cn(
              "rounded-md border px-3 py-1 text-sm capitalize",
              view === activeView ? "border-accent bg-surface-muted" : "border-border-strong text-ink-muted",
            )}
          >
            {view}
          </button>
        ))}
      </div>
    </div>
  );
}
