import { describe, expect, it } from "vitest";

import { readImageInfo } from "@/lib/catalog/image-dimensions";

function buildPng(width: number, height: number, colorType: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([0, 0, 0, 13], 8); // IHDR data length = 13
  bytes.set([73, 72, 68, 82], 12); // "IHDR"
  bytes[16] = (width >>> 24) & 0xff;
  bytes[17] = (width >>> 16) & 0xff;
  bytes[18] = (width >>> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[20] = (height >>> 24) & 0xff;
  bytes[21] = (height >>> 16) & 0xff;
  bytes[22] = (height >>> 8) & 0xff;
  bytes[23] = height & 0xff;
  bytes[24] = 8; // bit depth
  bytes[25] = colorType;
  return bytes;
}

function buildJpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xc0, // SOF0
    0x00, 0x0b, // segment length (arbitrary, unused by the reader)
    0x08, // precision
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, // component count (unused)
    0x00, 0x00, 0x00,
  ]);
}

function buildWebpVp8x(width: number, height: number, hasAlpha: boolean): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  bytes.set([0x56, 0x50, 0x38, 0x58], 12); // "VP8X"
  bytes.set([10, 0, 0, 0], 16); // chunk size (LE)
  bytes[20] = hasAlpha ? 0x10 : 0x00;
  const w = width - 1;
  const h = height - 1;
  bytes[24] = w & 0xff;
  bytes[25] = (w >> 8) & 0xff;
  bytes[26] = (w >> 16) & 0xff;
  bytes[27] = h & 0xff;
  bytes[28] = (h >> 8) & 0xff;
  bytes[29] = (h >> 16) & 0xff;
  return bytes;
}

describe("readImageInfo — PNG", () => {
  it("reads width/height from IHDR and detects an alpha color type", () => {
    const info = readImageInfo(buildPng(800, 600, 6), "image/png");
    expect(info).toEqual({ widthPx: 800, heightPx: 600, hasTransparency: true });
  });

  it("reports unknown (null) transparency for a color type with no guaranteed alpha", () => {
    const info = readImageInfo(buildPng(400, 400, 2), "image/png");
    expect(info?.hasTransparency).toBeNull();
  });

  it("returns null for bytes that aren't actually a PNG", () => {
    expect(readImageInfo(new Uint8Array([1, 2, 3, 4]), "image/png")).toBeNull();
  });
});

describe("readImageInfo — JPEG", () => {
  it("reads width/height from the SOF0 marker and always reports no transparency", () => {
    const info = readImageInfo(buildJpeg(1024, 768), "image/jpeg");
    expect(info).toEqual({ widthPx: 1024, heightPx: 768, hasTransparency: false });
  });

  it("returns null for bytes that aren't actually a JPEG", () => {
    expect(readImageInfo(new Uint8Array([0, 0, 0, 0]), "image/jpeg")).toBeNull();
  });
});

describe("readImageInfo — WebP", () => {
  it("reads width/height and the alpha flag from a VP8X extended header", () => {
    const info = readImageInfo(buildWebpVp8x(300, 200, true), "image/webp");
    expect(info).toEqual({ widthPx: 300, heightPx: 200, hasTransparency: true });
  });

  it("reports no transparency when the VP8X alpha flag is unset", () => {
    const info = readImageInfo(buildWebpVp8x(300, 200, false), "image/webp");
    expect(info?.hasTransparency).toBe(false);
  });
});

describe("readImageInfo — SVG", () => {
  it("reads width/height attributes when present", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"></svg>';
    const info = readImageInfo(new TextEncoder().encode(svg), "image/svg+xml");
    expect(info).toEqual({ widthPx: 120, heightPx: 80, hasTransparency: true });
  });

  it("falls back to viewBox when explicit width/height are absent", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150"></svg>';
    const info = readImageInfo(new TextEncoder().encode(svg), "image/svg+xml");
    expect(info?.widthPx).toBe(300);
    expect(info?.heightPx).toBe(150);
  });

  it("returns null when neither width/height nor viewBox is present", () => {
    const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>";
    expect(readImageInfo(new TextEncoder().encode(svg), "image/svg+xml")).toBeNull();
  });
});
