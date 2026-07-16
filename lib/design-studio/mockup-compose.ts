import { fontCssFamily } from "@/lib/design-studio/fonts";
import type { DesignElement, GarmentView } from "@/lib/design-studio/project-schema";

/**
 * Pure SVG-string composition for one mockup view: a garment background
 * (either the template's own sanitized SVG markup, or a plain silhouette
 * placeholder when none exists) plus every visible element for that view,
 * positioned via the same 0-100 percentage coordinate space print zones
 * use. The caller rasterizes this to a PNG in the browser (see
 * components/design-studio/mockup-generate-button.tsx) — there is no
 * server-side image renderer in this phase, so this composition step is
 * the "honest browser export flow" section 10 allows for when one isn't
 * available. See docs/DESIGN_STUDIO.md "Mockup limitations."
 */

const CANVAS_SIZE = 800;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function composeMockupSvg(input: {
  view: GarmentView;
  garmentSvgMarkup: string | null;
  colorHex: string | null;
  elements: DesignElement[];
  watermarkText?: string | null;
}): string {
  const background = input.garmentSvgMarkup
    ? `<g color="${input.colorHex ?? "#e5e5e5"}">${input.garmentSvgMarkup}</g>`
    : `<rect x="5%" y="5%" width="90%" height="90%" rx="24" fill="${input.colorHex ?? "#e5e5e5"}" />`;

  const elementMarkup = input.elements
    .filter((el) => el.placement.garmentView === input.view && !el.hidden)
    .map((el) => {
      const x = (el.placement.x / 100) * CANVAS_SIZE;
      const y = (el.placement.y / 100) * CANVAS_SIZE;
      const width = (el.placement.width / 100) * CANVAS_SIZE;
      const height = (el.placement.height / 100) * CANVAS_SIZE;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const transform = `rotate(${el.placement.rotation} ${centerX} ${centerY})`;

      if (el.elementType === "text") {
        const fontSize = el.fontSize ?? 24;
        return `<text x="${centerX}" y="${centerY}" transform="${transform}" font-family="${escapeXml(fontCssFamily(el.fontKey))}" font-size="${fontSize}" fill="${el.textColor ?? "#111111"}" text-anchor="middle" dominant-baseline="middle">${escapeXml(el.textContent ?? "")}</text>`;
      }
      // Image elements reference a signed URL resolved by the caller and
      // passed through placement metadata isn't available here (asset
      // resolution requires a server round trip) — the rasterizer
      // resolves the actual <image> href client-side before drawing.
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" transform="${transform}" fill="none" stroke="#999" stroke-dasharray="4 2" data-design-asset-id="${el.designAssetId ?? ""}" />`;
    })
    .join("\n");

  const watermark = input.watermarkText
    ? `<text x="50%" y="97%" font-size="14" fill="#00000055" text-anchor="middle">${escapeXml(input.watermarkText)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">${background}${elementMarkup}${watermark}</svg>`;
}
