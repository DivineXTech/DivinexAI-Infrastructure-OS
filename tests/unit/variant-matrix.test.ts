import { describe, expect, it } from "vitest";

import {
  combinationKey,
  findDuplicateCombinations,
  generateVariantMatrix,
  isDuplicateCombination,
} from "@/lib/catalog/variant-matrix";

describe("generateVariantMatrix", () => {
  it("produces the cartesian product of sizes and colors", () => {
    const combos = generateVariantMatrix({ sizes: ["S", "M"], colors: ["Black", "White"] });
    expect(combos).toHaveLength(4);
    expect(combos.map((c) => `${c.sizeLabel}-${c.colorName}`).sort()).toEqual(
      ["S-Black", "S-White", "M-Black", "M-White"].sort(),
    );
  });

  it("produces one variant per size when no colors are given (not zero)", () => {
    const combos = generateVariantMatrix({ sizes: ["S", "M", "L"] });
    expect(combos).toHaveLength(3);
    expect(combos.every((c) => c.colorName === null)).toBe(true);
  });

  it("produces exactly one combination when no dimensions are given at all", () => {
    const combos = generateVariantMatrix({});
    expect(combos).toHaveLength(1);
    expect(combos[0]).toEqual({
      sizeLabel: null,
      colorName: null,
      garmentStyle: null,
      material: null,
      printLocation: null,
    });
  });

  it("multiplies across every provided dimension", () => {
    const combos = generateVariantMatrix({ sizes: ["S", "M"], colors: ["Black"], printLocations: ["front", "back"] });
    expect(combos).toHaveLength(4);
  });
});

describe("combinationKey", () => {
  it("is null-safe — two combinations differing only by undefined vs. explicit values still compare correctly", () => {
    const a = { sizeLabel: "M", colorName: null, garmentStyle: null, material: null, printLocation: null };
    const b = { sizeLabel: "M", colorName: null, garmentStyle: null, material: null, printLocation: null };
    expect(combinationKey(a)).toBe(combinationKey(b));
  });

  it("differs when any dimension differs", () => {
    const a = { sizeLabel: "M", colorName: "Black", garmentStyle: null, material: null, printLocation: null };
    const b = { sizeLabel: "M", colorName: "White", garmentStyle: null, material: null, printLocation: null };
    expect(combinationKey(a)).not.toBe(combinationKey(b));
  });
});

describe("findDuplicateCombinations", () => {
  it("finds no duplicates in a clean matrix", () => {
    const combos = generateVariantMatrix({ sizes: ["S", "M"], colors: ["Black", "White"] });
    expect(findDuplicateCombinations(combos)).toEqual([]);
  });

  it("finds an exact duplicate combination", () => {
    const combos = generateVariantMatrix({ sizes: ["S"], colors: ["Black"] });
    const withDuplicate = [...combos, ...combos];
    expect(findDuplicateCombinations(withDuplicate)).toHaveLength(1);
  });
});

describe("isDuplicateCombination", () => {
  it("detects a candidate that matches an existing combination", () => {
    const existing = generateVariantMatrix({ sizes: ["M"], colors: ["Black"] });
    expect(isDuplicateCombination(existing[0], existing)).toBe(true);
  });

  it("returns false for a genuinely new combination", () => {
    const existing = generateVariantMatrix({ sizes: ["M"], colors: ["Black"] });
    const candidate = { sizeLabel: "L", colorName: "Black", garmentStyle: null, material: null, printLocation: null };
    expect(isDuplicateCombination(candidate, existing)).toBe(false);
  });
});
