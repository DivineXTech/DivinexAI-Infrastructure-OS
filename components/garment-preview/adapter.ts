/**
 * The garment-preview rendering contract. `GarmentViewer` (garment-viewer.tsx)
 * owns all interaction state (active view, zoom, pan, fullscreen) and
 * delegates only the "draw this view at this color" question to whatever
 * adapter is passed in — swapping `Layered2dAdapter` for a future WebGL/
 * Three.js adapter means implementing this one interface, not touching
 * the viewer's interaction logic. See docs/GARMENT_TEMPLATES.md
 * "Garment-view adapter."
 *
 * This phase's implementation (Layered2dAdapter) renders inline SVG or a
 * flat image per view — an interactive garment preview, not a 3D model.
 * Nothing in this codebase should describe it as photorealistic 3D
 * rendering.
 */
import type { ComponentType } from "react";

import type { GarmentView } from "@/lib/design-studio/project-schema";

export type { GarmentView };

export type GarmentViewAsset = {
  viewKey: GarmentView;
  imagePath: string | null;
  svgMarkup: string | null;
};

export type GarmentPreviewAdapterProps = {
  view: GarmentViewAsset | null;
  colorHex: string | null;
};

export type GarmentPreviewAdapter = ComponentType<GarmentPreviewAdapterProps>;
