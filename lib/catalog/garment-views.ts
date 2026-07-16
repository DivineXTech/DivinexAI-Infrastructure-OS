import type { GarmentView } from "@/lib/design-studio/project-schema";

/** Narrows a garment_template_views row (whose view_key can be "detail")
 * down to just the four rotation views the interactive viewer cycles
 * through — "detail" views aren't part of that rotation. */
export function isRotationView<T extends { viewKey: GarmentView | "detail" }>(
  view: T,
): view is T & { viewKey: GarmentView } {
  return view.viewKey !== "detail";
}
