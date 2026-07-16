/**
 * Pure print-quality warning generator. Never claims the browser preview
 * guarantees manufacturing output — every warning is phrased as
 * "potential issue" plus "manual production review recommended," per
 * section 8. Deliberately conservative: absent data (no known dimensions)
 * is itself a warning rather than being silently skipped.
 */

const MIN_RECOMMENDED_DPI = 150;

export type ArtworkQualityInput = {
  widthPx: number | null;
  heightPx: number | null;
  hasTransparency: boolean | null;
  mimeType: "image/png" | "image/jpeg" | "image/svg+xml" | "image/webp";
  placementWidthInches: number;
  placementHeightInches: number;
  productionMethod: string | null;
  /** True if the source was raster and has been enlarged beyond its
   * native pixel dimensions to fill the requested placement size. */
  isEnlargedBeyondNative?: boolean;
};

export type ArtworkQualityResult = {
  warnings: string[];
  hasIssues: boolean;
  estimatedDpi: number | null;
};

const TRANSPARENCY_SENSITIVE_METHODS = new Set(["dtf", "screen_printing", "heat_transfer_vinyl", "embroidery"]);

export function estimateDpi(widthPx: number, placementWidthInches: number): number | null {
  if (placementWidthInches <= 0) return null;
  return Math.round(widthPx / placementWidthInches);
}

export function evaluateArtworkQuality(input: ArtworkQualityInput): ArtworkQualityResult {
  const warnings: string[] = [];

  if (input.widthPx === null || input.heightPx === null) {
    warnings.push("Missing source artwork dimensions — manual production review recommended.");
    return { warnings, hasIssues: true, estimatedDpi: null };
  }

  const estimatedDpi = estimateDpi(input.widthPx, input.placementWidthInches);

  if (estimatedDpi !== null && estimatedDpi < MIN_RECOMMENDED_DPI) {
    warnings.push(
      `Potential print-quality issue: estimated resolution is about ${estimatedDpi} DPI at this print size, below the ${MIN_RECOMMENDED_DPI} DPI generally recommended. Manual production review recommended.`,
    );
  }

  if (input.isEnlargedBeyondNative) {
    warnings.push(
      "Potential print-quality issue: artwork has been enlarged beyond its native resolution. Manual production review recommended.",
    );
  }

  if (
    input.hasTransparency === false &&
    input.productionMethod &&
    TRANSPARENCY_SENSITIVE_METHODS.has(input.productionMethod)
  ) {
    warnings.push(
      `Potential print-quality issue: this artwork has no transparent background, which ${input.productionMethod.replace(/_/g, " ")} placements typically require for a clean result. Manual production review recommended.`,
    );
  }

  if (input.mimeType === "image/jpeg" && input.productionMethod === "screen_printing") {
    warnings.push(
      "Potential print-quality issue: screen printing typically requires vector or spot-color-separated artwork; a JPEG photo may not separate cleanly. Manual production review recommended.",
    );
  }

  if (input.placementWidthInches <= 0 || input.placementHeightInches <= 0) {
    warnings.push("Unsupported placement size — manual production review recommended.");
  }

  return { warnings, hasIssues: warnings.length > 0, estimatedDpi };
}
