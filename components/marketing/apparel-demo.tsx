"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GarmentView = "front" | "right" | "back" | "left";
const VIEWS: GarmentView[] = ["front", "right", "back", "left"];
const VIEW_LABEL: Record<GarmentView, string> = {
  front: "Front",
  right: "Right Side",
  back: "Back",
  left: "Left Side",
};

type PrintZone = "front-print" | "back-print" | "left-chest" | "sleeve";
const ZONE_LABEL: Record<PrintZone, string> = {
  "front-print": "Front print",
  "back-print": "Back print",
  "left-chest": "Left chest",
  sleeve: "Sleeve",
};
const ZONES_BY_VIEW: Record<GarmentView, PrintZone[]> = {
  front: ["front-print", "left-chest", "sleeve"],
  back: ["back-print"],
  left: [],
  right: [],
};

const COLORS = [
  { name: "Black", hex: "#18181b" },
  { name: "White", hex: "#fafafa" },
  { name: "Charcoal", hex: "#3f3f46" },
  { name: "Warm Gray", hex: "#78716c" },
  { name: "Navy", hex: "#1e2a4a" },
];

const FRONT_BACK_PATH =
  "M100,20 L70,20 L20,55 L45,95 L75,65 L75,260 L165,260 L165,65 L195,95 L220,55 L170,20 L140,20 L120,35 Z";
const SIDE_PATH = "M95,20 L140,20 L158,48 L146,72 L146,260 L95,260 Z";

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.5;

export function ApparelDemo() {
  const [viewIndex, setViewIndex] = useState(0);
  const [color, setColor] = useState(COLORS[0]);
  const [zoom, setZoom] = useState(1);
  const [activeZones, setActiveZones] = useState<Set<PrintZone>>(new Set());
  const touchStartX = useRef<number | null>(null);

  const view = VIEWS[viewIndex];
  const isSideView = view === "left" || view === "right";
  const availableZones = ZONES_BY_VIEW[view];

  function rotate(direction: 1 | -1) {
    setViewIndex((prev) => (prev + direction + VIEWS.length) % VIEWS.length);
  }

  function toggleZone(zone: PrintZone) {
    setActiveZones((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  }

  function reset() {
    setViewIndex(0);
    setColor(COLORS[0]);
    setZoom(1);
    setActiveZones(new Set());
  }

  function handleTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    if (Math.abs(delta) > 40) rotate(delta < 0 ? 1 : -1);
    touchStartX.current = null;
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Interactive product preview</p>
        <span className="text-xs text-ink-subtle">
          Illustrative preview &mdash; not photorealistic manufacturing output
        </span>
      </div>

      <div
        className="relative flex h-72 items-center justify-center overflow-hidden rounded-lg bg-surface-muted touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
        >
          <svg
            viewBox="0 0 240 280"
            width="180"
            height="210"
            role="img"
            aria-label={`Garment preview, ${VIEW_LABEL[view]} view, ${color.name} color`}
          >
            <path
              d={isSideView ? SIDE_PATH : FRONT_BACK_PATH}
              fill={color.hex}
              stroke="var(--border-strong)"
              strokeWidth={2}
            />
            {availableZones.includes("front-print") && activeZones.has("front-print") && (
              <rect x={95} y={110} width={50} height={60} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" />
            )}
            {availableZones.includes("back-print") && activeZones.has("back-print") && (
              <rect x={95} y={110} width={50} height={60} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" />
            )}
            {availableZones.includes("left-chest") && activeZones.has("left-chest") && (
              <rect x={92} y={82} width={20} height={20} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" />
            )}
            {availableZones.includes("sleeve") && activeZones.has("sleeve") && (
              <rect x={178} y={72} width={22} height={28} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" />
            )}
          </svg>
        </div>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-surface px-3 py-1 text-xs font-medium text-ink-muted shadow-sm">
          {VIEW_LABEL[view]}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => rotate(-1)}>
            ← Rotate
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => rotate(1)}>
            Rotate →
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)))}
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)))}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Reset preview" onClick={reset}>
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-muted">Color:</span>
        {COLORS.map((c) => (
          <button
            key={c.name}
            type="button"
            aria-label={`${c.name} garment color`}
            aria-pressed={color.name === c.name}
            onClick={() => setColor(c)}
            className={cn(
              "size-6 rounded-full border-2 transition-shadow",
              color.name === c.name ? "border-accent" : "border-border-strong",
            )}
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-muted">Design placement:</span>
        {(["front-print", "back-print", "left-chest", "sleeve"] as PrintZone[]).map((zone) => {
          const disabled = !availableZones.includes(zone);
          return (
            <button
              key={zone}
              type="button"
              disabled={disabled}
              aria-pressed={activeZones.has(zone)}
              onClick={() => toggleZone(zone)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                disabled
                  ? "cursor-not-allowed border-border text-ink-subtle opacity-50"
                  : activeZones.has(zone)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border-strong text-ink-muted hover:text-ink",
              )}
            >
              {ZONE_LABEL[zone]}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex justify-end">
        <Button asChild size="sm">
          <Link href="/design-studio">Open the Design Studio</Link>
        </Button>
      </div>
    </div>
  );
}
