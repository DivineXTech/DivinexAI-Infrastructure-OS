"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { APPROVED_FONTS } from "@/lib/design-studio/fonts";
import { printZoneBoundaryWarnings, type PrintZoneBounds } from "@/lib/catalog/print-zone-validation";
import type { DesignElement } from "@/lib/design-studio/project-schema";

/**
 * The accessible, always-available alternative to dragging: every
 * position/size/rotation value an element has is also a plain numeric
 * input here. Section 21 requires this explicitly — essential editor
 * actions must not depend solely on drag-and-drop.
 */
export function ElementInspector({
  element,
  activeZone,
  onUpdate,
  onUpdatePlacement,
  onDuplicate,
  onDelete,
}: {
  element: DesignElement | null;
  activeZone: PrintZoneBounds | null;
  onUpdate: (patch: Partial<Omit<DesignElement, "id" | "placement">>) => void;
  onUpdatePlacement: (patch: Partial<DesignElement["placement"]>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  if (!element) {
    return <p className="text-sm text-ink-subtle">Select an element to edit its properties.</p>;
  }

  const warnings = activeZone ? printZoneBoundaryWarnings(activeZone, element.placement) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="el-x">X position (%)</Label>
          <Input
            id="el-x"
            type="number"
            value={element.placement.x}
            onChange={(e) => onUpdatePlacement({ x: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="el-y">Y position (%)</Label>
          <Input
            id="el-y"
            type="number"
            value={element.placement.y}
            onChange={(e) => onUpdatePlacement({ y: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="el-width">Width (%)</Label>
          <Input
            id="el-width"
            type="number"
            min={1}
            value={element.placement.width}
            onChange={(e) => onUpdatePlacement({ width: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="el-height">Height (%)</Label>
          <Input
            id="el-height"
            type="number"
            min={1}
            value={element.placement.height}
            onChange={(e) => onUpdatePlacement({ height: Number(e.target.value) })}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <Label htmlFor="el-rotation">Rotation (degrees)</Label>
          <Input
            id="el-rotation"
            type="number"
            step={1}
            value={element.placement.rotation}
            onChange={(e) => onUpdatePlacement({ rotation: Number(e.target.value) })}
          />
        </div>
      </div>

      {warnings.length > 0 ? (
        <div role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}

      {element.elementType === "text" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="el-text">Text content</Label>
            <Textarea
              id="el-text"
              rows={2}
              value={element.textContent ?? ""}
              onChange={(e) => onUpdate({ textContent: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="el-font">Font</Label>
              <select
                id="el-font"
                value={element.fontKey ?? APPROVED_FONTS[0].key}
                onChange={(e) => onUpdate({ fontKey: e.target.value })}
                className="h-10 rounded-md border border-border-strong bg-surface px-2 text-sm text-ink"
              >
                {APPROVED_FONTS.map((font) => (
                  <option key={font.key} value={font.key}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="el-font-size">Font size (px)</Label>
              <Input
                id="el-font-size"
                type="number"
                min={1}
                value={element.fontSize ?? 24}
                onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="el-color">Text color</Label>
              <Input
                id="el-color"
                type="text"
                value={element.textColor ?? "#111111"}
                onChange={(e) => onUpdate({ textColor: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="el-align">Alignment</Label>
              <select
                id="el-align"
                value={element.textAlign ?? "center"}
                onChange={(e) => onUpdate({ textAlign: e.target.value as "left" | "center" | "right" })}
                className="h-10 rounded-md border border-border-strong bg-surface px-2 text-sm text-ink"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Image element — replace or remove it from the layer list.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onUpdate({ locked: !element.locked })}>
          {element.locked ? "Unlock" : "Lock"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onUpdate({ hidden: !element.hidden })}>
          {element.hidden ? "Show" : "Hide"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDuplicate}>
          Duplicate
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
