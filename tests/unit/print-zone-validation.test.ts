import { describe, expect, it } from "vitest";

import {
  isProductionMethodSupported,
  isWithinSafeBoundary,
  isWithinZoneBounds,
  printZoneBoundaryWarnings,
  safeBoundaryRect,
  type PrintZoneBounds,
} from "@/lib/catalog/print-zone-validation";

const zone: PrintZoneBounds = { x: 30, y: 25, width: 40, height: 45, safeWidth: 34, safeHeight: 39 };

describe("safeBoundaryRect", () => {
  it("centers the safe area within the zone", () => {
    const safe = safeBoundaryRect(zone);
    expect(safe.x).toBeCloseTo(33);
    expect(safe.y).toBeCloseTo(28);
    expect(safe.width).toBe(34);
    expect(safe.height).toBe(39);
  });

  it("falls back to the full zone when no safe area is configured", () => {
    const noSafeArea: PrintZoneBounds = { x: 10, y: 10, width: 20, height: 20 };
    const safe = safeBoundaryRect(noSafeArea);
    expect(safe).toEqual({ x: 10, y: 10, width: 20, height: 20 });
  });
});

describe("isWithinSafeBoundary / isWithinZoneBounds", () => {
  it("accepts an element fully within the safe area", () => {
    const element = { x: 35, y: 30, width: 30, height: 30 };
    expect(isWithinSafeBoundary(zone, element)).toBe(true);
    expect(isWithinZoneBounds(zone, element)).toBe(true);
  });

  it("rejects (safe) but accepts (zone) an element within the zone but outside the safe area", () => {
    const element = { x: 31, y: 26, width: 38, height: 43 };
    expect(isWithinZoneBounds(zone, element)).toBe(true);
    expect(isWithinSafeBoundary(zone, element)).toBe(false);
  });

  it("rejects an element extending outside the zone entirely", () => {
    const element = { x: 60, y: 60, width: 30, height: 30 };
    expect(isWithinZoneBounds(zone, element)).toBe(false);
    expect(isWithinSafeBoundary(zone, element)).toBe(false);
  });
});

describe("printZoneBoundaryWarnings", () => {
  it("is empty for a fully safe placement", () => {
    expect(printZoneBoundaryWarnings(zone, { x: 35, y: 30, width: 30, height: 30 })).toEqual([]);
  });

  it("warns about the safe boundary when within the zone but outside safe area", () => {
    const warnings = printZoneBoundaryWarnings(zone, { x: 31, y: 26, width: 38, height: 43 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/safe-print boundary/i);
  });

  it("warns about the zone entirely when the element extends outside it", () => {
    const warnings = printZoneBoundaryWarnings(zone, { x: 90, y: 90, width: 30, height: 30 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/print zone entirely/i);
  });
});

describe("isProductionMethodSupported", () => {
  it("supports every method when the zone has no restriction configured", () => {
    expect(isProductionMethodSupported([], "embroidery")).toBe(true);
  });

  it("supports a listed method", () => {
    expect(isProductionMethodSupported(["dtf", "screen_printing"], "dtf")).toBe(true);
  });

  it("rejects an unlisted method", () => {
    expect(isProductionMethodSupported(["dtf", "screen_printing"], "embroidery")).toBe(false);
  });

  it("treats a null production method as supported (nothing selected yet)", () => {
    expect(isProductionMethodSupported(["dtf"], null)).toBe(true);
  });
});
