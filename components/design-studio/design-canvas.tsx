"use client";

import { useRef } from "react";

import { Layered2dAdapter } from "@/components/garment-preview/layered-2d-adapter";
import type { GarmentViewAsset } from "@/components/garment-preview/adapter";
import { fontCssFamily } from "@/lib/design-studio/fonts";
import type { DesignElement } from "@/lib/design-studio/project-schema";
import { cn } from "@/lib/utils";

export type PrintZoneOverlay = {
  id: string;
  zoneKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * The design canvas: garment view + print-zone outlines + element
 * overlays, positioned in the same 0-100 percentage coordinate space as
 * garment_print_zones (see docs/GARMENT_TEMPLATES.md). Pointer drag is a
 * convenience layered on top of the numeric position/size inputs in
 * ElementInspector — dragging is never the only way to move an element
 * (section 21).
 */
export function DesignCanvas({
  view,
  colorHex,
  printZones,
  elements,
  selectedElementId,
  onSelectElement,
  onMoveElement,
}: {
  view: GarmentViewAsset | null;
  colorHex: string | null;
  printZones: PrintZoneOverlay[];
  elements: DesignElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onMoveElement: (id: string, x: number, y: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  function percentFromPointer(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }

  function handlePointerDown(event: React.PointerEvent, element: DesignElement) {
    if (element.locked) {
      onSelectElement(element.id);
      return;
    }
    const point = percentFromPointer(event.clientX, event.clientY);
    dragState.current = {
      id: element.id,
      offsetX: point.x - element.placement.x,
      offsetY: point.y - element.placement.y,
    };
    onSelectElement(element.id);
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!dragState.current) return;
    const point = percentFromPointer(event.clientX, event.clientY);
    onMoveElement(dragState.current.id, point.x - dragState.current.offsetX, point.y - dragState.current.offsetY);
  }

  function handlePointerUp() {
    dragState.current = null;
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface-muted"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="absolute inset-0">
        <Layered2dAdapter view={view} colorHex={colorHex} />
      </div>

      {printZones.map((zone) => (
        <div
          key={zone.id}
          aria-hidden="true"
          className="pointer-events-none absolute border border-dashed border-accent/60"
          style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }}
        />
      ))}

      {elements.map((element) => (
        <button
          key={element.id}
          type="button"
          onPointerDown={(event) => handlePointerDown(event, element)}
          aria-label={
            element.elementType === "text"
              ? `Text element: ${element.textContent || "empty"}`
              : "Image element"
          }
          aria-pressed={element.id === selectedElementId}
          className={cn(
            "absolute flex items-center justify-center overflow-hidden border-2 bg-surface/70 text-xs leading-tight",
            element.id === selectedElementId ? "border-accent" : "border-transparent",
            element.hidden && "opacity-30",
          )}
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
            cursor: element.locked ? "not-allowed" : "grab",
          }}
        >
          {element.elementType === "text" ? element.textContent : "Image"}
        </button>
      ))}
    </div>
  );
}
