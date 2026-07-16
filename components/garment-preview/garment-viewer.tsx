"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Layered2dAdapter } from "@/components/garment-preview/layered-2d-adapter";
import type { GarmentPreviewAdapter, GarmentView, GarmentViewAsset } from "@/components/garment-preview/adapter";
import { cn } from "@/lib/utils";

const VIEW_ORDER: GarmentView[] = ["front", "right", "back", "left"];
const VIEW_LABELS: Record<GarmentView, string> = {
  front: "Front",
  back: "Back",
  left: "Left side",
  right: "Right side",
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

export type GarmentViewerProps = {
  views: GarmentViewAsset[];
  colors: { name: string; hexValue: string }[];
  /** Swap this for a future WebGL/Three.js adapter without touching any
   * of the interaction logic below. */
  adapter?: GarmentPreviewAdapter;
  onViewChange?: (view: GarmentView) => void;
  onColorChange?: (colorName: string) => void;
};

/**
 * Interactive garment preview: front/back/left/right selection with a
 * simulated rotation transition between them, color switching, zoom, pan,
 * reset, fullscreen, touch swipe, and full keyboard support. This is a
 * 2D interactive preview, not a 3D render — see
 * docs/GARMENT_TEMPLATES.md "What this is not."
 */
export function GarmentViewer({ views, colors, adapter, onViewChange, onColorChange }: GarmentViewerProps) {
  const Adapter = adapter ?? Layered2dAdapter;
  const [activeView, setActiveView] = useState<GarmentView>("front");
  const [colorName, setColorName] = useState<string | null>(colors[0]?.name ?? null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const dragState = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const currentView = views.find((v) => v.viewKey === activeView) ?? null;
  const currentColor = colors.find((c) => c.name === colorName) ?? null;

  function changeView(view: GarmentView) {
    setActiveView(view);
    onViewChange?.(view);
  }

  function rotate(direction: 1 | -1) {
    const index = VIEW_ORDER.indexOf(activeView);
    const nextIndex = (index + direction + VIEW_ORDER.length) % VIEW_ORDER.length;
    changeView(VIEW_ORDER[nextIndex]);
  }

  function handleColorSelect(name: string) {
    setColorName(name);
    onColorChange?.(name);
  }

  function zoomIn() {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }
  function zoomOut() {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }
  function reset() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  async function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowRight":
        rotate(1);
        event.preventDefault();
        break;
      case "ArrowLeft":
        rotate(-1);
        event.preventDefault();
        break;
      case "+":
      case "=":
        zoomIn();
        event.preventDefault();
        break;
      case "-":
        zoomOut();
        event.preventDefault();
        break;
      case "0":
        reset();
        event.preventDefault();
        break;
    }
  }

  function handleTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }
  function handleTouchEnd(event: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      rotate(delta < 0 ? 1 : -1);
    }
    touchStartX.current = null;
  }

  function handlePointerDown(event: React.PointerEvent) {
    if (zoom <= 1) return;
    dragState.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
  }
  function handlePointerMove(event: React.PointerEvent) {
    if (!dragState.current) return;
    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;
    setPan({ x: dragState.current.panX + dx, y: dragState.current.panY + dy });
  }
  function handlePointerUp() {
    dragState.current = null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        role="group"
        aria-label={`Garment preview, currently showing the ${VIEW_LABELS[activeView].toLowerCase()} view`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={cn(
          "relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-muted outline-none focus-visible:ring-2 focus-visible:ring-accent",
          isFullscreen && "aspect-auto h-screen w-screen bg-background",
        )}
      >
        <div
          className="motion-safe:transition-transform motion-safe:duration-300"
          style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)` }}
        >
          <div className="size-64">
            <Adapter view={currentView} colorHex={currentColor?.hexValue ?? null} />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute right-2 top-2"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen preview" : "View fullscreen"}
        >
          {isFullscreen ? "⤓" : "⤢"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Garment view" className="flex gap-2">
          {VIEW_ORDER.map((view) => (
            <Button
              key={view}
              type="button"
              variant={view === activeView ? "default" : "outline"}
              size="sm"
              role="radio"
              aria-checked={view === activeView}
              onClick={() => changeView(view)}
            >
              {VIEW_LABELS[view]}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={zoomOut} aria-label="Zoom out">
            −
          </Button>
          <span className="text-sm text-ink-muted" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <Button type="button" variant="outline" size="sm" onClick={zoomIn} aria-label="Zoom in">
            +
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      {colors.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink">Color</legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => handleColorSelect(color.name)}
                aria-pressed={color.name === colorName}
                aria-label={color.name}
                title={color.name}
                className={cn(
                  "size-8 rounded-full border-2",
                  color.name === colorName ? "border-accent" : "border-border-strong",
                )}
                style={{ backgroundColor: color.hexValue }}
              />
            ))}
          </div>
          {currentColor ? <p className="text-xs text-ink-subtle">{currentColor.name}</p> : null}
        </fieldset>
      ) : null}

      <p className="text-xs text-ink-subtle">
        Interactive garment preview — an illustrative 2D representation, not a photorealistic 3D render. Use
        arrow keys to rotate, +/− to zoom, 0 to reset, or swipe on touch devices.
      </p>
    </div>
  );
}
