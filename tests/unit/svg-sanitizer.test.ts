import { describe, expect, it } from "vitest";

import { sanitizeSvgMarkup } from "@/lib/catalog/svg-sanitizer";

describe("sanitizeSvgMarkup", () => {
  it("accepts a plain, well-formed SVG unchanged (aside from sanitization passes finding nothing to remove)", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>';
    const result = sanitizeSvgMarkup(svg);
    expect(result.safe).toBe(true);
    expect(result.sanitized).toContain("<circle");
    expect(result.removedPatternNames).toEqual([]);
  });

  it("rejects input that isn't a well-formed <svg> document", () => {
    const result = sanitizeSvgMarkup("<div>not an svg</div>");
    expect(result.safe).toBe(false);
    expect(result.sanitized).toBe("");
  });

  it("strips a <script> tag entirely", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect /></svg>';
    const result = sanitizeSvgMarkup(svg);
    expect(result.safe).toBe(true);
    expect(result.sanitized).not.toContain("<script");
    expect(result.sanitized).not.toContain("alert(1)");
  });

  it("strips onload/onclick event handler attributes", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect onload="alert(1)" onclick=\'evil()\' /></svg>';
    const result = sanitizeSvgMarkup(svg);
    expect(result.sanitized).not.toMatch(/onload/i);
    expect(result.sanitized).not.toMatch(/onclick/i);
  });

  it("strips <foreignObject> and <iframe> content", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="https://evil.example"></iframe></foreignObject></svg>';
    const result = sanitizeSvgMarkup(svg);
    expect(result.sanitized).not.toContain("<foreignObject");
    expect(result.sanitized).not.toContain("<iframe");
  });

  it("neutralizes an external href/xlink:href, keeping only same-document fragment references", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/x.svg#y" /><use xlink:href="#local" /></svg>';
    const result = sanitizeSvgMarkup(svg);
    expect(result.sanitized).not.toContain("evil.example");
    expect(result.sanitized).toContain('xlink:href="#local"');
  });

  it("neutralizes a javascript: URI", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect /></a></svg>';
    const result = sanitizeSvgMarkup(svg);
    expect(result.sanitized).not.toContain("javascript:");
  });

  it("rejects empty input", () => {
    expect(sanitizeSvgMarkup("").safe).toBe(false);
    expect(sanitizeSvgMarkup("   ").safe).toBe(false);
  });
});
