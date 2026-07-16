/**
 * Pure print-zone boundary checks. Coordinates are percentages (0-100) of
 * a garment view's image — see supabase/migrations/20260719000000_catalog.sql
 * and docs/GARMENT_TEMPLATES.md "Print-zone coordinate model" — so these
 * functions work identically regardless of the underlying image's actual
 * pixel resolution.
 */

export type PrintZoneBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Safe-print sub-area, centered within the zone. Falls back to the
   * full zone when not set (no narrower safe area defined). */
  safeWidth?: number | null;
  safeHeight?: number | null;
};

export type ElementRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** The safe-print rectangle, centered within the zone's own bounds. */
export function safeBoundaryRect(zone: PrintZoneBounds): ElementRect {
  const safeWidth = zone.safeWidth ?? zone.width;
  const safeHeight = zone.safeHeight ?? zone.height;
  return {
    x: zone.x + (zone.width - safeWidth) / 2,
    y: zone.y + (zone.height - safeHeight) / 2,
    width: safeWidth,
    height: safeHeight,
  };
}

export function isWithinSafeBoundary(zone: PrintZoneBounds, element: ElementRect): boolean {
  const safe = safeBoundaryRect(zone);
  return (
    element.x >= safe.x &&
    element.y >= safe.y &&
    element.x + element.width <= safe.x + safe.width &&
    element.y + element.height <= safe.y + safe.height
  );
}

export function isWithinZoneBounds(zone: PrintZoneBounds, element: ElementRect): boolean {
  return (
    element.x >= zone.x &&
    element.y >= zone.y &&
    element.x + element.width <= zone.x + zone.width &&
    element.y + element.height <= zone.y + zone.height
  );
}

/**
 * Returns human-readable warnings for an element's placement, worst case
 * first. Empty array means the placement is fully within the safe
 * boundary — the editor should block or clearly flag anything else, per
 * section 5's "must prevent or warn" requirement.
 */
export function printZoneBoundaryWarnings(zone: PrintZoneBounds, element: ElementRect): string[] {
  const warnings: string[] = [];
  if (!isWithinZoneBounds(zone, element)) {
    warnings.push("Element extends outside the print zone entirely.");
  } else if (!isWithinSafeBoundary(zone, element)) {
    warnings.push("Element extends outside the safe-print boundary.");
  }
  return warnings;
}

/** True if the production method is one this zone supports. Zones with an
 * empty `supportedProductionMethods` list are treated as supporting every
 * method (no restriction configured for this zone). */
export function isProductionMethodSupported(
  supportedProductionMethods: string[],
  productionMethod: string | null,
): boolean {
  if (supportedProductionMethods.length === 0) return true;
  if (!productionMethod) return true;
  return supportedProductionMethods.includes(productionMethod);
}
