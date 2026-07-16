import { describe, expect, it } from "vitest";

import { composeMockupSvg } from "@/lib/design-studio/mockup-compose";
import type { DesignElement } from "@/lib/design-studio/project-schema";

function textElement(overrides: Partial<DesignElement> = {}): DesignElement {
  return {
    id: "el-1",
    elementType: "text",
    zIndex: 1,
    locked: false,
    hidden: false,
    textContent: "KUSHPRINTCO",
    fontKey: "sans",
    fontSize: 24,
    textColor: "#ffffff",
    textAlign: "center",
    designAssetId: null,
    placement: { printZoneId: null, garmentView: "front", x: 30, y: 40, width: 40, height: 15, rotation: 0 },
    ...overrides,
  };
}

describe("composeMockupSvg", () => {
  it("produces a well-formed svg root element", () => {
    const svg = composeMockupSvg({ view: "front", garmentSvgMarkup: null, colorHex: "#111111", elements: [] });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain("</svg>");
  });

  it("includes a visible text element for the active view", () => {
    const svg = composeMockupSvg({
      view: "front",
      garmentSvgMarkup: null,
      colorHex: "#111111",
      elements: [textElement()],
    });
    expect(svg).toContain("<text");
    expect(svg).toContain("KUSHPRINTCO");
  });

  it("excludes elements placed on a different view", () => {
    const svg = composeMockupSvg({
      view: "back",
      garmentSvgMarkup: null,
      colorHex: "#111111",
      elements: [textElement()],
    });
    expect(svg).not.toContain("KUSHPRINTCO");
  });

  it("excludes hidden elements", () => {
    const svg = composeMockupSvg({
      view: "front",
      garmentSvgMarkup: null,
      colorHex: "#111111",
      elements: [textElement({ hidden: true })],
    });
    expect(svg).not.toContain("KUSHPRINTCO");
  });

  it("escapes text content to prevent markup injection", () => {
    const svg = composeMockupSvg({
      view: "front",
      garmentSvgMarkup: null,
      colorHex: "#111111",
      elements: [textElement({ textContent: '<script>alert(1)</script>' })],
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("includes a watermark line only when requested", () => {
    const withWatermark = composeMockupSvg({
      view: "front",
      garmentSvgMarkup: null,
      colorHex: null,
      elements: [],
      watermarkText: "Demo Brand — digital preview",
    });
    expect(withWatermark).toContain("digital preview");

    const withoutWatermark = composeMockupSvg({
      view: "front",
      garmentSvgMarkup: null,
      colorHex: null,
      elements: [],
    });
    expect(withoutWatermark).not.toContain("digital preview");
  });

  it("embeds the provided garment SVG markup as the background layer", () => {
    const svg = composeMockupSvg({
      view: "front",
      garmentSvgMarkup: '<path d="M0 0 L10 10" />',
      colorHex: "#222222",
      elements: [],
    });
    expect(svg).toContain('<path d="M0 0 L10 10" />');
    expect(svg).toContain('color="#222222"');
  });
});
