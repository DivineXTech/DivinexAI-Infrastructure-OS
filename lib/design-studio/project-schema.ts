import { z } from "zod";

/**
 * The normalized, library-agnostic design-project state — what actually
 * gets persisted (as `design_project_versions.state` jsonb, and mirrored
 * live in `design_elements`/`design_placements`). Deliberately contains
 * only plain data: element type, transform, text/asset properties — never
 * a canvas-library object (no Fabric.js/Konva instances, no DOM nodes).
 * This is the architectural boundary that keeps KushPrintCo OS from being
 * locked into whichever rendering library the editor happens to use
 * today — see docs/DESIGN_STUDIO.md "Editor architecture".
 */

export const GARMENT_VIEWS = ["front", "back", "left", "right"] as const;
export type GarmentView = (typeof GARMENT_VIEWS)[number];

export const ELEMENT_TYPES = ["text", "image"] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

export const TEXT_ALIGNMENTS = ["left", "center", "right"] as const;

export const placementSchema = z.object({
  printZoneId: z.string().nullable(),
  garmentView: z.enum(GARMENT_VIEWS),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().default(0),
});
export type Placement = z.infer<typeof placementSchema>;

export const designElementSchema = z.object({
  id: z.string().min(1),
  elementType: z.enum(ELEMENT_TYPES),
  zIndex: z.number().int(),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  textContent: z.string().nullable().default(null),
  fontKey: z.string().nullable().default(null),
  fontSize: z.number().nullable().default(null),
  textColor: z.string().nullable().default(null),
  textAlign: z.enum(TEXT_ALIGNMENTS).nullable().default(null),
  designAssetId: z.string().nullable().default(null),
  placement: placementSchema,
});
export type DesignElement = z.infer<typeof designElementSchema>;

export const designProjectStateSchema = z.object({
  garmentTemplateId: z.string().nullable(),
  garmentColorId: z.string().nullable(),
  activeView: z.enum(GARMENT_VIEWS),
  elements: z.array(designElementSchema),
});
export type DesignProjectState = z.infer<typeof designProjectStateSchema>;

export function createEmptyProjectState(): DesignProjectState {
  return {
    garmentTemplateId: null,
    garmentColorId: null,
    activeView: "front",
    elements: [],
  };
}

/** Throws (via Zod) on anything that isn't a valid normalized state —
 * callers restoring a stored version should not silently accept
 * malformed data. */
export function parseProjectState(raw: unknown): DesignProjectState {
  return designProjectStateSchema.parse(raw);
}

export function serializeProjectState(state: DesignProjectState): string {
  return JSON.stringify(designProjectStateSchema.parse(state));
}
