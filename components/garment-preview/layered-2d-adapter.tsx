"use client";

import { sanitizeSvgMarkup } from "@/lib/catalog/svg-sanitizer";
import type { GarmentPreviewAdapterProps } from "@/components/garment-preview/adapter";

/**
 * Default garment-preview adapter: renders one flat layer per view —
 * either an uploaded image, or inline SVG using `currentColor` so the
 * selected garment color can recolor it via CSS `color`. Re-sanitized at
 * render time (not just at template-save time) since custom
 * tenant-created templates are less trusted than platform-curated ones —
 * see docs/ARTWORK_SECURITY.md.
 */
export function Layered2dAdapter({ view, colorHex }: GarmentPreviewAdapterProps) {
  const sanitizeResult = view?.svgMarkup ? sanitizeSvgMarkup(view.svgMarkup) : null;
  const safeMarkup = sanitizeResult?.safe ? sanitizeResult.sanitized : null;

  if (!view) {
    return (
      <div className="flex size-full items-center justify-center text-sm text-ink-subtle">
        No preview available for this view yet.
      </div>
    );
  }

  if (safeMarkup) {
    return (
      <div
        role="img"
        aria-label={`Garment ${view.viewKey} view`}
        style={{ color: colorHex ?? undefined }}
        className="flex size-full items-center justify-center [&_svg]:size-full"
        dangerouslySetInnerHTML={{ __html: safeMarkup }}
      />
    );
  }

  if (view.imagePath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={view.imagePath}
        alt={`Garment ${view.viewKey} view`}
        className="size-full object-contain"
      />
    );
  }

  return (
    <div className="flex size-full items-center justify-center text-sm text-ink-subtle">
      No preview available for this view yet.
    </div>
  );
}
