import { describe, expect, it } from "vitest";

import { estimateDpi, evaluateArtworkQuality, type ArtworkQualityInput } from "@/lib/catalog/artwork-quality";

function baseInput(overrides: Partial<ArtworkQualityInput> = {}): ArtworkQualityInput {
  return {
    widthPx: 1200,
    heightPx: 1200,
    hasTransparency: true,
    mimeType: "image/png",
    placementWidthInches: 4,
    placementHeightInches: 4,
    productionMethod: "dtf",
    ...overrides,
  };
}

describe("estimateDpi", () => {
  it("divides pixel width by placement width in inches", () => {
    expect(estimateDpi(1200, 4)).toBe(300);
  });

  it("returns null for a non-positive placement width", () => {
    expect(estimateDpi(1200, 0)).toBeNull();
  });
});

describe("evaluateArtworkQuality", () => {
  it("has no warnings for high-resolution artwork with transparency for a transparency-sensitive method", () => {
    const result = evaluateArtworkQuality(baseInput());
    expect(result.hasIssues).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(result.estimatedDpi).toBe(300);
  });

  it("warns and never guesses dimensions when source dimensions are missing", () => {
    const result = evaluateArtworkQuality(baseInput({ widthPx: null, heightPx: null }));
    expect(result.hasIssues).toBe(true);
    expect(result.estimatedDpi).toBeNull();
    expect(result.warnings[0]).toMatch(/missing source artwork dimensions/i);
  });

  it("warns about low estimated DPI at the requested print size", () => {
    const result = evaluateArtworkQuality(baseInput({ widthPx: 300, heightPx: 300, placementWidthInches: 6 }));
    expect(result.hasIssues).toBe(true);
    expect(result.warnings.some((w) => /potential print-quality issue/i.test(w) && /DPI/.test(w))).toBe(true);
  });

  it("warns when artwork lacks transparency for a transparency-sensitive production method", () => {
    const result = evaluateArtworkQuality(baseInput({ hasTransparency: false, productionMethod: "screen_printing" }));
    expect(result.warnings.some((w) => /no transparent background/i.test(w))).toBe(true);
  });

  it("does not warn about transparency for a method that doesn't need it", () => {
    const result = evaluateArtworkQuality(baseInput({ hasTransparency: false, productionMethod: "sublimation" }));
    expect(result.warnings.some((w) => /transparent background/i.test(w))).toBe(false);
  });

  it("warns about JPEG artwork for screen printing specifically", () => {
    const result = evaluateArtworkQuality(
      baseInput({ mimeType: "image/jpeg", hasTransparency: false, productionMethod: "screen_printing" }),
    );
    expect(result.warnings.some((w) => /JPEG photo may not separate cleanly/i.test(w))).toBe(true);
  });

  it("warns when artwork has been enlarged beyond its native resolution", () => {
    const result = evaluateArtworkQuality(baseInput({ isEnlargedBeyondNative: true }));
    expect(result.warnings.some((w) => /enlarged beyond its native resolution/i.test(w))).toBe(true);
  });

  it("warns about an unsupported (non-positive) placement size", () => {
    const result = evaluateArtworkQuality(baseInput({ placementWidthInches: 0 }));
    expect(result.warnings.some((w) => /unsupported placement size/i.test(w))).toBe(true);
  });

  it("never claims to guarantee manufacturing output — every warning recommends manual review", () => {
    const result = evaluateArtworkQuality(baseInput({ widthPx: 100, heightPx: 100, placementWidthInches: 6 }));
    for (const warning of result.warnings) {
      expect(warning).toMatch(/manual production review recommended/i);
    }
  });
});
