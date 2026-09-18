"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DesignElement } from "@/lib/design-studio/project-schema";
import { cn } from "@/lib/utils";

/**
 * Layer reordering via explicit "move up"/"move down" buttons rather than
 * drag-to-reorder — another instance of section 21's "essential actions
 * must not depend solely on drag-and-drop."
 */
export function LayerList({
  elements,
  selectedElementId,
  onSelect,
  onReorder,
}: {
  elements: DesignElement[];
  selectedElementId: string | null;
  onSelect: (id: string) => void;
  onReorder: (id: string, zIndex: number) => void;
}) {
  const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);

  function moveUp(index: number) {
    if (index === 0) return;
    const above = sorted[index - 1];
    const current = sorted[index];
    onReorder(current.id, above.zIndex + 1);
  }

  function moveDown(index: number) {
    if (index === sorted.length - 1) return;
    const below = sorted[index + 1];
    const current = sorted[index];
    onReorder(current.id, below.zIndex - 1);
  }

  if (elements.length === 0) {
    return <p className="text-sm text-ink-subtle">No elements yet — add text or artwork to get started.</p>;
  }

  return (
    <ul className="flex flex-col gap-1" aria-label="Layers, front to back">
      {sorted.map((element, index) => (
        <li key={element.id}>
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm",
              element.id === selectedElementId ? "border-accent bg-surface-muted" : "border-transparent",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(element.id)}
              className="flex-1 truncate text-left"
              aria-current={element.id === selectedElementId ? "true" : undefined}
            >
              {element.elementType === "text" ? element.textContent || "Text" : "Image"}
            </button>
            {element.locked ? <Badge variant="outline">Locked</Badge> : null}
            {element.hidden ? <Badge variant="outline">Hidden</Badge> : null}
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Move layer up"
                onClick={() => moveUp(index)}
                disabled={index === 0}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Move layer down"
                onClick={() => moveDown(index)}
                disabled={index === sorted.length - 1}
              >
                ↓
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
