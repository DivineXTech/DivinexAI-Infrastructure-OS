import { describe, expect, it } from "vitest";
import { slugify, formatMinorUnits } from "./utils";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Small-Business Branding Kit")).toBe("small-business-branding-kit");
  });

  it("strips non-alphanumeric characters", () => {
    expect(slugify("Café & Co. — 2026!")).toBe("caf-co-2026");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Weird Title--  ")).toBe("weird-title");
  });
});

describe("formatMinorUnits", () => {
  it("formats whole-dollar amounts without decimals", () => {
    expect(formatMinorUnits(4900, "USD")).toBe("$49");
  });

  it("formats fractional amounts with decimals", () => {
    expect(formatMinorUnits(4999, "USD")).toBe("$49.99");
  });
});
